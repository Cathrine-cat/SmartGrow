"""IoT Rule target for Raspberry Pi telemetry (not an API Gateway route).

Configure the IoT SQL rule to set deviceId from the restricted topic, e.g.:
SELECT temperature, humidity, soil, light, topic(2) AS deviceId
FROM 'smart-irrigation/+/telemetry'
"""

from decimal import Decimal, InvalidOperation

from common import device_exists, put_time_series_item, response, telemetry_table, trusted_device_id


def as_number(value, field):
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field} must be numeric")
    if not number.is_finite():
        raise ValueError(f"{field} must be finite")
    return number


def lambda_handler(event, context):
    device_id = trusted_device_id(event)
    if not device_exists(device_id):
        return response(400, {"message": "Unknown deviceId; check the IoT Rule and Devices registry"})

    try:
        item = {
            "id": device_id,
            "deviceId": device_id,
            "temperature": as_number(event.get("temperature", 0), "temperature"),
            "humidity": as_number(event.get("humidity", 0), "humidity"),
            "soil": as_number(event.get("soil", 0), "soil"),
            "light": as_number(event.get("light", 0), "light"),
        }
    except ValueError as error:
        return response(400, {"message": str(error)})

    # The legacy table's base partition key is timestamp. The helper assigns a
    # unique, sortable timestamp so simultaneous devices cannot overwrite rows.
    put_time_series_item(telemetry_table(), item)
    return response(200, {"message": "Telemetry stored", "deviceId": device_id, "timestamp": item["timestamp"]})
