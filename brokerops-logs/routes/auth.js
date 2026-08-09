const express = require("express");
const { findUser } = require("../lib/users");

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = findUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  req.session.user = { username: user.username, role: user.role };
  res.json({ username: user.username, role: user.role });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json(req.session.user);
});

module.exports = router;
