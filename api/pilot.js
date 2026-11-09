// Pilot map: POST /api/pilot body {u, n, e, s, icao} -> the Minecraft server sets the autopilot route to that airport
// and books the arrival slot from your ETA (within a second or two). The link fields come from /voice in Minecraft.
const { db, sign, safeEqual, readBody, broken } = require("./_firebase");

module.exports = async (req, res) => {
  if (broken(res)) return;
  if (req.method !== "POST") return res.status(405).end();
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return res.status(400).end(); }
  const { u, n, e, s } = b || {};
  if (!u || !n || !e || !s) return res.status(401).json({ error: "open the link from /voice in Minecraft" });
  if (Date.now() / 1000 > +e) return res.status(401).json({ error: "link expired - type /voice in Minecraft again" });
  if (!safeEqual(sign(`${u}|${n}|${e}`), s)) return res.status(401).json({ error: "invalid link" });
  const icao = String(b.icao || "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 12);
  if (!icao) return res.status(400).json({ error: "pick an airport" });
  await db.collection("pilotActions").add({ uuid: String(u), name: String(n).slice(0, 16), icao, status: "new", t: Date.now() });
  res.status(200).json({ ok: true });
};
