"""GET /settings?deviceId=..."""

from botocore.exceptions import ClientError

from common import authorize_device, response, requested_device_id, settings_table

DEFAULT_SETTINGS = {
    "autoMode": False,
    "minIntervalHours": 2,
    "wateringDuration": 10,
    "thresholdMoisture": 70,
}


def lambda_handler(event, context):
    device_id = requested_device_id(event)
    _, error = authorize_device(event, device_id)
    if error:
        return error

    table = settings_table()
    # The supplied getSettings Lambda already uses settingId as the table key.
    item = table.get_item(Key={"settingId": device_id}).get("Item")
    if not item:
        # Do not write a shared "main" row; each device gets its own settings key.
        item = {"settingId": device_id, **DEFAULT_SETTINGS}
        try:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(settingId)")
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            item = table.get_item(Key={"settingId": device_id}).get("Item") or item
    item["deviceId"] = device_id
    return response(200, item)
