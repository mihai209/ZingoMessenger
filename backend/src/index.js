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
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uploadsRoot = path.join(__dirname, "..", "uploads");
const avatarsDir = path.join(uploadsRoot, "avatars");
const chatUploadsDir = path.join(uploadsRoot, "chat");
fs.mkdirSync(avatarsDir, { recursive: true });
fs.mkdirSync(chatUploadsDir, { recursive: true });

function resolveUploadPath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  if (!publicUrl.startsWith("/uploads/")) return null;
  const relative = publicUrl.replace("/uploads/", "");
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(uploadsRoot, normalized);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".png");
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, chatUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".bin");
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 400 * 1024 * 1024 }
});

app.use("/uploads", express.static(uploadsRoot));

const sseClients = new Map();
const activeCalls = new Map();
const userActiveCall = new Map();

function addClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = sseClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(userId);
}

function sendEvent(userId, event, payload) {
  const set = sseClients.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    client.write(`event: ${event}\n`);
    client.write(`data: ${data}\n\n`);
  }
}

function getOtherCallParticipant(call, userId) {
  if (!call) return null;
  if (call.fromId === userId) return call.toId;
  if (call.toId === userId) return call.fromId;
  return null;
}

function clearCall(callId, reason) {
  const call = activeCalls.get(callId);
  if (!call) return;
  if (call.timeoutHandle) {
    clearTimeout(call.timeoutHandle);
  }
  activeCalls.delete(callId);
  if (call.fromId) userActiveCall.delete(call.fromId);
  if (call.toId) userActiveCall.delete(call.toId);
  if (reason) {
    sendEvent(call.fromId, reason, { callId });
    sendEvent(call.toId, reason, { callId });
  }
}

async function updateCallHistory(call, status) {
  if (!call?.historyId) return;
  const now = new Date();
  const update = { status };
  if (status === "accepted") {
    update.accepted_at = now.toISOString();
  }
  if (["declined", "timeout", "ended"].includes(status)) {
    update.ended_at = now.toISOString();
    const start = call.acceptedAt || call.createdAt;
    if (start) {
      const duration = Math.max(
        0,
        Math.floor((now.getTime() - new Date(start).getTime()) / 1000)
      );
      update.duration_seconds = duration;
    }
  }
  await db("call_history").where({ id: call.historyId }).update(update);
  sendEvent(call.fromId, "call_history", { callId: call.id });
  sendEvent(call.toId, "call_history", { callId: call.id });
}

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

async function areFriends(userId, otherId) {
  const row = await db("friend_requests")
    .where({ status: "accepted" })
    .andWhere((qb) => {
      qb.where({ from_user_id: userId, to_user_id: otherId }).orWhere({
        from_user_id: otherId,
        to_user_id: userId
      });
    })
    .first();
  return Boolean(row);
}

async function ensureChat(userId, otherId) {
  const row = await db("chat_members")
    .select("chat_id")
    .whereIn("user_id", [userId, otherId])
    .groupBy("chat_id")
    .havingRaw("count(distinct user_id) = 2")
    .first();

  if (row?.chat_id) return row.chat_id;

  const chatId = uuidv4();
  const now = new Date().toISOString();
  await db("chats").insert({ id: chatId, created_at: now });
  await db("chat_members").insert([
    { chat_id: chatId, user_id: userId },
    { chat_id: chatId, user_id: otherId }
  ]);
  return chatId;
}

async function requireChatMember(req, res, next) {
  const chatId = req.params.chatId;
  const member = await db("chat_members")
    .where({ chat_id: chatId, user_id: req.user.id })
    .first();
  if (!member) {
    return res.status(403).json({ error: "forbidden" });
  }
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
    birthDate,
    status: "online"
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
    avatarUrl: user.avatar_url || null,
    status: user.status || "online"
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
    avatarUrl: user.avatar_url || null,
    status: user.status || "online"
  });
});

app.get("/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  addClient(req.user.id, res);

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeClient(req.user.id, res);
  });
});

app.post("/account/status", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const allowed = ["online", "offline", "dnd", "sleepy"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "invalid_status" });
  }
  await db("users").where({ id: req.user.id }).update({ status });
  const accepted = await db("friend_requests")
    .where({ status: "accepted" })
    .andWhere((qb) => {
      qb.where({ from_user_id: req.user.id }).orWhere({ to_user_id: req.user.id });
    });
  const friendIds = accepted.map((r) =>
    r.from_user_id === req.user.id ? r.to_user_id : r.from_user_id
  );
  friendIds.forEach((fid) => {
    sendEvent(fid, "friend_status", {
      id: req.user.id,
      status
    });
  });
  return res.json({ ok: true, status });
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

app.post("/friends/request", requireAuth, async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "validation_error" });
  }
  const target = await db("users").where({ username: username.trim() }).first();
  if (!target) {
    return res.status(404).json({ error: "user_not_found" });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: "cannot_add_self" });
  }

  const existing = await db("friend_requests")
    .where({ from_user_id: req.user.id, to_user_id: target.id, status: "pending" })
    .first();
  if (existing) {
    return res.status(409).json({ error: "request_already_sent" });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  await db("friend_requests").insert({
    id,
    from_user_id: req.user.id,
    to_user_id: target.id,
    status: "pending",
    created_at: createdAt
  });

  sendEvent(target.id, "friend_request", {
    id,
    from: {
      id: req.user.id,
      username: req.user.username,
      avatarUrl: req.user.avatar_url || null
    },
    createdAt
  });

  return res.json({ ok: true, id, toUser: target.username, createdAt });
});

app.get("/friends/inbox", requireAuth, async (req, res) => {
  const rows = await db("friend_requests")
    .where({ to_user_id: req.user.id, status: "pending" })
    .orderBy("created_at", "desc");

  const fromIds = rows.map((r) => r.from_user_id);
  const users = fromIds.length ? await db("users").whereIn("id", fromIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((r) => {
    const u = userMap.get(r.from_user_id);
    return {
      id: r.id,
      from: {
        id: r.from_user_id,
        username: u?.username || "unknown",
        avatarUrl: u?.avatar_url || null
      },
      createdAt: r.created_at
    };
  });

  return res.json({ items });
});

app.post("/friends/respond", requireAuth, async (req, res) => {
  const { requestId, action } = req.body || {};
  const allowed = ["accept", "decline"];
  if (!requestId || !allowed.includes(action)) {
    return res.status(400).json({ error: "validation_error" });
  }

  const request = await db("friend_requests").where({ id: requestId }).first();
  if (!request || request.to_user_id !== req.user.id) {
    return res.status(404).json({ error: "not_found" });
  }

  await db("friend_requests").where({ id: requestId }).update({
    status: action === "accept" ? "accepted" : "declined"
  });

  sendEvent(request.from_user_id, "friend_response", {
    id: request.id,
    status: action === "accept" ? "accepted" : "declined",
    to: { id: req.user.id, username: req.user.username }
  });

  if (action === "accept") {
    const requester = await db("users").where({ id: request.from_user_id }).first();
    sendEvent(request.from_user_id, "friend_added", {
      id: req.user.id,
      username: req.user.username,
      avatarUrl: req.user.avatar_url || null,
      status: req.user.status || "online"
    });
    if (requester) {
      sendEvent(req.user.id, "friend_added", {
        id: requester.id,
        username: requester.username,
        avatarUrl: requester.avatar_url || null,
        status: requester.status || "online"
      });
    }
  }

  return res.json({ ok: true, status: action });
});

app.get("/friends/sent", requireAuth, async (req, res) => {
  const rows = await db("friend_requests")
    .where({ from_user_id: req.user.id, status: "pending" })
    .orderBy("created_at", "desc");

  const toIds = rows.map((r) => r.to_user_id);
  const users = toIds.length ? await db("users").whereIn("id", toIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((r) => {
    const u = userMap.get(r.to_user_id);
    return {
      id: r.id,
      to: {
        id: r.to_user_id,
        username: u?.username || "unknown",
        avatarUrl: u?.avatar_url || null
      },
      createdAt: r.created_at
    };
  });

  return res.json({ items });
});

app.post("/friends/cancel", requireAuth, async (req, res) => {
  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "validation_error" });
  }
  const request = await db("friend_requests").where({ id: requestId }).first();
  if (!request || request.from_user_id !== req.user.id) {
    return res.status(404).json({ error: "not_found" });
  }
  if (request.status !== "pending") {
    return res.status(409).json({ error: "not_pending" });
  }
  await db("friend_requests").where({ id: requestId }).update({ status: "canceled" });
  sendEvent(request.to_user_id, "friend_cancel", { id: request.id });
  return res.json({ ok: true });
});

app.get("/friends/list", requireAuth, async (req, res) => {
  const accepted = await db("friend_requests")
    .where({ status: "accepted" })
    .andWhere((qb) => {
      qb.where({ from_user_id: req.user.id }).orWhere({ to_user_id: req.user.id });
    })
    .orderBy("created_at", "desc");

  const friendIds = accepted.map((r) =>
    r.from_user_id === req.user.id ? r.to_user_id : r.from_user_id
  );
  const users = friendIds.length ? await db("users").whereIn("id", friendIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const unreadRows = await db("messages")
    .select("sender_id")
    .count({ count: "id" })
    .where({ recipient_id: req.user.id })
    .whereNull("read_at")
    .groupBy("sender_id");
  const unreadMap = new Map(unreadRows.map((r) => [r.sender_id, Number(r.count)]));

  const items = accepted.map((r) => {
    const friendId = r.from_user_id === req.user.id ? r.to_user_id : r.from_user_id;
    const u = userMap.get(friendId);
    return {
      id: friendId,
      username: u?.username || "unknown",
      avatarUrl: u?.avatar_url || null,
      status: u?.status || "offline",
      unreadCount: unreadMap.get(friendId) || 0
    };
  });

  return res.json({ items });
});

app.post("/friends/remove", requireAuth, async (req, res) => {
  const { friendId } = req.body || {};
  if (!friendId) {
    return res.status(400).json({ error: "validation_error" });
  }

  const request = await db("friend_requests")
    .where({ status: "accepted" })
    .andWhere((qb) => {
      qb.where({ from_user_id: req.user.id, to_user_id: friendId }).orWhere({
        from_user_id: friendId,
        to_user_id: req.user.id
      });
    })
    .first();

  if (!request) {
    return res.status(404).json({ error: "not_found" });
  }

  await db("friend_requests").where({ id: request.id }).update({ status: "removed" });
  sendEvent(friendId, "friend_removed", { id: req.user.id });
  sendEvent(req.user.id, "friend_removed", { id: friendId });
  return res.json({ ok: true });
});

app.post("/chats/ensure", requireAuth, async (req, res) => {
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "validation_error" });
  }
  const target = await db("users").where({ username: username.trim() }).first();
  if (!target) {
    return res.status(404).json({ error: "user_not_found" });
  }
  const ok = await areFriends(req.user.id, target.id);
  if (!ok) {
    return res.status(403).json({ error: "not_friends" });
  }

  const chatId = await ensureChat(req.user.id, target.id);
  return res.json({
    chatId,
    user: {
      id: target.id,
      username: target.username,
      avatarUrl: target.avatar_url || null,
      status: target.status || "offline"
    }
  });
});

app.get("/chats/:chatId/messages", requireAuth, requireChatMember, async (req, res) => {
  const chatId = req.params.chatId;
  const members = await db("chat_members").where({ chat_id: chatId });
  const other = members.find((m) => m.user_id !== req.user.id);
  if (!other) {
    return res.status(400).json({ error: "invalid_chat" });
  }
  const friendsOk = await areFriends(req.user.id, other.user_id);
  const rows = await db("messages").where({ chat_id: chatId }).orderBy("created_at", "asc");
  await db("messages")
    .where({ chat_id: chatId, recipient_id: req.user.id })
    .whereNull("read_at")
    .update({ read_at: new Date().toISOString() });

  const items = rows.map((m) => ({
    id: m.id,
    fromId: m.sender_id,
    body: m.body,
    attachmentUrl: m.attachment_url || null,
    attachmentName: m.attachment_name || null,
    attachmentMime: m.attachment_mime || null,
    attachmentSize: m.attachment_size || null,
    createdAt: m.created_at,
    editedAt: m.edited_at || null,
    deletedAt: m.deleted_at || null
  }));
  return res.json({ items, canChat: friendsOk });
});

app.post("/chats/:chatId/messages", requireAuth, requireChatMember, async (req, res) => {
  const chatId = req.params.chatId;
  const { body } = req.body || {};
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return res.status(400).json({ error: "validation_error" });
  }

  const members = await db("chat_members").where({ chat_id: chatId });
  const other = members.find((m) => m.user_id !== req.user.id);
  if (!other) {
    return res.status(400).json({ error: "invalid_chat" });
  }

  const friendsOk = await areFriends(req.user.id, other.user_id);
  if (!friendsOk) {
    return res.status(403).json({ error: "chat_locked" });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  await db("messages").insert({
    id,
    chat_id: chatId,
    sender_id: req.user.id,
    recipient_id: other.user_id,
    body: body.trim(),
    attachment_url: null,
    attachment_name: null,
    attachment_mime: null,
    attachment_size: null,
    created_at: createdAt
  });

  const recipient = await db("users").where({ id: other.user_id }).first();
  if (recipient && ["online", "sleepy"].includes(recipient.status || "offline")) {
    sendEvent(recipient.id, "message", {
      chatId,
      id,
      from: {
        id: req.user.id,
        username: req.user.username,
        avatarUrl: req.user.avatar_url || null
      },
      body: body.trim(),
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
      createdAt
    });
  }

  return res.json({ ok: true, id, createdAt });
});

app.post(
  "/chats/:chatId/attachments",
  requireAuth,
  requireChatMember,
  chatUpload.single("file"),
  async (req, res) => {
    const chatId = req.params.chatId;
    if (!req.file) {
      return res.status(400).json({ error: "file_required" });
    }

    const members = await db("chat_members").where({ chat_id: chatId });
    const other = members.find((m) => m.user_id !== req.user.id);
    if (!other) {
      return res.status(400).json({ error: "invalid_chat" });
    }

    const friendsOk = await areFriends(req.user.id, other.user_id);
    if (!friendsOk) {
      return res.status(403).json({ error: "chat_locked" });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const publicUrl = `/uploads/chat/${req.file.filename}`;
    await db("messages").insert({
      id,
      chat_id: chatId,
      sender_id: req.user.id,
      recipient_id: other.user_id,
      body: "",
      attachment_url: publicUrl,
      attachment_name: req.file.originalname || "attachment",
      attachment_mime: req.file.mimetype || "application/octet-stream",
      attachment_size: req.file.size || null,
      created_at: createdAt
    });

    const recipient = await db("users").where({ id: other.user_id }).first();
    if (recipient && ["online", "sleepy"].includes(recipient.status || "offline")) {
      sendEvent(recipient.id, "message", {
        chatId,
        id,
        from: {
          id: req.user.id,
          username: req.user.username,
          avatarUrl: req.user.avatar_url || null
        },
        body: "",
        attachmentUrl: publicUrl,
        attachmentName: req.file.originalname || "attachment",
        attachmentMime: req.file.mimetype || "application/octet-stream",
        attachmentSize: req.file.size || null,
        createdAt
      });
    }

    return res.json({
      ok: true,
      message: {
        id,
        fromId: req.user.id,
        body: "",
        attachmentUrl: publicUrl,
        attachmentName: req.file.originalname || "attachment",
        attachmentMime: req.file.mimetype || "application/octet-stream",
        attachmentSize: req.file.size || null,
        createdAt,
        editedAt: null,
        deletedAt: null
      }
    });
  }
);

app.patch("/chats/:chatId/messages/:messageId", requireAuth, requireChatMember, async (req, res) => {
  const chatId = req.params.chatId;
  const messageId = req.params.messageId;
  const { body } = req.body || {};
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return res.status(400).json({ error: "validation_error" });
  }

  const message = await db("messages").where({ id: messageId, chat_id: chatId }).first();
  if (!message) {
    return res.status(404).json({ error: "not_found" });
  }
  if (message.sender_id !== req.user.id) {
    return res.status(403).json({ error: "not_allowed" });
  }
  if (message.deleted_at) {
    return res.status(409).json({ error: "already_deleted" });
  }
  if (message.attachment_url) {
    return res.status(409).json({ error: "attachment_message" });
  }

  const editedAt = new Date().toISOString();
  await db("messages")
    .where({ id: messageId })
    .update({ body: body.trim(), edited_at: editedAt });

  const members = await db("chat_members").where({ chat_id: chatId });
  const other = members.find((m) => m.user_id !== req.user.id);
  if (other) {
    sendEvent(other.user_id, "message_edit", {
      chatId,
      messageId,
      body: body.trim(),
      editedAt,
      fromId: req.user.id
    });
  }
  sendEvent(req.user.id, "message_edit", {
    chatId,
    messageId,
    body: body.trim(),
    editedAt,
    fromId: req.user.id
  });

  return res.json({ ok: true, messageId, editedAt });
});

app.delete(
  "/chats/:chatId/messages/:messageId",
  requireAuth,
  requireChatMember,
  async (req, res) => {
    const chatId = req.params.chatId;
    const messageId = req.params.messageId;

    const message = await db("messages").where({ id: messageId, chat_id: chatId }).first();
    if (!message) {
      return res.status(404).json({ error: "not_found" });
    }
    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ error: "not_allowed" });
    }
    if (message.deleted_at) {
      return res.json({ ok: true, messageId, deletedAt: message.deleted_at });
    }

    const deletedAt = new Date().toISOString();
    if (message.attachment_url) {
      const filePath = resolveUploadPath(message.attachment_url);
      if (filePath) {
        fs.promises.unlink(filePath).catch(() => {});
      }
    }
    await db("messages")
      .where({ id: messageId })
      .update({
        body: "",
        deleted_at: deletedAt,
        attachment_url: null,
        attachment_name: null,
        attachment_mime: null,
        attachment_size: null
      });

    const members = await db("chat_members").where({ chat_id: chatId });
    const other = members.find((m) => m.user_id !== req.user.id);
    if (other) {
      sendEvent(other.user_id, "message_delete", {
        chatId,
        messageId,
        deletedAt,
        fromId: req.user.id
      });
    }
    sendEvent(req.user.id, "message_delete", {
      chatId,
      messageId,
      deletedAt,
      fromId: req.user.id
    });

    return res.json({ ok: true, messageId, deletedAt });
  }
);

app.post("/chats/:chatId/read", requireAuth, requireChatMember, async (req, res) => {
  const chatId = req.params.chatId;
  await db("messages")
    .where({ chat_id: chatId, recipient_id: req.user.id })
    .whereNull("read_at")
    .update({ read_at: new Date().toISOString() });
  return res.json({ ok: true });
});

app.post("/calls/start", requireAuth, async (req, res) => {
  const { username, type } = req.body || {};
  const allowedTypes = ["audio", "video"];
  if (!username || typeof username !== "string" || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: "validation_error" });
  }
  const target = await db("users").where({ username: username.trim() }).first();
  if (!target) {
    return res.status(404).json({ error: "user_not_found" });
  }
  if (userActiveCall.has(req.user.id) || userActiveCall.has(target.id)) {
    return res.status(409).json({ error: "busy" });
  }
  const ok = await areFriends(req.user.id, target.id);
  if (!ok) {
    return res.status(403).json({ error: "not_friends" });
  }

  const callId = uuidv4();
  const call = {
    id: callId,
    type,
    fromId: req.user.id,
    toId: target.id,
    createdAt: new Date().toISOString(),
    status: "ringing",
    acceptedAt: null
  };
  const historyId = uuidv4();
  call.historyId = historyId;
  await db("call_history").insert({
    id: historyId,
    call_id: callId,
    from_user_id: req.user.id,
    to_user_id: target.id,
    type,
    status: "ringing",
    started_at: call.createdAt
  });
  const timeoutSeconds = Number(process.env.CALL_TIMEOUT_SEC || 30);
  call.timeoutHandle = setTimeout(() => {
    updateCallHistory(call, "timeout").catch(() => {});
    clearCall(callId, "call_timeout");
  }, timeoutSeconds * 1000);
  activeCalls.set(callId, call);
  userActiveCall.set(req.user.id, callId);
  userActiveCall.set(target.id, callId);

  sendEvent(target.id, "call_invite", {
    callId,
    type,
    from: {
      id: req.user.id,
      username: req.user.username,
      avatarUrl: req.user.avatar_url || null
    }
  });

  return res.json({ ok: true, callId });
});

app.get("/calls/:callId", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  const users = await db("users").whereIn("id", [call.fromId, call.toId]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const safeCall = { ...call };
  delete safeCall.timeoutHandle;
  return res.json({
    call: {
      ...safeCall,
      from: {
        id: call.fromId,
        username: userMap.get(call.fromId)?.username || "unknown",
        avatarUrl: userMap.get(call.fromId)?.avatar_url || null
      },
      to: {
        id: call.toId,
        username: userMap.get(call.toId)?.username || "unknown",
        avatarUrl: userMap.get(call.toId)?.avatar_url || null
      }
    }
  });
});

app.post("/calls/:callId/accept", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  if (call.toId !== req.user.id) return res.status(403).json({ error: "not_allowed" });
  if (call.status === "accepted") return res.json({ ok: true });
  call.status = "accepted";
  call.acceptedAt = new Date().toISOString();
  if (call.timeoutHandle) {
    clearTimeout(call.timeoutHandle);
    call.timeoutHandle = null;
  }
  updateCallHistory(call, "accepted").catch(() => {});
  sendEvent(call.fromId, "call_accept", { callId });
  return res.json({ ok: true });
});

app.post("/calls/:callId/decline", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  sendEvent(other, "call_decline", { callId });
  updateCallHistory(call, "declined").catch(() => {});
  clearCall(callId);
  return res.json({ ok: true });
});

app.post("/calls/:callId/offer", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const { sdp } = req.body || {};
  if (!sdp) return res.status(400).json({ error: "validation_error" });
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  if (call.status !== "accepted") {
    return res.status(409).json({ error: "not_accepted" });
  }
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  sendEvent(other, "call_offer", { callId, sdp });
  return res.json({ ok: true });
});

app.post("/calls/:callId/answer", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const { sdp } = req.body || {};
  if (!sdp) return res.status(400).json({ error: "validation_error" });
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  if (call.status !== "accepted") {
    return res.status(409).json({ error: "not_accepted" });
  }
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  sendEvent(other, "call_answer", { callId, sdp });
  return res.json({ ok: true });
});

app.post("/calls/:callId/ice", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const { candidate } = req.body || {};
  if (!candidate) return res.status(400).json({ error: "validation_error" });
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  if (call.status !== "accepted") {
    return res.status(409).json({ error: "not_accepted" });
  }
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  sendEvent(other, "call_ice", { callId, candidate });
  return res.json({ ok: true });
});

app.post("/calls/:callId/leave", requireAuth, async (req, res) => {
  const callId = req.params.callId;
  const call = activeCalls.get(callId);
  if (!call) return res.status(404).json({ error: "not_found" });
  const other = getOtherCallParticipant(call, req.user.id);
  if (!other) return res.status(403).json({ error: "not_allowed" });
  sendEvent(other, "call_leave", { callId });
  updateCallHistory(call, "ended").catch(() => {});
  clearCall(callId);
  return res.json({ ok: true });
});

app.get("/calls/history", requireAuth, async (req, res) => {
  const rows = await db("call_history")
    .where({ from_user_id: req.user.id })
    .orWhere({ to_user_id: req.user.id })
    .orderBy("started_at", "desc")
    .limit(50);

  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]))
  );
  const users = userIds.length ? await db("users").whereIn("id", userIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((r) => {
    const from = userMap.get(r.from_user_id);
    const to = userMap.get(r.to_user_id);
    const isOutgoing = r.from_user_id === req.user.id;
    const other = isOutgoing ? to : from;
    return {
      id: r.id,
      callId: r.call_id,
      type: r.type,
      status: r.status,
      startedAt: r.started_at,
      acceptedAt: r.accepted_at,
      endedAt: r.ended_at,
      durationSeconds: r.duration_seconds,
      direction: isOutgoing ? "outgoing" : "incoming",
      other: {
        id: other?.id || null,
        username: other?.username || "unknown",
        avatarUrl: other?.avatar_url || null
      }
    };
  });

  return res.json({ items });
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
