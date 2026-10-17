import json
import os
from datetime import datetime, timezone

import boto3


dynamodb = boto3.resource("dynamodb")
pump_table = dynamodb.Table(os.environ.get("PUMP_STATUS_TABLE", "pumpStatus"))
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")


def lambda_handler(event, context):
    device_id = str(event.get("id") or event.get("deviceId") or "").strip()
    if not device_id:
        return {"statusCode": 400, "body": "id is required"}
    if not devices_table.get_item(Key={device_key_name: device_id}).get("Item"):
        return {"statusCode": 404, "body": "Device not found"}

    status = str(event.get("status", "OFF")).upper()
    if status not in {"ON", "OFF"}:
        return {"statusCode": 400, "body": "status must be ON or OFF"}

    timestamp = event.get("timestamp") or datetime.now(timezone.utc).isoformat()
    item = {
        "id": device_id,
        "status": status,
        "source": event.get("source", "unknown"),
        "timestamp": timestamp,
        "duration": int(event.get("duration", 0) or 0),
    }
    pump_table.put_item(Item=item)
    return {"statusCode": 200, "body": json.dumps({"message": "Pump status saved", **item}, default=str)}
