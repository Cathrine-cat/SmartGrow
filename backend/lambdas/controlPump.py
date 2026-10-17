"""POST /control?deviceId=..."""

import json
import os

import boto3

from common import authorize_device, read_body, requested_device_id, response

iot_endpoint = os.environ.get("IOT_DATA_ENDPOINT")
iot = boto3.client("iot-data", endpoint_url=iot_endpoint) if iot_endpoint else boto3.client("iot-data")


def lambda_handler(event, context):
    try:
        body = read_body(event)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return response(400, {"message": "Request body must be a valid JSON object"})
    device_id = requested_device_id(event, body)
    _, error = authorize_device(event, device_id)
    if error:
        return error
    command = str(body.get("command", "")).upper()
    source = str(body.get("source", "manual"))
    try:
        duration = int(body.get("duration", 0))
    except (TypeError, ValueError):
        return response(400, {"message": "duration must be a positive integer"})
    if command not in {"ON", "OFF"}:
        return response(400, {"message": "command must be ON or OFF"})
    if duration <= 0 or duration > 3600:
        return response(400, {"message": "duration must be between 1 and 3600 seconds"})
    if source not in {"manual", "automatic"}:
        return response(400, {"message": "source must be manual or automatic"})

    topic = f"smart-irrigation/{device_id}/control"
    iot.publish(
        topic=topic,
        qos=1,
        payload=json.dumps({"deviceId": device_id, "command": command, "duration": duration, "source": source}),
    )
    return response(200, {"message": f"Command {command} sent", "deviceId": device_id})
