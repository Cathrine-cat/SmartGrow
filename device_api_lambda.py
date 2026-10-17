"""HTTP API Lambda for listing, claiming, editing, and unlinking devices.

Expected DynamoDB table:
  * Partition key: deviceId (String) by default; set DEVICE_TABLE_KEY_NAME=id
    if the partition key is named id and its value is the device identifier.
  * Attributes: userId (String, absent while unclaimed), passwordHash (String)
  * GSI: UserDevicesIndex, partition key userId (String)

Configure DEVICES_TABLE and USER_DEVICES_INDEX (optional). Protect every
route with the HTTP API JWT authorizer. API Gateway should handle CORS.
"""

import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import secrets
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
devices = dynamodb.Table(os.environ["DEVICES_TABLE"])
INDEX_NAME = os.environ.get("USER_DEVICES_INDEX", "UserDevicesIndex")
DEVICE_TABLE_KEY_NAME = os.environ.get("DEVICE_TABLE_KEY_NAME", "deviceId")


def device_key(device_id):
    return {DEVICE_TABLE_KEY_NAME: device_id}


def response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def now():
    return datetime.now(timezone.utc).isoformat()


def get_user_id(event):
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
        .get("sub")
    )


def read_body(event):
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")
    body = json.loads(raw_body)
    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object")
    return body


def hash_password(password):
    """Hash new device passwords with scrypt and a fresh random salt."""
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=32,
    )
    salt_text = base64.b64encode(salt).decode("ascii")
    hash_text = base64.b64encode(derived).decode("ascii")
    return f"scrypt$16384$8$1${salt_text}${hash_text}"


def verify_password(password, stored_hash):
    """Verify legacy SHA-256 hex hashes and current salted scrypt hashes."""
    if not isinstance(password, str) or not isinstance(stored_hash, str):
        return False

    legacy_hash = stored_hash.strip()
    for prefix in ("sha256$", "sha256:"):
        if legacy_hash.lower().startswith(prefix):
            legacy_hash = legacy_hash[len(prefix):]
            break

    # Existing devices may have hashlib.sha256(password.encode()).hexdigest().
    if len(legacy_hash) == 64:
        try:
            bytes.fromhex(legacy_hash)
        except ValueError:
            pass
        else:
            candidate = hashlib.sha256(password.encode("utf-8")).hexdigest()
            return hmac.compare_digest(candidate.lower(), legacy_hash.lower())

    # New and previously migrated device credentials use the scrypt format.
    try:
        algorithm, n_text, r_text, p_text, salt_text, expected_text = stored_hash.split("$", 5)
        if algorithm != "scrypt":
            return False

        salt = base64.b64decode(salt_text, validate=True)
        expected = base64.b64decode(expected_text, validate=True)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n_text),
            r=int(r_text),
            p=int(p_text),
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


def public_device(item):
    """Never return password hashes or internal account fields."""
    allowed_fields = (
        "deviceId",
        "name",
        "location",
        "createdAt",
        "modifiedAt",
        "alertSettings",
    )
    result = {field: item[field] for field in allowed_fields if field in item}
    if not result.get("deviceId"):
        result["deviceId"] = item.get("id")
    return result


def device_id_from_path(event):
    return str((event.get("pathParameters") or {}).get("deviceId") or "").strip()


def lambda_handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return response(401, {"message": "Unauthorized"})

    request_context = event.get("requestContext", {})
    method = request_context.get("http", {}).get("method", "").upper()
    path = event.get("rawPath", "")

    try:
        # GET /devices: list only the signed-in user's linked devices.
        if method == "GET" and path == "/devices":
            records = []
            result = devices.query(
                IndexName=INDEX_NAME,
                KeyConditionExpression=Key("userId").eq(user_id),
            )
            records.extend(public_device(item) for item in result.get("Items", []))
            while result.get("LastEvaluatedKey"):
                result = devices.query(
                    IndexName=INDEX_NAME,
                    KeyConditionExpression=Key("userId").eq(user_id),
                    ExclusiveStartKey=result["LastEvaluatedKey"],
                )
                records.extend(public_device(item) for item in result.get("Items", []))
            return response(200, {"devices": records, "count": len(records)})

        # GET /devices/verify?deviceId=...: check whether an unlinked device
        # can be claimed, without disclosing its details.
        if method == "GET" and path == "/devices/verify":
            params = event.get("queryStringParameters") or {}
            requested_id = str(params.get("deviceId") or "").strip()
            if not requested_id:
                return response(400, {"message": "deviceId is required"})
            item = devices.get_item(
                Key=device_key(requested_id), ConsistentRead=True
            ).get("Item")
            available = bool(item and item.get("passwordHash") and not item.get("userId"))
            return response(200, {"exists": available})

        # POST /devices/claim: verify the device password and claim atomically.
        if method == "POST" and path == "/devices/claim":
            body = read_body(event)
            requested_id = str(body.get("deviceId") or "").strip()
            password = body.get("password")
            if not requested_id or not isinstance(password, str) or not password:
                return response(400, {"message": "deviceId and password are required"})

            item = devices.get_item(
                Key=device_key(requested_id), ConsistentRead=True
            ).get("Item")
            if (
                not item
                or not item.get("passwordHash")
                or item.get("userId")
                or not verify_password(password, item["passwordHash"])
            ):
                return response(400, {
                    "message": "Device ID or password is invalid, or device is unavailable."
                })

            timestamp = now()
            try:
                devices.update_item(
                    Key=device_key(requested_id),
                    UpdateExpression="SET userId = :uid, modifiedAt = :ts",
                    ConditionExpression=(
                        "attribute_not_exists(userId) AND passwordHash = :oldHash"
                    ),
                    ExpressionAttributeValues={
                        ":uid": user_id,
                        ":ts": timestamp,
                        ":oldHash": item["passwordHash"],
                    },
                )
            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(409, {"message": "This device is no longer available to claim."})
                raise

            claimed = {**item, "userId": user_id, "modifiedAt": timestamp}
            return response(201, {
                "message": "Device linked successfully",
                "device": public_device(claimed),
            })

        # POST /devices/{deviceId}/verify-password: verify the current password
        # before the UI reveals the new-password fields.
        if method == "POST" and path.endswith("/verify-password"):
            requested_id = device_id_from_path(event)
            password = read_body(event).get("currentPassword")
            if not requested_id or not isinstance(password, str) or not password:
                return response(400, {"message": "currentPassword is required"})

            item = devices.get_item(
                Key=device_key(requested_id), ConsistentRead=True
            ).get("Item")
            if not item or item.get("userId") != user_id:
                return response(404, {"message": "Device not found."})
            valid = verify_password(password, item.get("passwordHash", ""))
            return response(200, {"valid": valid})

        # PATCH /devices/{deviceId}: update name/location and optionally the
        # password. Passwords are always hashed in the Lambda, never in React.
        if method == "PATCH" and path.startswith("/devices/"):
            requested_id = device_id_from_path(event)
            if not requested_id or requested_id in ("verify", "claim"):
                return response(400, {"message": "Invalid device ID"})

            body = read_body(event)
            allowed = {"name", "location", "currentPassword", "newPassword", "alertSettings"}
            if set(body) - allowed:
                return response(400, {"message": "Unsupported field supplied"})

            updates = {}
            if "name" in body:
                name = body["name"]
                if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
                    return response(400, {"message": "Name must contain 1–100 characters"})
                updates["name"] = name.strip()

            if "location" in body:
                location = body["location"]
                if not isinstance(location, str) or len(location.strip()) > 200:
                    return response(400, {"message": "Location must be at most 200 characters"})
                updates["location"] = location.strip()

            if "alertSettings" in body:
                settings = body["alertSettings"]
                allowed_thresholds = {"soilMin", "soilMax", "temperatureMin", "temperatureMax"}
                if not isinstance(settings, dict) or set(settings) - allowed_thresholds:
                    return response(400, {"message": "Invalid alert settings."})
                normalized = {}
                for field, value in settings.items():
                    if value in (None, ""):
                        continue
                    try:
                        number = float(value)
                    except (TypeError, ValueError):
                        return response(400, {"message": f"{field} must be a number."})
                    if field.startswith("soil") and not 0 <= number <= 100:
                        return response(400, {"message": f"{field} must be between 0 and 100."})
                    normalized[field] = number
                updates["alertSettings"] = normalized

            changing_password = "newPassword" in body
            current_hash = None
            if changing_password:
                current_password = body.get("currentPassword")
                new_password = body.get("newPassword")
                if not isinstance(current_password, str) or not current_password:
                    return response(400, {"message": "Enter your current device password."})
                # No length or strength policy for device passwords; empty is
                # reserved to mean that the caller did not request a change.
                if not isinstance(new_password, str) or not new_password:
                    return response(400, {"message": "New device password cannot be empty."})

                item = devices.get_item(
                    Key=device_key(requested_id), ConsistentRead=True
                ).get("Item")
                if (
                    not item
                    or item.get("userId") != user_id
                    or not verify_password(current_password, item.get("passwordHash", ""))
                ):
                    return response(400, {"message": "Current device password is incorrect."})
                current_hash = item["passwordHash"]
                updates["passwordHash"] = hash_password(new_password)

            if not updates:
                return response(400, {"message": "Provide a name, location, or new password."})

            updates["modifiedAt"] = now()
            expression_names = {}
            expression_values = {":uid": user_id}
            assignments = []
            for index, (field, value) in enumerate(updates.items()):
                name_token = f"#f{index}"
                value_token = f":v{index}"
                expression_names[name_token] = field
                expression_values[value_token] = value
                assignments.append(f"{name_token} = {value_token}")

            condition = "userId = :uid"
            if changing_password:
                expression_values[":oldHash"] = current_hash
                condition += " AND passwordHash = :oldHash"

            try:
                result = devices.update_item(
                    Key=device_key(requested_id),
                    UpdateExpression="SET " + ", ".join(assignments),
                    ConditionExpression=condition,
                    ExpressionAttributeNames=expression_names,
                    ExpressionAttributeValues=expression_values,
                    ReturnValues="ALL_NEW",
                )
            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {"message": "Device not found or no longer available."})
                raise

            return response(200, {
                "message": "Device updated successfully",
                "device": public_device(result["Attributes"]),
            })

        # DELETE /devices/{deviceId}: unlink it, preserving its registry row.
        if method == "DELETE" and path.startswith("/devices/"):
            requested_id = device_id_from_path(event)
            if not requested_id or requested_id in ("verify", "claim"):
                return response(400, {"message": "Invalid device ID"})
            try:
                devices.update_item(
                    Key=device_key(requested_id),
                    UpdateExpression="SET modifiedAt = :ts REMOVE userId",
                    ConditionExpression="userId = :uid",
                    ExpressionAttributeValues={":uid": user_id, ":ts": now()},
                )
            except ClientError as error:
                if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    return response(404, {"message": "Device not found."})
                raise
            return response(200, {"message": "Device unlinked successfully"})

        return response(404, {"message": "Route not found"})

    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return response(400, {"message": "Request body must be a valid JSON object"})
    except Exception:
        logger.exception("Unexpected Device API error")
        return response(500, {"message": "Internal server error"})
