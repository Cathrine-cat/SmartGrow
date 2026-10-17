"""POST /settings?deviceId=..."""

import json
from decimal import Decimal, InvalidOperation

from common import authorize_device, read_body, requested_device_id, response, settings_table

ALLOWED = {"autoMode", "minIntervalHours", "wateringDuration", "thresholdMoisture"}


def lambda_handler(event, context):
    try:
        body = read_body(event)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return response(400, {"message": "Request body must be a valid JSON object"})
    if set(body) - ALLOWED:
        return response(400, {"message": "Unsupported settings field supplied"})
    device_id = requested_device_id(event, body)
    _, error = authorize_device(event, device_id)
    if error:
        return error
    values = {key: value for key, value in body.items() if key in ALLOWED}
    if not values:
        return response(400, {"message": "Provide at least one supported setting"})
    if "autoMode" in values and not isinstance(values["autoMode"], bool):
        return response(400, {"message": "autoMode must be true or false"})
    for key in ALLOWED - {"autoMode"}:
        if key in values:
            try:
                number = Decimal(str(values[key]))
            except (InvalidOperation, TypeError, ValueError):
                return response(400, {"message": f"{key} must be a number"})
            if not number.is_finite() or number < 0:
                return response(400, {"message": f"{key} must be a non-negative number"})
            values[key] = number
    if "wateringDuration" in values and values["wateringDuration"] <= 0:
        return response(400, {"message": "wateringDuration must be greater than zero"})
    if "thresholdMoisture" in values and values["thresholdMoisture"] > 100:
        return response(400, {"message": "thresholdMoisture must be between 0 and 100"})

    names = {f"#f{i}": key for i, key in enumerate(values)}
    expr_values = {f":v{i}": value for i, value in enumerate(values.values())}
    assignments = [f"#f{i} = :v{i}" for i in range(len(values))]
    table = settings_table()
    result = table.update_item(
        Key={"settingId": device_id},
        UpdateExpression="SET " + ", ".join(assignments),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=expr_values,
        ReturnValues="ALL_NEW",
    )
    item = dict(result["Attributes"])
    item["deviceId"] = device_id
    return response(200, {"message": "Settings updated", **item})
