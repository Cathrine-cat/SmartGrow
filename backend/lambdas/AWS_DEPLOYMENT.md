# Deploy the device ID Lambda changes

This is the simple version: it keeps your current DynamoDB tables and keys, adds no indexes or tables, and does not include `NotificationCond` or notification APIs.

Your confirmed table keys:

| Table | Existing partition key | How the code uses it |
| --- | --- | --- |
| `raspberryData` | `timestamp` | Scans and keeps only rows where `id` equals the selected device ID |
| `wateringEvents` | `timestamp` | Scans and keeps only rows where `id` equals the selected device ID |
| `pumpStatus` | `id` | Reads/writes one item using `id = deviceId` |
| `IrrigationSettings` | `settingId` | Reads/writes one item using `settingId = deviceId` |

`id` is an ordinary attribute on the first two tables; it is not their partition key. The read Lambdas use DynamoDB `Scan` with a filter, so you do **not** create a GSI. Rows with no `id` are excluded. Only add an `id` to an old row when you know which device created it.

This Scan approach is suitable while the tables are small. DynamoDB still scans the table to find matching rows, so the read cost and time grow with the whole table. You can move to a GSI later if this becomes too large.

## 1. Check device IDs and table keys

1. In AWS Console, select the region that contains your app's tables.
2. Open **DynamoDB → Tables** and check the key names match the table above.
3. Open `Devices` and check its partition key. The code supports either `id` or `deviceId`; use that exact name in `DEVICE_TABLE_KEY_NAME`. The partition-key value must be the same identifier the web app sends as `deviceId` (as in your sample). If `id` is an unrelated internal row ID and `deviceId` is a different value, this direct lookup must be changed to match your schema.
4. In `raspberryData` and `wateringEvents`, verify that each row you want to show has an `id` attribute containing the exact device ID shown in `Devices`. Rows without this attribute cannot be safely assigned automatically.

The app sends the selected identifier as `?deviceId=...`. The Lambda uses the Cognito user's `sub` claim to check ownership in `Devices` before returning device data.

## 2. Upload the Lambda code

The `from common import ...` lines import the local file `common.py` in this folder. It is a helper file included with these Lambdas; it is not an AWS module or an existing Lambda layer. Keep `common.py` beside the handler files in the deployment ZIP.

From the project root in PowerShell, create the ZIP:

```powershell
Compress-Archive -Path .\backend\lambdas\*.py -DestinationPath .\backend\lambdas\device-lambdas.zip -Force
```

Open the ZIP and confirm the `.py` files, including `common.py`, are at the ZIP's top level. In AWS, for each function below:

1. Open **Lambda → Functions → function name → Code**.
2. Choose **Upload from → .zip file**, select `backend\lambdas\device-lambdas.zip`, then choose **Save**.
3. Under **Runtime settings → Edit**, select Python 3.12 and set the handler from the table below.

Use the same ZIP for each function. Set a function's handler to the module it runs:

| Function | Runtime handler |
| --- | --- |
| `getSensorData` | `getSensorData.lambda_handler` |
| `getHistory` | `getHistory.lambda_handler` |
| `getWateringEvents` | `getWateringEvents.lambda_handler` |
| `getSettings` | `getSettings.lambda_handler` |
| `updateSettings` | `updateSettings.lambda_handler` |
| `getStatusData` | `getStatusData.lambda_handler` |
| `controlPump` | `controlPump.lambda_handler` |
| `RaspidDataFunct` | `RaspidDataFunct.lambda_handler` |
| `storeWateringEvent` | `storeWateringEvent.lambda_handler` |
| `pumpStatus` | `pumpStatus.lambda_handler` |
| `autoWatering` | `autoWatering.lambda_handler` |

## 3. Set Lambda environment variables

In each function, open **Configuration → Environment variables → Edit**. Add only the variables that function needs. Table names are case-sensitive.

| Variable | Value |
| --- | --- |
| `DEVICES_TABLE` | Your existing device registry table name, usually `Devices` |
| `DEVICE_TABLE_KEY_NAME` | The exact `Devices` partition key: `id` or `deviceId` |
| `TELEMETRY_TABLE` | `raspberryData` |
| `WATERING_EVENTS_TABLE` | `wateringEvents` |
| `PUMP_STATUS_TABLE` | `pumpStatus` |
| `SETTINGS_TABLE` | `IrrigationSettings` |
| `IOT_DATA_ENDPOINT` | Optional; set the IoT data endpoint for `controlPump` and `autoWatering` when you configure IoT Core |

Set `DEVICES_TABLE` and `DEVICE_TABLE_KEY_NAME` on all functions that call `Devices`: all API read/write functions, `RaspidDataFunct`, `storeWateringEvent`, `pumpStatus`, and `autoWatering`. Set the table-specific variables on functions accessing those tables. The code defaults the four data table names shown above.

Also set `DEVICE_TABLE_KEY_NAME` on the existing device-management Lambda (`device_api_lambda.py`) if its `Devices` table key is `id`. The default remains `deviceId` for compatibility with the current project code. That Lambda still needs its existing `UserDevicesIndex` GSI on `userId` for listing a user's devices; do not create another one if it already works.

If `Devices` uses partition key `id`, deploy the updated `device_api_lambda.py` separately because it is outside the Lambda source folder:

```powershell
Compress-Archive -Path .\device_api_lambda.py -DestinationPath .\backend\lambdas\device-api-lambda.zip -Force
```

Upload that ZIP to the existing device-management Lambda, set its handler to `device_api_lambda.lambda_handler`, and set `DEVICE_TABLE_KEY_NAME=id`. Keep its existing `DEVICES_TABLE` and `USER_DEVICES_INDEX` values. If the table key is `deviceId`, leave the existing device-management Lambda code and key setting as `deviceId`.

## 4. Give each Lambda table permissions

In **Lambda → function → Configuration → Permissions → Execution role**, open the role in IAM. Attach `AWSLambdaBasicExecutionRole` for CloudWatch logs. Then add only the table actions for that function. Use each table's ARN from **DynamoDB → table → Overview**.

All user-facing API Lambdas below need `dynamodb:GetItem` on the `Devices` table to verify that the signed-in user owns the requested device.

| Function | Additional DynamoDB permissions |
| --- | --- |
| `getSensorData`, `getHistory` | `dynamodb:Scan` on `raspberryData` |
| `getWateringEvents` | `dynamodb:Scan` on `wateringEvents` |
| `getSettings` | `dynamodb:GetItem`, `dynamodb:PutItem` on `IrrigationSettings` |
| `updateSettings` | `dynamodb:UpdateItem` on `IrrigationSettings` |
| `getStatusData` | `dynamodb:GetItem` on `pumpStatus` |
| `controlPump` | No additional DynamoDB permission; add IoT publish permission when you configure IoT Core |
| `RaspidDataFunct` | `dynamodb:PutItem` on `raspberryData` |
| `storeWateringEvent` | `dynamodb:PutItem` on `wateringEvents` |
| `pumpStatus` | `dynamodb:PutItem` on `pumpStatus` |
| `autoWatering` | `dynamodb:GetItem` on `IrrigationSettings`; `dynamodb:Scan` on `raspberryData` and `wateringEvents`; add IoT publish permission when you configure IoT Core |

For `Scan`, grant the action on the table ARN itself. These functions do not need `dynamodb:Query` or index ARNs. The IoT-triggered writers also check that the given ID exists in `Devices`, so they need `dynamodb:GetItem` on that table too.

## 5. Configure API Gateway

The React app already sends `deviceId` in the query string for the device data routes. Keep the route paths below and connect each route to the matching Lambda. In **API Gateway → your HTTP API → Routes**, create any missing route and choose **Attach integration**:

| Route | Lambda integration |
| --- | --- |
| `GET /latest-data` | `getSensorData` |
| `GET /history` | `getHistory` |
| `GET /watering-history` | `getWateringEvents` |
| `GET /settings` | `getSettings` |
| `POST /settings` | `updateSettings` |
| `GET /pumpStatus` | `getStatusData` |
| `POST /control` | `controlPump` |
| `GET /devices` | Keep your existing device-list integration |

For these routes:

1. Open **Authorization → Manage authorizers**. Create or select a **JWT authorizer**.
2. Set the identity source to `$request.header.Authorization`.
3. Use your Cognito user pool's issuer URL and the app client's audience. Use the same Cognito pool/client as the web app.
4. Select that authorizer for every route in the table, including POST routes. The Lambda checks the authorized token's `sub` against `Devices.userId`.
5. Under **CORS**, allow the deployed web app origin, methods `GET, POST, PATCH, DELETE, OPTIONS`, and headers `Authorization, Content-Type`.
6. Save. If auto-deploy is off, deploy the API stage used by the web app.

The Lambda functions use proxy responses. Example requests:

```text
GET /latest-data?deviceId=DEVICE123
GET /history?deviceId=DEVICE123
POST /control?deviceId=DEVICE123
```

The control request body is JSON, for example:

```json
{"command":"ON","duration":10,"source":"manual"}
```

No API Gateway route is needed for `RaspidDataFunct`, `storeWateringEvent`, `pumpStatus`, or `autoWatering` as part of this step. The first three are event handlers; connect them to IoT Core later. `autoWatering` is invoked by EventBridge Scheduler if you use automatic watering. `controlPump` needs IoT Core configuration before its command can reach the Raspberry Pi.

## 6. Point the web app at the API and publish it

The dashboard and Plant Journal include the selected `deviceId` in their data requests and ignore rows with a missing or different ID. The existing API URL is the default in `src/IrrigationDashboard.js`; if your deployed API URL differs, set `REACT_APP_API_BASE_URL` in the app's environment to the API Gateway invoke URL, including its stage path if present, then rebuild and redeploy the web app.

After the Lambdas and routes are updated, sign in and check:

1. Choose a device that has rows with `id` matching its ID; its latest reading/history/events should appear.
2. Choose another device; only rows with that device's `id` should appear.
3. Check old rows without `id`; they should not appear until you can safely add the correct ID.
4. Try requesting another user's device ID while signed in; the API should return 404 (or the API Gateway authorizer should reject an invalid token).

The Plant Journal notification badge and `NotificationCond` endpoints are not part of this rollout. Its existing device-specific alert settings remain on the device record until you add that feature later.
