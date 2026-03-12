const fs = require("fs");
const path = require("path");
const knex = require("knex");

function buildConfig() {
  const dbType = (process.env.DB_TYPE || "sqlite").toLowerCase();

  if (dbType === "mysql") {
    return {
      client: "mysql2",
      connection: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        database: process.env.DB_NAME || "zingo",
        user: process.env.DB_USER || "zingo",
        password: process.env.DB_PASS || "zingo"
      }
    };
  }

  const sqlitePath = process.env.DB_SQLITE_PATH || path.join(process.cwd(), "data", "zingo.db");
  const dir = path.dirname(sqlitePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    client: "sqlite3",
    connection: {
      filename: sqlitePath
    },
    useNullAsDefault: true
  };
}

const db = knex(buildConfig());

async function initSchema() {
  const exists = await db.schema.hasTable("users");
  if (!exists) {
    await db.schema.createTable("users", (table) => {
      table.string("id", 36).primary();
      table.string("username", 32).notNullable().unique();
      table.string("email", 255).unique();
      table.string("phone", 32).unique();
      table.string("password_hash", 100).notNullable();
      table.date("birth_date").notNullable();
      table.dateTime("created_at").notNullable();
      table.string("avatar_url", 512);
      table.string("status", 32).notNullable().defaultTo("online");
    });
  } else {
    const hasAvatar = await db.schema.hasColumn("users", "avatar_url");
    if (!hasAvatar) {
      await db.schema.alterTable("users", (table) => {
        table.string("avatar_url", 512);
      });
    }
    const hasStatus = await db.schema.hasColumn("users", "status");
    if (!hasStatus) {
      await db.schema.alterTable("users", (table) => {
        table.string("status", 32).notNullable().defaultTo("online");
      });
    }
  }

  const sessionsExists = await db.schema.hasTable("sessions");
  if (!sessionsExists) {
    await db.schema.createTable("sessions", (table) => {
      table.string("id", 36).primary();
      table.string("user_id", 36).notNullable();
      table.dateTime("expires_at").notNullable();
      table.dateTime("created_at").notNullable();
      table.dateTime("last_seen_at").notNullable();
      table.index(["user_id"]);
      table.index(["expires_at"]);
    });
  }

  const requestsExists = await db.schema.hasTable("friend_requests");
  if (!requestsExists) {
    await db.schema.createTable("friend_requests", (table) => {
      table.string("id", 36).primary();
      table.string("from_user_id", 36).notNullable();
      table.string("to_user_id", 36).notNullable();
      table.string("status", 32).notNullable().defaultTo("pending");
      table.dateTime("created_at").notNullable();
      table.index(["to_user_id"]);
      table.index(["from_user_id"]);
      table.index(["status"]);
    });
  }

  const chatsExists = await db.schema.hasTable("chats");
  if (!chatsExists) {
    await db.schema.createTable("chats", (table) => {
      table.string("id", 36).primary();
      table.dateTime("created_at").notNullable();
    });
  }

  const membersExists = await db.schema.hasTable("chat_members");
  if (!membersExists) {
    await db.schema.createTable("chat_members", (table) => {
      table.string("chat_id", 36).notNullable();
      table.string("user_id", 36).notNullable();
      table.primary(["chat_id", "user_id"]);
      table.index(["user_id"]);
    });
  }

  const messagesExists = await db.schema.hasTable("messages");
  if (!messagesExists) {
    await db.schema.createTable("messages", (table) => {
      table.string("id", 36).primary();
      table.string("chat_id", 36).notNullable();
      table.string("sender_id", 36).notNullable();
      table.string("recipient_id", 36).notNullable();
      table.text("body").notNullable();
      table.string("attachment_url", 512);
      table.string("attachment_name", 255);
      table.string("attachment_mime", 128);
      table.integer("attachment_size");
      table.dateTime("created_at").notNullable();
      table.dateTime("read_at");
      table.dateTime("edited_at");
      table.dateTime("deleted_at");
      table.index(["chat_id"]);
      table.index(["recipient_id"]);
    });
  } else {
    const hasEdited = await db.schema.hasColumn("messages", "edited_at");
    if (!hasEdited) {
      await db.schema.alterTable("messages", (table) => {
        table.dateTime("edited_at");
      });
    }
    const hasDeleted = await db.schema.hasColumn("messages", "deleted_at");
    if (!hasDeleted) {
      await db.schema.alterTable("messages", (table) => {
        table.dateTime("deleted_at");
      });
    }
    const hasAttachmentUrl = await db.schema.hasColumn("messages", "attachment_url");
    if (!hasAttachmentUrl) {
      await db.schema.alterTable("messages", (table) => {
        table.string("attachment_url", 512);
      });
    }
    const hasAttachmentName = await db.schema.hasColumn("messages", "attachment_name");
    if (!hasAttachmentName) {
      await db.schema.alterTable("messages", (table) => {
        table.string("attachment_name", 255);
      });
    }
    const hasAttachmentMime = await db.schema.hasColumn("messages", "attachment_mime");
    if (!hasAttachmentMime) {
      await db.schema.alterTable("messages", (table) => {
        table.string("attachment_mime", 128);
      });
    }
    const hasAttachmentSize = await db.schema.hasColumn("messages", "attachment_size");
    if (!hasAttachmentSize) {
      await db.schema.alterTable("messages", (table) => {
        table.integer("attachment_size");
      });
    }
  }

  const callsExists = await db.schema.hasTable("call_history");
  if (!callsExists) {
    await db.schema.createTable("call_history", (table) => {
      table.string("id", 36).primary();
      table.string("call_id", 36).notNullable();
      table.string("from_user_id", 36).notNullable();
      table.string("to_user_id", 36).notNullable();
      table.string("type", 16).notNullable();
      table.string("status", 32).notNullable();
      table.dateTime("started_at").notNullable();
      table.dateTime("accepted_at");
      table.dateTime("ended_at");
      table.integer("duration_seconds");
      table.index(["from_user_id"]);
      table.index(["to_user_id"]);
      table.index(["call_id"]);
    });
  }
}

module.exports = { db, initSchema };
