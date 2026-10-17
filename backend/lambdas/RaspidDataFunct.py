import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3


dynamodb = boto3.resource("dynamodb")
data_table = dynamodb.Table(os.environ.get("TELEMETRY_TABLE", "raspberryData"))
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")


def lambda_handler(event, context):
    device_id = str(event.get("id") or event.get("deviceId") or "").strip()
    if not device_id:
        return {"statusCode": 400, "body": "id is required"}

    device = devices_table.get_item(Key={device_key_name: device_id}).get("Item")
    if not device:
        return {"statusCode": 404, "body": "Device not found"}

    item = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z"),
        "id": device_id,
        "temperature": Decimal(str(event.get("temperature", 0))),
        "humidity": Decimal(str(event.get("humidity", 0))),
        "soil": Decimal(str(event.get("soil", 0))),
        "light": Decimal(str(event.get("light", 0))),
    }
    data_table.put_item(Item=item)
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Telemetry saved", "id": device_id, "timestamp": item["timestamp"]}),
    }
