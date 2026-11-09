// Shared Firebase Admin + signature helpers for the Vercel serverless functions.
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // local testing against the Firebase emulators (never set on Vercel)
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-skyplane" });
  } else {
    // FIREBASE_SERVICE_ACCOUNT = the whole service-account JSON (Project settings -> Service accounts -> Generate new private key)
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
}

function sign(data) {
  return crypto.createHmac("sha256", process.env.SERVER_SECRET || "").update(data).digest("hex");
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

module.exports = { admin, db: admin.firestore(), sign, safeEqual, readBody };
