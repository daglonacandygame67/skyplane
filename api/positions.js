// POST from the Minecraft server (SkyExtras VoiceBridge): every second while players are online, every 15 s when empty.
// Body: {t, clock, airports?, players:[{uuid,name,dim,x,y,z,yaw,area,fly?}], updates?:[{id,status,note}]}, header X-Signature = HMAC-SHA256(body, SERVER_SECRET).
// Response: {ok, n, applications:[{id,uuid,name,kind,text,x,z}]} - new land requests made on the website, handed to the server once.
const { db, sign, safeEqual, readBody } = require("./_firebase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await readBody(req);
  if (!process.env.SERVER_SECRET || !safeEqual(sign(raw), req.headers["x-signature"] || "")) return res.status(401).json({ error: "bad signature" });
  let body;
  try { body = JSON.parse(raw); } catch { return res.status(400).end(); }
  const players = (body.players || []).slice(0, 200).map((p) => ({
    uuid: String(p.uuid), name: String(p.name).slice(0, 16), dim: String(p.dim),
    x: +p.x, y: +p.y, z: +p.z, yaw: +p.yaw || 0, area: String(p.area || "").slice(0, 60),
    fly: p.fly ? { craft: String(p.fly.craft || "").slice(0, 40), alt: +p.fly.alt || 0, kt: +p.fly.kt || 0, hdg: +p.fly.hdg || 0,
      route: String(p.fly.route || "").slice(0, 60), dist: +p.fly.dist || 0, bps: +p.fly.bps || 0, ap: !!p.fly.ap } : null,
  }));
  await db.doc("world/positions").set({ t: Date.now(), players, clock: String(body.clock || "").slice(0, 60) });
  if (Array.isArray(body.airports)) await db.doc("world/airports").set({ t: Date.now(), list: body.airports.slice(0, 100) });
  if (body.stats && typeof body.stats === "object") {
    const s = body.stats, num = (v) => (Number.isFinite(+v) ? +v : 0), str = (v, n) => String(v ?? "").slice(0, n);
    const stocks = {};
    for (const [k, v] of Object.entries(s.stocks || {}).slice(0, 12)) stocks[str(k, 6)] = num(v);
    const mayors = {};
    for (const [k, v] of Object.entries(s.mayors || {}).slice(0, 20)) mayors[str(k, 30)] = str(v, 16);
    await db.doc("world/stats").set({
      t: Date.now(), pot: num(s.pot), lastWinner: str(s.lastWinner, 60), players: num(s.players), clubs: num(s.clubs), charity: num(s.charity),
      festival: !!s.festival, stocks, mayors,
      richest: (s.richest || []).slice(0, 5).map((r) => ({ name: str(r.name, 16), cents: num(r.cents) })),
      news: (s.news || []).slice(0, 5).map((n) => str(n, 160)),
    });
  }

  // staff decisions made in game -> application status the website shows
  const batch = db.batch();
  let writes = 0;
  for (const u of (body.updates || []).slice(0, 50)) {
    if (!u || !u.id || !["approved", "declined"].includes(u.status)) continue;
    batch.update(db.collection("applications").doc(String(u.id)), { status: u.status, note: String(u.note || "").slice(0, 80) });
    writes++;
  }
  // new website requests -> hand them to the server once
  const fresh = await db.collection("applications").where("status", "==", "new").limit(25).get();
  const applications = fresh.docs.map((d) => {
    const a = d.data();
    batch.update(d.ref, { status: "pending" });
    writes++;
    return { id: d.id, uuid: a.uuid, name: a.name, kind: a.kind, text: a.text, x: a.x, z: a.z };
  });
  // auction-house snapshot for the website market (sent every 30 s)
  if (Array.isArray(body.market)) await db.doc("world/market").set({ t: Date.now(), listings: body.market.slice(0, 300) });
  for (const r of (body.marketResults || []).slice(0, 50)) {
    if (!r || !r.id) continue;
    batch.update(db.collection("marketActions").doc(String(r.id)), { status: "done", result: String(r.result || "").slice(0, 200) });
    writes++;
  }
  const acts = await db.collection("marketActions").where("status", "==", "new").limit(25).get();
  const marketActions = acts.docs.map((d) => {
    const a = d.data();
    batch.update(d.ref, { status: "pending" }); writes++;
    return { id: d.id, uuid: a.uuid, name: a.name, kind: a.kind, listing: a.listing, amount: a.amount };
  });
  // pilot map: "fly me to <airport>" requests from the website
  const pa = await db.collection("pilotActions").where("status", "==", "new").limit(25).get();
  const pilotActions = pa.docs.map((d) => { const a = d.data(); batch.update(d.ref, { status: "done" }); writes++; return { uuid: a.uuid, icao: a.icao }; });
  // speech captions (only fresh ones; anything older than 8 s is dropped)
  const capSnap = await db.collection("captions").orderBy("t").limit(60).get();
  const captions = [];
  for (const d of capSnap.docs) {
    const c = d.data();
    if (Date.now() - c.t < 8000) captions.push({ uuid: c.uuid, text: c.text });
    batch.delete(d.ref); writes++;
  }
  // website direct messages -> the receiver's in-game phone (written by the browser into "notify", handed over once)
  const nSnap = await db.collection("notify").limit(50).get();
  const dms = [];
  for (const d of nSnap.docs) {
    const m = d.data();
    if (Date.now() - (m.t || 0) < 6 * 3600 * 1000) dms.push({ to: String(m.to), fromName: String(m.fromName || "").slice(0, 16), text: String(m.text || "").slice(0, 500) });
    batch.delete(d.ref); writes++;
  }
  if (writes) await batch.commit();
  res.status(200).json({ ok: true, n: players.length, applications, captions, marketActions, pilotActions, dms });
};
