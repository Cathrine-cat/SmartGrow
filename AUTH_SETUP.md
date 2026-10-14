# Cognito and app setup

The React app now uses Amplify Auth with a custom in-app form. Cognito's hosted sign-in page and OIDC redirect are not used.

## 1. Check the existing Cognito User Pool

The previous OIDC setup in this repository pointed to:

- AWS Region: `eu-north-1`
- User Pool ID: `eu-north-1_lg2c9gK3O`
- App Client ID: `5e1sld4og5nol6jebrcgrqt7tn`

In the AWS Console, open **Amazon Cognito → User pools** and select that pool. Confirm:

1. **Sign-in identifiers** allows email sign-in.
2. Self-service sign-up is enabled.
3. Email is a required sign-up attribute and email verification is enabled using a **code**.
4. Name is available as an attribute. Phone number is optional; do not mark it required because the app only asks for it optionally.
5. The pool's password policy meets your requirements.

If the pool was set up with a username-only sign-in identifier or has incompatible required attributes, create a new pool with these settings. Cognito does not let you change some pool-level sign-in choices after creation.

## 2. Check or create a browser app client

In the pool, open **App integration → App clients** and inspect the client above. The React app is a public browser client:

1. It must have **no client secret**. A secret embedded in a React build is public. If this client has a secret, create a new app client without one and use its ID instead.
2. Enable the **SRP (Secure Remote Password)** user authentication flow. Keep refresh-token authentication enabled.
3. Hosted UI callback URLs and OAuth scopes are unnecessary for this direct email/password flow. The app does not call `signInWithRedirect`.
4. Keep self-service sign-up enabled and make sure the client can write `email`, `name`, and (if used) `phone_number` attributes.

The frontend calls Cognito's sign-up and confirmation APIs. A new user remains unconfirmed until they enter the emailed code; after confirmation they can sign in with email and password. Cognito handles and stores the password credential, not this app or its DynamoDB table.

## 3. Configure the React app

The ignored local `.env.local` already contains the pool and app client IDs from the old setup. For a different pool/client, copy `.env.example` to `.env.local` and replace the values. Restart `npm start` after changing environment values.

For AWS Amplify Hosting, add these same two variables under the app's **Environment variables** settings for the relevant branch, then redeploy:

- `REACT_APP_COGNITO_USER_POOL_ID`
- `REACT_APP_COGNITO_USER_POOL_CLIENT_ID`

These are public identifiers, not secrets. Do not add a client secret or AWS access keys to React environment variables.

The current login page keeps its existing layout. Signup asks for name, email, password, and optional phone; it then shows a code-entry step with a resend-code action. Login asks for email and password. Email verification occurs at account creation.

## 4. Protect the existing irrigation API

The dashboard now sends the Cognito **ID token** as `Authorization: Bearer <token>` to each existing API Gateway endpoint. This header alone does not secure an endpoint. Configure authorization in API Gateway before treating the app as protected:

- **REST API:** create a Cognito User Pool authorizer for this pool and attach it to every data and control method.
- **HTTP API:** create a JWT authorizer with issuer `https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_lg2c9gK3O` and audience `5e1sld4og5nol6jebrcgrqt7tn`, then attach it to every protected route.

Allow the `Authorization` header in API CORS settings. Redeploy the API after changing its authorizers. Do not leave `/control` or `/settings` open while only the read routes are protected.

In each Lambda handler, take the authenticated Cognito `sub` from API Gateway's validated authorizer claims. Use that identity to look up the caller's profile/device ownership in DynamoDB and reject requests for devices they do not own. Never accept a caller-supplied `userId` as proof of ownership. The current React repository does not include those API Gateway/Lambda definitions, so that backend authorization and DynamoDB profile API still need to be added to the AWS backend.

## 5. Put app profiles in DynamoDB

Keep Cognito as the identity/password directory. Create one profile item in the existing or a dedicated DynamoDB table, keyed by Cognito `sub`, for example:

```text
PK = USER#<sub>
name = ...
email = ...
phone = ...
deviceIds = [...]
```

Create/read/update that profile through authenticated API Gateway + Lambda endpoints. The Lambda should set the profile key from the verified token claims, not a value sent by the browser. Associate sensor/settings/history data with a device ID and verify that the caller owns that device before returning or changing it. Cognito is the source of truth for email verification; DynamoDB stores application profile and irrigation data.

## Current boundary

Authentication, code confirmation, sign-out, profile-attribute reads/updates, and ID-token attachment are wired in React. The current frontend's device list and irrigation API calls do not yet persist or authorize user-specific data in DynamoDB; completing that requires updating the API Gateway/Lambda backend. In particular, the React route guard is only a user-interface convenience and is not an API security control.
