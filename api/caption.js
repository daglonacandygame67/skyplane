// POST /api/caption  body {u, n, e, s, text}: a phrase recognised by the browser while the player talks in voice chat.
// The Minecraft server collects captions through /api/positions and shows them above the player's head.
const { db, sign, safeEqual, readBody, broken } = require("./_firebase");

module.exports = async (req, res) => {
  if (broken(res)) return;
  if (req.method !== "POST") return res.status(405).end();
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return res.status(400).end(); }
  const { u, n, e, s } = b || {};
  if (!u || !n || !e || !s || Date.now() / 1000 > +e || !safeEqual(sign(`${u}|${n}|${e}`), s)) return res.status(401).json({ error: "invalid link" });
  const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!text) return res.status(200).json({ ok: true });
  await db.collection("captions").add({ uuid: String(u), name: String(n).slice(0, 16), text, t: Date.now() });
  res.status(200).json({ ok: true });
};
