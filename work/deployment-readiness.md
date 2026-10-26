# Implemnt deployment readiness — 26 October 2026

Status: **not yet production-verified**. This checkout and its Supabase CLI are linked only to the separate development project `ctdffqqbwfdgonflamae`. No change in this audit was deployed to `implemnt.ai` or its live database.

## Checks completed in development

- Frontend build and full ESLint pass.
- Signed-in browser visit to `/` stays on the landing page; `/dashboard` remains available through the workspace button.
- Temporary-account smoke test passes for sign-in, profile creation, Supabase client writes, Client/Call/Action Item row isolation, OAuth initiation, Recall manual-sync endpoint, and action-item deduplication on re-analysis. Temporary test data is removed.
- The updated Recall Edge Functions and both new transcript migrations are deployed to the linked **development** project. Reconciliation is scheduled every minute; after deployment, its response was HTTP 200 with no application error and `processed: 0`. There are currently no development calendars, calls, clients, or calendar events, so this is **not** a real-meeting test.
- Recall unit tests cover an unsorted multi-bot response, a transcript becoming available on a later recording, merging two recording transcripts, and idempotent reprocessing.

## Client Four issue review

| Reported issue | Code status in this checkout | Still needed for live confirmation |
| --- | --- | --- |
| Missing call transcript | Signed Recall webhook, retrying reconciliation, fair per-event retry tracking, and per-recording transcript storage/merge are implemented. Missed terminal webhooks can be recovered from the bot's status history. | Check actual Recall delivery logs, a completed production bot, and the matching live Supabase call record. |
| Calendar connection unreliable | `calendar.update` is handled and reconnecting the same Google account updates its Recall calendar instead of creating a duplicate. Disconnect preserves old event/bot mappings for late transcripts and the user's auto-record preference. | Complete Google OAuth with a production account and verify calendar events and connection status. |
| Monday.com updates missing | OAuth requests write scopes; board choice is explicit for action items; Monday mutations must return IDs before success is reported. | Register the exact production redirect URI in the active Monday app version, reconnect, and verify a real test-board update and resulting status. |
| Bot misses a meeting | Calendar-event pagination, scheduling retries, bot-ID selection for moved events, and the minute reconciliation job are present. | Check webhook subscription and run an actual scheduled meeting with a supported link; confirm join and transcript. Meeting-host admission and provider availability remain external limits. |

## Production deployment hold points

1. Identify the hosting project and the **live** Supabase project that currently hold the site's users and Client Four records. The public `https://implemnt.ai/` URL alone does not identify either admin project. Do not point the site at the separate development database.
2. Compare live schema/functions/configuration with this checkout, back up the live database, then review migrations before applying them. Preserve existing user and integration records.
3. Verify the active Monday app version allows `https://implemnt.ai/integrations` and the Google OAuth client allows `https://implemnt.ai/calendarbots`. Both providers must grant the requested scopes.
   The development Monday OAuth smoke test generates `http://localhost:5173/integrations`; Monday rejects this redirect in the user's screenshot. The linked development project does not have `MONDAY_APP_VERSION_ID` set. Register the exact localhost URL in the active Monday app version (and configure that version ID if required by the app) before expecting local OAuth to complete.
4. Verify the live Recall webhook endpoint, required event subscriptions and signature secret, plus an active, successful reconciliation schedule. A deployed Edge Function alone does not establish these provider-side settings.
5. Use a dedicated test user, test Monday board, and real scheduled meeting to confirm the entire chain: calendar event → scheduled bot → joined meeting → transcript segments → Supabase call → reviewed item → Monday mutation → status. Monitor failures after launch. No software can guarantee a bot joins a meeting whose host blocks admission or whose provider is unavailable.
