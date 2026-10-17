# Device ID rollout

Use [backend/lambdas/AWS_DEPLOYMENT.md](backend/lambdas/AWS_DEPLOYMENT.md) for the Lambda ZIP, environment variables, IAM permissions, API Gateway routes, CORS, and rollout steps.

This rollout keeps the existing DynamoDB keys. It filters `raspberryData` and `wateringEvents` by their ordinary `id` attribute using paginated scans; it does not create a GSI or backfill IDs automatically. Rows without a known device ID are omitted. `pumpStatus` continues to use `id`, and `IrrigationSettings` continues to use `settingId`.

Notification conditions, notification events, and the Plant Journal unread badge are intentionally outside this rollout. IoT Core topics and device policies are also left for a later step; the ingest Lambdas accept an `id` or `deviceId` in their invoke event and can be connected when you configure IoT Core.
