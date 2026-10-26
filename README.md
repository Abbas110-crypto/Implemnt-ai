# Implemnt local development

This checkout uses the separate development Supabase project. It does not modify the live website or its database. The browser app alone cannot provide login, calendar bots, transcripts, or Monday.com connections: the schema and Edge Functions must also be deployed to this development project.

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

Add the server values from `.env.local` in the **development project** under Supabase Edge Function Secrets. Supabase provides its own `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. Keep Monday, Recall, and Google secrets on the server. `.env.local` is the local source for these values, but Vite does not upload them to Supabase automatically.

## Monday.com

In the Monday app's OAuth & Permissions settings, enable the new OAuth flow with PKCE for the app version used during authorization and grant `boards:read`, `boards:write`, `me:read`, `users:read`, `updates:write`, and `account:read`. Register **exactly** `http://localhost:5173/integrations` as a redirect URI in that version. If using a draft version, set it Active for me while testing and put its version ID in the server-only `MONDAY_APP_VERSION_ID` secret so the authorization request targets that version; promote it when ready. Existing users must reconnect after scope changes. Each app user receives their own Monday token stored under their Supabase user ID. The Integrations page offers a connection test.

## Google Calendar and Recall

Register `http://localhost:5173/calendarbots` in the Google OAuth client's authorized redirect URIs. While the Google consent screen is in Testing mode, add the **same Google address selected during authorization** under Google Auth Platform → Audience → Test users. The app uses the `calendar.events.readonly` and `userinfo.email` scopes. The message "Access blocked: Implemnt has not completed the Google verification process" normally means that the selected account is not an allowed test user, the OAuth app/client belongs to another Google Cloud project, or the app has a Google policy restriction; check the detailed `403` reason on Google's page. Testing is for approved users only. Public users require Google OAuth verification for sensitive Calendar scopes. Google testing refresh tokens can expire after seven days, so calendar reconnection may be necessary until the OAuth app is published.

Deploy `recallWebhook`, then register the public development endpoint `https://ctdffqqbwfdgonflamae.supabase.co/functions/v1/recallWebhook` in the EU Recall dashboard. Subscribe to `calendar.sync_events`, `calendar.update`, `bot.in_waiting_room`, `bot.done`, `bot.fatal`, `recording.done`, `recording.failed`, `transcript.done`, and `transcript.failed`. Use the EU workspace verification secret in `RECALL_WORKSPACE_VERIFICATION_SECRET`. A localhost address cannot receive Recall webhooks.

Generate a fresh random `RECALL_RECONCILE_SECRET` and set it in Edge Function Secrets. Schedule `reconcileRecall` every minute using the development project's Cron integration and the template at `supabase/cron/recall_reconcile.sql.example`. The webhook handles immediate updates; reconciliation checks connected calendars for missed event deliveries and retries missing transcripts. Scheduling is limited by Recall's 28-day future event window and external meeting permissions: a meeting host may still have to admit a bot from a waiting room.

In PowerShell, generate that secret with `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`. Put it in `.env.local` and the development project's Edge Function Secrets. Do not send its value in chat.

## Before Vercel

The Vite SPA needs the route rewrite in `vercel.json` so direct visits and OAuth callbacks at `/integrations` and `/calendarbots` load the app.

For any deployed hostname, register the exact browser callback URLs in the corresponding OAuth app. For `https://implemnt.ai`, they are `https://implemnt.ai/integrations` in the Monday Developer Center and `https://implemnt.ai/calendarbots` in the Google OAuth web client. The existing localhost entries remain separate for local testing. A Monday `invalid_redirect_uri` response occurs at Monday before our callback runs; it means the exact URI sent by the frontend is not permitted on the app version used for authorization. The Monday app version must use the new OAuth flow with PKCE and include the requested scopes.

The current `implemnt.ai` deployment may still be using its original backend. Deploying this checkout there would replace the frontend and require intentionally choosing its Supabase project; do not point the site at the separate development database without a migration decision. Put only browser-safe `VITE_` values in Vercel. All other secrets stay in the chosen Supabase project's Edge Function Secrets. Verify a connected user from each platform, a scheduled meeting bot, a completed transcript, and Monday item status before opening access to more users.
