require("dotenv").config({ path: process.env.ENV_FILE });

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { db, initSchema } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

app.post("/auth/register", async (req, res) => {
  const { username, email, phone, password, passwordConfirm, birthDate } = req.body || {};
  const errors = [];

  if (!username || username.trim().length < 3 || username.trim().length > 32) {
    errors.push("username must be 3-32 characters");
  }
  if (!email && !phone) {
    errors.push("email or phone is required");
  }
  if (!password || password.length < 8) {
    errors.push("password must be at least 8 characters");
  }
  if (password !== passwordConfirm) {
    errors.push("password confirmation does not match");
  }
  if (!birthDate || !isValidDate(birthDate)) {
    errors.push("birthDate must be ISO format yyyy-MM-dd");
  }

  if (errors.length) {
    return res.status(400).json({ error: "validation_error", details: errors });
  }

  const conflicts = [];
  if (await db("users").where({ username: username.trim() }).first()) {
    conflicts.push("username already taken");
  }
  if (email && (await db("users").where({ email: email.trim() }).first())) {
    conflicts.push("email already registered");
  }
  if (phone && (await db("users").where({ phone: phone.trim() }).first())) {
    conflicts.push("phone already registered");
  }

  if (conflicts.length) {
    return res.status(409).json({ error: "conflict", details: conflicts });
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  await db("users").insert({
    id,
    username: username.trim(),
    email: email ? email.trim() : null,
    phone: phone ? phone.trim() : null,
    password_hash: passwordHash,
    birth_date: birthDate,
    created_at: new Date().toISOString()
  });

  return res.status(201).json({
    id,
    username: username.trim(),
    email: email ? email.trim() : null,
    phone: phone ? phone.trim() : null,
    birthDate
  });
});

app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ error: "validation_error" });
  }

  const user = await db("users")
    .where({ username: identifier.trim() })
    .orWhere({ email: identifier.trim() })
    .orWhere({ phone: identifier.trim() })
    .first();

  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    birthDate: user.birth_date
  });
});

async function start() {
  try {
    await initSchema();
    const port = Number(process.env.PORT || 8080);
    app.listen(port, () => {
      console.log(`Backend listening on ${port}`);
    });
  } catch (err) {
    console.error("Failed to start backend:", err);
    process.exit(1);
  }
}

start();
