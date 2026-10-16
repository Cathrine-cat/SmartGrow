# SmartGrow

SmartGrow is a React application for monitoring garden sensors and managing irrigation. Signed-in users can view live readings and watering history, configure device settings, set plant-care thresholds, and ask the Sprout assistant for guidance.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Cognito user pool and client IDs. The API base URL can also be configured with `REACT_APP_API_BASE_URL`.
3. Start the development server with `npm start`.

## Build for deployment

Run `npm run build`. The optimized static application is written to `build/`.

## Backend

The frontend expects the authenticated API routes for user profiles, devices, sensor readings, device history, irrigation settings, pump control, and the plant assistant. See [AUTH_SETUP.md](AUTH_SETUP.md) and [DASHBOARD_DATA_SCHEMA.md](DASHBOARD_DATA_SCHEMA.md) for authentication and device-data details.
