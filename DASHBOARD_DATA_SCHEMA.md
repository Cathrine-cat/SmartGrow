# Device-scoped dashboard data

The web app sends the selected device ID as `deviceId` on data requests. Each response row must contain the same identifier in `id` (or the handler's response envelope must identify it as `deviceId`). Rows without an ID, or with another device's ID, are omitted.

| Table | Existing partition key | Device scoping |
| --- | --- | --- |
| `raspberryData` | `timestamp` | Scan with `id = selected device ID` |
| `wateringEvents` | `timestamp` | Scan with `id = selected device ID` |
| `pumpStatus` | `id` | `GetItem` using selected device ID |
| `IrrigationSettings` | `settingId` | `GetItem` using selected device ID |

The time-series tables do not have `id` as a key. This implementation uses a Scan filter, so it needs `dynamodb:Scan` permission and does not require a GSI or a new table. A Scan still reads the table to find matches, so use this while the tables are small. The Lambda deployment and API Gateway instructions are in [backend/lambdas/AWS_DEPLOYMENT.md](backend/lambdas/AWS_DEPLOYMENT.md).

For existing rows, only set `id` when you know which physical device produced that row. Rows without `id` remain hidden from device-scoped results.

Every user-facing data Lambda checks the Cognito JWT `sub` against the device's `userId` in `Devices`. API Gateway must use the app's JWT authorizer for those routes. The Plant Journal notification badge, `NotificationCond`, and notification endpoints are not part of this change.
