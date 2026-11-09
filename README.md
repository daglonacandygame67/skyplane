# SkyPlane SMP website

This folder is the whole website:

| Address | What it is |
|---|---|
| `/` | The public homepage: about the server, the cities, how to join, commands and rules. |
| `/voice` | Proximity voice chat, messages, pilot map, market, land requests and server stats. Players get their personal link by typing `/voice` in game. |

**How voice works:**
- Voice goes directly between players' browsers (WebRTC). It never passes through your servers and isn't recorded.
- You hear players who are near you in game: within 48 blocks by default, and in the same dimension.
- Volume fades with distance.
- Voices are panned left or right depending on which side of you the speaker is standing, using your in-game facing.
- Players can mute, deafen, and set a separate volume for each person.

**How messages work:**
- Messages are saved, so you can message players who are offline.
- Unread messages get a badge and show in the tab title.
- Each message is also sent to the other player's in-game phone.

**Stack:**
- Vercel: static pages plus small serverless functions in `api/`.
- Firebase: Firestore for data, and Auth with custom tokens.

## One-time setup (about 20 minutes)

### 1. Firebase
1. Create a project at <https://console.firebase.google.com>.
2. In **Build → Firestore Database**, create a database in production mode.
3. In the database's **Rules** tab, paste in the whole of `firestore.rules` and press **Publish**.
   - **If you set this up before Update 7, publish the rules again.** The new message inbox needs them, and messages fail without them.
4. In **Build → Authentication**, press **Get started**. You don't need to turn on any sign-in providers.
5. In **Project settings → General → Your apps**, add a **Web app**. Copy its `apiKey`, `authDomain`, `projectId` and `appId`.
6. In **Project settings → Service accounts**, press **Generate new private key**. This downloads a JSON file. Keep it secret.

### 2. GitHub and Vercel
1. Put this folder in a GitHub repository, either a new one or your existing site's repo, replacing the old files.
2. On <https://vercel.com>, go to **Add New → Project** and import the repo. Leave the framework set to "Other".
3. In **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The **entire** contents of the service-account JSON file |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` | The values from Firebase step 5 |
| `SERVER_SECRET` | A long random password, for example 40 random letters. The Minecraft server uses the same value. |
| `HEARING_RANGE` | Optional. The voice range in blocks; the default is 48. |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | Optional. A TURN relay for players on strict school or office networks, where voice can't connect directly. metered.ca has a free tier. |

4. Press **Redeploy**. The site is now at `https://<project>.vercel.app`, and you can add your own domain under **Settings → Domains**.

### 3. Minecraft server
Edit `config/skyserver/extras.json` on SpaceNode:
```json
"voiceUrl": "https://<project>.vercel.app",
"voiceApi": "https://<project>.vercel.app/api/positions",
"voiceSecret": "<the same SERVER_SECRET>"
```
Restart the server. Players type `/voice`, or use the Voice Chat app on their in-game phone.

## Checking it works
1. Join the game and type `/voice`, then open the link.
2. The top bar should show the in-game clock. If it doesn't:
   - `voiceApi` or `voiceSecret` is wrong; or
   - Vercel's `SERVER_SECRET` doesn't match `voiceSecret`.
3. With a friend near you in game, both press **Join voice**. Within a few seconds the friend's row should show **talking range**.
   - If it stays on "Connecting…", one of you is on a network that blocks direct connections. Add a TURN relay (see the Vercel variables above).
4. Send a message. It should appear on their phone in game within a couple of seconds.

## Costs
- **Firestore:**
  - The server writes its position update once a second while players are online, which is about 3,600 writes an hour.
  - The free tier is 20,000 writes a day.
  - A server that is busy all day costs roughly US$0.10–0.20 a day.
- **Vercel:** the Hobby plan is free for non-commercial sites.

## Security
- Each `/voice` link is signed with `SERVER_SECRET` and expires after 12 hours, so players can't pretend to be someone else.
- Only the Minecraft server can post positions, because every update carries a signature.
- Players can only read their own conversations and their own signalling messages.
