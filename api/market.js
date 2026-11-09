// Website market actions.
//   POST /api/market  body {u, n, e, s, kind: "bid"|"buy", listing, amount}  -> queued; the Minecraft server runs it within seconds
//   GET  /api/market?u&n&e&s                                                -> your recent actions and their results
// The listing snapshot itself is the Firestore doc world/market, written by /api/positions every 30 s.
const { db, sign, safeEqual, readBody, broken } = require("./_firebase");

function verify(q) {
  const { u, n, e, s } = q || {};
  if (!u || !n || !e || !s) return "missing parameters - open the link from /voice in Minecraft";
  if (Date.now() / 1000 > +e) return "link expired - type /voice in Minecraft again";
  if (!safeEqual(sign(`${u}|${n}|${e}`), s)) return "invalid link";
  return null;
}

module.exports = async (req, res) => {
  if (broken(res)) return;
  if (req.method === "GET") {
    const err = verify(req.query);
    if (err) return res.status(401).json({ error: err });
    const snap = await db.collection("marketActions").where("uuid", "==", String(req.query.u)).limit(20).get();
    return res.status(200).json({ actions: snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.t - a.t) });
  }
  if (req.method !== "POST") return res.status(405).end();
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return res.status(400).end(); }
  const err = verify(b);
  if (err) return res.status(401).json({ error: err });
  const kind = b.kind === "buy" ? "buy" : "bid";
  const listing = Math.floor(+b.listing);
  const amount = Math.round((+b.amount || 0) * 100);          // dollars -> cents
  if (!(listing > 0)) return res.status(400).json({ error: "bad listing" });
  if (kind === "bid" && !(amount > 0)) return res.status(400).json({ error: "enter a bid amount" });
  const ref = await db.collection("marketActions").add({ uuid: String(b.u), name: String(b.n).slice(0, 16), kind, listing, amount, status: "new", result: "", t: Date.now() });
  res.status(200).json({ ok: true, id: ref.id });
};
