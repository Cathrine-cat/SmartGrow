import json
import os

import boto3


dynamodb = boto3.resource("dynamodb")
settings_table = dynamodb.Table(os.environ.get("SETTINGS_TABLE", "IrrigationSettings"))
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

    item = settings_table.get_item(Key={"settingId": device_id}).get("Item")
    if not item:
        # Show defaults until settings are saved for this device.
        item = {
            "settingId": device_id,
            "deviceId": device_id,
            "autoMode": False,
            "minIntervalHours": 2,
            "wateringDuration": 10,
            "thresholdMoisture": 70,
        }
    else:
        item["deviceId"] = device_id

    return response(200, item)
