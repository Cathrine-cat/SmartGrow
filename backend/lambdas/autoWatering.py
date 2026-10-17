"""EventBridge target. Invoke once per device with {"deviceId": "..."}."""

import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

import boto3

from common import device_exists, query_device_rows, settings_table, telemetry_table, utc_now, watering_table


iot_endpoint = os.environ.get("IOT_DATA_ENDPOINT")
iot = boto3.client("iot-data", endpoint_url=iot_endpoint) if iot_endpoint else boto3.client("iot-data")


def parse_timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo("Europe/Bucharest"))
    return parsed.astimezone(timezone.utc)


def lambda_handler(event, context):
    device_id = str(event.get("deviceId") or event.get("id") or "").strip()
    if not device_exists(device_id):
        return {"statusCode": 400, "body": "Unknown or missing deviceId"}

    settings = settings_table().get_item(Key={"settingId": device_id}).get("Item")
    if not settings or not settings.get("autoMode", False):
        return {"statusCode": 200, "body": "Auto mode disabled or settings missing"}

    readings = query_device_rows(telemetry_table(), device_id, 1)
    if not readings:
        return {"statusCode": 200, "body": "No sensor reading"}
    try:
        soil = Decimal(str(readings[0]["soil"]))
        threshold = Decimal(str(settings.get("thresholdMoisture", 70)))
    except (KeyError, InvalidOperation, TypeError, ValueError):
        return {"statusCode": 400, "body": "Invalid soil or threshold value"}
    if soil >= threshold:
        return {"statusCode": 200, "body": "Soil moisture is above the watering threshold"}

    events = query_device_rows(watering_table(), device_id, 1)
    if events:
        last_time = parse_timestamp(events[0].get("timestamp"))
        min_hours = Decimal(str(settings.get("minIntervalHours", 2)))
        if last_time and datetime.now(timezone.utc) - last_time < timedelta(hours=float(min_hours)):
            return {"statusCode": 200, "body": "Minimum watering interval has not elapsed"}

    duration = int(settings.get("wateringDuration", 10))
    topic = f"smart-irrigation/{device_id}/control"
    iot.publish(
        topic=topic,
        qos=1,
        payload=json.dumps({
            "deviceId": device_id,
            "command": "ON",
            "duration": duration,
            "source": "automatic",
            "threshold": float(threshold),
        }),
    )
    return {"statusCode": 200, "body": f"Automatic watering started for {device_id} at {utc_now()}"}
