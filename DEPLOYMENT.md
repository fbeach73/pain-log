# PainTracker Deployment Guide

This document explains how to properly deploy the PainTracker application with full data persistence.

## Database Configuration

The PainTracker application requires a PostgreSQL database for data persistence. Without proper database configuration, user sessions and data will be lost when the application is restarted or redeployed.

### Required Environment Secrets

All of these secrets must be synchronized to your deployment environment:

1. `DATABASE_URL` - The PostgreSQL connection string (most important for persistence)
2. `PGDATABASE` - PostgreSQL database name
3. `PGHOST` - PostgreSQL host address
4. `PGUSER` - PostgreSQL username
5. `PGPORT` - PostgreSQL port (typically 5432)
6. `PGPASSWORD` - PostgreSQL password

### Setting Up Deployment Secrets

To ensure your app has persistent sessions in production:

1. Go to your Replit project
2. Click on "Deployment" in the sidebar
3. Select the "Secrets" tab
4. Click "Sync Secrets" button to transfer all your workspace secrets to the deployment environment
5. Verify all 6 secrets are synchronized

If you see a warning saying "X secrets out of sync", it means your deployed application is missing important environment variables needed for persistence.

## Verification

Once deployed with the proper secrets, you can verify persistence is working by:

1. Look for the persistence indicator in the app footer
2. The indicator should show "Persistent" in green if everything is configured correctly
3. If you hover over the indicator, it will show the database connection status and session persistence status

## Troubleshooting

If you're experiencing persistence issues after deployment:

1. Check that all 6 required secrets are synced to the deployment environment
2. Verify your database server is running and accessible from the Replit deployment environment
3. Check the Database Status indicator in the app footer for specific error messages
4. Redeploy the application after fixing any environment issues

## Session Persistence

The application uses connect-pg-simple to store sessions in the PostgreSQL database. This ensures that user logins and session data persist across application restarts and deployments.

The session table will be automatically created if it doesn't exist, but requires proper database connection credentials.