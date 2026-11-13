# GeoMatch — Geothermal Career Explorer

A plain HTML/CSS/JavaScript career-discovery tool for Geothermal Rising. No framework, no build step, no backend required. Runs by double-clicking `index.html` and works identically when hosted (GitHub Pages, Netlify, etc.).

## 1. Running the app

**Locally:** double-click `index.html`, or open it with File → Open in any browser. Everything — including career data and the QR code generator — is loaded as plain `<script>` tags, so nothing is fetched over the network and it works on `file://`.

**Hosted:** upload the whole `geomatch/` folder to any static host (see Section 8, "Hosting"). No server-side code is needed.

## 2. File structure

```
geomatch/
├── index.html              # markup only
├── styles.css               # all styling, incl. print and responsive rules
├── app.js                   # questions, scoring, results, email, analytics, admin view
├── data/
│   └── careers.js           # window.GEOMATCH_CAREERS — edit this to change careers
├── vendor/
│   └── qrcode.js             # local QR code generator (no external API)
├── assets/
│   └── geothermal-rising-logo.png
└── README.md
```

## 3. Editing careers (no coding needed)

Open `data/careers.js` in any text editor. It's a plain JavaScript array — each career is one `{ ... }` block. Copy an existing block, change the values, and save.

**Every career needs these fields:**

| Field | What it is |
|---|---|
| `title` | Job title |
| `category` | Must be **exactly** one of the 17 cluster names (see the list in `app.js`, search for `CLUSTERS`) |
| `description` | One plain sentence |
| `typical_tasks` | 3 short phrases |
| `skills` | 4 short phrases |
| `degrees` | Typical degrees/certifications |
| `courses` | 2 example courses |
| `fields` | Study fields — must come from the Step 3 "field of study" list |
| `industries_transferable_from` | Industries — must come from the Step 3 "industry" list |
| `interests` | Must come from the Step 5 interests list |
| `activities` | Must come from the Step 6 working-style list |
| `environments` | Must come from the Step 7 environment list |
| `entry_route` | One of: `Degree`, `Diploma`, `Apprenticeship`, `Certification`, `Experience` |

**Important: labels must match exactly.** The matching engine compares strings exactly, including capitalisation and punctuation (e.g. `"Field sites"`, not `"field sites"`). The full list of valid option labels for each tag type is defined in `app.js` near the top (`FIELD_OPTIONS`, `INDUSTRY_OPTIONS`, `INTEREST_OPTIONS`, `ACTIVITY_OPTIONS`, `ENVIRONMENT_OPTIONS`).

**Validation check:** every time the app loads, it checks `data/careers.js` against the option lists and prints warnings to the browser console (press F12 → Console) for:
- any tag on a career that isn't a real option label
- any option label that no career uses at all

Fix any warnings you see there before publishing changes.

**Minimum:** each of the 17 clusters needs at least 3 careers, or that cluster can never show meaningfully in results.

## 4. Adding a new cluster

1. Add the cluster name and one-line description to the `CLUSTERS` array in `app.js`.
2. Add at least 3 careers in `data/careers.js` with `category` set to the new cluster name.
3. Decide which project-scenario option(s) (Step 4) should point to it, and add the cluster name to that option's `clusters` array in `SCENARIO_OPTIONS` in `app.js`.
4. Reload and check the console for validation warnings.

## 4a. The Middle School flow

Middle School users (Step 1) get a shorter, plainer-language version of the flow — **7 steps instead of 8**:

1. Career stage
2. Region
3. Subjects — a simpler 6-option list (`MS_SUBJECT_OPTIONS` in `app.js`), not the full High School list
4. **Free time** — a new question (`FREE_TIME_OPTIONS` in `app.js`) that replaces Interests and Working style entirely for this age group
5. Scenario — the same 11 options as everyone else, but with kid-friendly wording (`labelMS` on each `SCENARIO_OPTIONS` entry) and the same scoring
6. Where would you like to work — the same environment tags, simplified labels, "Government" dropped as an option
7. Prior familiarity

Results are lighter too: 3 careers instead of 5 (only the title, description, two "What you'd do" tasks and the entry route — no skills/degrees/courses blocks), no "Skills to develop" card, and simpler next steps. Going back and changing the career stage to or from "Middle School" rebuilds the step list and clears the answers that no longer apply (subjects, free time, interests, working style).

**Middle School + email:** `CONFIG.middleSchoolEmail` (default `true`) controls whether Middle School users see the email panel at all — see Section 9.

## 5. Staff view, analytics and CSV export

Open `index.html#admin` (or add `#admin` to the hosted URL) and enter the staff PIN (`CONFIG.adminPin`, see Section 9).

The staff view shows, **for this device only**:
- Started / Completed / Completion % counts
- Breakdown tables: top cluster, career stage, region, prior familiarity, top career, and where people drop off (last step reached)
- **Download CSV** — all anonymous completions (now includes an `interestAfter` column)
- **Interest after results**: a tally of the three answers, a response rate (answered ÷ completed), and a cross-table of prior familiarity × interest after results — useful for reporting e.g. how many people new to geothermal left curious or very interested
- **Link clicks**: a tally of clicks by link (job board, student resources, membership, events, etc.)
- An email records panel (counts + latest 20 records) with its own **Download email CSV** (now includes `interestAfter`)
- **Clear email records** and **Clear device data** (separate, each needs confirmation)

All of this is read from `localStorage` on the device being used — it is **not** shared across devices unless you set up `analyticsEndpoint` (below).

## 6. Central backend via Google Sheets (`analyticsEndpoint` / `emailEndpoint`)

By default both are empty, so analytics stay on-device only and **Send** falls back to a `mailto:` link in the visitor's own mail app. On a personal device that's fine. **On a shared device (e.g. a career-fair iPad), the mailto: fallback opens that device's Mail app, which is not what you want** — set up the endpoint below before using GeoMatch at an event.

One Apps Script web app can serve both settings (point `CONFIG.analyticsEndpoint` and `CONFIG.emailEndpoint` at the same deployment URL) — it branches on the shape of the payload it receives: a `to` field means an email request, `type: "interest_after"` means an update to an existing completion row, `type: "link_click"` logs a link click, and anything else is treated as a completion.

### 6.1 Deploy the Apps Script

1. Create (or reuse) a Google Sheet.
2. Extensions → Apps Script, paste the script below.
3. Deploy → New deployment → **Web app** → Execute as **Me** → Who has access: **Anyone**.
4. Copy the deployment URL into both `CONFIG.analyticsEndpoint` and `CONFIG.emailEndpoint` in `app.js`.
5. Replace `SPREADSHEET_ID` at the top of the script with your Sheet's ID (the long string in its URL between `/d/` and `/edit`).

```javascript
var SPREADSHEET_ID = "REPLACE_WITH_YOUR_SHEET_ID";

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (payload.to) {
    return handleEmail(payload, ss);
  }
  if (payload.type === "interest_after") {
    return handleInterestAfter(payload, ss);
  }
  if (payload.type === "link_click") {
    return handleLinkClick(payload, ss);
  }
  return handleAnalytics(payload, ss);
}

function handleEmail(payload, ss) {
  var to = payload.to;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "invalid email" })).setMimeType(ContentService.MimeType.JSON);
  }
  MailApp.sendEmail({ to: to, subject: payload.subject, body: payload.text, htmlBody: payload.html });

  var sheet = ss.getSheetByName("Emails") || ss.insertSheet("Emails");
  var columns = ["timestamp","email","method","stage","region","background","cluster1","cluster2","cluster3","career1","familiarity","followUp","guardianConsent","interestAfter","sessionId"];
  if (sheet.getLastRow() === 0) sheet.appendRow(columns.concat(["repeat"]));

  var existing = [];
  if (sheet.getLastRow() > 1) {
    var values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) existing.push(String(values[i][0]).toLowerCase());
  }
  var isRepeat = existing.indexOf(String(to).toLowerCase()) > -1;

  var record = payload.record || {};
  var row = columns.map(function (c) { return record[c] != null ? record[c] : ""; });
  row.push(isRepeat);
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Turns the raw epoch-ms timestamp into a readable date for the "Date Collected"
// column. Sheets auto-detects the formatted string and stores it as a real date
// value, so it stays sortable/filterable rather than being stuck as plain text.
function formatDateCollected(ms) {
  if (!ms) return "";
  return Utilities.formatDate(new Date(ms), Session.getScriptTimeZone(), "MMM d, yyyy h:mm a");
}

function handleAnalytics(payload, ss) {
  var sheet = ss.getSheetByName("Completions") || ss.insertSheet("Completions");
  var headers = ["type","sessionId","stage","region","background","scenario","cluster1","cluster2","cluster3","topCareer","familiarity","interestAfter","timestamp"];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers.concat(["Date Collected"]));
  var row = headers.map(function (h) { return payload[h] != null ? payload[h] : ""; });
  row.push(formatDateCollected(payload.timestamp));
  sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Updates the matching Completions row (found by sessionId) once a user answers
// "how interested are you" after seeing their results — sent as a follow-up
// POST, separate from the original completion.
function handleInterestAfter(payload, ss) {
  var sheet = ss.getSheetByName("Completions") || ss.insertSheet("Completions");
  if (sheet.getLastRow() < 2) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sidCol = headers.indexOf("sessionId") + 1;
  var interestCol = headers.indexOf("interestAfter") + 1;
  if (sidCol === 0 || interestCol === 0) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  }
  var sids = sheet.getRange(2, sidCol, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < sids.length; i++) {
    if (sids[i][0] === payload.sid) {
      sheet.getRange(i + 2, interestCol).setValue(payload.value);
      break;
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function handleLinkClick(payload, ss) {
  var sheet = ss.getSheetByName("LinkClicks") || ss.insertSheet("LinkClicks");
  if (sheet.getLastRow() === 0) sheet.appendRow(["which", "sid", "t"]);
  sheet.appendRow([payload.which || "", payload.sid || "", payload.t || ""]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

**Google's email quota:** consumer Gmail accounts can send about 100 emails/day via `MailApp`; Google Workspace accounts get a higher quota (~1,500/day on most plans). **For a large event, use a Workspace account** so you don't hit the limit mid-day.

Analytics and link-click requests are sent with `mode: "no-cors"`, so the app never sees (or depends on) the response — if the device is offline or the endpoint fails, it fails silently and the on-device copy is unaffected. Email requests are sent as a normal `fetch` (the Apps Script response includes `access-control-allow-origin: *`), so the app can show a real success/failure message.

**If you already had an older script deployed:** replace its code with the version above and redeploy the *same* deployment as a **new version** (Deploy → Manage deployments → pencil icon → Version: New version → Deploy) so the URL — and therefore `CONFIG`'s endpoints — doesn't change. The existing "Completions" and "Emails" tabs were created with an older, shorter set of columns; either delete those two tabs (they'll be recreated with the right headers on the next request) or manually add the missing columns so new rows line up correctly.

**Editing the Sheet directly:** `handleAnalytics` and `handleEmail` write new rows to fixed column positions, not by matching header names — so adding, removing or reordering a column in the middle of either tab will misalign every row appended after that point. It's safe to add a column at the very end of a tab (e.g. a note column), or to reorder/insert a column as long as you also update the `headers`/`columns` array in the script to match. `handleInterestAfter` is the exception — it looks up `sessionId` and `interestAfter` by header name, so it tolerates column reordering on its own.

**Backfilling a new column onto existing rows:** write a one-off function in the Apps Script editor (e.g. loop over `sheet.getRange(...)` and `setValues(...)`), run it once via the Run button, then delete it. This is more reliable than editing many cells by hand in the Sheets UI, and it's how the "Date Collected" column above was backfilled onto rows that existed before it was added.

### 6.2 Exporting records

Open the "Completions", "Emails" or "LinkClicks" tab in the connected Sheet directly, or use **Download CSV** / **Download email CSV** in the staff view (`#admin`) to export whatever has been collected on that specific device (useful for offline kiosks, or as a backup).

## 7. Links to Geothermal Rising (`CONFIG.links`)

```javascript
links: {
  jobBoard: "https://www.geothermal.org/resources/job-board",
  geothermalRising: "https://www.geothermal.org",
  studentResources: "https://www.geothermal.org/index.php/resources/students",
  studentCommittee: "https://www.geothermal.org/index.php/our-organization/geothermal-rising-student-committee",
  membership: "https://www.geothermal.org/index.php/our-organization/membership",
  events: "https://www.geothermal.org/events",
  learn: ""   // optional — hidden everywhere while empty
}
```

| Key | Appears | Who sees it |
|---|---|---|
| `jobBoard` | "See current geothermal job openings →" below the top careers; "Browse the Geothermal Rising job board" in Next steps | Below-careers link: High School and up (not Middle School). Next-steps line: tertiary and professional only. |
| `geothermalRising` | "Connect with Geothermal Rising and see upcoming events." in Next steps | Everyone |
| `events` | Same line as above | Everyone |
| `studentResources` | "Explore student resources" in Next steps | High School and tertiary |
| `studentCommittee` | "Join the Geothermal Rising Student Committee" in Next steps | High School and tertiary |
| `membership` | "Become a Geothermal Rising member" in Next steps | Tertiary and professional |
| `learn` | "Learn more about geothermal energy" in Next steps | Middle School only — not set by default; fill it in with a page suitable for younger users, or leave empty to hide the line entirely |

Any key left empty is simply not rendered — nothing breaks. Links open in a new tab (`target="_blank" rel="noopener"`), are followed by their URL in parentheses when printed to PDF, are included in the email body (plain text and HTML), and every click is logged as a `link_click` analytics event (see the "Link clicks" table in the staff view, Section 5). **Check that all of these links still work before each event** — Geothermal Rising's own site structure may change.

## 8. Hosting (so QR codes work on phones)

QR codes encode a link back to `location.href` at the time they're generated. On `file://` or `localhost` they still render (so you can check them in meetings), but phones can't open `file://` or `localhost` links, so the app shows a note: *"QR codes only open on phones once GeoMatch is hosted online."*

**GitHub Pages:**
1. Push this folder to a GitHub repository.
2. Repository Settings → Pages → Deploy from branch → select the branch and root folder.
3. GeoMatch will be live at `https://<username>.github.io/<repo>/`.

**Netlify:** drag the `geomatch/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect the repository for continuous deploys. No build command is needed (static files only).

## 9. Settings reference (`CONFIG` in `app.js`)

| Setting | Default | What it does |
|---|---|---|
| `idleSeconds` | `180` | Seconds of inactivity on the question or results screens before the "Still there?" overlay appears. After a further 15 seconds with no tap, the app clears all answers and the email field and returns to the landing screen — important for shared devices at events. |
| `analyticsEndpoint` | set | Google Apps Script URL for central anonymous analytics (Section 6). Empty = on-device only. |
| `emailEndpoint` | set | Google Apps Script URL for sending email directly (Section 6). Empty = falls back to `mailto:`. Can be — and currently is — the same URL as `analyticsEndpoint`. |
| `adminPin` | `"1234"` | PIN required to open the staff view at `#admin`. This is not real security, just a deterrent against casual visitors opening the staff view on a shared device — `1234` is easy to guess, so change it to something less obvious before a public event. |
| `privacyContact` | `"amarise@geothermal.org"` | Email address shown in the "How we use your email" panel for deletion requests. Have the client confirm the privacy wording against their own policy and the data-protection rules that apply where GeoMatch is used — especially for users under 18 (Middle School and High School users are shown an extra notice before sharing their email). |
| `middleSchoolEmail` | `true` | Whether Middle School users see the "Email my results" panel at all. **`true` (current, launch setting):** they see it exactly like everyone else, including the required guardian checkbox. **`false`:** the email panel and the hero "Email my results" button are hidden for Middle School users (based on their *stored* career stage, so this also applies to a reopened Middle School share link); "Take your results with you" becomes "Save your results" with QR code, share link and Save as PDF only — no email address is ever collected or stored for them. Flip this with no code changes once Geothermal Rising decides its policy on collecting emails from under-13s. |
| `links` | see Section 7 | Links to Geothermal Rising pages shown in results and Next steps. |

### Before launch / privacy

`middleSchoolEmail` is on. Confirm with Geothermal Rising whether to keep collecting emails from middle school users (many are under 13). To turn it off, set it to `false`.

## 10. Deviations from the brief / interpretation notes

- **`maxPossible` (fit % denominator):** the original brief specifies adding `weight × share` per answer and tracking `maxPossible` as "the total of the weights of every answer given," without pinning down whether a multi-select question contributes its weight once or once per selected option. This build adds the weight once per *selection* for true multi-selects (interests, activities, environments) — consistent with how their scores accumulate — and once per *question* for field and industry (which are explicitly de-duplicated to avoid double-counting). Free time (Middle School, see below) follows the same per-selection pattern.
- **Free time scoring (Section 2 of the update brief):** each pick's weight (1, or 0.5 for "Sports and team activities") is scaled by 3 to get that pick's "effective weight"; that effective weight is added in full to *every* cluster the pick lists (matching how the Scenario question already treats a multi-cluster option) and the same amount is added once to `maxPossible`. This keeps free time dimensionally consistent with every other scoring input — a pick can't silently inflate fit % beyond what its weight implies.
- **Scenario email/analytics format:** the update brief says picks are "joined with ' | '" in "analytics and the email record." The analytics `complete` event already carried a `scenario` field, so that's where the join happens. The fixed email-record schema (Section 10.5 of the original brief) has no `scenario` column, and this update doesn't explicitly add one, so no new column was invented there.
- **"Why" sentence grouping:** when more than one answer of the *same type* lands among the top reasons (e.g. two matched interests), they're combined into one clause ("you're interested in Data & AI and Research") rather than repeated ("you're interested in X, you're interested in Y") — this applies the career-card grouping rule (Section 7.5) to the cluster-level sentences too (Section 7.1), since the brief's own example never shows two same-type reasons back to back and grouping reads far more naturally when it happens.
- **Entry-route wording:** the original brief's plain-word list for school "entry routes" has four items (University degree, College diploma, Apprenticeship, Industry certification). A small number of careers use `entry_route: "Experience"` (e.g. Operations Manager, Program Director). Adults see "On-the-job experience"; Middle School results use the update brief's own phrase, "Degree, then work experience."

## 11. Open items for the client

- **Logo:** `assets/geothermal-rising-logo.png` is included; if it's ever missing, the app falls back to a text wordmark automatically — no broken image.
- **Backend:** `analyticsEndpoint` and `emailEndpoint` are both configured and live (Section 6). Both Completions and Emails tabs in the connected Sheet were created with an older column layout during development/testing — see the note in Section 6.1 about clearing or fixing them before relying on the data.
- **Admin PIN:** set to `1234`, which is easy to guess — consider changing `CONFIG.adminPin` to something less obvious before a public event.
- **Privacy contact and wording:** `CONFIG.privacyContact` is set to `amarise@geothermal.org`. The privacy note content (who sees the data, retention, deletion) should still be reviewed against Geothermal Rising's actual privacy policy and the regulations that apply in the regions GeoMatch is used, with particular attention to under-18 users.
- **`middleSchoolEmail` decision:** currently `true` (Middle School users see the full email panel with guardian checkbox). Geothermal Rising should confirm this is the policy it wants before Friday — flipping it to `false` needs no code changes, just a one-line edit in `app.js`.
- **`CONFIG.links.learn`:** left empty — fill in with a "learn about geothermal" page suitable for younger users if Geothermal Rising has one, or leave it empty to keep that Next-steps line hidden for Middle School.
- **Career content review:** the 76 careers in `data/careers.js` were written for accuracy and plain language, but member companies and subject-matter reviewers should sanity-check descriptions, degrees and courses for their region before publishing.
