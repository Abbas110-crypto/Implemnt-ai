# Implemnt local development

This checkout uses the separate development Supabase project. It does not modify the live website or its database. The browser app alone cannot provide login, calendar bots, transcripts, or CRM connections: the schema and Edge Functions must also be deployed to this development project.

## Run the browser app

1. Keep all local values in `.env.local` and keep that file private. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` enter the browser bundle.
2. Run `npm install` and `npm run dev`.
3. Open `http://localhost:5173`. Vite uses a fixed port so OAuth redirect URLs stay stable. Close another process using port 5173 before starting a second server.

## Deploy the development backend

The official Supabase CLI is a project dependency. From this directory:

```powershell
npx supabase login
npx supabase projects list
npx supabase link --project-ref ctdffqqbwfdgonflamae
npx supabase db push --dry-run
npx supabase db push
npx supabase config diff --project-ref ctdffqqbwfdgonflamae
npx supabase config push --project-ref ctdffqqbwfdgonflamae
npx supabase functions deploy
```

Confirm that `projects list` and the linked project both show `ctdffqqbwfdgonflamae` before the database push. Never use `db reset --linked` here. The schema migrations create the per-user tables and access policies; a Vite build cannot apply them.

The `link` command may ask for this development project's database password. Enter it only in the CLI prompt, never in chat. Review the config diff before pushing: `supabase/config.toml` declares the development Site URL and allowed redirects for `http://localhost:5173`. In Authentication → Providers, enable Email if you want email/password sign-up and sign-in. The SQL migrations create a profile automatically for each new Auth user.

Add the server values from `.env.local` in the **development project** under Supabase Edge Function Secrets. Supabase provides its own `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. Keep all HubSpot, Monday, Recall, and Google secrets on the server. `.env.local` is the local source for these values, but Vite does not upload them to Supabase automatically.

## Monday.com

In the Monday app's OAuth & Permissions settings, enable the new OAuth flow with PKCE and grant `boards:read`, `boards:write`, `me:read`, `users:read`, `updates:write`, and `account:read`. Register `http://localhost:5173/integrations` as a redirect URI. Existing users must reconnect after scope changes. Each app user receives their own Monday token stored under their Supabase user ID. The Integrations page offers a connection test.

## Google Calendar and Recall

Register `http://localhost:5173/calendarbots` in the Google OAuth client's authorized redirect URIs. While the Google consent screen is in Testing mode, add each test user's Google address in Google Auth Platform. Google testing refresh tokens can expire after seven days, so calendar reconnection may be necessary until the OAuth app is published.

Deploy `recallWebhook`, then register the public development endpoint `https://ctdffqqbwfdgonflamae.supabase.co/functions/v1/recallWebhook` in the EU Recall dashboard. Subscribe to `calendar.sync_events`, `calendar.update`, `bot.in_waiting_room`, `bot.done`, `bot.fatal`, `recording.done`, `recording.failed`, `transcript.done`, and `transcript.failed`. Use the EU workspace verification secret in `RECALL_WORKSPACE_VERIFICATION_SECRET`. A localhost address cannot receive Recall webhooks.

Generate a fresh random `RECALL_RECONCILE_SECRET` and set it in Edge Function Secrets. Schedule `reconcileRecall` every minute using the development project's Cron integration and the template at `supabase/cron/recall_reconcile.sql.example`. The webhook handles immediate updates; reconciliation checks connected calendars for missed event deliveries and retries missing transcripts. Scheduling is limited by Recall's 28-day future event window and external meeting permissions: a meeting host may still have to admit a bot from a waiting room.

In PowerShell, generate that secret with `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`. Put it in `.env.local` and the development project's Edge Function Secrets. Do not send its value in chat.

## HubSpot

The existing `HUBSPOT_API_TOKEN` is a private-app token for one HubSpot account. To let every app user connect a different HubSpot account, create a HubSpot OAuth app, provide `HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` in development Edge Function Secrets, and register `http://localhost:5173/integrations` as a redirect URI. The app requests contact and deal read/write scopes. Every user then connects through the Integrations page.

For a single explicitly chosen user, the private-app token can still be used by setting `HUBSPOT_SHARED_TENANT_ID` to that user's Supabase Auth user ID. It is never applied to all users automatically. HubSpot churn sync also requires `churn_risk_score`, `churn_risk_level`, and `churn_risk_keywords` custom properties on each contact/deal object type being updated.

## Before Vercel

Add the Vercel URLs to the Monday, Google, and HubSpot OAuth app redirect settings. Put only browser-safe `VITE_` values in Vercel. All other secrets stay in the development Supabase Edge Function Secrets. Verify a connected user from each platform, a scheduled meeting bot, a completed transcript, and Monday item status before opening access to more users.
