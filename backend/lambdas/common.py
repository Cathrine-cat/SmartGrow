"""Shared helpers for the device-scoped AWS Lambda handlers.

Package this file beside each handler module in the Lambda deployment ZIP.
"""

import base64
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr


logger = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")


class DecimalEncoder(json.JSONEncoder):
    def default(self, value):
        if isinstance(value, Decimal):
            return int(value) if value % 1 == 0 else float(value)
        return super().default(value)


def table_from_env(name, default=None):
    table_name = os.environ.get(name, default)
    if not table_name:
        raise RuntimeError(f"Set the {name} Lambda environment variable")
    return dynamodb.Table(table_name)


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def read_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    body = json.loads(raw)
    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object")
    return body


def claims_sub(event):
    context = event.get("requestContext", {})
    authorizer = context.get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims") or {}
    return claims.get("sub")


def requested_device_id(event, body=None):
    params = event.get("queryStringParameters") or {}
    body = body or {}
    value = params.get("deviceId") or body.get("deviceId")
    device_id = str(value or "").strip()
    return "" if device_id.lower() in {"null", "undefined"} else device_id


def authorize_device(event, device_id):
    """Return (user_sub, error_response); caller must use validated JWT claims."""
    user_id = claims_sub(event)
    if not user_id:
        return None, response(401, {"message": "Unauthorized"})
    if not device_id:
        return None, response(400, {"message": "deviceId is required"})

    devices = table_from_env("DEVICES_TABLE", "Devices")
    device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
    try:
        item = devices.get_item(Key={device_key_name: device_id}, ConsistentRead=True).get("Item")
    except Exception:
        logger.exception("Could not read device ownership")
        return None, response(500, {"message": "Device authorization failed"})
    if not item or item.get("userId") != user_id:
        return None, response(404, {"message": "Device not found"})
    return user_id, None


def trusted_device_id(event):
    """Read the device identifier supplied by the event trigger."""
    return str(event.get("deviceId") or event.get("id") or "").strip()


def device_exists(device_id):
    if not device_id:
        return False
    devices = table_from_env("DEVICES_TABLE", "Devices")
    device_key_name = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")
    return bool(devices.get_item(Key={device_key_name: device_id}).get("Item"))


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def put_time_series_item(table, item):
    """Insert without overwriting rows when the legacy table key is timestamp."""
    hash_key = table_hash_key_name(table)
    if hash_key != "timestamp":
        missing = [part["AttributeName"] for part in table.key_schema if part["AttributeName"] not in item]
        if missing:
            raise RuntimeError(
                f"Table {table.name} requires base key fields {missing}; map those fields in the writer"
            )
        table.put_item(Item=item)
        return

    # Existing supplied writers use timestamp as their only base key. Add
    # microseconds and condition the put so simultaneous devices never replace
    # one another's rows. No table key or index change is required.
    moment = datetime.now(timezone.utc)
    for _ in range(10):
        iso_time = moment.isoformat(timespec="microseconds").replace("+00:00", "Z")
        item["timestamp"] = iso_time
        try:
            table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(#pk)",
                ExpressionAttributeNames={"#pk": "timestamp"},
            )
            return
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            moment += timedelta(microseconds=1)
    raise RuntimeError("Could not allocate a unique timestamp key")


def table_hash_key_name(table):
    for element in table.key_schema:
        if element["KeyType"] == "HASH":
            return element["AttributeName"]
    raise RuntimeError(f"Table {table.name} has no partition key")


def query_device_rows(table, device_id, limit, descending=True):
    """Simple scan-based lookup. It scans the table but returns only this ID."""
    items = []
    last_key = None
    while True:
        args = {"FilterExpression": Attr("id").eq(device_id)}
        if last_key:
            args["ExclusiveStartKey"] = last_key
        result = table.scan(**args)
        items.extend(result.get("Items", []))
        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

    valid_items = []
    for stored_item in items:
        if stored_item.get("id") != device_id:
            continue
        raw_timestamp = stored_item.get("timestamp")
        normalized_timestamp = normalize_timestamp(raw_timestamp)
        if not normalized_timestamp:
            continue
        item = dict(stored_item)
        item["timestamp"] = normalized_timestamp
        valid_items.append(item)
    valid_items.sort(key=lambda item: item["timestamp"], reverse=descending)
    return valid_items[:limit]


def normalize_timestamp(value):
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo("Europe/Bucharest"))
    return parsed.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def telemetry_table():
    return table_from_env("TELEMETRY_TABLE", "raspberryData")


def watering_table():
    return table_from_env("WATERING_EVENTS_TABLE", "wateringEvents")


def settings_table():
    return table_from_env("SETTINGS_TABLE", "IrrigationSettings")


def pump_table():
    return table_from_env("PUMP_STATUS_TABLE", "pumpStatus")

