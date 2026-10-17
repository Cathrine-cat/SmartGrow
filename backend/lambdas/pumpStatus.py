"""IoT Rule target for pump status updates (WebSocket broadcast removed)."""

from common import device_exists, pump_table, response, trusted_device_id, utc_now


def lambda_handler(event, context):
    device_id = trusted_device_id(event)
    if not device_exists(device_id):
        return response(400, {"message": "Unknown deviceId"})
    status = str(event.get("status", "")).upper()
    if status not in {"ON", "OFF"}:
        return response(400, {"message": "status must be ON or OFF"})
    timestamp = str(event.get("timestamp") or utc_now())
    item = {
        # The supplied getStatusData Lambda reads the status table by id.
        "id": device_id,
        "deviceId": device_id,
        "status": status,
        "isActuallyOn": status == "ON",
        "source": str(event.get("source", "unknown")),
        "timestamp": timestamp,
        "startTime": timestamp,
        "duration": int(event.get("duration", 0) or 0),
    }
    pump_table().put_item(Item=item)
    return response(200, {"message": "Pump status updated", "deviceId": device_id, "status": status})
