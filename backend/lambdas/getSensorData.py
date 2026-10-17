"""GET /latest-data?deviceId=..."""

from common import authorize_device, query_device_rows, requested_device_id, response, telemetry_table


def lambda_handler(event, context):
    device_id = requested_device_id(event)
    _, error = authorize_device(event, device_id)
    if error:
        return error
    rows = query_device_rows(telemetry_table(), device_id, 1)
    if not rows:
        return response(404, {"message": "No sensor data found", "deviceId": device_id})
    item = dict(rows[0])
    item["deviceId"] = device_id
    return response(200, item)
