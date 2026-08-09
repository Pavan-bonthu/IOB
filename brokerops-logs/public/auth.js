/* =========================================================
   CONFIG — Application links
   ========================================================= */

// Log Tracker now lives on this same server/app (no separate login).
// Case Management stays wherever your existing case app is hosted.
const APP_LINKS = {
  caseManagement: "http://103.138.137.170:8080/salesforcedashboard/",
  logTracker: "/dashboard.html",
};


/* =========================================================
   Session key (client-side mirror, used for UI only)
   ========================================================= */

const SESSION_KEY = "brokerops_session";


/* =========================================================
   Session helpers
   ========================================================= */

// Save logged-in user info for UI purposes (greeting, avatar, role checks
// used by pages like Case Management). The real access control for the
// Log Tracker does NOT depend on this - it's enforced server-side by a
// secure, httpOnly session cookie that this JS can't read or forge.
function setSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: user.username,
      role: user.role,
      loginAt: Date.now()
    })
  );
}

// Get current session
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

// Clear session / logout - clears the local UI copy AND the real server
// session, so the Log Tracker cookie is actually invalidated too.
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  fetch("/api/logout", { method: "POST" }).catch(() => {});
}

// Make sure user is logged in
function requireSession() {
  if (!getSession()) {
    window.location.href = "login.html";
  }
}


/* =========================================================
   Login
   ========================================================= */

// Verifies credentials against the server (the only place passwords are
// checked now) and, on success, sets both the secure server cookie and
// the local UI session in one step. Returns true/false.
async function attemptLogin(username, password) {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) return false;

    const user = await res.json(); // { username, role }
    setSession(user);
    return true;
  } catch {
    return false;
  }
}


/* =========================================================
   Role helpers
   ========================================================= */

// Check whether current user is admin
function isAdmin() {
  const session = getSession();
  return session && session.role === "admin";
}

// Check whether current user is normal user
function isNormalUser() {
  const session = getSession();
  return session && session.role === "user";
}

// Get current username
function getCurrentUsername() {
  const session = getSession();
  return session ? session.username : null;
}

// Get current role
function getCurrentRole() {
  const session = getSession();
  return session ? session.role : null;
}
