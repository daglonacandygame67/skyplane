// Discord bot (HTTP interactions, no always-on bot needed). Discord sends slash commands here:
//   /link name:<Minecraft name> code:<code from /discord link in Minecraft>
// The code is HMAC(SERVER_SECRET, "discord|<name lowercased>|<day>") made by the Minecraft server, so no database is
// needed: a valid code proves the person is that Minecraft player. On success the member gets the Linked role
// (DISCORD_ROLE_ID) and their nickname becomes their Minecraft name. Give only that role permission to send messages.
//
// Vercel settings: DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN, DISCORD_ROLE_ID (and SERVER_SECRET, already set).
const crypto = require("crypto");

const clean = (n) => (process.env[n] || "").trim().replace(/^["']+|["']+$/g, "").trim();

function rawBody(req) {
  return new Promise((res, rej) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => res(Buffer.concat(chunks)));
    req.on("error", rej);
  });
}

function verifyDiscord(req, body) {
  const sig = req.headers["x-signature-ed25519"], ts = req.headers["x-signature-timestamp"];
  const pub = clean("DISCORD_PUBLIC_KEY");
  if (!sig || !ts || !/^[0-9a-f]{64}$/i.test(pub)) return false;
  try {
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub, "hex")]), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.concat([Buffer.from(String(ts)), body]), key, Buffer.from(String(sig), "hex"));
  } catch { return false; }
}

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I
function codeFor(name, day) {
  const h = crypto.createHmac("sha256", clean("SERVER_SECRET")).update(`discord|${name.toLowerCase()}|${day}`).digest();
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[h[i] % ALPHA.length];
  return s;
}

async function discordApi(method, path, body) {
  const r = await fetch("https://discord.com/api/v10" + path, {
    method,
    headers: { Authorization: "Bot " + clean("DISCORD_BOT_TOKEN"), "Content-Type": "application/json", "X-Audit-Log-Reason": "SkyPlane account link" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.status;
}

const reply = (res, text) => res.status(200).json({ type: 4, data: { content: text, flags: 64 } });   // 64 = only the user sees it

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("SkyPlane Discord endpoint. Put this URL in the Discord Developer Portal as the Interactions Endpoint URL.");
  const body = await rawBody(req);
  if (!verifyDiscord(req, body)) return res.status(401).send("invalid request signature");
  const it = JSON.parse(body.toString("utf8"));
  if (it.type === 1) return res.status(200).json({ type: 1 });                                        // Discord's PING
  if (it.type !== 2) return reply(res, "Unknown request.");
  const opt = Object.fromEntries((it.data.options || []).map((o) => [o.name, String(o.value)]));
  const user = it.member && it.member.user;
  if (!it.guild_id || !user) return reply(res, "Use this command in the SkyPlane SMP server.");

  if (it.data.name === "link") {
    const name = (opt.name || "").trim(), code = (opt.code || "").trim().toUpperCase();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return reply(res, "That isn't a Minecraft name. Type `/discord link` in Minecraft to get your code.");
    const today = Math.floor(Date.now() / 86400000);
    if (!clean("SERVER_SECRET") || ![today, today - 1].some((d) => codeFor(name, d) === code))
      return reply(res, "❌ That code doesn't match. In Minecraft type `/discord link` and copy the name and code exactly (codes last about a day).");
    const role = clean("DISCORD_ROLE_ID");
    const st = await discordApi("PUT", `/guilds/${it.guild_id}/members/${user.id}/roles/${role}`);
    if (st >= 300) return reply(res, `⚠️ The code is right, but I couldn't give you the Linked role (Discord said ${st}). Ask an admin to put my role above the Linked role.`);
    const nick = await discordApi("PATCH", `/guilds/${it.guild_id}/members/${user.id}`, { nick: name });
    return reply(res, `✅ Linked to **${name}**! You can chat now.` + (nick >= 300 ? " (I couldn't change your nickname - the server owner's nickname can't be changed by bots.)" : ""));
  }
  return reply(res, "Unknown command.");
};
