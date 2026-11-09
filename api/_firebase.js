// Shared Firebase Admin + signature helpers for the Vercel serverless functions.
const admin = require("firebase-admin");
const crypto = require("crypto");

// Settings pasted into Vercel often pick up stray quotes or spaces: clean them up.
function env(name) {
  let v = (process.env[name] || "").trim();
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) v = v.slice(1, -1);
  return v.replace(/^"+|"+$/g, "").trim();
}

// FIREBASE_SERVICE_ACCOUNT = the whole service-account JSON (Project settings -> Service accounts -> Generate new private key).
// Returns {sa} or {problem: "what is wrong"} without ever revealing the key.
function serviceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return { problem: "FIREBASE_SERVICE_ACCOUNT is not set in Vercel" };
  let sa = null;
  const tries = [
    raw,
    raw.replace(/^'|'$/g, ""),
    raw.replace(/^"|"$/g, "").replace(/\\"/g, '"'),                                   // pasted as a quoted, escaped string
    raw.replace(/("private_key"\s*:\s*")([\s\S]*?)(")/, (m, a, b, c) => a + b.replace(/\r?\n/g, "\\n") + c),   // real line breaks in the key
    (() => { try { return Buffer.from(raw, "base64").toString("utf8"); } catch { return ""; } })(),          // base64 of the file
  ];
  for (const t of tries) {
    try {
      let o = JSON.parse(t);
      if (typeof o === "string") o = JSON.parse(o);                                     // double-encoded
      if (o && typeof o === "object") { sa = o; break; }
    } catch {}
  }
  if (!sa) {
    const hint = raw.startsWith("{") ? (raw.trim().endsWith("}") ? "it starts with { and ends with } but something inside is broken" : "it starts with { but does not end with } - part of the file is missing")
      : "it does not start with { - paste the file's contents, not its name or path";
    return { problem: `FIREBASE_SERVICE_ACCOUNT is not valid JSON (${hint}, ${raw.length} characters). Open the .json file in Notepad, Ctrl+A, Ctrl+C, and paste it as the value` };
  }
  if (sa.private_key) sa.private_key = sa.private_key.split("\\n").join("\n");   // literal \n pasted as text -> real newlines
  for (const k of ["project_id", "client_email", "private_key"]) if (!sa[k]) return { problem: `FIREBASE_SERVICE_ACCOUNT is missing "${k}" - use the file from Generate new private key` };
  return { sa };
}

let initProblem = null;
if (!admin.apps.length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // local testing against the Firebase emulators (never set on Vercel)
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-skyplane" });
  } else {
    const { sa, problem } = serviceAccount();
    if (problem) initProblem = problem;
    else {
      try { admin.initializeApp({ credential: admin.credential.cert(sa) }); }
      catch (e) { initProblem = "Firebase rejected the service account: " + String(e.message || e).slice(0, 160); }
    }
  }
}
if (!initProblem && !env("SERVER_SECRET")) initProblem = "SERVER_SECRET is not set in Vercel (it must match serverSecret in the Minecraft server's config)";

function sign(data) {
  return crypto.createHmac("sha256", env("SERVER_SECRET")).update(data).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// The server's position updates are signed over the exact bytes it sent, so prefer the raw text: the Minecraft
// server posts them as text/plain, which Vercel hands over unparsed. Browser JSON posts fall back to the parsed object.
async function readBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return await new Promise((res, rej) => { let d = ""; req.setEncoding("utf8"); req.on("data", (c) => (d += c)); req.on("end", () => res(d)); req.on("error", rej); });
}

// db is only created when Firebase started, so a bad setting gives a clear error instead of a crash
const db = initProblem ? null : admin.firestore();

/** Call first in every function: answers 500 with the exact setting to fix (and returns true) when the setup is broken. */
function broken(res) {
  if (!initProblem) return false;
  res.status(500).json({ error: "Website setup problem: " + initProblem });
  return true;
}

module.exports = { admin, db, sign, safeEqual, readBody, broken, env, initProblem: () => initProblem };
