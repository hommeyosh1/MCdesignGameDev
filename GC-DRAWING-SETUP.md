# Activate the GC Drawing (free Google Sheets + Apps Script)

Your private spreadsheet: https://docs.google.com/spreadsheets/d/1r9XsA8H_vsz_NMb72MwoH5UQ4qtvgJmxfSRrQZAaf64/edit

## One-time Google authorization and deployment

1. Open the spreadsheet while signed in to the Google account that owns it.
2. Select **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the contents of this repository's `gc-drawing-apps-script.gs`, then save.
4. Edit `DRAWING_ID` to a unique value like `GASP-2026-11-07` and set `CLOSES_AT` to the Saturday deadline.
5. Confirm the official giveaway rules, privacy notice, eligibility, location restrictions, prize type, and retention policy are published. Do not enable entries yet.
6. In the script editor, run `doGet` to request Google authorization.
7. Select **Deploy → New deployment → Web app**. Choose **Execute as: Me**, **Who has access: Anyone**, then deploy and authorize. Copy the resulting **/exec** web-app URL.
8. Test a submission through a controlled form integration and verify it arrives privately in the spreadsheet; check duplicate handling and script logs.
9. Change `ACCEPTING_ENTRIES` to `true`, save and redeploy the latest web app version **only after** validation, rate-limiting/spam defenses, and testing. Connect the form to the /exec URL.

## Security warning

Do not put spreadsheet IDs, client secrets, API keys, or personal information in public HTML/JS. The published GitHub page does not currently post data. A publicly accessible Apps Script web app has limited built-in spam controls. For public operation, use a server-side challenge verification/rate-limiting layer or another trusted managed form endpoint. Avoid using unverified public submissions to select prize winners. The spreadsheet must remain unshared publicly; admin controls must not run from the public website.

## Weekly operation

Set a fresh drawing ID and close date for the upcoming week's episode and redeploy the script; store previous weeks' records in the same sheet. Each eligible email is limited to one entry per drawing ID. When the window closes, run `drawWinner` in the Apps Script editor (never from the public site) to mark one eligible row as Winner. Verify eligibility and contact the winner privately before delivering a prize.

Email/text marketing consent must remain separate from drawing notifications. Before sending texts, set up a compliant opt-in and unsubscribe workflow; Apps Script alone does not send SMS. Request mailing addresses only from winners wherever possible.

**Status:** Setup scaffold only. The sheet exists but submissions are not enabled; deployment and integration require authorization by the Google account owner.
