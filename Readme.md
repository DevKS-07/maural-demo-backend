# Project documentation

API for Maural KMS

## Required Environment Variables:

######################################################

### Development environment variables

######################################################
NODE_ENV=development
HOST=localhost
PORT=5000
apiVersion: "v1"

######################################################

### Supabase Settings

######################################################

<!-- Connect to Supabase via connection pooling -->

SUPABASE_URL=https://[REDACTED_PROJECT_REF].supabase.co

SUPABASE_ANON_KEY=[REDACTED_SUPABASE_ANON_KEY]

######################################################

### Database Connection Strings

######################################################

<!-- Connect to Supabase via connection pooling -->

DATABASE_URL="postgresql://postgres.[REDACTED_PROJECT_REF]:[REDACTED_DB_PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection to the database. Used for migrations

DIRECT_URL= <!-- Get this from Supabase -->

######################################################

### HubSpot Integration Settings

######################################################
HUBSPOT_APP_ID=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_REDIRECT_URI=http://localhost:5000/api/integrations/hubspot/oauth-callback

######################################################

### QuickBooks Integration Settings

######################################################
QUICKBOOKS_APP_ID=
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/integrations/quickbooks/oauth-callback
QUICKBOOKS_ENVIRONMENT=sandbox

<!-- Change to "production" for live environment -->

QUICKBOOKS_BASE_URL=https://sandbox-quickbooks.api.intuit.com

<!-- QUICKBOOKS_BASE_URL=https://quickbooks.api.intuit.com # Production Base URL -->
