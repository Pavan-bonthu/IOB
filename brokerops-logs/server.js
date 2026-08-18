require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "please-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

app.use("/api", authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use(express.static(path.join(__dirname, "public")));

// Anything else -> send to login; the frontend JS decides where to route
// a logged-in user from there.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => {
  console.log(`IOB logs server running on http://103.138.137.170:${PORT}`);
  console.log(`Ticket folders will be created under: ${process.env.LOGS_BASE_PATH || "/else"}`);
});
