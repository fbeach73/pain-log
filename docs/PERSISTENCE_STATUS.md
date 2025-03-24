# PainTracker Persistence Status Guide

The PainTracker application now includes a persistence status indicator in the footer of the application. This guide explains how to interpret and use this feature.

## Understanding the Persistence Status Indicator

### What is Persistence?

Persistence refers to the ability of the application to retain your data (such as user accounts, pain logs, medications, etc.) and login sessions across application restarts and redeployments. Without proper persistence, your data could be lost when the application updates or restarts.

### Location

The persistence status indicator is located in the footer of the application, next to the copyright information.

### Status Indicators

The persistence status indicator can show three different states:

1. **Persistent (Green)** - Data and sessions will persist across restarts and deployments
2. **Partial Persistence (Yellow)** - Database is connected but session persistence may have issues
3. **Not Persistent (Red)** - Data will be lost when the application is restarted or deployed

### Detailed Information

Hover over the indicator to see detailed information:

- **Database Configured** - Whether the DATABASE_URL environment variable is set
- **Database Connected** - Whether the application can successfully connect to the database
- **Session Persistence** - Whether user sessions will persist across restarts

## What to Do if Persistence is Not Working

If the indicator shows "Not Persistent" (red):

1. **In Development Environment:**
   - Make sure the DATABASE_URL environment variable is set in your workspace
   - Check that your PostgreSQL database is running and accessible

2. **In Production Environment:**
   - Follow the instructions in the DEPLOYMENT.md file
   - Ensure all database-related secrets (DATABASE_URL, etc.) are synced to the deployment environment
   - Redeploy the application after fixing the environment configuration

## Benefits of Database Persistence

With properly configured database persistence:

- User accounts and login sessions remain active even after application updates
- All pain logs, medication records, and user data are safely stored
- No need to recreate accounts or re-enter data after application maintenance
- Consistent user experience across application upgrades and restarts

## Technical Details

The PainTracker application uses PostgreSQL with connect-pg-simple for session storage. The database health and status are regularly checked to ensure optimal performance and data safety.