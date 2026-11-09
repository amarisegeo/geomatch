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

## 5. Staff view, analytics and CSV export

Open `index.html#admin` (or add `#admin` to the hosted URL) and enter the staff PIN (`CONFIG.adminPin`, see Section 9).

The staff view shows, **for this device only**:
- Started / Completed / Completion % counts
- Breakdown tables: top cluster, career stage, region, prior familiarity, top career, and where people drop off (last step reached)
- **Download CSV** — all anonymous completions
- An email records panel (counts + latest 20 records) with its own **Download email CSV**
- **Clear email records** and **Clear device data** (separate, each needs confirmation)

All of this is read from `localStorage` on the device being used — it is **not** shared across devices unless you set up `analyticsEndpoint` (below).

## 6. Central analytics via Google Sheets (`analyticsEndpoint`)

By default `CONFIG.analyticsEndpoint` is empty, so analytics stay on-device only. To collect anonymous completions centrally:

1. Create a Google Sheet.
2. Extensions → Apps Script, paste the script below, and deploy it (Deploy → New deployment → Web app → Execute as **Me** → Who has access: **Anyone**).
3. Copy the deployment URL into `CONFIG.analyticsEndpoint` in `app.js`.

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Completions") || ss.insertSheet("Completions");
  var headers = ["type","sessionId","stage","region","background","scenario","cluster1","cluster2","cluster3","topCareer","familiarity","timestamp"];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.appendRow(headers.map(function (h) { return data[h] || ""; }));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

Requests are sent with `mode: "no-cors"`, so the app never sees (or depends on) the response — if the device is offline or the endpoint fails, it fails silently and the on-device copy is unaffected.

## 7. Email sending (`emailEndpoint`)

By default `CONFIG.emailEndpoint` is empty, which means **Send** falls back to opening a `mailto:` link in the visitor's own mail app. On a personal device that's fine. **On a shared device (e.g. a career-fair iPad), this opens that device's Mail app, which is not what you want** — set up the endpoint below before using GeoMatch at an event.

### 7.1 Deploy the Apps Script

1. Create (or reuse) a Google Sheet to hold email records.
2. Extensions → Apps Script, paste the script below.
3. Deploy → New deployment → **Web app** → Execute as **Me** → Who has access: **Anyone**.
4. Copy the deployment URL into `CONFIG.emailEndpoint` in `app.js`.

```javascript
function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var to = payload.to;

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "invalid email" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 1. Send the email.
  MailApp.sendEmail({
    to: to,
    subject: payload.subject,
    body: payload.text,
    htmlBody: payload.html
  });

  // 2. Append the record to the "Emails" tab.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Emails") || ss.insertSheet("Emails");
  var columns = ["timestamp","email","method","stage","region","background","cluster1","cluster2","cluster3","career1","familiarity","followUp","guardianConsent","sessionId"];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns.concat(["repeat"]));
  }

  // Check whether this address has been seen before (case-insensitive).
  var existing = sheet.getLastRow() > 1
    ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat().map(function (v) { return String(v).toLowerCase(); })
    : [];
  var isRepeat = existing.indexOf(String(to).toLowerCase()) > -1;

  var record = payload.record || {};
  var row = columns.map(function (c) { return record[c] != null ? record[c] : ""; });
  row.push(isRepeat);
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

**Google's email quota:** consumer Gmail accounts can send about 100 emails/day via `MailApp`; Google Workspace accounts get a higher quota (~1,500/day on most plans). **For a large event, use a Workspace account** so you don't hit the limit mid-day.

### 7.2 Exporting email records

Either open the "Emails" tab in the connected Sheet directly, or use **Download email CSV** in the staff view (`#admin`) to export whatever has been collected on that specific device (useful for offline kiosks, or as a backup).

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
| `analyticsEndpoint` | `""` | Google Apps Script URL for central anonymous analytics (Section 6). Empty = on-device only. |
| `emailEndpoint` | `""` | Google Apps Script URL for sending email directly (Section 7). Empty = falls back to `mailto:`. |
| `adminPin` | `"1234"` | PIN required to open the staff view at `#admin`. This is not real security, just a deterrent against casual visitors opening the staff view on a shared device — `1234` is easy to guess, so change it to something less obvious before a public event. |
| `privacyContact` | `"amarise@geothermal.org"` | Email address shown in the "How we use your email" panel for deletion requests. Have the client confirm the privacy wording against their own policy and the data-protection rules that apply where GeoMatch is used — especially for users under 18 (Middle School and High School users are shown an extra notice before sharing their email). |

## 10. Deviations from the brief / interpretation notes

- **`maxPossible` (fit % denominator):** the brief specifies adding `weight × share` per answer and tracking `maxPossible` as "the total of the weights of every answer given," without pinning down whether a multi-select question contributes its weight once or once per selected option. This build adds the weight once per *selection* for true multi-selects (interests, activities, environments) — consistent with how their scores accumulate — and once per *question* for field and industry (which are explicitly de-duplicated to avoid double-counting, per Section 8.3). This keeps fit % meaningful (never silently exceeding 100, never artificially capped except at the 99 ceiling) without hard-coding a normalisation that contradicts "do not scale scores so the top cluster always reads 100%."
- **Entry-route wording:** the brief's plain-word list for school "entry routes" (Section 9.7) has four items (University degree, College diploma, Apprenticeship, Industry certification). A small number of careers use `entry_route: "Experience"` (e.g. Operations Manager, Program Director). These map to "On-the-job experience" so the list never silently drops a route.

## 11. Open items for the client

- **Logo:** `assets/geothermal-rising-logo.png` is included; if it's ever missing, the app falls back to a text wordmark automatically — no broken image.
- **Email endpoint:** not configured by default (ships with the `mailto:` fallback). Set up before any event with a shared device.
- **Admin PIN:** set to `1234`, which is easy to guess — consider changing `CONFIG.adminPin` to something less obvious before a public event.
- **Privacy contact and wording:** `CONFIG.privacyContact` is set to `amarise@geothermal.org`. The privacy note content (who sees the data, retention, deletion) should still be reviewed against Geothermal Rising's actual privacy policy and the regulations that apply in the regions GeoMatch is used, with particular attention to under-18 users.
- **Career content review:** the 76 careers in `data/careers.js` were written for accuracy and plain language, but member companies and subject-matter reviewers should sanity-check descriptions, degrees and courses for their region before publishing.
