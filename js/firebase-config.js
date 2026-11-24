/**
 * Firebase Realtime Database configuration, pure-JS passcode hashing,
 * and unified room sync client for "Kwan Phayao Yi Peng".
 *
 * Out of the box, placeholder values keep the app in Local Multi-Tab Demo Mode
 * (BroadcastChannel + localStorage). Replace FIREBASE_CONFIG with your web app
 * keys from the Firebase Console to enable cross-device Realtime Database sync.
 */

// ---------------------------------------------------------------------------
// Firebase Configuration (loykrathong-e3c19 · asia-southeast1)
// ---------------------------------------------------------------------------
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBvjspJLkqPWyVj7gV7U0R8RhnBhNMW_bM",
  authDomain: "loykrathong-e3c19.firebaseapp.com",
  databaseURL: "https://loykrathong-e3c19-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "loykrathong-e3c19",
  storageBucket: "loykrathong-e3c19.firebasestorage.app",
  messagingSenderId: "421436628532",
  appId: "1:421436628532:web:a2e7a926a71654bbb3f461",
  measurementId: "G-NMVEK48Z8P"
};

const FIREBASE_APP_CDN = "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
const FIREBASE_DB_CDN = "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const LOCAL_HEARTBEAT_MS = 12000;
const LOCAL_STALE_MS = 18000;
const LOCAL_STALE_POLL_MS = 4000;
const MAX_KRATHONGS = 16;
const MAX_LANTERNS = 20;

const memoryStore = new Map();
const sameTabListeners = new Map();
let firebaseRuntimePromise = null;

/**
 * Returns true only when apiKey and databaseURL have been replaced with
 * real, non-empty Firebase configuration values.
 */
export function isFirebaseConfigured() {
  const apiKey = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey;
  const databaseURL = FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL;
  return (
    typeof apiKey === "string" &&
    apiKey.trim().length > 0 &&
    !apiKey.includes("YOUR_") &&
    typeof databaseURL === "string" &&
    databaseURL.trim().length > 0 &&
    !databaseURL.includes("YOUR_")
  );
}

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 (FIPS 180-4) - works over LAN HTTP, file://, and HTTPS
// ---------------------------------------------------------------------------
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function encodeUtf8(str) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function sha256Hex(message) {
  const input = encodeUtf8(message);
  const inputLen = input.length;
  const bitLen = inputLen * 8;
  const paddedLen = Math.ceil((inputLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[inputLen] = 0x80;

  // Big-endian 64-bit bit length in final 8 bytes
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => (word >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/**
 * Normalizes and hashes a shared room passcode into a deterministic room ID.
 * Uses pure-JS SHA-256 (no WebCrypto dependency) so LAN HTTP and file:// work.
 */
export async function hashPasscode(passcode) {
  // NFC + trim + lowercase keeps desktop and auto-capitalized mobile input aligned
  const normalized = String(passcode ?? "").normalize("NFC").trim().toLowerCase();
  const hex = sha256Hex(normalized);
  return `kp_${hex.slice(0, 20)}`;
}

// ---------------------------------------------------------------------------
// Shared Sanitization & Helper Utilities
// ---------------------------------------------------------------------------
function sanitizeRoomId(roomId) {
  const clean = String(roomId ?? "").trim().replace(/[.#$[\]/]/g, "_");
  return clean || "kp_default";
}

function normalizeCharacter(character) {
  return character === "her" ? "her" : "him";
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function stripUndefined(obj) {
  const clean = {};
  if (!obj || typeof obj !== "object") return clean;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

function sanitizePresenceMap(raw, maxAgeMs = null) {
  const result = {};
  if (!raw || typeof raw !== "object") return result;
  const now = Date.now();
  for (const charKey of ["him", "her"]) {
    const entry = raw[charKey];
    if (!entry || typeof entry !== "object" || entry.online === false) continue;
    if (maxAgeMs !== null) {
      const updatedAt = typeof entry.updatedAt === "number" ? entry.updatedAt : 0;
      if (now - updatedAt > maxAgeMs) continue;
    }
    result[charKey] = { ...entry };
  }
  return result;
}

// Strict privacy sanitizer: krathong items NEVER carry wishText
function sanitizeKrathongItem(id, val) {
  if (!val || typeof val !== "object") return null;
  return {
    id: String(id),
    character: normalizeCharacter(val.character),
    krathongStyle: typeof val.krathongStyle === "string" && val.krathongStyle ? val.krathongStyle : "marigold",
    spawnX: typeof val.spawnX === "number" && Number.isFinite(val.spawnX) ? val.spawnX : 380,
    driftSeed: typeof val.driftSeed === "number" && Number.isFinite(val.driftSeed) ? val.driftSeed : 0.5,
    createdAt: typeof val.createdAt === "number" && Number.isFinite(val.createdAt) ? val.createdAt : 0
  };
}

function sanitizeLanternItem(id, val) {
  if (!val || typeof val !== "object") return null;
  return {
    id: String(id),
    character: normalizeCharacter(val.character),
    spawnX: typeof val.spawnX === "number" && Number.isFinite(val.spawnX) ? val.spawnX : 165,
    driftSeed: typeof val.driftSeed === "number" && Number.isFinite(val.driftSeed) ? val.driftSeed : 0.5,
    createdAt: typeof val.createdAt === "number" && Number.isFinite(val.createdAt) ? val.createdAt : 0
  };
}

function sortAndCap(items, limit) {
  const sorted = items.slice().sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.length > limit ? sorted.slice(sorted.length - limit) : sorted;
}

function safeParseJson(raw, fallback) {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

let localStorageAvailable = null;

function isLocalStorageAvailable() {
  if (localStorageAvailable !== null) return localStorageAvailable;
  try {
    if (typeof localStorage === "undefined") {
      localStorageAvailable = false;
      return false;
    }
    const probeKey = "__kp_storage_probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }
  return localStorageAvailable;
}

function storageGet(key) {
  if (isLocalStorageAvailable()) {
    try {
      return localStorage.getItem(key);
    } catch {
      // Fall back to in-memory store
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function storageSet(key, value) {
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // Fall back to in-memory store when quota is exceeded
    }
  }
  memoryStore.set(key, value);
}

function storageRemove(key) {
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(key);
      return;
    } catch {
      // Fall back to in-memory store
    }
  }
  memoryStore.delete(key);
}

// ---------------------------------------------------------------------------
// Dynamic Firebase Runtime Loader (only invoked when configured)
// ---------------------------------------------------------------------------
async function getFirebaseRuntime() {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!firebaseRuntimePromise) {
    firebaseRuntimePromise = (async () => {
      try {
        const [appMod, dbMod] = await Promise.all([
          import(FIREBASE_APP_CDN),
          import(FIREBASE_DB_CDN)
        ]);
        const existingApps = typeof appMod.getApps === "function" ? appMod.getApps() : [];
        const app = existingApps.length > 0 ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
        const db = dbMod.getDatabase(app);
        return { appMod, dbMod, db };
      } catch (err) {
        console.warn("[firebase-config] Firebase unavailable, falling back to Local Demo Mode:", err);
        firebaseRuntimePromise = null;
        return null;
      }
    })();
  }
  return firebaseRuntimePromise;
}

// ---------------------------------------------------------------------------
// Firebase Realtime Database Client
// ---------------------------------------------------------------------------
function createFirebaseRoomClient(roomId, runtime) {
  const { dbMod, db } = runtime;
  const sessionId = createId("fb");
  const joinedCharacters = new Set();
  const activeUnsubs = new Set();
  let destroyed = false;

  function trackUnsub(rawUnsub) {
    let active = true;
    const wrapped = () => {
      if (!active) return;
      active = false;
      activeUnsubs.delete(wrapped);
      try {
        rawUnsub();
      } catch {
        // Ignore teardown errors
      }
    };
    activeUnsubs.add(wrapped);
    return wrapped;
  }

  async function leaveCharacter(character) {
    const charKey = normalizeCharacter(character);
    joinedCharacters.delete(charKey);
    const playerRef = dbMod.ref(db, `rooms/${roomId}/presence/${charKey}`);
    try {
      await dbMod.onDisconnect(playerRef).cancel();
    } catch {
      // Ignore cancel errors if disconnected
    }
    try {
      const snap = await dbMod.get(playerRef);
      if (snap.exists() && snap.val()?.sessionId === sessionId) {
        await dbMod.remove(playerRef);
      }
    } catch {
      // Best-effort cleanup
    }
  }

  return {
    mode: "firebase",
    roomId,

    watchRoomPresence(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const presenceRef = dbMod.ref(db, `rooms/${roomId}/presence`);
      const unsub = dbMod.onValue(presenceRef, (snapshot) => {
        if (destroyed) return;
        cb(sanitizePresenceMap(snapshot.val()));
      });
      return trackUnsub(unsub);
    },

    async joinAs(character, initialState = {}) {
      if (destroyed) return;
      const charKey = normalizeCharacter(character);
      const playerRef = dbMod.ref(db, `rooms/${roomId}/presence/${charKey}`);
      await dbMod.onDisconnect(playerRef).remove();
      const payload = {
        ...stripUndefined(initialState),
        online: true,
        sessionId,
        updatedAt: Date.now()
      };
      await dbMod.set(playerRef, payload);
      joinedCharacters.add(charKey);
    },

    async updatePlayer(character, partialState = {}) {
      if (destroyed) return;
      const charKey = normalizeCharacter(character);
      const playerRef = dbMod.ref(db, `rooms/${roomId}/presence/${charKey}`);
      const payload = {
        ...stripUndefined(partialState),
        online: true,
        sessionId,
        updatedAt: Date.now()
      };
      await dbMod.update(playerRef, payload);
    },

    async leave(character) {
      await leaveCharacter(character);
    },

    watchKrathongs(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const q = dbMod.query(
        dbMod.ref(db, `rooms/${roomId}/krathongs`),
        dbMod.orderByChild("createdAt"),
        dbMod.limitToLast(MAX_KRATHONGS)
      );
      const unsub = dbMod.onValue(q, (snapshot) => {
        if (destroyed) return;
        const items = [];
        snapshot.forEach((child) => {
          const clean = sanitizeKrathongItem(child.key, child.val());
          if (clean) items.push(clean);
        });
        cb(sortAndCap(items, MAX_KRATHONGS));
      });
      return trackUnsub(unsub);
    },

    watchLanterns(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const q = dbMod.query(
        dbMod.ref(db, `rooms/${roomId}/lanterns`),
        dbMod.orderByChild("createdAt"),
        dbMod.limitToLast(MAX_LANTERNS)
      );
      const unsub = dbMod.onValue(q, (snapshot) => {
        if (destroyed) return;
        const items = [];
        snapshot.forEach((child) => {
          const clean = sanitizeLanternItem(child.key, child.val());
          if (clean) items.push(clean);
        });
        cb(sortAndCap(items, MAX_LANTERNS));
      });
      return trackUnsub(unsub);
    },

    async submitWishAndKrathong({ character, wishText, krathongStyle, spawnX }) {
      if (destroyed) return { ok: false, id: null };
      const charKey = normalizeCharacter(character);
      const style = typeof krathongStyle === "string" && krathongStyle ? krathongStyle : "marigold";
      const createdAt = Date.now();
      const cleanWish = String(wishText || "").trim();

      // Write private wish to write-only branch; never expose wishText to krathongs
      const wishRef = dbMod.push(dbMod.ref(db, `rooms/${roomId}/wishes`));
      await dbMod.set(wishRef, {
        character: charKey,
        wishText: cleanWish,
        krathongStyle: style,
        createdAt
      });

      const krathongRef = dbMod.push(dbMod.ref(db, `rooms/${roomId}/krathongs`));
      await dbMod.set(krathongRef, {
        character: charKey,
        krathongStyle: style,
        spawnX: typeof spawnX === "number" && Number.isFinite(spawnX) ? spawnX : 380,
        driftSeed: Math.random(),
        createdAt
      });

      return { ok: true, id: krathongRef.key };
    },

    async releaseSkyLantern({ character, spawnX }) {
      if (destroyed) return { ok: false, id: null };
      const charKey = normalizeCharacter(character);
      const createdAt = Date.now();
      const lanternRef = dbMod.push(dbMod.ref(db, `rooms/${roomId}/lanterns`));
      await dbMod.set(lanternRef, {
        character: charKey,
        spawnX: typeof spawnX === "number" && Number.isFinite(spawnX) ? spawnX : 165,
        driftSeed: Math.random(),
        createdAt
      });
      return { ok: true, id: lanternRef.key };
    },

    async destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const unsub of Array.from(activeUnsubs)) {
        unsub();
      }
      activeUnsubs.clear();
      const chars = Array.from(joinedCharacters);
      await Promise.allSettled(chars.map((charKey) => leaveCharacter(charKey)));
    }
  };
}

// ---------------------------------------------------------------------------
// Local Multi-Tab Demo Client (BroadcastChannel + localStorage + same-tab bus)
// ---------------------------------------------------------------------------
function createLocalRoomClient(roomId) {
  const sessionId = createId("loc");
  const joinedCharacters = new Set();
  const heartbeatTimers = new Map();
  const presenceWatchers = new Set();
  const krathongWatchers = new Set();
  const lanternWatchers = new Set();
  let staleCheckTimer = null;
  let unloadListenersAttached = false;
  let destroyed = false;

  const pKey = (charKey) => `kp_local_presence_${roomId}_${charKey}`;
  const kKey = `kp_local_krathongs_${roomId}`;
  const lKey = `kp_local_lanterns_${roomId}`;
  const wKey = `kp_writeonly_wishes_${roomId}`;

  let channel = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(`kwan-phayao-${roomId}`);
    } catch {
      channel = null;
    }
  }

  function readPresence() {
    const raw = {
      him: safeParseJson(storageGet(pKey("him")), null),
      her: safeParseJson(storageGet(pKey("her")), null)
    };
    return sanitizePresenceMap(raw, LOCAL_STALE_MS);
  }

  function readKrathongs() {
    const rawList = safeParseJson(storageGet(kKey), []);
    if (!Array.isArray(rawList)) return [];
    const cleaned = [];
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const sanitized = sanitizeKrathongItem(item.id || createId("k"), item);
      if (sanitized) cleaned.push(sanitized);
    }
    return sortAndCap(cleaned, MAX_KRATHONGS);
  }

  function readLanterns() {
    const rawList = safeParseJson(storageGet(lKey), []);
    if (!Array.isArray(rawList)) return [];
    const cleaned = [];
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const sanitized = sanitizeLanternItem(item.id || createId("l"), item);
      if (sanitized) cleaned.push(sanitized);
    }
    return sortAndCap(cleaned, MAX_LANTERNS);
  }

  // Write-only sink: never read back into UI, game state, or network callbacks
  function appendWriteOnlyWish(entry) {
    const existing = safeParseJson(storageGet(wKey), []);
    const list = Array.isArray(existing) ? existing : [];
    list.push(entry);
    const trimmed = list.length > 200 ? list.slice(list.length - 200) : list;
    storageSet(wKey, JSON.stringify(trimmed));
  }

  function notifyWatchers(kind) {
    if (destroyed) return;
    if (kind === "presence") {
      const snapshot = readPresence();
      for (const entry of Array.from(presenceWatchers)) {
        entry.emit(snapshot);
      }
    } else if (kind === "krathongs") {
      const list = readKrathongs();
      for (const entry of Array.from(krathongWatchers)) {
        entry.emit(list);
      }
    } else if (kind === "lanterns") {
      const list = readLanterns();
      for (const entry of Array.from(lanternWatchers)) {
        entry.emit(list);
      }
    }
  }

  function broadcast(kind, syncPayload) {
    if (channel) {
      try {
        channel.postMessage({ kind, roomId, senderId: sessionId, syncPayload });
      } catch {
        // Ignore closed-channel errors
      }
    }
    const localSet = sameTabListeners.get(roomId);
    if (localSet) {
      for (const listener of Array.from(localSet)) {
        listener(kind);
      }
    }
  }

  function onSameTabEvent(kind) {
    notifyWatchers(kind);
  }

  if (!sameTabListeners.has(roomId)) {
    sameTabListeners.set(roomId, new Set());
  }
  sameTabListeners.get(roomId).add(onSameTabEvent);

  function applyCrossTabFallbackPayload(kind, syncPayload) {
    if (!syncPayload || isLocalStorageAvailable()) return;
    if (kind === "presence" && syncPayload.character) {
      const key = pKey(syncPayload.character);
      if (syncPayload.entry === null) {
        storageRemove(key);
      } else if (syncPayload.entry) {
        storageSet(key, JSON.stringify(syncPayload.entry));
      }
    } else if (kind === "krathongs" && Array.isArray(syncPayload)) {
      storageSet(kKey, JSON.stringify(syncPayload));
    } else if (kind === "lanterns" && Array.isArray(syncPayload)) {
      storageSet(lKey, JSON.stringify(syncPayload));
    }
  }

  function onChannelMessage(event) {
    if (destroyed || !event || !event.data) return;
    const { kind, senderId, syncPayload } = event.data;
    if (senderId === sessionId) return;
    applyCrossTabFallbackPayload(kind, syncPayload);
    if (kind === "presence" || kind === "krathongs" || kind === "lanterns") {
      notifyWatchers(kind);
    }
  }

  if (channel) {
    channel.addEventListener("message", onChannelMessage);
  }

  function onStorageEvent(event) {
    if (destroyed || !event) return;
    if (event.key === null) {
      notifyWatchers("presence");
      notifyWatchers("krathongs");
      notifyWatchers("lanterns");
      return;
    }
    if (event.key === pKey("him") || event.key === pKey("her")) {
      notifyWatchers("presence");
    } else if (event.key === kKey) {
      notifyWatchers("krathongs");
    } else if (event.key === lKey) {
      notifyWatchers("lanterns");
    }
    // Deliberately ignore wKey (write-only wishes)
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorageEvent);
  }

  function leaveCharacterSync(character) {
    const charKey = normalizeCharacter(character);
    joinedCharacters.delete(charKey);
    const timer = heartbeatTimers.get(charKey);
    if (timer !== undefined) {
      clearInterval(timer);
      heartbeatTimers.delete(charKey);
    }
    const existing = safeParseJson(storageGet(pKey(charKey)), null);
    if (!existing || existing.sessionId === sessionId) {
      storageRemove(pKey(charKey));
      broadcast("presence", { character: charKey, entry: null });
    }
    if (joinedCharacters.size === 0) {
      detachUnloadListeners();
    }
  }

  function onPageUnload() {
    for (const charKey of Array.from(joinedCharacters)) {
      leaveCharacterSync(charKey);
    }
  }

  function attachUnloadListeners() {
    if (unloadListenersAttached || typeof window === "undefined") return;
    window.addEventListener("beforeunload", onPageUnload);
    window.addEventListener("pagehide", onPageUnload);
    unloadListenersAttached = true;
  }

  function detachUnloadListeners() {
    if (!unloadListenersAttached || typeof window === "undefined") return;
    window.removeEventListener("beforeunload", onPageUnload);
    window.removeEventListener("pagehide", onPageUnload);
    unloadListenersAttached = false;
  }

  function ensureStalePoll() {
    if (staleCheckTimer !== null || presenceWatchers.size === 0) return;
    staleCheckTimer = setInterval(() => {
      if (destroyed) return;
      notifyWatchers("presence");
    }, LOCAL_STALE_POLL_MS);
  }

  function stopStalePollIfIdle() {
    if (presenceWatchers.size === 0 && staleCheckTimer !== null) {
      clearInterval(staleCheckTimer);
      staleCheckTimer = null;
    }
  }

  function startHeartbeat(charKey) {
    const existingTimer = heartbeatTimers.get(charKey);
    if (existingTimer !== undefined) {
      clearInterval(existingTimer);
    }
    const timer = setInterval(() => {
      if (destroyed || !joinedCharacters.has(charKey)) return;
      const current = safeParseJson(storageGet(pKey(charKey)), null);
      if (current && current.sessionId !== sessionId) return;
      const updated = {
        ...(current && typeof current === "object" ? current : {}),
        online: true,
        sessionId,
        updatedAt: Date.now()
      };
      storageSet(pKey(charKey), JSON.stringify(updated));
      broadcast("presence", { character: charKey, entry: updated });
    }, LOCAL_HEARTBEAT_MS);
    heartbeatTimers.set(charKey, timer);
  }

  function createWatcherEntry(cb) {
    let lastJson = null;
    return {
      emit(payload) {
        const nextJson = JSON.stringify(payload);
        if (nextJson === lastJson) return;
        lastJson = nextJson;
        cb(payload);
      }
    };
  }

  return {
    mode: "local",
    roomId,

    watchRoomPresence(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const entry = createWatcherEntry(cb);
      presenceWatchers.add(entry);
      ensureStalePoll();
      entry.emit(readPresence());
      return () => {
        presenceWatchers.delete(entry);
        stopStalePollIfIdle();
      };
    },

    async joinAs(character, initialState = {}) {
      if (destroyed) return;
      const charKey = normalizeCharacter(character);
      const payload = {
        ...stripUndefined(initialState),
        online: true,
        sessionId,
        updatedAt: Date.now()
      };
      storageSet(pKey(charKey), JSON.stringify(payload));
      joinedCharacters.add(charKey);
      attachUnloadListeners();
      startHeartbeat(charKey);
      broadcast("presence", { character: charKey, entry: payload });
    },

    async updatePlayer(character, partialState = {}) {
      if (destroyed) return;
      const charKey = normalizeCharacter(character);
      const existing = safeParseJson(storageGet(pKey(charKey)), {});
      const payload = {
        ...(existing && typeof existing === "object" ? existing : {}),
        ...stripUndefined(partialState),
        online: true,
        sessionId,
        updatedAt: Date.now()
      };
      storageSet(pKey(charKey), JSON.stringify(payload));
      broadcast("presence", { character: charKey, entry: payload });
    },

    async leave(character) {
      leaveCharacterSync(character);
    },

    watchKrathongs(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const entry = createWatcherEntry(cb);
      krathongWatchers.add(entry);
      entry.emit(readKrathongs());
      return () => {
        krathongWatchers.delete(entry);
      };
    },

    watchLanterns(cb) {
      if (destroyed || typeof cb !== "function") return () => {};
      const entry = createWatcherEntry(cb);
      lanternWatchers.add(entry);
      entry.emit(readLanterns());
      return () => {
        lanternWatchers.delete(entry);
      };
    },

    async submitWishAndKrathong({ character, wishText, krathongStyle, spawnX }) {
      if (destroyed) return { ok: false, id: null };
      const charKey = normalizeCharacter(character);
      const style = typeof krathongStyle === "string" && krathongStyle ? krathongStyle : "marigold";
      const createdAt = Date.now();
      const cleanWish = String(wishText || "").trim();

      // 1) Store private wish in write-only sink (never read back into UI or state)
      appendWriteOnlyWish({
        character: charKey,
        wishText: cleanWish,
        krathongStyle: style,
        createdAt
      });

      // 2) Publish public krathong with ZERO wishText
      const id = createId("kr");
      const krathongItem = {
        id,
        character: charKey,
        krathongStyle: style,
        spawnX: typeof spawnX === "number" && Number.isFinite(spawnX) ? spawnX : 380,
        driftSeed: Math.random(),
        createdAt
      };
      const nextList = sortAndCap([...readKrathongs(), krathongItem], MAX_KRATHONGS);
      storageSet(kKey, JSON.stringify(nextList));
      broadcast("krathongs", nextList);

      return { ok: true, id };
    },

    async releaseSkyLantern({ character, spawnX }) {
      if (destroyed) return { ok: false, id: null };
      const charKey = normalizeCharacter(character);
      const id = createId("ln");
      const lanternItem = {
        id,
        character: charKey,
        spawnX: typeof spawnX === "number" && Number.isFinite(spawnX) ? spawnX : 165,
        driftSeed: Math.random(),
        createdAt: Date.now()
      };
      const nextList = sortAndCap([...readLanterns(), lanternItem], MAX_LANTERNS);
      storageSet(lKey, JSON.stringify(nextList));
      broadcast("lanterns", nextList);

      return { ok: true, id };
    },

    async destroy() {
      if (destroyed) return;
      for (const charKey of Array.from(joinedCharacters)) {
        leaveCharacterSync(charKey);
      }
      destroyed = true;

      for (const timer of heartbeatTimers.values()) {
        clearInterval(timer);
      }
      heartbeatTimers.clear();

      if (staleCheckTimer !== null) {
        clearInterval(staleCheckTimer);
        staleCheckTimer = null;
      }

      presenceWatchers.clear();
      krathongWatchers.clear();
      lanternWatchers.clear();

      detachUnloadListeners();

      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorageEvent);
      }

      const localSet = sameTabListeners.get(roomId);
      if (localSet) {
        localSet.delete(onSameTabEvent);
        if (localSet.size === 0) {
          sameTabListeners.delete(roomId);
        }
      }

      if (channel) {
        channel.removeEventListener("message", onChannelMessage);
        try {
          channel.close();
        } catch {
          // Ignore close errors
        }
        channel = null;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Public Unified Room Client Factory
// ---------------------------------------------------------------------------
export async function createRoomClient(roomId) {
  const cleanRoomId = sanitizeRoomId(roomId);
  const runtime = await getFirebaseRuntime();
  if (runtime) {
    return createFirebaseRoomClient(cleanRoomId, runtime);
  }
  return createLocalRoomClient(cleanRoomId);
}
