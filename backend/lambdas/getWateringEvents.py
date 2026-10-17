"""GET /watering-history?deviceId=..."""

from common import authorize_device, query_device_rows, requested_device_id, response, watering_table


def lambda_handler(event, context):
    device_id = requested_device_id(event)
    _, error = authorize_device(event, device_id)
    if error:
        return error
    rows = query_device_rows(watering_table(), device_id, 200)
    return response(200, {"deviceId": device_id, "items": rows})
