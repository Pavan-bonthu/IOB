let currentUser = null;
let currentTickets = [];
let pendingMarkDoneId = null;

const els = {
  whoami: document.getElementById("whoami"),
  avatarLetter: document.getElementById("avatarLetter"),
  roleBadge: document.getElementById("roleBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  pendingCount: document.getElementById("pendingCount"),
  newTicketForm: document.getElementById("newTicketForm"),
  ticketNumber: document.getElementById("ticketNumber"),
  ownerName: document.getElementById("ownerName"),
  newTicketError: document.getElementById("newTicketError"),
  ticketList: document.getElementById("ticketList"),
  adminSearchPanel: document.getElementById("adminSearchPanel"),
  searchTicketNumber: document.getElementById("searchTicketNumber"),
  searchBtn: document.getElementById("searchBtn"),
  searchResult: document.getElementById("searchResult"),
  markDoneModal: document.getElementById("markDoneModal"),
  markDoneTicketNumber: document.getElementById("markDoneTicketNumber"),
  doneNotes: document.getElementById("doneNotes"),
  markDoneError: document.getElementById("markDoneError"),
  markDoneCancel: document.getElementById("markDoneCancel"),
  markDoneConfirm: document.getElementById("markDoneConfirm"),
};

init();

async function init() {
  const meRes = await fetch("/api/me");
  if (!meRes.ok) {
    window.location.href = "login.html";
    return;
  }
  currentUser = await meRes.json();

  els.whoami.textContent = currentUser.username;
  els.avatarLetter.textContent = currentUser.username.charAt(0);
  els.roleBadge.textContent = currentUser.role;
  els.roleBadge.classList.add(currentUser.role);
  els.ownerName.value = currentUser.username; // auto-filled, read-only, from session

  // Keep the localStorage session (used by home.html for the greeting)
  // in sync with the real server session, in case someone lands here
  // via a direct link with a stale local copy.
  setSession(currentUser);

  if (currentUser.role === "admin") {
    els.adminSearchPanel.style.display = "block";
  }

  await loadTickets();
}

async function loadTickets() {
  const res = await fetch("/api/tickets"); // defaults to status=pending
  const data = await res.json();
  currentTickets = data.tickets || [];
  els.pendingCount.textContent = data.count ?? currentTickets.length;
  renderTickets();
}

function renderTickets() {
  if (currentTickets.length === 0) {
    els.ticketList.innerHTML = `<div class="empty-state">No pending tickets. Create one above once a case needs log analysis.</div>`;
    return;
  }

  els.ticketList.innerHTML = currentTickets.map(ticketRowHtml).join("");

  // Wire up per-row interactions after render.
  currentTickets.forEach((t) => {
    const copyBtn = document.getElementById(`copy-${t.id}`);
    if (copyBtn) {
      copyBtn.addEventListener("click", () => copyPath(t.folderPath, copyBtn));
    }
    const fileInput = document.getElementById(`file-${t.id}`);
    if (fileInput) {
      fileInput.addEventListener("change", (e) => handleUpload(t.id, e.target.files));
    }
    const doneBtn = document.getElementById(`done-${t.id}`);
    if (doneBtn) {
      doneBtn.addEventListener("click", () => openMarkDoneModal(t));
    }
  });
}

function ticketRowHtml(t) {
  const fileChips = t.files
    .map((f) => `<span class="file-chip">${escapeHtml(f.originalName)}</span>`)
    .join("");

  const adminDoneBtn =
    currentUser.role === "admin"
      ? `<button class="btn-done" id="done-${t.id}">Mark done</button>`
      : "";

  return `
    <div class="ticket-row">
      <div class="ticket-main">
        <div class="ticket-top">
          <span class="ticket-number">${escapeHtml(t.ticketNumber)}</span>
          <span class="ticket-owner">opened by <b>${escapeHtml(t.createdBy)}</b> · ${timeAgo(t.createdAt)}</span>
        </div>

        <div class="path-line">
          <span class="prompt">$</span>
          <span>${escapeHtml(t.folderPath)}</span>
          <button class="btn-ghost" id="copy-${t.id}">Copy path</button>
        </div>

        ${fileChips ? `<div class="file-chip-row">${fileChips}</div>` : ""}
      </div>

      <div class="ticket-actions">
        <label class="upload-label">
          Upload files
          <input type="file" id="file-${t.id}" multiple />
        </label>
        ${adminDoneBtn}
      </div>
    </div>
  `;
}

// ---------------- create ticket ----------------

els.newTicketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.newTicketError.textContent = "";

  const ticketNumber = els.ticketNumber.value.trim();
  if (!ticketNumber) return;

  const res = await fetch("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketNumber }),
  });
  const data = await res.json();

  if (!res.ok) {
    els.newTicketError.textContent = data.error || "Could not create ticket";
    return;
  }

  els.ticketNumber.value = "";
  await loadTickets();
});

// ---------------- upload ----------------

async function handleUpload(ticketId, fileList) {
  if (!fileList || fileList.length === 0) return;

  const formData = new FormData();
  Array.from(fileList).forEach((f) => formData.append("files", f));

  await fetch(`/api/tickets/${ticketId}/upload`, {
    method: "POST",
    body: formData,
  });

  await loadTickets();
}

// ---------------- mark done ----------------

function openMarkDoneModal(ticket) {
  pendingMarkDoneId = ticket.id;
  els.markDoneTicketNumber.textContent = ticket.ticketNumber;
  els.doneNotes.value = "";
  els.markDoneError.textContent = "";
  els.markDoneConfirm.disabled = true;
  els.markDoneModal.classList.remove("hidden");
  els.doneNotes.focus();
}

els.doneNotes.addEventListener("input", () => {
  els.markDoneConfirm.disabled = els.doneNotes.value.trim().length === 0;
});

els.markDoneCancel.addEventListener("click", () => {
  els.markDoneModal.classList.add("hidden");
  pendingMarkDoneId = null;
});

els.markDoneConfirm.addEventListener("click", async () => {
  if (!pendingMarkDoneId) return;
  const notes = els.doneNotes.value.trim();
  if (!notes) return; // mandatory - button should already be disabled otherwise

  const res = await fetch(`/api/tickets/${pendingMarkDoneId}/mark-done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  const data = await res.json();

  if (!res.ok) {
    els.markDoneError.textContent = data.error || "Could not mark ticket done";
    return;
  }

  els.markDoneModal.classList.add("hidden");
  pendingMarkDoneId = null;
  await loadTickets();
});

// ---------------- admin: search closed tickets ----------------

if (els.searchBtn) {
  els.searchBtn.addEventListener("click", async () => {
    const ticketNumber = els.searchTicketNumber.value.trim();
    els.searchResult.innerHTML = "";
    if (!ticketNumber) return;

    const res = await fetch(`/api/tickets/search?ticketNumber=${encodeURIComponent(ticketNumber)}`);
    const data = await res.json();

    if (!res.ok) {
      els.searchResult.innerHTML = `<p class="error-text">${escapeHtml(data.error || "Not found")}</p>`;
      return;
    }

    els.searchResult.innerHTML = `
      <div class="ticket-row done" style="margin-top:14px">
        <div class="ticket-main">
          <div class="ticket-top">
            <span class="ticket-number">${escapeHtml(data.ticketNumber)}</span>
            <span class="ticket-owner">opened by <b>${escapeHtml(data.createdBy)}</b> · closed by <b>${escapeHtml(data.doneBy)}</b></span>
          </div>
          <div class="path-line">
            <span class="prompt">$</span>
            <span>${escapeHtml(data.folderPath)}</span>
          </div>
          <div class="notes-block"><b>Analysis notes:</b> ${escapeHtml(data.notes || "")}</div>
        </div>
      </div>
    `;
  });
}

// ---------------- logout ----------------

els.logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  clearSession(); // also clears the localStorage copy used by home.html
  window.location.href = "login.html";
});

// ---------------- helpers ----------------

function copyPath(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = original), 1200);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
