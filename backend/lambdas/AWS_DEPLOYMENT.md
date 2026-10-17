# Simple device ID setup

## What this changes

It keeps your current tables and keys. It adds no DynamoDB indexes or tables. Rows in `raspberryData` and `wateringEvents` are shown only when `id` matches the selected device. Rows without `id` are silently ignored. If there is no reading, the dashboard stays open and shows dashes.

| Table | Key already in your table | Used by the code |
| --- | --- | --- |
| `raspberryData` | `timestamp` | Scan rows and keep `id == deviceId` |
| `wateringEvents` | `timestamp` | Scan rows and keep `id == deviceId` |
| `pumpStatus` | `id` | Read/write by device ID |
| `IrrigationSettings` | `settingId` | Read/write by device ID |

## Do these AWS steps

### 1. Check old rows

In **DynamoDB → Tables**, make sure the table keys above match. In `raspberryData` and `wateringEvents`, rows with a correct `id` will appear. Leave rows without an `id` alone unless you know which device made them.

### 2. Upload the Lambda ZIP

Open **Lambda → Functions → [function] → Code → Upload from → .zip file**. Upload [device-lambdas.zip](device-lambdas.zip) to each function below. Under **Runtime settings**, set its handler as shown:

| Function | Handler |
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

Use Python 3.12. Each Lambda is a separate Python file in the ZIP; there is no shared helper to copy or configure.

### 3. Set the device table name and key

For each function that reads `Devices`, open **Configuration → Environment variables → Edit** and set:

| Name | Value |
| --- | --- |
| `DEVICES_TABLE` | Your device table name, usually `Devices` |
| `DEVICE_TABLE_KEY_NAME` | The exact key name from that table: `id` or `deviceId` |

The key value must be the device ID selected in the web app. Your pasted Lambda uses `id`; the existing project code defaults to `deviceId`, so check the actual table key before choosing.

If the `Devices` key is `id`, upload [device-api-lambda.zip](device-api-lambda.zip) to your existing device-management Lambda too. Set its handler to `device_api_lambda.lambda_handler` and set the same two variables. If the key is `deviceId`, skip this optional upload.

The other table names already default to `raspberryData`, `wateringEvents`, `pumpStatus`, and `IrrigationSettings`. When you later configure IoT Core, set `IOT_DATA_ENDPOINT` and add `iot:Publish` permission to `controlPump` and `autoWatering`.

### 4. Give the functions table access

In **Lambda → Configuration → Permissions → Execution role**, add these DynamoDB actions to the function's role. Also attach `AWSLambdaBasicExecutionRole` so it can write logs.

| Functions | Action and table |
| --- | --- |
| All functions that use `Devices` | `GetItem` on `Devices` |
| `getSensorData`, `getHistory` | `Scan` on `raspberryData` |
| `getWateringEvents` | `Scan` on `wateringEvents` |
| `getSettings` | `GetItem` on `IrrigationSettings` |
| `updateSettings` | `UpdateItem` on `IrrigationSettings` |
| `getStatusData` | `GetItem` on `pumpStatus` |
| `RaspidDataFunct` | `PutItem` on `raspberryData` |
| `storeWateringEvent` | `PutItem` on `wateringEvents` |
| `pumpStatus` | `PutItem` on `pumpStatus` |
| `autoWatering` | `GetItem` on `IrrigationSettings`; `Scan` on `raspberryData` and `wateringEvents` |

For the two history tables, the permission is `Scan` on the table itself. No GSI or index permission is needed. Scans inspect the table before filtering, so they are simple but become less efficient as the tables grow.

### 5. Check API Gateway

Keep the existing HTTP API routes and connect them to these functions:

| Route | Function |
| --- | --- |
| `GET /latest-data` | `getSensorData` |
| `GET /history` | `getHistory` |
| `GET /watering-history` | `getWateringEvents` |
| `GET /settings` | `getSettings` |
| `POST /settings` | `updateSettings` |
| `GET /pumpStatus` | `getStatusData` |
| `POST /control` | `controlPump` |

Each browser request already includes `?deviceId=...` and its sign-in token. In **API Gateway → your HTTP API → Routes**, set the Cognito JWT authorizer on each route. Use your app's Cognito user pool as issuer and its app client as audience. In **CORS**, allow your web app's URL, `GET, POST, PATCH, DELETE, OPTIONS`, and `Authorization, Content-Type`. Save and deploy the stage if auto-deploy is off.

Keep your existing `/devices` route. If your `Devices` table uses key `id`, use the optional device API ZIP from step 3 so the device list and device reads use the same key.

### 6. Rebuild the web app

The app already sends the selected device ID. If the API URL changed, set `REACT_APP_API_BASE_URL` to the API Gateway invoke URL, then run `npm run build` and deploy the `build` folder.

Rows without `id` will not appear, but they will not cause an error. If one data route has no matching rows, the rest of the dashboard still appears. IoT Core setup and Plant Journal notifications are not part of these steps.
