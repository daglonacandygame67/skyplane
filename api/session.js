// Exchanges the signed link from /voice in Minecraft for a Firebase custom token.
// The link carries u (uuid), n (name), e (expiry, unix s) and s = HMAC(u|n|e) made by the server with SERVER_SECRET.
const { admin, sign, safeEqual } = require("./_firebase");

module.exports = async (req, res) => {
  const { u, n, e, s } = req.query || {};
  if (!u || !n || !e || !s) return res.status(400).json({ error: "missing parameters - open the link from /voice in Minecraft" });
  if (Date.now() / 1000 > +e) return res.status(401).json({ error: "link expired - type /voice in Minecraft again" });
  if (!safeEqual(sign(`${u}|${n}|${e}`), s)) return res.status(401).json({ error: "invalid link" });
  const token = await admin.auth().createCustomToken(String(u), { name: String(n).slice(0, 16) });
  res.status(200).json({ token, uuid: u, name: n });
};
