"""IoT Rule target for completed/started watering events (no push notifications)."""

from decimal import Decimal, InvalidOperation

from common import device_exists, put_time_series_item, response, trusted_device_id, watering_table


def lambda_handler(event, context):
    device_id = trusted_device_id(event)
    if not device_exists(device_id):
        return response(400, {"message": "Unknown deviceId"})
    try:
        duration = Decimal(str(event["duration"]))
    except (KeyError, InvalidOperation, TypeError, ValueError):
        return response(400, {"message": "duration is required and must be numeric"})
    if not duration.is_finite() or duration <= 0:
        return response(400, {"message": "duration must be greater than zero"})

    item = {
        "id": device_id,
        "deviceId": device_id,
        "source": str(event.get("source", "unknown")),
        "duration": duration,
        "event": str(event.get("event", "Watering")),
    }
    put_time_series_item(watering_table(), item)
    return response(200, {"message": "Watering event stored", "deviceId": device_id, "timestamp": item["timestamp"]})
