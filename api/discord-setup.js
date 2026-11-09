// One-time setup: registers the /link slash command in your Discord server.
// Open https://<your site>/api/discord-setup?key=<SERVER_SECRET> once after setting the Discord settings in Vercel.
// Needs DISCORD_APP_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN.
const crypto = require("crypto");
const clean = (n) => (process.env[n] || "").trim().replace(/^["']+|["']+$/g, "").trim();

module.exports = async (req, res) => {
  const key = String((req.query && req.query.key) || "");
  const secret = clean("SERVER_SECRET");
  const a = Buffer.from(key), b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "add ?key=<your SERVER_SECRET> to the link" });
  const missing = ["DISCORD_APP_ID", "DISCORD_GUILD_ID", "DISCORD_BOT_TOKEN", "DISCORD_PUBLIC_KEY", "DISCORD_ROLE_ID"].filter((n) => !clean(n));
  if (missing.length) return res.status(400).json({ error: "missing Vercel settings: " + missing.join(", ") });
  const commands = [{
    name: "link",
    description: "Link your Minecraft account to chat here",
    options: [
      { type: 3, name: "name", description: "Your Minecraft name", required: true },
      { type: 3, name: "code", description: "The code from /discord link in Minecraft", required: true },
    ],
  }];
  const r = await fetch(`https://discord.com/api/v10/applications/${clean("DISCORD_APP_ID")}/guilds/${clean("DISCORD_GUILD_ID")}/commands`, {
    method: "PUT",
    headers: { Authorization: "Bot " + clean("DISCORD_BOT_TOKEN"), "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  const text = await r.text();
  res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true, message: "The /link command is registered in your Discord server." } : { error: "Discord said " + r.status, detail: text.slice(0, 300) });
};
