"""GET /pumpStatus?deviceId=..."""

from common import authorize_device, pump_table, requested_device_id, response


def lambda_handler(event, context):
    device_id = requested_device_id(event)
    _, error = authorize_device(event, device_id)
    if error:
        return error
    # The supplied pumpStatus writer uses id as the status table key.
    item = pump_table().get_item(Key={"id": device_id}).get("Item")
    if not item:
        return response(200, {"id": device_id, "deviceId": device_id, "status": "OFF", "isActuallyOn": False})
    item["deviceId"] = device_id
    item["isActuallyOn"] = str(item.get("status", "OFF")).upper() == "ON"
    item.setdefault("startTime", item.get("timestamp"))
    return response(200, item)
