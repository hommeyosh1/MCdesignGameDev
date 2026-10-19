# The Hommeyosh Subscriber Website — Development Branch

**Status: prototype, not ready to deploy or collect production subscriptions.** The current live GitHub Pages website on main has not been changed.

## Scope

- Public signup for email and optional SMS, with explicit distinct opt-in checkboxes.
- One-time six-digit code, 10-minute expiry, five attempts per code, separate verification for selected delivery channels.
- PostgreSQL tables for subscribers, code digests, consent events, and campaign delivery logs.
- Server-side admin password check, HTTP-only signed cookie, protected subscriber and consent views.
- Email via Resend and texts via Twilio (credentials not included).
- Video embedded from the current YouTube link. Automatically synchronized latest-video feed is not implemented yet.
- Existing course files remain in the repository but are removed from the new homepage.

## Architecture

GitHub Pages **cannot execute** Node/Express, store private PostgreSQL records, or send SMS. Running this project requires a separate Node host (with HTTPS) and a managed PostgreSQL database. Configure DNS/proxy so the public page and API share the same origin, or implement a securely configured CORS setup. Do not deploy this API as a public production service until security and compliance tasks are complete.

## Local development

1. Install Node 20+ and PostgreSQL; run `npm install`.
2. Run `psql "$DATABASE_URL" -f server/schema.sql` with a suitable connection string.
3. Copy `.env.example` to `.env` and configure **all** required variables. Never upload real keys to GitHub.
4. Complete domain verification with Resend and sender/registration requirements with Twilio.
5. Run `npm start`, then use the configured `BASE_URL`. Email and SMS verification will not work without real providers.

## Important launch blockers

1. Implement Twilio inbound **STOP/START/HELP** webhook with signature validation; suppression must be enforced before any marketing SMS is sent. Add automated email one-click unsubscribe links, a public preferences endpoint, and provider bounce/complaint handling. The current admin bulk sender is disabled unless `ENABLE_CAMPAIGNS=true` is set; **do not enable it** until all these are completed and tested.
2. Get a review of SMS marketing consent wording, privacy policy, business contact details, applicable US telemarketing laws, carrier registration and sender identification. Update the draft policy with actual contact/address and retention terms.
3. Strengthen identity flow: add admin MFA, secure secret rotation, persistent shared request throttling (current in-memory limiter is insufficient at scale), per-destination OTP throttles/resend caps, email validation/deliverability handling, duplicate phone reconciliation, CSRF protections, audit logs, and a robust admin password reset.
4. Build transactional queue/worker for bulk campaigns; current send loop is only a prototype and cannot safely handle large sends or delivery retries. Build a subscriber-facing self-service unsubscribe/preferences system.
5. Add a current YouTube videos feed through YouTube Data API or a controlled content update process; the current homepage embeds one known video only.
6. Deploy/test a separate production API and database before publishing the redesigned site; never treat a static GitHub Pages copy as a working signup.
7. Run automated integration tests for verification expiry, retries, email-only vs SMS consent, unsubscription, webhook signature validation, permissions, and database failures.

## Do not merge to main or deploy before review.
