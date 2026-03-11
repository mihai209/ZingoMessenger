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
    });
  } else {
    const hasAvatar = await db.schema.hasColumn("users", "avatar_url");
    if (!hasAvatar) {
      await db.schema.alterTable("users", (table) => {
        table.string("avatar_url", 512);
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
}

module.exports = { db, initSchema };
