# Device-scoped dashboard data

Every sensor, settings, pump-status, and watering-history item must identify the device that produced it. Use the exact same string as the device registry's `deviceId`.

## Suggested DynamoDB keys

| Data | Partition key | Sort key | Query |
| --- | --- | --- | --- |
| Sensor readings and history | `deviceId` (String) | `timestamp` (String, ISO 8601 UTC) | Latest: descending, limit 1. Chart: descending, limit 300, then reverse for display. |
| Watering history | `deviceId` (String) | `timestamp` (String, ISO 8601 UTC) | Query only the requested recent period, limit 200. |
| Irrigation settings | `deviceId` (String) | — | `GetItem` for the selected device. |
| Pump status | `deviceId` (String) | — | `GetItem` for the selected device. |

The current web app sends `deviceId` to `/latest-data`, `/history`, `/settings`, `/pumpStatus`, `/watering-history`, and `/control`. Each Lambda for these routes must:

1. Read `deviceId` from the query string (or request body for a write).
2. Read the caller's Cognito `sub` from the HTTP API JWT authorizer.
3. Look up that ID in the devices registry and require `device.userId == sub`.
4. Query or update only rows for that `deviceId`.
5. Return `deviceId` in responses where practical, so the UI can detect a mismatched response.

Example for a time-series table whose partition key is `deviceId` and sort key is `timestamp`:

```python
result = telemetry.query(
    KeyConditionExpression=Key("deviceId").eq(device_id),
    ScanIndexForward=False,
    Limit=300,
)
rows = list(reversed(result.get("Items", [])))
```

Do not use `Scan` to load all sensor rows for a dashboard. The page refreshes live readings every 10 seconds and chart histories every 60 seconds. The browser also caps chart inputs at 300 readings and 200 watering events, but the Lambda should cap its DynamoDB response too.

## Existing rows without a device ID

First determine which physical device produced each existing row. Backfill that `deviceId` on every row; assigning the currently selected device to all rows is only correct if all those rows really came from that one device. New IoT messages should include `deviceId` from the device's provisioned identity.

If a table's current primary key is unsuitable, DynamoDB does not let `UpdateItem` change an item's primary-key attributes. Add a `deviceId` attribute and a GSI for the access pattern, or create a replacement table with the keys above and migrate the rows. A GSI will not return old rows until their `deviceId` key attribute has been populated.
