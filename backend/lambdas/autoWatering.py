import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr


dynamodb = boto3.resource("dynamodb")
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
settings_table = dynamodb.Table(os.environ.get("SETTINGS_TABLE", "IrrigationSettings"))
data_table = dynamodb.Table(os.environ.get("TELEMETRY_TABLE", "raspberryData"))
events_table = dynamodb.Table(os.environ.get("WATERING_EVENTS_TABLE", "wateringEvents"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
iot_endpoint = os.environ.get("IOT_DATA_ENDPOINT")
iot = boto3.client("iot-data", **({"endpoint_url": iot_endpoint} if iot_endpoint else {}))


def scan_device_rows(table, device_id):
    items = []
    last_key = None
    while True:
        args = {"FilterExpression": Attr("id").eq(device_id)}
        if last_key:
            args["ExclusiveStartKey"] = last_key
        result = table.scan(**args)
        items.extend(result.get("Items", []))
        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break
    return [item for item in items if item.get("id") == device_id and item.get("timestamp")]


def parse_time(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def lambda_handler(event, context):
    device_id = str(event.get("id") or event.get("deviceId") or "").strip()
    if not device_id or not devices_table.get_item(Key={device_key_name: device_id}).get("Item"):
        return {"statusCode": 200, "body": "Device not found; nothing to do"}

    settings = settings_table.get_item(Key={"settingId": device_id}).get("Item")
    if not settings or not settings.get("autoMode", False):
        return {"statusCode": 200, "body": "Automatic watering is off"}

    readings = scan_device_rows(data_table, device_id)
    readings.sort(key=lambda item: str(item["timestamp"]), reverse=True)
    if not readings or readings[0].get("soil") is None:
        return {"statusCode": 200, "body": "No usable sensor reading"}

    try:
        soil = Decimal(str(readings[0]["soil"]))
        threshold = Decimal(str(settings.get("thresholdMoisture", 70)))
    except Exception:
        return {"statusCode": 200, "body": "Sensor reading or threshold is unavailable"}
    if soil >= threshold:
        return {"statusCode": 200, "body": "Soil moisture is above the threshold"}

    events = scan_device_rows(events_table, device_id)
    if events:
        events.sort(key=lambda item: str(item["timestamp"]), reverse=True)
        last_time = parse_time(events[0]["timestamp"])
        if last_time:
            if last_time.tzinfo is None:
                last_time = last_time.replace(tzinfo=timezone.utc)
            min_hours = float(settings.get("minIntervalHours", 2))
            if datetime.now(timezone.utc) - last_time < timedelta(hours=min_hours):
                return {"statusCode": 200, "body": "Minimum watering interval has not elapsed"}

    duration = int(settings.get("wateringDuration", 10))
    iot.publish(
        topic=f"smart-irrigation/{device_id}/control",
        qos=1,
        payload=json.dumps({"deviceId": device_id, "command": "ON", "duration": duration}),
    )
    return {"statusCode": 200, "body": f"Automatic watering started for {device_id}"}
