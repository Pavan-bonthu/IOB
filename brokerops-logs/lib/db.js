// Minimal JSON-file "database" for tickets.
// Good enough for an internal tool with a handful of concurrent users.
// Writes are serialized with a simple promise queue so two requests
// landing at once can't corrupt the file.

const fs = require("fs");
const path = require("path");

const DATA_FILE = process.env.DATA_FILE || "/else/_tickets-db.json";

let writeQueue = Promise.resolve();

function ensureFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tickets: [] }, null, 2));
  }
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    // If the file is somehow empty/corrupt, don't crash the whole app -
    // start fresh rather than losing the ability to boot.
    return { tickets: [] };
  }
}

function writeAll(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  return writeQueue;
}

async function getAllTickets() {
  return readAll().tickets;
}

async function getTicketById(id) {
  return readAll().tickets.find((t) => t.id === id) || null;
}

async function getTicketByNumber(ticketNumber) {
  return (
    readAll().tickets.find(
      (t) => t.ticketNumber.toLowerCase() === ticketNumber.toLowerCase()
    ) || null
  );
}

async function addTicket(ticket) {
  const data = readAll();
  data.tickets.push(ticket);
  await writeAll(data);
  return ticket;
}

async function updateTicket(id, updates) {
  const data = readAll();
  const idx = data.tickets.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  data.tickets[idx] = { ...data.tickets[idx], ...updates };
  await writeAll(data);
  return data.tickets[idx];
}

module.exports = {
  DATA_FILE,
  getAllTickets,
  getTicketById,
  getTicketByNumber,
  addTicket,
  updateTicket,
};
