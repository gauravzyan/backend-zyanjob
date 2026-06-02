# backend-zyanjob

A Node.js backend for the overseas jobs platform.

## Deployment notes

This repository expects database credentials to be provided through environment variables in the deployment environment. The `.env` file is not included in the Git repository and should be configured separately.

Required environment variables:

- `PORT`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `JWT_SECRET`
- `JWT_EXPIRY`
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`

If you are deploying on Render or another hosting service, set these values in the service dashboard rather than relying on a local `.env` file.

If your deployment setup uses a root directory setting, point it to the repository root (`.`) instead of `backend`.
