import json
import os

import boto3


dynamodb = boto3.resource("dynamodb")
pump_table = dynamodb.Table(os.environ.get("PUMP_STATUS_TABLE", "pumpStatus"))
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
    }


def lambda_handler(event, context):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    params = event.get("queryStringParameters") or {}
    device_id = str(params.get("deviceId") or "").strip()

    if not user_id:
        return response(401, {"message": "Unauthorized"})
    if not device_id:
        return response(400, {"message": "deviceId is required"})
    device = devices_table.get_item(Key={device_key_name: device_id}).get("Item")
    if not device or device.get("userId") != user_id:
        return response(404, {"message": "Device not found"})

    item = pump_table.get_item(Key={"id": device_id}).get("Item")
    if not item:
        item = {"id": device_id, "status": "OFF", "duration": 0}
    item["deviceId"] = device_id
    item["isActuallyOn"] = str(item.get("status", "OFF")).upper() == "ON"
    item.setdefault("startTime", item.get("timestamp"))
    return response(200, item)
