import json
import os

import boto3


dynamodb = boto3.resource("dynamodb")
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
iot = boto3.client("iot-data", endpoint_url=os.environ.get("IOT_DATA_ENDPOINT"))


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

    command = str(body.get("command", "")).upper()
    try:
        duration = int(body.get("duration", 0))
    except (TypeError, ValueError):
        return response(400, {"message": "duration must be a number"})
    if command not in {"ON", "OFF"} or duration <= 0:
        return response(400, {"message": "Provide command ON/OFF and a positive duration"})

    topic = f"smart-irrigation/{device_id}/control"
    iot.publish(
        topic=topic,
        qos=1,
        payload=json.dumps({"deviceId": device_id, "command": command, "duration": duration}),
    )
    return response(200, {"message": "Command sent", "deviceId": device_id})
