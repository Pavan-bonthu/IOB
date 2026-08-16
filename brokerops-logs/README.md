# IOB Log Tracker

Your existing login → home dashboard → Log Tracker flow, now wired together
as one app: one sign-in, no second login screen. Log in, open a ticket,
upload the case's log files (they land straight in a per-ticket folder on
this server), and see a live pending count. Admin marks a ticket done only
after writing mandatory analysis notes — once done it drops off the pending
list on the website, but the folder, files, and notes stay on the server
forever, and admins can look a closed ticket back up by ticket number.

## 1. What changed vs. your code

- **Everything now runs from one Express server and one `public/` folder**:
  `login.html`, `home.html`, `auth.js`, and `dashboard.html` (the Log
  Tracker) all live together and share one session. Clicking "Launch" on
  the Log Tracker card just opens `dashboard.html` — you're already signed
  in, same as Case Management.
- **The "Welcome back, undefined" bug is fixed.** The cause: your old
  `login.html` called `setSession(username)` with a plain string right
  after `attemptLogin()` had already called `setSession(user)` correctly —
  the second call overwrote the good session with `user.username` where
  `user` was just the string `"admin"`, which is `undefined`. Fixed by
  having `attemptLogin()` set the session once, from the real server
  response.
- **Passwords are checked server-side now, not in the browser.** Your old
  `VALID_USERS` array shipped to every visitor — anyone could read it in
  dev tools. It's moved to `lib/users.js`, server-only. `auth.js` still
  keeps a `localStorage` copy of `{username, role}` for the UI (greeting,
  avatar, Case Management's `isAdmin()` checks) — that's unchanged and
  still works exactly like before.
- **The Log Tracker's admin-only actions (Mark Done) are protected by a
  real, secure `httpOnly` session cookie**, not `localStorage`. That
  matters because `localStorage` can be edited from the browser console —
  someone could set `role: "admin"` themselves. The cookie can't be read
  or forged from JavaScript, so Mark Done is genuinely admin-only no
  matter what a user edits client-side.
- **Didn't have your real `style.css`**, so I rebuilt one using the exact
  same CSS variable names your pages already reference (`--accent`,
  `--card`, `--font-display`, etc). If you have the real file, drop it in
  at `public/style.css` — everything, including the Log Tracker page,
  will pick up your real theme automatically since it's built on the same
  variables.

## 2. Deploy on your server (103.138.137.170)

This now **replaces** wherever `login.html`/`home.html` are currently
hosted — don't run it alongside the old static copies, or you'll have two
different login pages pointing at two different sessions. You said
Node.js + SSH/sudo is available — do this over PuTTY:

```bash
# 1. Install Node.js if it isn't already there (Ubuntu/Debian example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Copy this whole IOB-logs/ folder onto the server, e.g. via scp
#    (from your own machine): scp -r IOB-logs user@103.138.137.170:/opt/

# 3. On the server:
cd /opt/IOB-logs
npm install --production

# 4. Configure
cp .env.example .env
nano .env
#    - Set LOGS_BASE_PATH to where you want ticket folders created
#      (this can be the /else path you mentioned)
#    - Set SESSION_SECRET to a random string: openssl rand -hex 32
#    - Set PORT — use 8080 if that's what your old login page ran on,
#      so existing bookmarks/links keep working

# 5. Make sure the folder in LOGS_BASE_PATH exists and Node can write to it
sudo mkdir -p /else
sudo chown $(whoami) /else

# 6. Run it
node server.js
```

Visit `http://103.138.137.170:<PORT>/login.html`. Same admin/user1/user2
credentials as before (change these in `lib/users.js` whenever you like).
From there: sign in once → land on `home.html` → click **Launch** on Log
Tracker → you're straight into `dashboard.html`, still signed in.

## 3. Keep it running (recommended: pm2)

```bash
sudo npm install -g pm2
pm2 start server.js --name IOB-logs
pm2 save
pm2 startup   # follow the printed instructions so it survives a reboot
```

## 4. Putting it behind your existing dashboard

Your `APP_LINKS` object already points at `caseManagement` and `logTracker`
URLs. Point `logTracker` at wherever this app ends up running, e.g.:

```js
logTracker: "http://103.138.137.170:4000/dashboard.html",
```

If you want a case in `caseManagement` to jump straight to its ticket's
folder path here, that just needs a link built as
`http://103.138.137.170:4000/dashboard.html?search=<ticketNumber>` — say the
word and I'll wire that query param into the search box automatically.

## 5. How the pieces map to what you asked for

| You asked for | Where it is |
|---|---|
| Login as admin/user | `routes/auth.js`, `lib/users.js` — now server-side |
| Ticket number field | "Open a new ticket" form on the dashboard |
| Name auto-filled, grayed, uncontrollable | `ownerName` input, `readonly`, filled from the session — the server also independently stamps `createdBy` from the session, so even editing the page can't fake a name |
| Files land on the Linux server, per-ticket folder | `routes/tickets.js` — `POST /api/tickets` makes `/else/<ticketNumber>/`, uploads go straight into it via multer |
| Pending count going down as tickets close | `pendingCount` stat card, backed by `GET /api/tickets` |
| Mark Done — admin only | `requireAdmin` middleware on `POST /api/tickets/:id/mark-done` |
| Notes mandatory before Mark Done works | Button is disabled client-side until notes are typed, **and** the server rejects the request with no notes regardless — so it can't be bypassed by calling the API directly |
| Ticket disappears from site, still stored on server | Status flips to `done`; default ticket list only shows `pending`; the JSON record + all uploaded files stay in `LOGS_BASE_PATH` untouched |
| Reference a closed case later | Admin-only "Look up a closed ticket" search box, by ticket number |
| Arrow/link straight to the logs path for PuTTY | Each row shows the full path in monospace with a "Copy path" button |

## 6. Things worth doing next (didn't want to guess and overbuild)

- **Passwords are still plaintext** in `lib/users.js`. Fine for a first
  internal cut, but worth moving to bcrypt hashes soon.
- **HTTP, not HTTPS** — logins currently travel in the clear on your network.
  Put nginx + a TLS cert in front of this when you get a chance, then flip
  `COOKIE_SECURE=true` in `.env`.
- The JSON "database" (`_tickets-db.json`) is fine at your current volume.
  If ticket volume gets large, this is a straightforward swap to SQLite —
  happy to do that later without changing anything above it.
