# Project documentation
API for Maural KMS

# Required Environment Variables:
NODE_ENV=development    <br>
HOST=localhost    <br>
PORT=5000    <br>
apiVersion: "v1"    <br>
DISABLE_AUTH=true    <br>

## Supabase/Database Variables
SUPABASE_URL=    <br>
SUPABASE_ANON_KEY=    <br>
DATABASE_URL=    <br>
DIRECT_URL=    <br>

## Clerk Variables
CLERK_PUBLISHABLE_KEY=    <br>
CLERK_SECRET_KEY=     <br>
CLERK_WEBHOOK_SECRET="You can leave this one out unless testing Login/Signup Logic"     <br>

## HubSpot Integration Settings
HUBSPOT_APP_ID=    <br>
HUBSPOT_CLIENT_ID=    <br>
HUBSPOT_CLIENT_SECRET=    <br>
HUBSPOT_REDIRECT_URI=http://localhost:5000/api/integrations/hubspot/oauth-callback    <br>

## QuickBooks Integration Settings
QUICKBOOKS_APP_ID=    <br>
QUICKBOOKS_CLIENT_ID=    <br>
QUICKBOOKS_CLIENT_SECRET=    <br>
QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/integrations/quickbooks/oauth-callback    <br>
QUICKBOOKS_ENVIRONMENT=sandbox    <br>
QUICKBOOKS_BASE_URL=https://sandbox-quickbooks.api.intuit.com    <br>
