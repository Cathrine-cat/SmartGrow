import json
import os

import boto3
from boto3.dynamodb.conditions import Attr


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("TELEMETRY_TABLE", "raspberryData"))
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

    items = []
    last_key = None
    while True:
        scan_args = {"FilterExpression": Attr("id").eq(device_id)}
        if last_key:
            scan_args["ExclusiveStartKey"] = last_key
        result = table.scan(**scan_args)
        items.extend(result.get("Items", []))
        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

    # A missing id or timestamp is normal for older/incomplete rows: skip it.
    items = [item for item in items if item.get("id") == device_id and item.get("timestamp")]
    items.sort(key=lambda item: str(item["timestamp"]))
    items = items[-300:]

    return response(200, {"deviceId": device_id, "items": items})
