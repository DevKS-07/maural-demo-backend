# Maural KMS — User Navigation Guide

A practical, role-by-role guide to every feature in the system.

---

## Table of Contents

1. [Who Can Do What — Roles Overview](#roles-overview)
2. [How to Sign In](#how-to-sign-in)
3. [How to Navigate the System](#how-to-navigate-the-system)
4. [How to Use the Dashboard](#how-to-use-the-dashboard)
5. [How to Manage Organisations](#how-to-manage-organisations)
6. [How to Manage Users](#how-to-manage-users)
7. [How to Send and Track Invitations](#how-to-send-and-track-invitations)
8. [How to Work with Documents](#how-to-work-with-documents)
9. [How to View Analytics](#how-to-view-analytics)
10. [How to Manage Integrations](#how-to-manage-integrations)
11. [How to Use the Activity Log](#how-to-use-the-activity-log)
12. [How to Use the AI Chatbot](#how-to-use-the-ai-chatbot)
13. [How to Use the Command Palette](#how-to-use-the-command-palette)
14. [How to Update Your Profile](#how-to-update-your-profile)

---

## Roles Overview

The system has four user roles. Your role determines what pages and actions are available to you.

| Feature | Super Admin | Admin | Org Executive | Org Staff |
|---|:---:|:---:|:---:|:---:|
| All Organisations | ✓ | ✓ | Own only | — |
| Edit Any Organisation | ✓ | ✓ | Own only | — |
| All Users (system-wide) | ✓ | ✓ | Own org only | — |
| Invite / Edit Users | ✓ | ✓ | Own org only | — |
| Documents | ✓ | ✓ | Own org only | Own org only |
| Upload Documents | ✓ | ✓ | ✓ | ✓ |
| Analytics / KPIs | ✓ | ✓ | Own org only | — |
| Integrations | — | — | ✓ | — |
| Activity Log | ✓ | ✓ | ✓ | — |
| Reports | ✓ | ✓ | ✓ | — |
| AI Chatbot | ✓ | ✓ | ✓ | ✓ |

---

## How to Sign In

1. Open the application URL in your browser.
2. You will be redirected to the **Login** page if you are not already signed in.
3. Enter your **email address** and **password**, then click **Sign in**.
4. On success you are taken directly to your **Dashboard**.

> If you do not have an account, you must first accept an invitation email sent by an Admin or Org Executive (see [Invitations](#how-to-send-and-track-invitations)).

---

## How to Navigate the System

### Using the Sidebar

The **left sidebar** is your primary navigation. It is always visible once you are signed in.

- Menu items displayed depend on your role.
- The **Users** menu item has a sub-menu — click it once to expand the options: **Manage Users** and **Invitations**.
- On mobile the sidebar collapses into a drawer; tap the menu icon (top-left) to open it.
- Your profile and sign-out options are in the **sidebar footer** (bottom of the sidebar).

### Sidebar links by role

**Super Admin / Admin**
- Home → Dashboard
- Organisations → Organisation list
- Users → Manage Users / Invitations
- Documents → Document library
- Activity → Activity log
- Reports → Reports page
- Ask AI → Opens the AI chatbot

**Org Executive**
- Home → Dashboard
- Organisation → Your organisation detail page
- Users → Manage Users / Invitations (own org)
- Documents → Document library (own org)
- Analytics → KPI analytics for your org
- Integrations → Connect/disconnect data sources
- Activity → Activity log
- Reports → Reports page
- Ask AI → Opens the AI chatbot

**Org Staff**
- Home → Dashboard
- Documents → Document library (own org)
- Ask AI → Opens the AI chatbot

---

## How to Use the Dashboard

Your dashboard is the first page you see after logging in. The content is tailored to your role.

### If you are a Super Admin or Admin

The dashboard gives you a system-wide overview.

- **Quick Stat Cards (top row):** Shows total Organisations, Members, Pending Invitations, and Documents. Each card is clickable and takes you to the relevant page.
- **Scorecard Table (left, 2/3 width):** Lists all organisations with their performance scores. Click **Full reports** to go to the Reports page.
- **Organisations Quick List (right, 1/3 width):** Shows the 6 most recent organisations with their integration status (green checkmark = connected, grey X = not connected). Click any organisation name to open its detail page.
- **Recent Documents (right, below orgs):** Lists the 5 most recently uploaded documents across all organisations. Click a document name to open it in the viewer. Click **View All Documents** to go to the full Documents library.

### If you are an Org Executive

The dashboard gives you a live view of your organisation's KPIs and operations.

- **KPI Headline Cards (top row):** Shows Total Revenue, EBITDA Margin, Pipeline Coverage, and Billable Utilisation — all with variance vs the prior period. Click **Full analytics** (top right) to see the complete analytics breakdown.
- **Team Card:** Shows member count, pending invites, and role breakdown. Click **Manage** to go to the Users page.
- **Integrations Card:** Shows live connection status for HubSpot, QuickBooks, Monday.com, and ClickUp. Click **Manage integrations** to go to the Integrations page.
- **Strategic Goals (VTO) Card:** Displays your organisation's Vision/Traction Organizer — Core Values, Mission, 10-year targets, and 3-year financials. Click **Edit** (or **Create** if none exists) to update it.
- **Sales Funnel Card:** Shows your leads → proposals → deals won pipeline with conversion rate.
- **Recent Documents:** Lists the 5 most recently uploaded documents for your org. Click any file to view it.
- **Cash & Runway Card:** Shows your current cash position, monthly burn rate, and runway in months.

### If you are Org Staff

The dashboard shows you a simplified view of your organisation.

- **Quick Stat Cards:** Shows Documents count, Team Members count, and the date of the most Recent Upload.
- **Your Team card (left):** Lists the first 8 team members with their names, job titles, and role badges.
- **Recent Documents (right):** Shows the 6 most recently uploaded documents. Click any file to open it in the document viewer. If no documents exist, click **Go to Documents** to navigate to the library.

---

## How to Manage Organisations

> Available to: Super Admin, Admin (all orgs); Org Executive (own org only)

### How to view all organisations

1. Click **Organisations** in the sidebar.
2. All organisations are displayed as cards in a grid.
3. Use the **search bar** to filter by organisation name, industry, location, or key contact details. Results update in real time.
4. Click any organisation card to open its detail page.

### How to create an organisation

1. Click **Organisations** in the sidebar.
2. Click the **Create organisation** button (top right).
3. Fill in the form:
   - **Name** — required
   - **Industry** — required
   - **Location** — required
4. To add key contacts, click **Add contact** and fill in name, email, and phone.
5. Click **Save**.

### How to view an organisation's details

1. Click **Organisations** → click any organisation card.
2. The detail page has five tabs:

   - **Overview** — Location, founding date, AI types, integrations, and key contacts.
   - **Members** — Table of all users in the organisation: name, job title, role, manager, and status.
   - **Org Chart** — A visual hierarchy tree of the organisation. If no hierarchy is configured, users are grouped by role tier.
   - **Documents** — A table of all documents uploaded to this organisation.
   - **VTO** — The Vision/Traction Organizer if one has been created.

### How to edit an organisation

1. Navigate to the organisation detail page.
2. Click the **Edit** button (only visible to Super Admin, Admin, and Org Executives viewing their own org).
3. The edit page has two tabs:

   **Organisation Details tab:**
   - Update Name, Industry, Location, Founded Date, AI/GPT Types, Labor Source.
   - To add a key contact, click **Add contact**. To remove one, click the remove icon next to it.
   - Click **Save** when done.

   **Vision/Traction Organizer (VTO) tab:**
   - Each section (Core Values, Mission, Vision, 10-Year Targets, 3-Year Financials, etc.) is an expandable accordion.
   - Click a section header to expand it.
   - Add or remove items using the **+** and **×** buttons within each section.
   - Click **Save** to persist your changes.

---

## How to Manage Users

> Available to: Super Admin, Admin (all users); Org Executive (own org users only)

### How to view users

1. Click **Users** → **Manage Users** in the sidebar.
2. All users you have access to are displayed in a table.
3. Use the toolbar to filter:
   - **Search** by name, email, phone, or job title.
   - **Status** filter: All, Active, Inactive, Pending.
   - **Role** filter: Super Admin, Admin, Org Executive, Org Staff.
   - **Organisation** filter (Admin only): narrow down to a specific org.

### How to edit a user

1. Go to **Users** → **Manage Users**.
2. Find the user in the table and click the **Edit** button on their row (or click the row itself).
3. Update any fields in the modal: First Name, Last Name, Email, Job Title, Phone, Role, Organisation, Department, Manager.
4. Click **Save changes**.

### How to change a user's status (Active / Inactive)

1. Go to **Users** → **Manage Users**.
2. Find the user. Their status is shown as a badge in the **Status** column.
3. Click the status badge to toggle between **Active** and **Inactive**.

### How to delete a user

1. Go to **Users** → **Manage Users**.
2. Find the user and click the **Delete** button on their row.
3. A confirmation dialog will appear. Click **Delete** to confirm.

> Warning: This action is permanent.

---

## How to Send and Track Invitations

> Available to: Super Admin, Admin (all orgs); Org Executive (own org only)

### How to invite a new user

1. Click **Users** → **Manage Users** in the sidebar.
2. Click the **Invite user** button (top right of the toolbar).
3. Fill in the invitation form:
   - **Email** — required; this is where the invitation is sent.
   - **First Name** and **Last Name** — required.
   - **Job Title** and **Phone** — optional but recommended.
   - **Role** — select what role the new user should have. You can only assign roles equal to or below your own.
   - **Organisation** — select which org they belong to (Admins only; Org Executives are locked to their own org).
   - **Department** — optional.
   - **Manager** — select from existing users (optional).
4. Click **Send invitation**. The user receives an email with a link to complete their sign-up.

### How to view and manage sent invitations

1. Click **Users** → **Invitations** in the sidebar.
2. All invitations you have access to are listed in a table showing: Email, Organisation, Role, Status, Sent Date, and Expiry.
3. Use the **Status** dropdown to filter by: All, Pending, Accepted, or Revoked.

### How to revoke an invitation

1. Go to **Users** → **Invitations**.
2. Find the invitation and click the **Revoke** button on its row.
3. Confirm in the dialog that appears.

> Revoking an invitation prevents the recipient from using that invitation link to create an account.

---

## How to Work with Documents

> Available to: All authenticated users (scoped to own org for Org Executive and Org Staff)

### How to browse documents

1. Click **Documents** in the sidebar.
2. Documents are displayed as cards in a grid.
3. Use the toolbar to find what you need:
   - **Search** by filename (real-time filter).
   - **Category** filter: All, Sales, Marketing, Finance, Legal, Technical, Uncategorized.
   - **Organisation** filter (Admin only): narrow to a specific org.
4. Click **Clear filters** to reset all active filters.

### How to upload a document

1. Click **Documents** in the sidebar.
2. Click the **Upload** button (top right) to open the file upload drawer.
3. Either **drag and drop** files onto the upload area, or click it to open a file picker.
4. Each uploaded file appears in a preview list. Use the **Category** dropdown next to each file to assign it a category (e.g., Finance, Legal).
5. Click **Upload** to save the files to the system.

### How to view a document

**Option A — from the document grid:**
1. Click any document card to select it.
2. A **detail panel** opens on the right showing: file name, size, upload date, category, uploader, and organisation.
3. Click the **View** button in the detail panel to open the full document viewer.

**Option B — direct link:**
- Click the file name anywhere in the system (dashboard, org detail, etc.) to open the document viewer directly.

### How to use the Document Viewer

The viewer opens full-screen and supports:
- **PDF files** — rendered natively with full scroll, zoom, and page navigation.
- **Excel files** (.xlsx, .xls) — rendered via Office viewer.
- **Word files** (.doc, .docx) — rendered via Office viewer.

Use your browser's native controls (or the viewer toolbar) to zoom, navigate pages, and scroll.

### How to change a document's category

1. Click a document card to open the detail panel.
2. Click the **Category** dropdown in the detail panel.
3. Select the new category from the list.
4. The change is saved automatically.

### How to delete a document

1. Click a document card to open the detail panel.
2. Click the **Delete** button in the detail panel.
3. Confirm in the dialog that appears.

> Warning: This action is permanent.

---

## How to View Analytics

> Available to: Super Admin, Admin (all orgs); Org Executive (own org only)

### How to open analytics

- **Super Admin / Admin:** Click **Organisations** → click an organisation card → the analytics are available from the org detail page, or navigate to `/summary/{org_id}`.
- **Org Executive:** Click **Analytics** in the sidebar.

### How to navigate the analytics tabs

Analytics are organised into four tabs. Click the tab name to switch between them.

**Finance tab**
- Shows revenue, budget variance, net income, profitability, cash position, and revenue mix.
- Data is sourced from your connected **QuickBooks** integration.

**Leads tab**
- Shows the lead funnel (leads → proposals → deals won), pipeline coverage, conversion rates, and deal health.
- Data is sourced from your connected **HubSpot** integration.

**Labor tab**
- Shows billable utilisation %, FTE breakdown, workforce count, and utilisation trends.
- Use the **source toggle** to switch between **Monday.com** and **ClickUp** data.
- Data is sourced from whichever project management tool is connected.

**Goals tab**
- Displays the full Vision/Traction Organizer (VTO) for the organisation.
- If you have edit permissions, click the **Edit** button to update goals.

### How to filter analytics by date

1. On any analytics page, look for the **Date Range Picker** (top right of the analytics view).
2. Click it to open the picker.
3. Select a pre-set quarter, or choose a custom **start date** and **end date**.
4. All KPI cards and charts update to reflect the selected period.

---

## How to Manage Integrations

> Available to: Org Executive only

Integrations connect your organisation's third-party tools so KPI data flows into Maural KMS automatically.

### How to view integration status

1. Click **Integrations** in the sidebar.
2. All four integration cards are displayed: **HubSpot**, **QuickBooks**, **ClickUp**, and **Monday.com**.
3. Each card shows a status badge: **Connected** (green) or **Off** (grey).

### How to connect an integration

1. Click **Integrations** in the sidebar.
2. Find the integration you want to connect and click its **Connect** toggle or button.
3. You will be redirected through an OAuth authorisation flow for that service. Follow the prompts to grant access.
4. Once authorised, you are returned to the Integrations page and the status badge updates to **Connected**.

### How to disconnect an integration

1. Click **Integrations** in the sidebar.
2. Find the connected integration and click its **Disconnect** toggle.
3. The status updates to **Off** and data from that source will no longer be displayed in analytics.

> Note: Disconnecting does not delete historical data already pulled into the system.

---

## How to Use the Activity Log

> Available to: Super Admin, Admin, Org Executive

The Activity Log records every significant action taken in the system — uploads, invitations, syncs, and updates.

### How to open the activity log

1. Click **Activity** in the sidebar.

### How to filter the activity log

Use the **Action Type** dropdown (top of the page) to filter entries:
- **All actions** — shows everything.
- **Uploads** — files uploaded to the system.
- **Invites** — user invitations sent.
- **Syncs** — integration data sync events.
- **Updates** — changes made to organisations, users, or settings.

The table columns are: **Timestamp**, **User**, **Action** (colour-coded badge), **Target**, and **Details**.

---

## How to Use the AI Chatbot

> Available to: All authenticated users

The AI chatbot can answer questions about your organisation's data, documents, and processes.

### How to open the chatbot

- Click the **Ask AI** button at the bottom of the sidebar (labelled with a chat icon).
- A floating chat panel opens over the current page.

### How to use the chatbot

1. Type your question in the text input at the bottom of the chat panel.
2. Press **Enter** or click the send button.
3. The AI responds in the chat panel. Your message appears with an animated typewriter effect.
4. You can ask follow-up questions — the conversation is continuous within the session.
5. Close the panel by clicking outside it or clicking the close button.

**Example questions you can ask:**
- "What is the current cash runway for our organisation?"
- "Show me the latest documents uploaded this month."
- "What are our core values?"
- "Who are the key contacts for [Organisation Name]?"

---

## How to Use the Command Palette

> Available to: All authenticated users

The Command Palette is a keyboard-driven shortcut for fast navigation anywhere in the system.

### How to open it

- Press **Ctrl+K** (Windows / Linux) or **Cmd+K** (Mac).

### How to use it

1. Start typing the name of a page, organisation, or user.
2. Results appear as a list below the search input.
3. Use the **arrow keys** to move up and down through the results.
4. Press **Enter** to navigate to the selected item.
5. Press **Escape** to close the palette without navigating.

**Smart commands you can type:**
- `manage [org name]` → goes directly to that organisation's edit page.
- `analytics [org name]` → goes directly to that organisation's analytics page.
- Any page name (e.g., "documents", "invitations", "activity") → navigates to that page.

---

## How to Update Your Profile

1. In the sidebar footer (bottom of the left sidebar), click your name or avatar.
2. Click **My Profile**.
3. The Clerk profile manager opens. From here you can:
   - Update your **name** and **email address**.
   - Change your **password**.
   - Manage **connected accounts** and **security settings** (e.g., two-factor authentication).
4. Changes are saved automatically within each section.

---

*For technical setup and API reference, see [SYSTEM_SETUP_GUIDE.md](SYSTEM_SETUP_GUIDE.md) and [API_REFERENCE.md](API_REFERENCE.md).*
