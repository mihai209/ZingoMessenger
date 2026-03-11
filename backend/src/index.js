require("dotenv").config({ path: process.env.ENV_FILE });

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { db, initSchema } = require("./db");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const allowedOrigins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uploadsRoot = path.join(__dirname, "..", "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".png");
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

app.use("/uploads", express.static(uploadsRoot));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sessionTtlMinutes() {
  const raw = process.env.SESSION_TTL_MINUTES || "43200";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 43200;
}

function buildExpiry() {
  const mins = sessionTtlMinutes();
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

async function issueSession(userId) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = buildExpiry();
  await db("sessions").insert({
    id,
    user_id: userId,
    expires_at: expiresAt,
    created_at: now,
    last_seen_at: now
  });
  return { id, expiresAt };
}

async function getSession(req) {
  const token = req.cookies?.zingo_session;
  if (!token) return null;
  const session = await db("sessions").where({ id: token }).first();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db("sessions").where({ id: token }).del();
    return null;
  }
  const newExpiresAt = buildExpiry();
  await db("sessions").where({ id: token }).update({
    expires_at: newExpiresAt,
    last_seen_at: new Date().toISOString()
  });
  return { ...session, expires_at: newExpiresAt };
}

async function requireAuth(req, res, next) {
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const user = await db("users").where({ id: session.user_id }).first();
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.user = user;
  req.session = session;
  return next();
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

  const session = await issueSession(user.id);
  const cookieSecure = (process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
  res.cookie("zingo_session", session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    maxAge: sessionTtlMinutes() * 60 * 1000
  });

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    birthDate: user.birth_date,
    avatarUrl: user.avatar_url || null
  });
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  await db("sessions").where({ id: req.session.id }).del();
  res.clearCookie("zingo_session");
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const user = req.user;
  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    birthDate: user.birth_date,
    avatarUrl: user.avatar_url || null
  });
});

app.post("/account/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body || {};
  const errors = [];

  if (!currentPassword) errors.push("current password required");
  if (!newPassword || newPassword.length < 8) errors.push("new password must be at least 8 characters");
  if (newPassword !== newPasswordConfirm) errors.push("password confirmation does not match");

  if (errors.length) {
    return res.status(400).json({ error: "validation_error", details: errors });
  }

  const ok = await bcrypt.compare(currentPassword, req.user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db("users").where({ id: req.user.id }).update({ password_hash: passwordHash });
  await db("sessions").where({ user_id: req.user.id }).del();
  res.clearCookie("zingo_session");
  return res.json({ ok: true, logout: true });
});

app.post("/account/avatar/url", requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "invalid_url" });
  }
  await db("users").where({ id: req.user.id }).update({ avatar_url: url });
  return res.json({ ok: true, avatarUrl: url });
});

app.post("/account/avatar/upload", requireAuth, upload.single("avatar"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "file_required" });
  }
  const publicUrl = `/uploads/avatars/${req.file.filename}`;
  await db("users").where({ id: req.user.id }).update({ avatar_url: publicUrl });
  return res.json({ ok: true, avatarUrl: publicUrl });
});

async function start() {
  try {
    console.log("Backend booting...");
    console.log(`DB_TYPE=${process.env.DB_TYPE || "sqlite"}`);
    console.log(`DB_SQLITE_PATH=${process.env.DB_SQLITE_PATH || "./data/zingo.db"}`);
    console.log(`PORT=${process.env.PORT || 8080}`);
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
