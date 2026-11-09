// GET /api/health - checks the website's Vercel settings (never shows any secret values).
const fb = require("./_firebase");
module.exports = async (req, res) => {
  const set = (n) => !!(process.env[n] || "").trim();
  const out = {
    ok: !fb.initProblem(),
    problem: fb.initProblem(),
    settings: Object.fromEntries(["FIREBASE_SERVICE_ACCOUNT", "SERVER_SECRET", "FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID", "FIREBASE_APP_ID", "TURN_URL"].map((n) => [n, set(n)])),
  };
  if (out.ok) {
    try { await fb.db.collection("health").doc("ping").set({ t: Date.now() }); out.firestore = "ok"; }
    catch (e) { out.ok = false; out.firestore = String(e.message || e).slice(0, 200); }
  }
  res.status(out.ok ? 200 : 500).json(out);
};
