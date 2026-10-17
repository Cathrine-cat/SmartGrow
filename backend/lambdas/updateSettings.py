import json
import os
from decimal import Decimal

import boto3


dynamodb = boto3.resource("dynamodb")
settings_table = dynamodb.Table(os.environ.get("SETTINGS_TABLE", "IrrigationSettings"))
devices_table = dynamodb.Table(os.environ.get("DEVICES_TABLE", "Devices"))
device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
allowed_fields = {"autoMode", "minIntervalHours", "wateringDuration", "thresholdMoisture"}


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

    values = {key: value for key, value in body.items() if key in allowed_fields}
    if not values:
        return response(400, {"message": "No settings were provided"})

    for key, value in values.items():
        if key == "autoMode":
            if not isinstance(value, bool):
                return response(400, {"message": "autoMode must be true or false"})
        else:
            try:
                number = Decimal(str(value))
            except Exception:
                return response(400, {"message": f"{key} must be a number"})
            if number < 0:
                return response(400, {"message": f"{key} cannot be negative"})
            if key == "thresholdMoisture" and number > 100:
                return response(400, {"message": "thresholdMoisture must be between 0 and 100"})
            values[key] = number

    names = {f"#f{i}": key for i, key in enumerate(values)}
    expression_values = {f":v{i}": value for i, value in enumerate(values.values())}
    updates = [f"#f{i} = :v{i}" for i in range(len(values))]
    result = settings_table.update_item(
        Key={"settingId": device_id},
        UpdateExpression="SET " + ", ".join(updates),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=expression_values,
        ReturnValues="ALL_NEW",
    )
    item = result.get("Attributes", {})
    item["deviceId"] = device_id
    return response(200, item)
