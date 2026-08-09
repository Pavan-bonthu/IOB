// Server-side only. This file never gets sent to the browser, unlike the
// old client-side VALID_USERS array.
//
// TODO: swap this for real hashed passwords (bcrypt) before going further -
// plaintext passwords here are only OK as a stopgap for an internal tool.

const VALID_USERS = [
  { username: "admin", password: "changeme123", role: "admin" },
  { username: "user1", password: "user123", role: "user" },
  { username: "user2", password: "user456", role: "user" },
];

function findUser(username, password) {
  return VALID_USERS.find(
    (u) => u.username === username && u.password === password
  );
}

module.exports = { findUser };
