const path = require("path");
const crypto = require("crypto");

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = String(process.env.WHITELIST_ADMIN_USER || "admin");
const ADMIN_PASS = String(process.env.WHITELIST_ADMIN_PASS || "admin123");
const FIVEM_WEBHOOK_KEY = String(process.env.FIVEM_WEBHOOK_KEY || "");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));

const projectRoot = __dirname;
const webRoot = projectRoot;
app.use(express.static(webRoot));

const dbPath = path.join(projectRoot, "data", "whitelist.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret TEXT NOT NULL,
  status TEXT NOT NULL,
  name TEXT NOT NULL,
  discord TEXT NOT NULL,
  age INTEGER,
  experience TEXT,
  availability TEXT,
  motivation TEXT,
  user_message TEXT,
  answers_json TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

CREATE TABLE IF NOT EXISTS fivem_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const tableInfo = db.prepare("PRAGMA table_info(submissions)").all();
const existingColumns = new Set(tableInfo.map((c) => c.name));
if (!existingColumns.has("answers_json")) {
  db.exec("ALTER TABLE submissions ADD COLUMN answers_json TEXT");
}

const adminTokens = new Map();

function nowIso() {
  return new Date().toISOString();
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function requireFiveMKey(req, res, next) {
  if (!FIVEM_WEBHOOK_KEY) return res.status(500).json({ error: "missing_fivem_webhook_key" });
  const key = String(req.headers["x-api-key"] || "");
  if (!key || key !== FIVEM_WEBHOOK_KEY) return res.status(401).json({ error: "unauthorized" });
  next();
}

function requireAdmin(req, res, next) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return res.status(401).json({ error: "missing_token" });
  const t = adminTokens.get(token);
  if (!t) return res.status(401).json({ error: "invalid_token" });
  if (Date.now() > t.expiresAt) {
    adminTokens.delete(token);
    return res.status(401).json({ error: "expired_token" });
  }
  next();
}

app.post("/api/whitelist/submit", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const name = String(body.name || "").trim();
  const discord = String(body.discord || "").trim();

  if (!name || !discord) {
    return res.status(400).json({ error: "missing_fields", fields: ["name", "discord"] });
  }

  const ageRaw = body.age;
  const age = Number.isFinite(Number(ageRaw)) ? Number(ageRaw) : null;

  const secret = randomToken(16);
  const createdAt = nowIso();

  const answers = {};
  Object.keys(body).forEach((k) => {
    if (/^q\d+$/i.test(k)) {
      const v = String(body[k] || "").trim();
      if (v) answers[k.toLowerCase()] = v;
    }
  });
  const answersJson = Object.keys(answers).length ? JSON.stringify(answers) : null;

  const insert = db.prepare(`
    INSERT INTO submissions (
      secret, status, name, discord, age, experience, availability, motivation, user_message,
      answers_json, admin_note, created_at, updated_at
    ) VALUES (
      @secret, @status, @name, @discord, @age, @experience, @availability, @motivation, @user_message,
      @answers_json, @admin_note, @created_at, @updated_at
    )
  `);

  const result = insert.run({
    secret,
    status: "pending",
    name,
    discord,
    age,
    experience: body.experience ? String(body.experience) : null,
    availability: body.availability ? String(body.availability) : null,
    motivation: body.motivation ? String(body.motivation) : null,
    user_message: body.user_message ? String(body.user_message) : null,
    answers_json: answersJson,
    admin_note: null,
    created_at: createdAt,
    updated_at: createdAt,
  });

  return res.json({ id: result.lastInsertRowid, secret });
});

app.post("/api/fivem/players", requireFiveMKey, (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const payload = {
    ts: body.ts || Date.now(),
    server: body.server && typeof body.server === "object" ? body.server : null,
    players: Array.isArray(body.players) ? body.players : [],
  };

  const updatedAt = nowIso();
  db.prepare(
    "INSERT INTO fivem_state (id, data_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
  ).run(JSON.stringify(payload), updatedAt);

  return res.json({ ok: true });
});

app.get("/api/fivem/players", (req, res) => {
  const row = db.prepare("SELECT data_json, updated_at FROM fivem_state WHERE id = 1").get();
  if (!row) return res.json({ ts: null, server: null, players: [], updated_at: null });
  let data = null;
  try {
    data = JSON.parse(String(row.data_json || "{}"));
  } catch {
    data = { ts: null, server: null, players: [] };
  }
  return res.json({ ...data, updated_at: row.updated_at });
});

app.get("/api/whitelist/status/:id", (req, res) => {
  const id = Number(req.params.id);
  const secret = String(req.query.secret || "");
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  if (!secret) return res.status(400).json({ error: "missing_secret" });

  const row = db
    .prepare(
      "SELECT id, status, admin_note, created_at, updated_at FROM submissions WHERE id = ? AND secret = ?"
    )
    .get(id, secret);

  if (!row) return res.status(404).json({ error: "not_found" });
  return res.json(row);
});

app.post("/api/admin/login", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const user = String(body.user || "");
  const pass = String(body.pass || "");
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.status(401).json({ error: "invalid_login" });

  const token = randomToken(24);
  const ttlMs = 1000 * 60 * 60 * 12;
  adminTokens.set(token, { expiresAt: Date.now() + ttlMs });

  return res.json({ token, expiresInSeconds: Math.floor(ttlMs / 1000) });
});

app.get("/api/admin/submissions", requireAdmin, (req, res) => {
  const status = req.query.status ? String(req.query.status) : "";

  const base =
    "SELECT id, status, name, discord, created_at, updated_at FROM submissions";
  const order = " ORDER BY created_at DESC";

  const rows = status
    ? db.prepare(base + " WHERE status = ?" + order).all(status)
    : db.prepare(base + order).all();

  return res.json({ rows });
});

app.get("/api/admin/submissions/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "not_found" });

  return res.json({ row });
});

app.post("/api/admin/submissions/:id/update", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const status = body.status ? String(body.status) : "";
  const adminNote = body.admin_note != null ? String(body.admin_note) : null;

  const allowed = new Set(["pending", "approved", "rejected"]);
  if (!allowed.has(status)) return res.status(400).json({ error: "invalid_status" });

  const updatedAt = nowIso();

  const result = db
    .prepare("UPDATE submissions SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?")
    .run(status, adminNote, updatedAt, id);

  if (result.changes === 0) return res.status(404).json({ error: "not_found" });

  return res.json({ ok: true });
});

app.delete("/api/admin/submissions/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

  const result = db.prepare("DELETE FROM submissions WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

app.post("/api/admin/submissions/:id/delete", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

  const result = db.prepare("DELETE FROM submissions WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[whitelist] server running on http://localhost:${PORT}`);
  console.log(`[whitelist] admin user: ${ADMIN_USER}`);
});
