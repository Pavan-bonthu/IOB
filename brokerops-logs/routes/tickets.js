const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const db = require("../lib/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const LOGS_BASE_PATH = process.env.LOGS_BASE_PATH || "/else";

function folderForTicket(ticketNumber) {
  // Keep folder names filesystem-safe - strip anything that isn't
  // alphanumeric, dash, or underscore.
  const safe = ticketNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LOGS_BASE_PATH, safe);
}

// ---- multer storage: route files straight into the ticket's own folder ----
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const ticket = await db.getTicketById(req.params.id);
      if (!ticket) return cb(new Error("Ticket not found"));
      fs.mkdirSync(ticket.folderPath, { recursive: true });
      cb(null, ticket.folderPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Prefix with a short random id so re-uploading a same-named file
    // never silently overwrites an earlier log.
    const prefix = crypto.randomBytes(4).toString("hex");
    cb(null, `${prefix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// ---- list tickets ----
// GET /api/tickets            -> pending tickets (default dashboard view)
// GET /api/tickets?status=done -> admin-only archive view
router.get("/", requireAuth, async (req, res) => {
  const status = req.query.status === "done" ? "done" : "pending";

  if (status === "done" && req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }

  const all = await db.getAllTickets();
  const filtered = all
    .filter((t) => t.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ tickets: filtered, count: filtered.length });
});

// ---- search a closed ticket by ticket number (admin reference lookup) ----
router.get("/search", requireAdmin, async (req, res) => {
  const { ticketNumber } = req.query;
  if (!ticketNumber) {
    return res.status(400).json({ error: "ticketNumber query param required" });
  }
  const ticket = await db.getTicketByNumber(ticketNumber);
  if (!ticket) return res.status(404).json({ error: "No ticket found with that number" });
  res.json(ticket);
});

// ---- create a new ticket ----
router.post("/", requireAuth, async (req, res) => {
  const { ticketNumber } = req.body || {};
  if (!ticketNumber || !ticketNumber.trim()) {
    return res.status(400).json({ error: "Ticket number is required" });
  }

  const existing = await db.getTicketByNumber(ticketNumber.trim());
  if (existing) {
    return res.status(409).json({ error: "A ticket with this number already exists" });
  }

  const folderPath = folderForTicket(ticketNumber.trim());
  fs.mkdirSync(folderPath, { recursive: true });

  const ticket = {
    id: crypto.randomUUID(),
    ticketNumber: ticketNumber.trim(),
    createdBy: req.session.user.username, // auto-filled from session, not user-editable
    createdByRole: req.session.user.role,
    createdAt: new Date().toISOString(),
    status: "pending",
    notes: null,
    doneBy: null,
    doneAt: null,
    folderPath,
    files: [],
  };

  await db.addTicket(ticket);
  res.status(201).json(ticket);
});

// ---- upload one or more files to a ticket's folder ----
router.post("/:id/upload", requireAuth, upload.array("files", 20), async (req, res) => {
  const ticket = await db.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const newFiles = (req.files || []).map((f) => ({
    originalName: f.originalname,
    storedName: f.filename,
    size: f.size,
    uploadedBy: req.session.user.username,
    uploadedAt: new Date().toISOString(),
  }));

  const updated = await db.updateTicket(ticket.id, {
    files: [...ticket.files, ...newFiles],
  });

  res.json(updated);
});

// ---- mark done: admin only, notes are mandatory ----
router.post("/:id/mark-done", requireAdmin, async (req, res) => {
  const { notes } = req.body || {};
  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: "Analysis notes are required before marking a ticket done" });
  }

  const ticket = await db.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (ticket.status === "done") {
    return res.status(409).json({ error: "Ticket is already marked done" });
  }

  const updated = await db.updateTicket(ticket.id, {
    status: "done",
    notes: notes.trim(),
    doneBy: req.session.user.username,
    doneAt: new Date().toISOString(),
  });

  res.json(updated);
});

module.exports = router;
