// Gives the browser the public Firebase web config (these values are not secret) and optional TURN servers.
const clean = (n) => { let v = (process.env[n] || "").trim(); return v.replace(/^["']+|["']+$/g, "").trim(); };
module.exports = (req, res) => {
  const ice = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (process.env.TURN_URL) ice.push({ urls: process.env.TURN_URL, username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  res.status(200).json({
    firebase: {
      apiKey: clean("FIREBASE_API_KEY"),
      authDomain: clean("FIREBASE_AUTH_DOMAIN"),
      projectId: clean("FIREBASE_PROJECT_ID"),
      appId: clean("FIREBASE_APP_ID"),
    },
    ice,
    hearing: +(process.env.HEARING_RANGE || 48),
    emulator: process.env.FIRESTORE_EMULATOR_HOST ? { firestore: process.env.FIRESTORE_EMULATOR_HOST, auth: process.env.FIREBASE_AUTH_EMULATOR_HOST } : null,
  });
};
