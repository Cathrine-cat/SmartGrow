"""Replace the alert thresholds configured for one device."""

import json
import os
from decimal import Decimal, InvalidOperation

import boto3


dynamodb = boto3.resource("dynamodb")
conditions_table = dynamodb.Table(os.environ.get("NOTIFICATION_COND_TABLE", "NotificationCond"))
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
CONDITION_FIELDS = ("soilMin", "soilMax", "temperatureMin", "temperatureMax")


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
    }


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError):
        return response(400, {"message": "Invalid JSON body"})
    if not isinstance(body, dict):
        return response(400, {"message": "Body must be a JSON object"})

    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    params = event.get("queryStringParameters") or {}
    device_id = str(params.get("deviceId") or body.get("deviceId") or "").strip()

    if not user_id:
        return response(401, {"message": "Unauthorized"})
    if not device_id:
        return response(400, {"message": "deviceId is required"})

    device = devices_table.get_item(Key={device_key_name: device_id}).get("Item")
    if not device or device.get("userId") != user_id:
        return response(404, {"message": "Device not found"})

    item = {"id": device_id}
    for field in CONDITION_FIELDS:
        value = body.get(field, "")
        if value in (None, ""):
            continue
        if isinstance(value, bool):
            return response(400, {"message": f"{field} must be a number"})
        try:
            number = Decimal(str(value))
        except (InvalidOperation, ValueError):
            return response(400, {"message": f"{field} must be a number"})
        if not number.is_finite():
            return response(400, {"message": f"{field} must be finite"})
        if field.startswith("soil") and not Decimal("0") <= number <= Decimal("100"):
            return response(400, {"message": f"{field} must be between 0 and 100"})
        item[field] = number

    conditions_table.put_item(Item=item)
    conditions = {field: str(item[field]) if field in item else "" for field in CONDITION_FIELDS}
    return response(200, {"deviceId": device_id, "conditions": conditions})
