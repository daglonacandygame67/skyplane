// Land applications from the website.
//   POST /api/apply   body {u, n, e, s, kind, text, x, z}  -> stores the request (the signed /voice link proves who you are)
//   GET  /api/apply?u&n&e&s                              -> your requests and their status
// The Minecraft server picks new requests up through /api/positions and sends staff decisions back the same way.
const { db, sign, safeEqual, readBody } = require("./_firebase");

function verify(q) {
  const { u, n, e, s } = q || {};
  if (!u || !n || !e || !s) return "missing parameters - open the link from /voice in Minecraft";
  if (Date.now() / 1000 > +e) return "link expired - type /voice in Minecraft again";
  if (!safeEqual(sign(`${u}|${n}|${e}`), s)) return "invalid link";
  return null;
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const err = verify(req.query);
    if (err) return res.status(401).json({ error: err });
    const snap = await db.collection("applications").where("uuid", "==", String(req.query.u)).limit(30).get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.t - a.t);
    return res.status(200).json({ applications: list });
  }
  if (req.method !== "POST") return res.status(405).end();
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return res.status(400).json({ error: "bad request" }); }
  const err = verify(b);
  if (err) return res.status(401).json({ error: err });
  const kind = ["land", "plot", "city"].includes(b.kind) ? b.kind : "land";
  const text = String(b.text || "").trim().slice(0, 300);
  if (text.length < 5) return res.status(400).json({ error: "Please describe what you want (at least 5 characters)." });
  const x = Math.round(+b.x || 0), z = Math.round(+b.z || 0);
  if (Math.abs(x) > 30000000 || Math.abs(z) > 30000000) return res.status(400).json({ error: "coordinates out of range" });
  // at most 3 open requests per player
  const open = await db.collection("applications").where("uuid", "==", String(b.u)).where("status", "in", ["new", "pending"]).get();
  if (open.size >= 3) return res.status(429).json({ error: "You already have 3 open requests. Wait for the staff to decide." });
  const ref = await db.collection("applications").add({
    uuid: String(b.u), name: String(b.n).slice(0, 16), kind, text, x, z, status: "new", note: "", t: Date.now(),
  });
  res.status(200).json({ ok: true, id: ref.id });
};
