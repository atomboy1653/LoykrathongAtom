# คืนเดือนเพ็ญ ณ กว๊านพะเยา · Kwan Phayao Yi Peng

A cozy zero-build 2-player lakeside experience at Kwan Phayao (กว๊านพะเยา). Walk along the promenade, sit together on the lakeside bench, release sky lanterns (*khom loi*) from the wooden pier, and float private candlelit *krathongs* onto the water.

Works out of the box in **Local Multi-Tab Demo Mode** with zero configuration, or across devices in ~5 minutes using free **Firebase Realtime Database** + **GitHub Pages**.

---

## 1. Quick Start: Local Multi-Tab Demo Mode (0 min)

Because the app uses standard ES modules (`<script type="module">`), serve the folder over a local static HTTP server:

```bash
# Option A: Python
python -m http.server 8080

# Option B: Node.js
npx --yes serve -l 8080 .
```

Then test co-op locally:
1. Open **`http://localhost:8080`** in **Tab 1** and **Tab 2** (no build step required).
2. Enter the **same shared passcode** in both tabs (e.g. `phayao-2569`), or join in Tab 1 and click **Invite / Copy Link** to open the `#id=...` URL in Tab 2.
3. Choose **ชายหนุ่ม · Him** in Tab 1 and **หญิงสาว · Her** in Tab 2, then enter the lakeside.
4. Move around (`WASD` / Arrow keys), press `1–4` for emotes, press `E` near the bench, pier, pavilion, or shoreline.
5. **Test mobile viewports & LAN phones**:
   - In Browser DevTools (`F12` -> Toggle Device Toolbar), check **Portrait (`390×844`)** and **Landscape (`844×390`)** to verify the on-screen D-pad, Interact button, and Thai text layout.
   - To test on a real phone on the same Wi-Fi, open `http://<YOUR-LAN-IP>:8080` (passcode hashing uses pure-JS SHA-256 so LAN HTTP works without HTTPS).

---

## 2. Live Cross-Device Setup with Firebase (5 min)

### Step A: Create a Free Firebase Realtime Database (`asia-southeast1`)
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project** (Google Analytics is optional).
2. In the left sidebar, open **Build -> Realtime Database** and click **Create Database**.
3. Choose **`Singapore (asia-southeast1)`** as the database location (lowest latency for Thailand).
4. Start in **locked mode**, then click **Enable**.

### Step B: Paste Your Web App Config into `js/firebase-config.js`
1. Click the gear icon next to **Project Overview -> Project settings**.
2. Under **Your apps**, click the Web icon (`</>`), register an app name, and copy the `firebaseConfig` object.
3. Open [`js/firebase-config.js`](./js/firebase-config.js) and replace the placeholder values in `FIREBASE_CONFIG`:

```js
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

> Once `apiKey` and `databaseURL` no longer contain `"YOUR_"`, the app automatically switches from Local Demo Mode to Firebase live sync (and still falls back to Local Demo Mode if offline or unreachable).

### Step C: Apply Write-Only Privacy Security Rules
In Firebase Console -> **Realtime Database -> Rules**, replace the rules with the JSON below and click **Publish**:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$roomId": {
        "presence": {
          ".read": true,
          "$character": {
            ".write": "$character === 'him' || $character === 'her'"
          }
        },
        "wishes": {
          ".read": false,
          "$wishId": {
            ".read": false,
            ".write": "!data.exists()",
            ".validate": "newData.hasChildren(['character', 'wishText', 'krathongStyle', 'createdAt']) && newData.child('wishText').isString() && newData.child('wishText').val().length <= 500"
          }
        },
        "krathongs": {
          ".read": true,
          ".indexOn": ["createdAt"],
          "$krathongId": {
            ".write": "!data.exists()",
            ".validate": "!newData.hasChild('wishText') && newData.hasChildren(['character', 'krathongStyle', 'spawnX', 'driftSeed', 'createdAt'])"
          }
        },
        "lanterns": {
          ".read": true,
          ".indexOn": ["createdAt"],
          "$lanternId": {
            ".write": "!data.exists()",
            ".validate": "!newData.hasChild('wishText') && newData.hasChildren(['character', 'spawnX', 'driftSeed', 'createdAt'])"
          }
        }
      }
    }
  }
}
```

**Why these rules guarantee privacy:**
- `rooms/$roomId` intentionally has **no** `.read: true` at the room root (in Firebase RTDB, parent `.read: true` cannot be revoked by children).
- `rooms/$roomId/wishes/$wishId` enforces `".read": false` and `".write": "!data.exists()"` — wishes are strictly write-once and unreadable by any client, including your partner.
- `rooms/$roomId/krathongs` enforces `!newData.hasChild('wishText')` — synced floating krathongs can never carry or expose wish text.

---

## 3. Host Free on GitHub Pages

1. Push this repository to GitHub (e.g., to your `main` branch).
2. Open your repository on GitHub and go to **Settings -> Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` and folder `/ (root)`
4. Click **Save**. Within a minute or two, GitHub Pages will publish your static site at `https://<your-username>.github.io/<repo-name>/` over HTTPS—ready to share with an invite link.
