/**
 * Kwan Phayao Yi Peng - Main Game Engine & Scene Renderer
 * Owns canvas rendering, camera scaling, movement/collision, co-op sync,
 * and UI/input bindings for Kwan Phayao Lakeside.
 */

import {
  WORLD_CONFIG,
  PALETTE,
  createSprites,
  drawCharacterPreview,
} from './sprites.js';
import { createAudioEngine } from './audio.js';
import {
  hashPasscode,
  isFirebaseConfigured,
  createRoomClient,
} from './firebase-config.js';

const STORAGE_PASSCODE_KEY = 'kp_remember_passcode';
const STORAGE_ROOM_ID_KEY = 'kp_remember_room_id';

const KRATHONG_STYLES = ['marigold', 'lotus', 'jasmine'];
const CHAR_NAMES = {
  him: { th: 'อะตอม', en: 'Atom' },
  her: { th: 'ฟ้าใส', en: 'Fahsai' },
};
const KRATHONG_BADGE_LABELS = {
  marigold: 'ถือกระทง: ดาวเรือง · Carrying Marigold',
  lotus: 'ถือกระทง: บัวหลวง · Carrying Lotus',
  jasmine: 'ถือกระทง: มะลิ · Carrying Jasmine',
};

const EMOTES = ['heart', 'lantern', 'sparkle', 'wave'];
const EMOTE_DURATION_MS = 2600;
const PLAYER_SPEED = 72; // world px/s
const SYNC_INTERVAL_MS = 84; // ~12 Hz throttled updates
const LANTERN_COOLDOWN_MS = 450;
const CELEBRATION_RADIUS = 48;
const PROXIMITY_AURA_RADIUS = 34;
const COOP_LANTERN_RADIUS = 44;
const COOP_LANTERN_CANCEL_RADIUS = 54;
const CLOSENESS_MAX_DIST = 56;
const SIDE_BY_SIDE_DIST = 44;

const MOON_POS = { x: 546, y: 24, r: 10 };
const WAT_POS = { x: 356, y: 74 };
const NAGA_POS = { x: 418, y: 130, sortY: 170 };
const BENCH_POS = { x: 232, y: 170, sortY: 179 };
const PAVILION_POS = { x: 739, y: 144, sortY: 200 };
const MUSIC_BOX_POS = { x: 36, y: 162, sortY: 183 };
const PIER_BOUNDS = { x: 133, y: 132, w: 64, h: 32 };

const SHORELINE_BUSHES = [
  { x: 10, y: 174, kind: 'bushA' },
  { x: 12, y: 214, kind: 'bushB' },
  { x: 14, y: 248, kind: 'bushA' },
  { x: 42, y: 256, kind: 'bushB' },
  { x: 156, y: 258, kind: 'bushA' },
  { x: 278, y: 256, kind: 'bushB' },
  { x: 468, y: 258, kind: 'bushA' },
  { x: 648, y: 256, kind: 'bushB' },
  { x: 772, y: 258, kind: 'bushA' },
  { x: 898, y: 256, kind: 'bushB' },
  { x: 946, y: 176, kind: 'bushB' },
  { x: 944, y: 216, kind: 'bushA' },
  { x: 942, y: 248, kind: 'bushB' },
];

// Deterministic PRNG for twinkling stars, distant lanterns, mountains & fireflies
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildSceneParticles() {
  const rng = createRng(25671115);

  const stars = [];
  for (let i = 0; i < 58; i++) {
    stars.push({
      x: Math.floor(rng() * WORLD_CONFIG.width),
      y: Math.floor(-48 + rng() * 98),
      phase: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 2.1,
      bright: rng() > 0.65,
    });
  }

  const ambientLanterns = [];
  for (let i = 0; i < 18; i++) {
    ambientLanterns.push({
      x: rng() * WORLD_CONFIG.width,
      y: -30 + rng() * 92,
      speedY: 1.8 + rng() * 2.4,
      driftX: (rng() - 0.35) * 1.4,
      phase: rng() * Math.PI * 2,
      size: rng() > 0.68 ? 2 : 1,
    });
  }

  const lakeGlints = [];
  for (let i = 0; i < 32; i++) {
    lakeGlints.push({
      x: Math.floor(rng() * (WORLD_CONFIG.width - 12)),
      y: Math.floor(WORLD_CONFIG.skyBottomY + 6 + rng() * (WORLD_CONFIG.waterBottomY - WORLD_CONFIG.skyBottomY - 12)),
      w: 3 + Math.floor(rng() * 7),
      phase: rng() * Math.PI * 2,
      speed: 0.7 + rng() * 1.1,
    });
  }

  const fireflies = [];
  for (let i = 0; i < 28; i++) {
    const nearPavilion = i >= 22;
    const baseX = nearPavilion
      ? 720 + rng() * 130
      : 16 + rng() * (WORLD_CONFIG.width - 32);
    const baseY = nearPavilion
      ? 172 + rng() * 68
      : rng() > 0.4
        ? 234 + rng() * 30
        : 164 + rng() * 24;
    fireflies.push({
      baseX,
      baseY,
      ampX: 4 + rng() * 8,
      ampY: 2 + rng() * 5,
      phase: rng() * Math.PI * 2,
      speed: 0.8 + rng() * 1.2,
    });
  }

  // Precompute Doi Luang & Doi Nok mountain ridges (1px columns across width)
  const farRidge = new Int16Array(WORLD_CONFIG.width);
  const nearRidge = new Int16Array(WORLD_CONFIG.width);
  for (let x = 0; x < WORLD_CONFIG.width; x++) {
    // Doi Luang / Doi Nok broad twin massif silhouette across Phayao horizon
    const p1 = Math.exp(-Math.pow((x - 210) / 95, 2)) * 24;
    const p2 = Math.exp(-Math.pow((x - 320) / 72, 2)) * 20;
    const p3 = Math.exp(-Math.pow((x - 495) / 115, 2)) * 14;
    const p4 = Math.exp(-Math.pow((x - 715) / 88, 2)) * 25;
    const p5 = Math.exp(-Math.pow((x - 840) / 78, 2)) * 18;
    const crags = Math.sin(x * 0.055) * 2.1 + Math.cos(x * 0.14) * 1.1;
    farRidge[x] = Math.max(5, Math.round(6 + p1 + p2 + p3 + p4 + p5 + crags));

    const n1 = Math.exp(-Math.pow((x - 120) / 95, 2)) * 11;
    const n2 = Math.exp(-Math.pow((x - 420) / 140, 2)) * 9;
    const n3 = Math.exp(-Math.pow((x - 760) / 110, 2)) * 12;
    const hillNoise = Math.sin(x * 0.09 + 1.4) * 1.6 + Math.cos(x * 0.19) * 0.8;
    nearRidge[x] = Math.max(3, Math.round(4 + n1 + n2 + n3 + hillNoise));
  }

  const betweenFireflies = [];
  for (let i = 0; i < 8; i++) {
    betweenFireflies.push({
      u: 0.14 + (i / 7) * 0.72,
      arc: (i % 2 === 0 ? 1 : -1) * (4 + (i % 3) * 2),
      speed: 1.4 + rng() * 1.1,
      phase: rng() * Math.PI * 2,
    });
  }

  return {
    stars,
    ambientLanterns,
    lakeGlints,
    fireflies,
    betweenFireflies,
    farRidge,
    nearRidge,
  };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function inRect(x, y, r, padX = 0, padY = 0) {
  return (
    x >= r.x - padX &&
    x <= r.x + r.w + padX &&
    y >= r.y - padY &&
    y <= r.y + r.h + padY
  );
}

function inEllipse(x, y, zone) {
  const dx = (x - zone.x) / zone.rx;
  const dy = (y - zone.y) / zone.ry;
  return dx * dx + dy * dy <= 1;
}

function isWalkableSurface(x, y) {
  const wb = WORLD_CONFIG.walkBounds;
  const onPromenade =
    x >= wb.minX && x <= wb.maxX && y >= wb.minY && y <= wb.maxY;
  const onPier = inRect(x, y, WORLD_CONFIG.pierWalkRect);
  return onPromenade || onPier;
}

function hitsAnyCollider(x, y) {
  if (inRect(x, y, WORLD_CONFIG.nagaCollider, 4, 2)) return true;
  if (inRect(x, y, WORLD_CONFIG.benchCollider, 4, 2)) return true;
  if (inRect(x, y, WORLD_CONFIG.pavilionCollider, 4, 2)) return true;
  if (inRect(x, y, WORLD_CONFIG.musicBoxCollider, 3, 2)) return true;

  for (const post of WORLD_CONFIG.lanternPosts) {
    const baseRect = { x: post.x - 4, y: post.y - 3, w: 8, h: 6 };
    if (inRect(x, y, baseRect, 3, 2)) return true;
  }
  return false;
}

function canStandAt(x, y) {
  return isWalkableSurface(x, y) && !hitsAnyCollider(x, y);
}

function moveWithCollision(x, y, dx, dy) {
  let nextX = x;
  let nextY = y;
  if (dx !== 0 && canStandAt(nextX + dx, nextY)) {
    nextX += dx;
  }
  if (dy !== 0 && canStandAt(nextX, nextY + dy)) {
    nextY += dy;
  }
  return { x: nextX, y: nextY };
}

function findActiveZone(x, y) {
  if (inEllipse(x, y, WORLD_CONFIG.zones.pierLantern)) {
    return { type: 'pierLantern', zone: WORLD_CONFIG.zones.pierLantern };
  }
  for (const spot of WORLD_CONFIG.zones.krathongSpots) {
    if (inEllipse(x, y, spot)) {
      return { type: 'krathong', zone: spot };
    }
  }
  if (inEllipse(x, y, WORLD_CONFIG.zones.bench)) {
    return { type: 'bench', zone: WORLD_CONFIG.zones.bench };
  }
  if (inEllipse(x, y, WORLD_CONFIG.zones.pavilion)) {
    return { type: 'pavilion', zone: WORLD_CONFIG.zones.pavilion };
  }
  if (WORLD_CONFIG.zones.musicBox && inEllipse(x, y, WORLD_CONFIG.zones.musicBox)) {
    return { type: 'musicBox', zone: WORLD_CONFIG.zones.musicBox };
  }
  if (WORLD_CONFIG.zones.nagaPhoto && inEllipse(x, y, WORLD_CONFIG.zones.nagaPhoto)) {
    return { type: 'nagaPhoto', zone: WORLD_CONFIG.zones.nagaPhoto };
  }
  return null;
}

function computeViewportLayout(cssW, cssH) {
  const safeW = Math.max(1, cssW || 800);
  const safeH = Math.max(1, cssH || 600);

  let scale = Math.max(2, Math.floor(Math.min(safeW / 185, safeH / 235)));
  // Keep logical view width within world width
  while (Math.round(safeW / scale) > WORLD_CONFIG.width) {
    scale += 1;
  }

  const viewW = clamp(Math.round(safeW / scale), 120, WORLD_CONFIG.width);
  const viewH = Math.max(120, Math.round(safeH / scale));
  return { scale, viewW, viewH };
}

function storageSafeGet(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSafeSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors
  }
}

function storageSafeRemove(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

function setVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle('hidden', !visible);
}

function parseHashRoomId() {
  if (typeof location === 'undefined' || !location.hash) return null;
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  const id = params.get('id');
  return id && id.trim() ? id.trim() : null;
}

async function copyTextSafe(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function initGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Entry overlay DOM
  const entryOverlay = document.getElementById('entry-overlay');
  const modeBadge = document.getElementById('connection-mode-badge');
  const passcodeInput = document.getElementById('passcode-input');
  const passcodeLinkedNote = document.getElementById('passcode-linked-note');
  const changeRoomBtn = document.getElementById('change-room-btn');
  const rememberCheckbox = document.getElementById('remember-room-checkbox');
  const selectHimBtn = document.getElementById('select-him');
  const selectHerBtn = document.getElementById('select-her');
  const previewHimCanvas = document.getElementById('preview-him');
  const previewHerCanvas = document.getElementById('preview-her');
  const statusHimEl = document.getElementById('status-him');
  const statusHerEl = document.getElementById('status-her');
  const entryErrorEl = document.getElementById('entry-error');
  const enterBtn = document.getElementById('enter-btn');

  // HUD & controls DOM
  const hudEl = document.getElementById('hud');
  const hudRoomStatus = document.getElementById('hud-room-status');
  const hudKrathongBadge = document.getElementById('hud-krathong-badge');
  const btnInvite = document.getElementById('btn-invite');
  const btnAudio = document.getElementById('btn-audio');
  const btnHelp = document.getElementById('btn-help');
  const btnSwitchMobile = document.getElementById('btn-switch-mobile');
  const btnSwitchDesktop = document.getElementById('btn-switch-desktop');
  const entrySwitchUi = document.getElementById('entry-switch-ui');
  const btnNagaPhoto = document.getElementById('btn-naga-photo');
  const interactPrompt = document.getElementById('interact-prompt');
  const emoteBar = document.getElementById('emote-bar');
  const emoteButtons = Array.from(document.querySelectorAll('#emote-bar button[data-emote]'));
  const touchControls = document.getElementById('touch-controls');
  const dpadContainer = touchControls ? touchControls.querySelector('.dpad') : null;
  const dpadButtons = {
    up: document.getElementById('dpad-up'),
    down: document.getElementById('dpad-down'),
    left: document.getElementById('dpad-left'),
    right: document.getElementById('dpad-right'),
  };
  const touchInteractBtn = document.getElementById('touch-interact');
  const touchLanternBtn = document.getElementById('touch-lantern');
  const btnEmoteToggle = document.getElementById('btn-emote-toggle');

  // Shop modal, wish modal & help DOM
  const shopModal = document.getElementById('shop-modal');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const shopStyleGroup = document.getElementById('shop-style-group');
  const shopStyleButtons = Array.from(
    shopStyleGroup ? shopStyleGroup.querySelectorAll('button[data-shop-style]') : []
  );
  const shopBuyBtn = document.getElementById('shop-buy-btn');
  const wishModal = document.getElementById('wish-modal');
  const wishCloseBtn = document.getElementById('wish-close-btn');
  const krathongStyleGroup = document.getElementById('krathong-style-group');
  const styleButtons = Array.from(
    krathongStyleGroup ? krathongStyleGroup.querySelectorAll('button[data-style]') : []
  );
  const wishInput = document.getElementById('wish-input');
  const wishSubmitBtn = document.getElementById('wish-submit-btn');
  const photoModal = document.getElementById('photo-modal');
  const photoCloseBtn = document.getElementById('photo-close-btn');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const photoDownloadBtn = document.getElementById('photo-download-btn');
  const toastEl = document.getElementById('toast');
  const helpPopover = document.getElementById('help-popover');
  const helpCloseBtn = document.getElementById('help-close-btn');

  // Core subsystems
  const sprites = createSprites();
  const audio = createAudioEngine();
  const scene = buildSceneParticles();

  drawCharacterPreview(previewHimCanvas, 'him', sprites);
  drawCharacterPreview(previewHerCanvas, 'her', sprites);

  // State
  let viewport = computeViewportLayout(window.innerWidth, window.innerHeight);
  canvas.width = viewport.viewW;
  canvas.height = viewport.viewH;
  ctx.imageSmoothingEnabled = false;

  const cam = {
    x: clamp(480 - viewport.viewW / 2, 0, Math.max(0, WORLD_CONFIG.width - viewport.viewW)),
    y: viewport.viewH <= WORLD_CONFIG.height
      ? clamp(160 - viewport.viewH * 0.68, 0, WORLD_CONFIG.height - viewport.viewH)
      : -Math.floor((viewport.viewH - WORLD_CONFIG.height) * 0.4),
  };

  let linkedRoomId = null;
  let selectedChar = null;
  let selectedStyle = 'marigold';
  let shopSelectedStyle = 'marigold';
  let hasJoined = false;
  let localChar = null;
  let roomClient = null;
  let previewClient = null;
  let previewUnsub = null;
  let previewRequestSeq = 0;
  let previewDebounceTimer = null;
  let latestEntryPresence = {};

  let unsubPresence = null;
  let unsubKrathongs = null;
  let unsubLanterns = null;

  let syncedKrathongs = [];
  let syncedLanterns = [];
  let seenPartnerKrathongIds = new Set();
  let krathongsPrimed = false;
  const seenLanternIds = new Set();
  let lanternsPrimed = false;
  const burstParticles = [];
  let togetherWarmth = 0;
  let photoFlashAlpha = 0;
  let latestPhotoDataUrl = '';

  const characters = {
    him: {
      x: WORLD_CONFIG.defaultIdleSpots.him.x,
      y: WORLD_CONFIG.defaultIdleSpots.him.y,
      targetX: WORLD_CONFIG.defaultIdleSpots.him.x,
      targetY: WORLD_CONFIG.defaultIdleSpots.him.y,
      vx: 0,
      vy: 0,
      lastTargetAt: 0,
      dir: WORLD_CONFIG.defaultIdleSpots.him.dir,
      isSitting: false,
      online: false,
      emote: null,
      emoteAt: 0,
      krathongStyle: 'marigold',
      hasKrathong: false,
      lanternReady: false,
      lanternReadyAt: 0,
      walkAnim: 0,
      moving: false,
    },
    her: {
      x: WORLD_CONFIG.defaultIdleSpots.her.x,
      y: WORLD_CONFIG.defaultIdleSpots.her.y,
      targetX: WORLD_CONFIG.defaultIdleSpots.her.x,
      targetY: WORLD_CONFIG.defaultIdleSpots.her.y,
      vx: 0,
      vy: 0,
      lastTargetAt: 0,
      dir: WORLD_CONFIG.defaultIdleSpots.her.dir,
      isSitting: false,
      online: false,
      emote: null,
      emoteAt: 0,
      krathongStyle: 'marigold',
      hasKrathong: false,
      lanternReady: false,
      lanternReadyAt: 0,
      walkAnim: 0,
      moving: false,
    },
  };

  const keysHeld = new Set();
  const dpadState = { up: false, down: false, left: false, right: false };
  const activeDpadPointers = new Map();

  let activeZone = null;
  let activeKrathongSpawnX = 380;
  let toastTimer = null;
  let lastSyncAt = 0;
  let lastSyncedState = {
    x: null,
    y: null,
    dir: null,
    isSitting: null,
    hasKrathong: null,
    lanternReady: null,
  };
  let wasMoving = false;
  let lastLanternAt = 0;
  let lastPointerInteractAt = 0;
  let lastPointerLanternAt = 0;
  let lastPointerEmoteToggleAt = 0;
  let lastModalOpenedAt = 0;
  let lastFrameTime = performance.now();

  // Unlock Web Audio silently on first touch/pointer gesture (mobile Safari/Chrome)
  if (typeof window !== 'undefined') {
    const unlockOnce = () => {
      audio.unlock?.();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
    window.addEventListener('touchstart', unlockOnce, { once: true, passive: true });
  }

  // -------------------------------------------------------------------------
  // UI Helpers
  // -------------------------------------------------------------------------
  function updateConnectionBadge(modeOverride = null) {
    if (!modeBadge) return;
    const isLive = modeOverride ? modeOverride === 'firebase' : isFirebaseConfigured();
    if (isLive) {
      modeBadge.textContent = 'Firebase Live Sync · ซิงค์ออนไลน์';
      modeBadge.classList.add('live', 'firebase');
    } else {
      modeBadge.textContent = 'Local Demo Mode · โหมดทดลองในเครื่อง';
      modeBadge.classList.remove('live', 'firebase');
    }
  }

  function showToast(message, durationMs = 3400) {
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    setVisible(toastEl, true);
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      setVisible(toastEl, false);
      toastTimer = null;
    }, durationMs);
  }

  function setEntryError(msg) {
    if (!entryErrorEl) return;
    entryErrorEl.textContent = msg || '';
  }

  function updateAudioButton() {
    if (!btnAudio) return;
    const unmuted = !audio.isMuted();
    btnAudio.setAttribute('aria-pressed', String(unmuted));
    if (btnAudio.dataset.compact === 'true') {
      btnAudio.textContent = unmuted ? '🔊' : '🔇';
      btnAudio.setAttribute('aria-label', unmuted ? 'ปิดเสียง · Sound On' : 'เปิดเสียง · Mute');
    } else {
      btnAudio.textContent = unmuted ? 'เสียง · Sound On' : 'เสียง · Mute';
    }
  }

  function setKrathongStyle(style) {
    if (!KRATHONG_STYLES.includes(style)) return;
    selectedStyle = style;
    for (const btn of styleButtons) {
      const isMatch = btn.dataset.style === style;
      btn.classList.toggle('active', isMatch);
      btn.classList.toggle('selected', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    }
    if (hasJoined && localChar) {
      characters[localChar].krathongStyle = style;
      roomClient?.updatePlayer(localChar, { krathongStyle: style }).catch(() => {});
      updateKrathongBadge();
    }
  }

  function setShopSelectedStyle(style) {
    if (!KRATHONG_STYLES.includes(style)) return;
    shopSelectedStyle = style;
    for (const btn of shopStyleButtons) {
      const isMatch = btn.dataset.shopStyle === style;
      btn.classList.toggle('active', isMatch);
      btn.classList.toggle('selected', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    }
  }

  function updateKrathongBadge() {
    if (!hudKrathongBadge) return;
    const local = hasJoined && localChar ? characters[localChar] : null;
    if (!local || !local.hasKrathong) {
      hudKrathongBadge.textContent = 'ยังไม่มีกระทง · No Krathong';
      hudKrathongBadge.classList.remove('has-krathong');
      return;
    }
    const style = KRATHONG_STYLES.includes(local.krathongStyle)
      ? local.krathongStyle
      : selectedStyle;
    hudKrathongBadge.textContent =
      KRATHONG_BADGE_LABELS[style] || KRATHONG_BADGE_LABELS.marigold;
    hudKrathongBadge.classList.add('has-krathong');
  }

  function isModalOpen() {
    return (
      (wishModal && !wishModal.hidden) ||
      (shopModal && !shopModal.hidden) ||
      (photoModal && !photoModal.hidden) ||
      (helpPopover && !helpPopover.hidden)
    );
  }

  function clearMovementInputs() {
    keysHeld.clear();
    activeDpadPointers.clear();
    dpadState.up = false;
    dpadState.down = false;
    dpadState.left = false;
    dpadState.right = false;
    syncDpadClasses();
  }

  function setEmoteTrayOpen(open) {
    if (!emoteBar || emoteBar.dataset.collapsible !== 'true') return;
    const isOpen = Boolean(open);
    emoteBar.classList.toggle('emote-tray-closed', !isOpen);
    btnEmoteToggle?.setAttribute('aria-expanded', String(isOpen));
  }

  function openShopModal() {
    setEmoteTrayOpen(false);
    cancelLocalLanternReady(true);
    clearMovementInputs();
    lastModalOpenedAt = performance.now();
    setShopSelectedStyle(selectedStyle);
    setVisible(shopModal, true);
    if (shopBuyBtn) {
      setTimeout(() => {
        try {
          shopBuyBtn.focus({ preventScroll: true });
        } catch {
          shopBuyBtn.focus();
        }
      }, 20);
    }
  }

  function closeShopModal() {
    setVisible(shopModal, false);
  }

  function openPhotoModal() {
    setEmoteTrayOpen(false);
    cancelLocalLanternReady(true);
    clearMovementInputs();
    lastModalOpenedAt = performance.now();
    setVisible(photoModal, true);
    if (photoDownloadBtn) {
      setTimeout(() => {
        try {
          photoDownloadBtn.focus({ preventScroll: true });
        } catch {
          photoDownloadBtn.focus();
        }
      }, 20);
    }
  }

  function closePhotoModal() {
    setVisible(photoModal, false);
  }

  function openWishModal(spawnX) {
    setEmoteTrayOpen(false);
    cancelLocalLanternReady(true);
    activeKrathongSpawnX = spawnX;
    clearMovementInputs();
    lastModalOpenedAt = performance.now();
    setKrathongStyle(selectedStyle);
    setVisible(wishModal, true);
    if (wishInput) {
      setTimeout(() => {
        try {
          wishInput.focus({ preventScroll: true });
        } catch {
          wishInput.focus();
        }
      }, 20);
    }
  }

  function closeWishModal() {
    setVisible(wishModal, false);
    if (wishInput) {
      wishInput.blur();
    }
  }

  function openHelpPopover() {
    setEmoteTrayOpen(false);
    cancelLocalLanternReady(true);
    clearMovementInputs();
    lastModalOpenedAt = performance.now();
    setVisible(helpPopover, true);
  }

  function closeHelpPopover() {
    setVisible(helpPopover, false);
  }

  function updateCharacterSelectionUI() {
    const cards = [
      { id: 'him', btn: selectHimBtn, statusEl: statusHimEl },
      { id: 'her', btn: selectHerBtn, statusEl: statusHerEl },
    ];
    for (const { id, btn, statusEl } of cards) {
      if (!btn) continue;
      const taken = Boolean(latestEntryPresence[id]?.online);
      if (taken && selectedChar === id) {
        selectedChar = null;
      }
      const isSelected = selectedChar === id && !taken;
      btn.disabled = taken;
      btn.classList.toggle('taken', taken);
      btn.classList.toggle('selected', isSelected);
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
      if (taken) {
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.removeAttribute('aria-disabled');
      }
      if (statusEl) {
        statusEl.textContent = taken ? 'ออนไลน์ · Online' : 'ว่าง · Ready';
      }
    }
  }

  function applyEntryPresence(presence) {
    latestEntryPresence = presence || {};
    updateCharacterSelectionUI();
  }

  function updateHudRoomStatus() {
    if (!hudRoomStatus || !hasJoined || !localChar) return;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const partnerOnline = Boolean(characters[otherChar].online);
    const localName = CHAR_NAMES[localChar];
    const partnerName = CHAR_NAMES[otherChar];
    const modeTag = roomClient?.mode === 'firebase' ? 'Live' : 'Demo';
    hudRoomStatus.textContent = partnerOnline
      ? `${localName.th} · อยู่กับ${partnerName.th} · Both Online (${modeTag})`
      : `${localName.th} · รอ${partnerName.th} · Waiting (${modeTag})`;
  }

  // -------------------------------------------------------------------------
  // Entry Preview & Room Client Connection
  // -------------------------------------------------------------------------
  async function teardownPreviewClient() {
    if (previewUnsub) {
      previewUnsub();
      previewUnsub = null;
    }
    if (previewClient) {
      const old = previewClient;
      previewClient = null;
      await old.destroy().catch(() => {});
    }
  }

  async function connectPreviewForRoom(roomId) {
    const seq = ++previewRequestSeq;
    if (!roomId) {
      await teardownPreviewClient();
      applyEntryPresence({});
      return;
    }
    if (previewClient && previewClient.roomId === roomId) {
      return;
    }

    await teardownPreviewClient();
    if (seq !== previewRequestSeq || hasJoined) return;

    const client = await createRoomClient(roomId);
    if (seq !== previewRequestSeq || hasJoined) {
      await client.destroy().catch(() => {});
      return;
    }

    previewClient = client;
    updateConnectionBadge(client.mode);
    previewUnsub = client.watchRoomPresence(applyEntryPresence);
  }

  function applyLinkedRoomUI(roomId) {
    linkedRoomId = roomId;
    if (passcodeInput) {
      passcodeInput.value = '';
      passcodeInput.disabled = true;
      passcodeInput.placeholder = `ห้อง · Room: ${roomId}`;
    }
    setVisible(passcodeLinkedNote, true);
  }

  function clearLinkedRoomUI() {
    linkedRoomId = null;
    if (passcodeInput) {
      passcodeInput.disabled = false;
      passcodeInput.placeholder = 'ตั้งรหัสห้องเดียวกันเพื่อเดินเล่นด้วยกัน...';
    }
    setVisible(passcodeLinkedNote, false);
  }

  async function initEntryState() {
    updateConnectionBadge();
    const hashRoom = parseHashRoomId();
    if (hashRoom) {
      applyLinkedRoomUI(hashRoom);
      await connectPreviewForRoom(hashRoom);
      return;
    }

    const savedPasscode = storageSafeGet(STORAGE_PASSCODE_KEY);
    const savedRoomId = storageSafeGet(STORAGE_ROOM_ID_KEY);
    if (savedPasscode && passcodeInput) {
      passcodeInput.value = savedPasscode;
      const roomId = await hashPasscode(savedPasscode);
      await connectPreviewForRoom(roomId);
    } else if (savedRoomId) {
      applyLinkedRoomUI(savedRoomId);
      await connectPreviewForRoom(savedRoomId);
    }
  }

  // -------------------------------------------------------------------------
  // Room Sync Handlers (In-Game)
  // -------------------------------------------------------------------------
  function handleRoomPresence(presence) {
    if (!hasJoined || !localChar) return;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const partnerName = CHAR_NAMES[otherChar];
    const remote = presence ? presence[otherChar] : null;
    const local = characters[localChar];
    const partner = characters[otherChar];
    const wasOnline = partner.online;

    if (remote && remote.online !== false) {
      const nowPerf = performance.now();
      const nextX = typeof remote.x === 'number' && Number.isFinite(remote.x)
        ? remote.x
        : WORLD_CONFIG.defaultIdleSpots[otherChar].x;
      const nextY = typeof remote.y === 'number' && Number.isFinite(remote.y)
        ? remote.y
        : WORLD_CONFIG.defaultIdleSpots[otherChar].y;

      if (!wasOnline) {
        partner.x = nextX;
        partner.y = nextY;
        partner.vx = 0;
        partner.vy = 0;
        partner.lastTargetAt = nowPerf;
        showToast(`${partnerName.th}เข้ามาเดินเล่นแล้ว! · ${partnerName.en} arrived lakeside!`);
      } else if (nextX !== partner.targetX || nextY !== partner.targetY) {
        const dtRemote = Math.max(0.03, (nowPerf - (partner.lastTargetAt || nowPerf)) / 1000);
        const rawVx = clamp((nextX - partner.targetX) / dtRemote, -120, 120);
        const rawVy = clamp((nextY - partner.targetY) / dtRemote, -120, 120);
        partner.vx = lerp(partner.vx, rawVx, 0.55);
        partner.vy = lerp(partner.vy, rawVy, 0.55);
        partner.lastTargetAt = nowPerf;
      }
      partner.targetX = nextX;
      partner.targetY = nextY;
      partner.dir = remote.dir || 'up';
      partner.isSitting = Boolean(remote.isSitting);
      partner.krathongStyle = KRATHONG_STYLES.includes(remote.krathongStyle)
        ? remote.krathongStyle
        : 'marigold';
      partner.hasKrathong = Boolean(remote.hasKrathong);
      partner.lanternReady = Boolean(remote.lanternReady);
      partner.lanternReadyAt =
        partner.lanternReady &&
        typeof remote.lanternReadyAt === 'number' &&
        Number.isFinite(remote.lanternReadyAt)
          ? remote.lanternReadyAt
          : 0;
      if (remote.emote && remote.emoteAt && remote.emoteAt !== partner.emoteAt) {
        partner.emote = remote.emote;
        partner.emoteAt = remote.emoteAt;
        audio.playEmotePop();
      }
      partner.online = true;

      if (
        local.lanternReady &&
        (partner.isSitting ||
          Math.hypot(local.x - nextX, local.y - nextY) > COOP_LANTERN_CANCEL_RADIUS)
      ) {
        cancelLocalLanternReady(true);
      }
    } else {
      if (wasOnline) {
        showToast(`${partnerName.th}ออกจากริมกว๊านแล้ว · ${partnerName.en} left the lakeside`);
      }
      partner.online = false;
      partner.isSitting = false;
      partner.hasKrathong = false;
      partner.lanternReady = false;
      partner.lanternReadyAt = 0;
      partner.vx = 0;
      partner.vy = 0;
      partner.lastTargetAt = 0;
      partner.dir = WORLD_CONFIG.defaultIdleSpots[otherChar].dir;
      partner.targetX = WORLD_CONFIG.defaultIdleSpots[otherChar].x;
      partner.targetY = WORLD_CONFIG.defaultIdleSpots[otherChar].y;
      if (local.lanternReady) {
        cancelLocalLanternReady(true);
      }
    }
    updateHudRoomStatus();
    if (hasJoined && localChar) {
      updateInteractPrompt(characters[localChar]);
    }
  }

  function spawnCelebrationBurst(cx, cy) {
    const now = performance.now();
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.4;
      const speed = 10 + Math.random() * 24;
      burstParticles.push({
        x: cx + (Math.random() - 0.5) * 14,
        y: cy - 10 + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65 - 12,
        bornAt: now,
        lifeMs: 1800 + Math.random() * 900,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function handleKrathongs(list) {
    syncedKrathongs = Array.isArray(list) ? list : [];
    if (!krathongsPrimed) {
      krathongsPrimed = true;
      for (const item of syncedKrathongs) {
        seenPartnerKrathongIds.add(item.id);
      }
      return;
    }

    if (!hasJoined || !localChar) return;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const local = characters[localChar];
    const partner = characters[otherChar];

    for (const item of syncedKrathongs) {
      if (seenPartnerKrathongIds.has(item.id)) continue;
      seenPartnerKrathongIds.add(item.id);
      if (item.character === otherChar && partner.online) {
        if (Math.hypot(local.x - partner.x, local.y - partner.y) <= CELEBRATION_RADIUS) {
          spawnCelebrationBurst((local.x + partner.x) / 2, (local.y + partner.y) / 2);
        }
      }
    }
  }

  function handleLanterns(list) {
    syncedLanterns = Array.isArray(list) ? list : [];
    if (!lanternsPrimed) {
      lanternsPrimed = true;
      for (const item of syncedLanterns) {
        seenLanternIds.add(item.id);
      }
      return;
    }

    if (!hasJoined || !localChar) return;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const local = characters[localChar];
    const partner = characters[otherChar];

    let launchedNow = false;
    for (const item of syncedLanterns) {
      if (seenLanternIds.has(item.id)) continue;
      seenLanternIds.add(item.id);
      if (local.lanternReady) {
        launchedNow = true;
      }
    }

    if (launchedNow && local.lanternReady) {
      local.lanternReady = false;
      local.lanternReadyAt = 0;
      lastSyncedState.lanternReady = false;
      roomClient
        ?.updatePlayer(localChar, { lanternReady: false, lanternReadyAt: 0 })
        .catch(() => {});
      const burstX = partner.online ? (local.x + partner.x) / 2 : local.x;
      const burstY = partner.online ? (local.y + partner.y) / 2 : local.y;
      audio.playLanternChime();
      spawnCelebrationBurst(burstX, burstY);
      showToast('ปล่อยโคมลอยขึ้นฟ้าด้วยกันแล้ว! · You floated a sky lantern together!');
    }
  }

  async function joinRoom() {
    setEntryError('');
    const passcodeRaw = passcodeInput ? passcodeInput.value.trim() : '';

    if (!linkedRoomId && !passcodeRaw) {
      setEntryError('กรุณาใส่รหัสห้องเดียวกันก่อน · Please enter a shared room passcode');
      passcodeInput?.focus();
      return;
    }
    if (!selectedChar) {
      setEntryError('กรุณาเลือก อะตอม หรือ ฟ้าใส · Please choose Atom or Fahsai');
      return;
    }

    if (enterBtn) enterBtn.disabled = true;

    try {
      const targetRoomId = linkedRoomId || (await hashPasscode(passcodeRaw));

      // Reuse matching preview client cleanly or create a fresh one
      let client = null;
      if (previewClient && previewClient.roomId === targetRoomId) {
        if (previewUnsub) {
          previewUnsub();
          previewUnsub = null;
        }
        client = previewClient;
        previewClient = null;
      } else {
        await teardownPreviewClient();
        client = await createRoomClient(targetRoomId);
      }

      let livePresence = latestEntryPresence;
      if (client.mode === 'local') {
        const stopPeek = client.watchRoomPresence((p) => {
          livePresence = p || {};
        });
        stopPeek();
      }

      if (livePresence[selectedChar]?.online) {
        latestEntryPresence = livePresence;
        setEntryError('ตัวละครนี้มีผู้เล่นออนไลน์อยู่แล้ว · Character is already online');
        previewClient = client;
        previewUnsub = client.watchRoomPresence(applyEntryPresence);
        updateCharacterSelectionUI();
        return;
      }

      // Persist remembered room state if checked
      if (rememberCheckbox?.checked) {
        if (passcodeRaw) {
          storageSafeSet(STORAGE_PASSCODE_KEY, passcodeRaw);
        } else {
          storageSafeRemove(STORAGE_PASSCODE_KEY);
        }
        storageSafeSet(STORAGE_ROOM_ID_KEY, targetRoomId);
      } else {
        storageSafeRemove(STORAGE_PASSCODE_KEY);
        storageSafeRemove(STORAGE_ROOM_ID_KEY);
      }

      roomClient = client;
      localChar = selectedChar;
      const otherChar = localChar === 'him' ? 'her' : 'him';
      const spawn = WORLD_CONFIG.defaultIdleSpots[localChar];
      const otherIdle = WORLD_CONFIG.defaultIdleSpots[otherChar];

      Object.assign(characters[localChar], {
        x: spawn.x,
        y: spawn.y,
        targetX: spawn.x,
        targetY: spawn.y,
        dir: spawn.dir,
        isSitting: false,
        online: true,
        emote: null,
        emoteAt: 0,
        krathongStyle: selectedStyle,
        hasKrathong: false,
        lanternReady: false,
        lanternReadyAt: 0,
      });
      Object.assign(characters[otherChar], {
        x: otherIdle.x,
        y: otherIdle.y,
        targetX: otherIdle.x,
        targetY: otherIdle.y,
        dir: otherIdle.dir,
        isSitting: false,
        online: false,
        emote: null,
        emoteAt: 0,
        hasKrathong: false,
        lanternReady: false,
        lanternReadyAt: 0,
      });

      await roomClient.joinAs(localChar, {
        x: spawn.x,
        y: spawn.y,
        dir: spawn.dir,
        isSitting: false,
        krathongStyle: selectedStyle,
        hasKrathong: false,
        lanternReady: false,
        lanternReadyAt: 0,
      });

      lastSyncedState = {
        x: spawn.x,
        y: spawn.y,
        dir: spawn.dir,
        isSitting: false,
        hasKrathong: false,
        lanternReady: false,
      };
      lastSyncAt = performance.now();

      hasJoined = true;
      unsubPresence = roomClient.watchRoomPresence(handleRoomPresence);
      unsubKrathongs = roomClient.watchKrathongs(handleKrathongs);
      unsubLanterns = roomClient.watchLanterns(handleLanterns);

      // Snap camera immediately onto local player
      cam.x = clamp(spawn.x - viewport.viewW / 2, 0, Math.max(0, WORLD_CONFIG.width - viewport.viewW));
      if (viewport.viewH <= WORLD_CONFIG.height) {
        cam.y = clamp(
          spawn.y - viewport.viewH * 0.7,
          0,
          WORLD_CONFIG.height - viewport.viewH
        );
      } else {
        cam.y = -Math.floor((viewport.viewH - WORLD_CONFIG.height) * 0.4);
      }

      setVisible(entryOverlay, false);
      setVisible(hudEl, true);
      setVisible(emoteBar, true);
      setVisible(touchControls, true);
      updateHudRoomStatus();
      updateKrathongBadge();
      updateAudioButton();
      updateInteractPrompt(characters[localChar]);
    } catch {
      setEntryError('ไม่สามารถเชื่อมต่อห้องได้ กรุณาลองใหม่ · Could not join room');
    } finally {
      if (enterBtn) enterBtn.disabled = false;
    }
  }

  // -------------------------------------------------------------------------
  // Actions: Sync, Emotes, Bench, Co-op Lantern, Krathong Shop & Wish
  // -------------------------------------------------------------------------
  function syncLocalPlayer(force = false) {
    if (!hasJoined || !roomClient || !localChar) return;
    const now = performance.now();
    if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) return;

    const p = characters[localChar];
    const rx = Math.round(p.x * 10) / 10;
    const ry = Math.round(p.y * 10) / 10;
    const hasKrathong = Boolean(p.hasKrathong);
    const lanternReady = Boolean(p.lanternReady);
    const changed =
      rx !== lastSyncedState.x ||
      ry !== lastSyncedState.y ||
      p.dir !== lastSyncedState.dir ||
      p.isSitting !== lastSyncedState.isSitting ||
      hasKrathong !== lastSyncedState.hasKrathong ||
      lanternReady !== lastSyncedState.lanternReady;

    if (!force && !changed) return;

    lastSyncAt = now;
    lastSyncedState = {
      x: rx,
      y: ry,
      dir: p.dir,
      isSitting: p.isSitting,
      hasKrathong,
      lanternReady,
    };
    roomClient
      .updatePlayer(localChar, {
        x: rx,
        y: ry,
        dir: p.dir,
        isSitting: p.isSitting,
        krathongStyle: selectedStyle,
        hasKrathong,
        lanternReady,
        lanternReadyAt: lanternReady ? p.lanternReadyAt : 0,
      })
      .catch(() => {});
  }

  function triggerEmote(emoteName) {
    if (!hasJoined || !localChar || !EMOTES.includes(emoteName)) return;
    setEmoteTrayOpen(false);
    const nowMs = Date.now();
    const p = characters[localChar];
    p.emote = emoteName;
    p.emoteAt = nowMs;
    audio.playEmotePop();
    roomClient?.updatePlayer(localChar, { emote: emoteName, emoteAt: nowMs }).catch(() => {});
  }

  function standUpFromBench(syncNow = true) {
    if (!localChar) return;
    const p = characters[localChar];
    if (!p.isSitting) return;
    p.isSitting = false;
    p.y = 190;
    p.dir = 'down';
    if (syncNow) {
      syncLocalPlayer(true);
    }
  }

  function isPartnerNearForLantern() {
    if (!hasJoined || !localChar) return false;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const local = characters[localChar];
    const partner = characters[otherChar];
    return Boolean(
      partner.online &&
        !local.isSitting &&
        !partner.isSitting &&
        Math.hypot(local.x - partner.x, local.y - partner.y) <= COOP_LANTERN_RADIUS
    );
  }

  function cancelLocalLanternReady(syncNow = true) {
    if (!hasJoined || !localChar) return;
    const local = characters[localChar];
    if (!local.lanternReady) return;
    local.lanternReady = false;
    local.lanternReadyAt = 0;
    lastSyncedState.lanternReady = false;
    if (syncNow) {
      roomClient?.updatePlayer(localChar, { lanternReady: false, lanternReadyAt: 0 }).catch(() => {});
    }
  }

  function handleBuyKrathong() {
    if (!hasJoined || !localChar) return;
    selectedStyle = shopSelectedStyle;
    const local = characters[localChar];
    local.hasKrathong = true;
    local.krathongStyle = selectedStyle;
    lastSyncedState.hasKrathong = true;
    roomClient
      ?.updatePlayer(localChar, { hasKrathong: true, krathongStyle: selectedStyle })
      .catch(() => {});
    closeShopModal();
    updateKrathongBadge();
    audio.playEmotePop();
    showToast(
      'ซื้อกระทงแล้ว! เดินไปริมน้ำใกล้พญานาคเพื่อลอยกระทง · Bought a krathong! Head to the shoreline to float it.'
    );
  }

  async function handleCoopLantern() {
    if (!hasJoined || !roomClient || !localChar || isModalOpen()) return;
    const otherChar = localChar === 'him' ? 'her' : 'him';
    const local = characters[localChar];
    const partner = characters[otherChar];
    const partnerName = CHAR_NAMES[otherChar];

    if (local.isSitting) {
      standUpFromBench(true);
      return;
    }

    if (!isPartnerNearForLantern()) {
      if (local.lanternReady) {
        cancelLocalLanternReady(true);
      }
      showToast(
        'ต้องยืนใกล้กันทั้งอะตอมและฟ้าใสเพื่อปล่อยโคมลอยด้วยกัน · Stand close together to float a sky lantern!'
      );
      return;
    }

    if (partner.lanternReady) {
      const now = performance.now();
      if (now - lastLanternAt < LANTERN_COOLDOWN_MS) return;
      lastLanternAt = now;

      const midX = Math.round((local.x + partner.x) / 2);
      const midY = (local.y + partner.y) / 2;
      await roomClient.releaseSkyLantern({ character: localChar, spawnX: midX });
      local.lanternReady = false;
      local.lanternReadyAt = 0;
      lastSyncedState.lanternReady = false;
      roomClient
        .updatePlayer(localChar, { lanternReady: false, lanternReadyAt: 0 })
        .catch(() => {});
      audio.playLanternChime();
      spawnCelebrationBurst(midX, midY);
      showToast('ปล่อยโคมลอยขึ้นฟ้าด้วยกันแล้ว! · You floated a sky lantern together!');
      return;
    }

    if (!local.lanternReady) {
      local.lanternReady = true;
      local.lanternReadyAt = Date.now();
      local.dir = 'up';
      lastSyncedState.dir = 'up';
      lastSyncedState.lanternReady = true;
      roomClient
        .updatePlayer(localChar, {
          dir: 'up',
          lanternReady: true,
          lanternReadyAt: local.lanternReadyAt,
        })
        .catch(() => {});
      audio.playEmotePop();
      showToast(
        `กำลังถือโคมลอยรอ${partnerName.th}... · Holding sky lantern — waiting for ${partnerName.en} to lift together!`
      );
      return;
    }

    cancelLocalLanternReady(true);
    showToast('วางโคมลอยลงแล้ว · Lowered sky lantern');
  }

  function isTogetherAtNaga() {
    if (!hasJoined || !localChar) return false;
    const him = characters.him;
    const her = characters.her;
    const nagaZone = WORLD_CONFIG.zones.nagaPhoto;
    if (!nagaZone) return false;
    return Boolean(
      him.online &&
        her.online &&
        !him.isSitting &&
        !her.isSitting &&
        inEllipse(him.x, him.y, nagaZone) &&
        inEllipse(her.x, her.y, nagaZone)
    );
  }

  function captureNagaScreenshot() {
    if (!isTogetherAtNaga() || isModalOpen()) return;
    if (typeof document === 'undefined') return;

    cancelLocalLanternReady(true);
    photoFlashAlpha = 0.85;
    audio.playCameraShutter();
    spawnCelebrationBurst(480, 178);

    const shotW = 320;
    const shotH = 180;
    const shotCanvas = document.createElement('canvas');
    shotCanvas.width = shotW;
    shotCanvas.height = shotH;
    const shotCtx = shotCanvas.getContext('2d');
    if (!shotCtx) return;
    shotCtx.imageSmoothingEnabled = false;

    const nowMs = performance.now();
    renderWorld(shotCtx, shotW, shotH, 320, 42, nowMs, nowMs / 1000);

    const frameW = 1280;
    const frameH = 772;
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frameW;
    frameCanvas.height = frameH;
    const frameCtx = frameCanvas.getContext('2d');
    if (!frameCtx) return;

    frameCtx.fillStyle = PALETTE.skyTop;
    frameCtx.fillRect(0, 0, frameW, frameH);
    frameCtx.imageSmoothingEnabled = false;
    frameCtx.drawImage(shotCanvas, 0, 0, 1280, 720);

    frameCtx.fillStyle = PALETTE.gold;
    frameCtx.fillRect(0, 720, frameW, 4);

    const dateLabel = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    frameCtx.fillStyle = PALETTE.goldBright;
    frameCtx.font = 'bold 20px "Pixelify Sans", "Noto Sans Thai", sans-serif';
    frameCtx.textBaseline = 'middle';
    frameCtx.textAlign = 'left';
    frameCtx.fillText(
      'คืนเดือนเพ็ญ ณ กว๊านพะเยา · Atom & Fahsai · Kwan Phayao',
      24,
      748
    );

    frameCtx.fillStyle = PALETTE.nagaPearl;
    frameCtx.font = '16px "Pixelify Sans", "Noto Sans Thai", sans-serif';
    frameCtx.textAlign = 'right';
    frameCtx.fillText(dateLabel, frameW - 24, 748);

    latestPhotoDataUrl = frameCanvas.toDataURL('image/png');
    if (photoPreviewImg) {
      photoPreviewImg.src = latestPhotoDataUrl;
    }
    openPhotoModal();
    showToast('ถ่ายภาพคู่หน้าพญานาคแล้ว! · Captured your Kwan Phayao keepsake!');
  }

  async function handleInteract() {
    if (!hasJoined || !localChar || isModalOpen()) return;

    const p = characters[localChar];
    if (p.isSitting) {
      standUpFromBench(true);
      return;
    }

    const otherChar = localChar === 'him' ? 'her' : 'him';
    const partner = characters[otherChar];
    const nearPartner = isPartnerNearForLantern();

    if (nearPartner && partner.lanternReady) {
      await handleCoopLantern();
      return;
    }

    if (p.lanternReady) {
      await handleCoopLantern();
      return;
    }

    const found = findActiveZone(p.x, p.y);
    if (found?.type === 'pierLantern') {
      await handleCoopLantern();
      return;
    }

    if (found) {
      if (found.type === 'bench') {
        const seats = WORLD_CONFIG.benchSeats
          .map((seat) => ({
            seat,
            dist: Math.hypot(p.x - seat.x, p.y - seat.y),
            occupied:
              partner.online &&
              partner.isSitting &&
              Math.hypot(partner.x - seat.x, partner.y - seat.y) < 10,
          }))
          .sort((a, b) => a.dist - b.dist);

        const free = seats.find((s) => !s.occupied);
        if (!free) {
          showToast('ที่นั่งเต็มแล้ว · Bench seats are occupied');
          return;
        }
        cancelLocalLanternReady(false);
        p.x = free.seat.x;
        p.y = free.seat.y;
        p.dir = 'up';
        p.isSitting = true;
        p.moving = false;
        syncLocalPlayer(true);
        return;
      }

      if (found.type === 'krathong') {
        if (!p.hasKrathong) {
          showToast(
            'ยังไม่มีกระทง · แวะซื้อกระทงที่ร้านฝั่งขวาก่อนนะ! (Buy a krathong at the right-side shop first)'
          );
          return;
        }
        const spot = found.zone;
        const spawnX = Math.round(clamp(p.x, spot.x - 16, spot.x + 16));
        openWishModal(spawnX);
        return;
      }

      if (found.type === 'pavilion') {
        openShopModal();
        return;
      }

      if (found.type === 'musicBox') {
        if (audio.isMusicBoxPlaying()) {
          audio.stopMusicBox();
          showToast('ปิดกล่องดนตรีแล้ว · Music Box paused');
        } else {
          audio.startMusicBox();
          updateAudioButton();
          showToast('♪ กล่องดนตรีกำลังบรรเลง Canon in D... · Music Box playing Canon in D');
        }
        return;
      }

      if (found.type === 'nagaPhoto') {
        if (isTogetherAtNaga()) {
          captureNagaScreenshot();
          return;
        }
        if (nearPartner) {
          await handleCoopLantern();
          return;
        }
        showToast(
          'เดินมาหน้าพญานาคด้วยกันเพื่อถ่ายรูปคู่ · Stand by Phaya Naga together for a photo'
        );
        return;
      }
    }

    if (nearPartner) {
      await handleCoopLantern();
      return;
    }

    showToast(
      'เดินไปร้านกระทง ริมน้ำ เก้าอี้ กล่องดนตรี หรือยืนใกล้กันกด L · Visit shop, shore, bench, music box, or press L together',
      2600
    );
  }

  async function handleSubmitWish() {
    if (!hasJoined || !roomClient || !localChar || !characters[localChar].hasKrathong) return;
    if (wishSubmitBtn) wishSubmitBtn.disabled = true;
    try {
      await roomClient.submitWishAndKrathong({
        character: localChar,
        wishText: wishInput ? wishInput.value : '',
        krathongStyle: selectedStyle,
        spawnX: activeKrathongSpawnX,
      });
      if (wishInput) wishInput.value = '';
      const local = characters[localChar];
      local.hasKrathong = false;
      lastSyncedState.hasKrathong = false;
      roomClient.updatePlayer(localChar, { hasKrathong: false }).catch(() => {});
      updateKrathongBadge();
      closeWishModal();
      audio.playKrathongChime();
      showToast('คำอธิษฐานลอยไปกับสายน้ำแล้ว · Your wish has drifted into the night...', 4000);

      const otherChar = localChar === 'him' ? 'her' : 'him';
      const partner = characters[otherChar];
      if (partner.online && Math.hypot(local.x - partner.x, local.y - partner.y) <= CELEBRATION_RADIUS) {
        spawnCelebrationBurst((local.x + partner.x) / 2, (local.y + partner.y) / 2);
      }
    } finally {
      if (wishSubmitBtn) wishSubmitBtn.disabled = false;
    }
  }

  // -------------------------------------------------------------------------
  // Input Wiring
  // -------------------------------------------------------------------------
  function syncDpadClasses() {
    for (const dir of ['up', 'down', 'left', 'right']) {
      const btn = dpadButtons[dir];
      if (btn) {
        btn.classList.toggle('pressed', Boolean(dpadState[dir]));
      }
    }
  }

  function recomputeDpadFromPointers() {
    dpadState.up = false;
    dpadState.down = false;
    dpadState.left = false;
    dpadState.right = false;
    for (const dirs of activeDpadPointers.values()) {
      for (const d of dirs) {
        dpadState[d] = true;
      }
    }
    syncDpadClasses();
  }

  function resolveDpadDirs(e) {
    if (!dpadContainer) return [];
    const rect = dpadContainer.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      const targetBtn = e.target?.closest?.('[data-dir]');
      return targetBtn?.dataset.dir ? [targetBtn.dataset.dir] : [];
    }
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    if (rx < -0.45 || rx > 1.45 || ry < -0.45 || ry > 1.45) return [];

    const dx = rx - 0.5;
    const dy = ry - 0.5;
    if (Math.hypot(dx, dy) < 0.1) return [];

    const dirs = [];
    if (dy < -0.14) dirs.push('up');
    else if (dy > 0.14) dirs.push('down');
    if (dx < -0.14) dirs.push('left');
    else if (dx > 0.14) dirs.push('right');
    return dirs;
  }

  if (dpadContainer) {
    dpadContainer.addEventListener('pointerdown', (e) => {
      if (!hasJoined || isModalOpen()) return;
      e.preventDefault();
      if (typeof dpadContainer.setPointerCapture === 'function') {
        try {
          dpadContainer.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors on synthetic events
        }
      }
      activeDpadPointers.set(e.pointerId, resolveDpadDirs(e));
      recomputeDpadFromPointers();
    });

    dpadContainer.addEventListener('pointermove', (e) => {
      if (!activeDpadPointers.has(e.pointerId)) return;
      e.preventDefault();
      activeDpadPointers.set(e.pointerId, resolveDpadDirs(e));
      recomputeDpadFromPointers();
    });

    const endDpadPointer = (e) => {
      if (!activeDpadPointers.has(e.pointerId)) return;
      activeDpadPointers.delete(e.pointerId);
      recomputeDpadFromPointers();
    };
    dpadContainer.addEventListener('pointerup', endDpadPointer);
    dpadContainer.addEventListener('pointercancel', endDpadPointer);
    dpadContainer.addEventListener('lostpointercapture', endDpadPointer);
  }

  if (touchInteractBtn) {
    touchInteractBtn.addEventListener('pointerdown', (e) => {
      if (!hasJoined || isModalOpen()) return;
      e.preventDefault();
      lastPointerInteractAt = performance.now();
      touchInteractBtn.classList.add('pressed');
      handleInteract();
    });
    const clearInteractPressed = (e) => {
      if (e.cancelable) e.preventDefault();
      touchInteractBtn.classList.remove('pressed');
    };
    touchInteractBtn.addEventListener('pointerup', clearInteractPressed);
    touchInteractBtn.addEventListener('pointercancel', clearInteractPressed);
    touchInteractBtn.addEventListener('touchend', clearInteractPressed, { passive: false });
    touchInteractBtn.addEventListener('click', () => {
      if (performance.now() - lastPointerInteractAt < 400) return;
      handleInteract();
    });
  }

  if (touchLanternBtn) {
    touchLanternBtn.addEventListener('pointerdown', (e) => {
      if (!hasJoined || isModalOpen()) return;
      e.preventDefault();
      lastPointerLanternAt = performance.now();
      touchLanternBtn.classList.add('pressed');
      handleCoopLantern();
    });
    const clearLanternPressed = (e) => {
      if (e.cancelable) e.preventDefault();
      touchLanternBtn.classList.remove('pressed');
    };
    touchLanternBtn.addEventListener('pointerup', clearLanternPressed);
    touchLanternBtn.addEventListener('pointercancel', clearLanternPressed);
    touchLanternBtn.addEventListener('touchend', clearLanternPressed, { passive: false });
    touchLanternBtn.addEventListener('click', () => {
      if (performance.now() - lastPointerLanternAt < 400) return;
      handleCoopLantern();
    });
  }

  for (const switchEl of [btnSwitchMobile, btnSwitchDesktop, entrySwitchUi]) {
    switchEl?.addEventListener('click', () => {
      const activeRoomId = roomClient?.roomId || linkedRoomId || previewClient?.roomId;
      if (!activeRoomId) return;
      const baseHref = switchEl.getAttribute('href')?.split('#')[0] || './index.html';
      switchEl.setAttribute('href', `${baseHref}#id=${activeRoomId}`);
    });
  }

  interactPrompt?.addEventListener('click', () => {
    handleInteract();
  });

  btnNagaPhoto?.addEventListener('click', () => {
    captureNagaScreenshot();
  });

  // Entry UI events
  passcodeInput?.addEventListener('input', () => {
    setEntryError('');
    if (previewDebounceTimer !== null) {
      clearTimeout(previewDebounceTimer);
    }
    const val = passcodeInput.value.trim();
    if (!val) {
      previewDebounceTimer = setTimeout(() => {
        connectPreviewForRoom(null);
      }, 150);
      return;
    }
    previewDebounceTimer = setTimeout(async () => {
      const roomId = await hashPasscode(val);
      connectPreviewForRoom(roomId);
    }, 240);
  });

  passcodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinRoom();
    }
  });

  changeRoomBtn?.addEventListener('click', () => {
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
    clearLinkedRoomUI();
    storageSafeRemove(STORAGE_ROOM_ID_KEY);
    storageSafeRemove(STORAGE_PASSCODE_KEY);
    setEntryError('');
    connectPreviewForRoom(null);
    passcodeInput?.focus();
  });

  selectHimBtn?.addEventListener('click', () => {
    if (latestEntryPresence.him?.online) return;
    selectedChar = 'him';
    setEntryError('');
    updateCharacterSelectionUI();
  });

  selectHerBtn?.addEventListener('click', () => {
    if (latestEntryPresence.her?.online) return;
    selectedChar = 'her';
    setEntryError('');
    updateCharacterSelectionUI();
  });

  enterBtn?.addEventListener('click', () => {
    joinRoom();
  });

  // HUD events
  btnInvite?.addEventListener('click', async () => {
    if (!roomClient) return;
    const base =
      typeof location !== 'undefined'
        ? `${location.origin}${location.pathname}`
        : '';
    const inviteUrl = `${base}#id=${roomClient.roomId}`;
    const copied = await copyTextSafe(inviteUrl);
    showToast(
      copied
        ? 'คัดลอกลิงก์ชวนแล้ว · Invite link copied!'
        : `ลิงก์ห้อง · Room link: ${inviteUrl}`
    );
  });

  btnAudio?.addEventListener('click', () => {
    audio.toggleMute();
    updateAudioButton();
    showToast(audio.isMuted() ? 'ปิดเสียงแล้ว · Audio muted' : 'เปิดเสียงบรรยากาศริมกว๊านแล้ว · Lakeside audio on', 2000);
  });

  btnHelp?.addEventListener('click', () => {
    if (helpPopover && !helpPopover.hidden) {
      closeHelpPopover();
    } else {
      openHelpPopover();
    }
  });

  helpCloseBtn?.addEventListener('click', closeHelpPopover);
  helpPopover?.addEventListener('click', (e) => {
    if (e.target === helpPopover && performance.now() - lastModalOpenedAt > 350) closeHelpPopover();
  });

  // Shop modal events
  shopCloseBtn?.addEventListener('click', closeShopModal);
  shopModal?.addEventListener('click', (e) => {
    if (e.target === shopModal && performance.now() - lastModalOpenedAt > 350) closeShopModal();
  });

  for (const btn of shopStyleButtons) {
    btn.addEventListener('click', () => {
      if (btn.dataset.shopStyle) {
        setShopSelectedStyle(btn.dataset.shopStyle);
      }
    });
  }

  shopBuyBtn?.addEventListener('click', () => {
    handleBuyKrathong();
  });

  shopModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target !== shopCloseBtn) {
      e.preventDefault();
      handleBuyKrathong();
    }
  });

  // Photo modal events
  photoCloseBtn?.addEventListener('click', closePhotoModal);
  photoModal?.addEventListener('click', (e) => {
    if (e.target === photoModal && performance.now() - lastModalOpenedAt > 350) closePhotoModal();
  });
  photoDownloadBtn?.addEventListener('click', () => {
    if (!latestPhotoDataUrl || typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = latestPhotoDataUrl;
    link.download = 'kwan-phayao-atom-fahsai.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('บันทึกรูปภาพแล้ว · Keepsake photo saved!');
  });

  // Wish modal events
  wishCloseBtn?.addEventListener('click', closeWishModal);
  wishModal?.addEventListener('click', (e) => {
    if (e.target === wishModal && performance.now() - lastModalOpenedAt > 350) closeWishModal();
  });

  for (const btn of styleButtons) {
    btn.addEventListener('click', () => {
      if (btn.dataset.style) {
        setKrathongStyle(btn.dataset.style);
      }
    });
  }

  wishSubmitBtn?.addEventListener('click', () => {
    handleSubmitWish();
  });

  wishInput?.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitWish();
    }
  });

  // Emote bar events
  if (btnEmoteToggle) {
    const toggleEmoteTray = () => {
      if (!hasJoined || isModalOpen()) return;
      const isCurrentlyClosed = emoteBar?.classList.contains('emote-tray-closed');
      setEmoteTrayOpen(Boolean(isCurrentlyClosed));
    };
    btnEmoteToggle.addEventListener('pointerdown', (e) => {
      if (!hasJoined || isModalOpen()) return;
      e.preventDefault();
      lastPointerEmoteToggleAt = performance.now();
      toggleEmoteTray();
    });
    btnEmoteToggle.addEventListener('touchend', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    btnEmoteToggle.addEventListener('click', () => {
      if (performance.now() - lastPointerEmoteToggleAt < 400) return;
      toggleEmoteTray();
    });
  }

  for (const btn of emoteButtons) {
    btn.addEventListener('click', () => {
      if (btn.dataset.emote) {
        triggerEmote(btn.dataset.emote);
      }
    });
  }

  // Global keyboard controls
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    const typingInField = tag === 'INPUT' || tag === 'TEXTAREA';

    if (e.key === 'Escape') {
      if (photoModal && !photoModal.hidden) {
        closePhotoModal();
        return;
      }
      if (shopModal && !shopModal.hidden) {
        closeShopModal();
        return;
      }
      if (wishModal && !wishModal.hidden) {
        closeWishModal();
        return;
      }
      if (helpPopover && !helpPopover.hidden) {
        closeHelpPopover();
        return;
      }
      if (hasJoined && localChar && characters[localChar].lanternReady) {
        cancelLocalLanternReady(true);
        showToast('วางโคมลอยลงแล้ว · Lowered sky lantern');
        return;
      }
    }

    if (typingInField || !hasJoined) return;

    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      audio.toggleMute();
      updateAudioButton();
      return;
    }

    if (isModalOpen()) return;

    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      keysHeld.add(k);
      return;
    }

    if (k === 'e' && !e.repeat) {
      e.preventDefault();
      handleInteract();
      return;
    }

    if (k === 'p' && !e.repeat) {
      e.preventDefault();
      captureNagaScreenshot();
      return;
    }

    if (k === 'l' && !e.repeat) {
      e.preventDefault();
      handleCoopLantern();
      return;
    }

    if (!e.repeat && ['1', '2', '3', '4'].includes(k)) {
      e.preventDefault();
      triggerEmote(EMOTES[Number(k) - 1]);
    }
  });

  window.addEventListener('keyup', (e) => {
    keysHeld.delete(e.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    clearMovementInputs();
  });

  window.addEventListener('resize', () => {
    viewport = computeViewportLayout(window.innerWidth, window.innerHeight);
    canvas.width = viewport.viewW;
    canvas.height = viewport.viewH;
    ctx.imageSmoothingEnabled = false;
  });

  window.addEventListener('hashchange', () => {
    if (hasJoined) return;
    const hashRoom = parseHashRoomId();
    if (hashRoom) {
      applyLinkedRoomUI(hashRoom);
      connectPreviewForRoom(hashRoom);
    }
  });

  // -------------------------------------------------------------------------
  // Simulation Step
  // -------------------------------------------------------------------------
  function updateSimulation(dt, nowMs, tSec) {
    photoFlashAlpha = Math.max(0, photoFlashAlpha - dt * 2.6);

    // 1. Update ambient distant lanterns
    for (const lan of scene.ambientLanterns) {
      lan.y -= lan.speedY * dt;
      lan.x += (lan.driftX + Math.sin(tSec * 0.45 + lan.phase) * 1.1) * dt;
      if (lan.y < -48) {
        lan.y = WORLD_CONFIG.skyBottomY - 2;
      }
      if (lan.x < -8) lan.x = WORLD_CONFIG.width + 6;
      if (lan.x > WORLD_CONFIG.width + 8) lan.x = -6;
    }

    // 2. Update celebration burst particles
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const pt = burstParticles[i];
      const age = nowMs - pt.bornAt;
      if (age >= pt.lifeMs) {
        burstParticles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.25, dt);
      pt.vy *= Math.pow(0.4, dt);
    }

    // 3. Movement & camera when joined
    if (hasJoined && localChar) {
      const local = characters[localChar];
      const otherChar = localChar === 'him' ? 'her' : 'him';
      const partner = characters[otherChar];
      let ix = 0;
      let iy = 0;

      if (!isModalOpen()) {
        if (keysHeld.has('a') || keysHeld.has('arrowleft') || dpadState.left) ix -= 1;
        if (keysHeld.has('d') || keysHeld.has('arrowright') || dpadState.right) ix += 1;
        if (keysHeld.has('w') || keysHeld.has('arrowup') || dpadState.up) iy -= 1;
        if (keysHeld.has('s') || keysHeld.has('arrowdown') || dpadState.down) iy += 1;
      }

      if (ix !== 0 || iy !== 0) {
        if (emoteBar?.dataset.collapsible === 'true' && !emoteBar.classList.contains('emote-tray-closed')) {
          setEmoteTrayOpen(false);
        }
        if (local.isSitting) {
          standUpFromBench(true);
        }
        if (local.lanternReady) {
          cancelLocalLanternReady(true);
        }
        const len = Math.hypot(ix, iy);
        const ux = ix / len;
        const uy = iy / len;

        // Gentle side-by-side speed matching when walking together
        let speedMult = 1;
        if (partner.online && !local.isSitting && !partner.isSitting) {
          const dist = Math.hypot(local.x - partner.x, local.y - partner.y);
          const partnerSpeed = Math.hypot(partner.vx, partner.vy);
          if (dist <= SIDE_BY_SIDE_DIST && partnerSpeed > 12) {
            const pvx = partner.vx / partnerSpeed;
            const pvy = partner.vy / partnerSpeed;
            const align = ux * pvx + uy * pvy;
            if (align > 0.55) {
              const lead = (local.x - partner.x) * ux + (local.y - partner.y) * uy;
              if (lead > 6) {
                speedMult = clamp(1 - (lead - 6) * 0.009, 0.82, 1.0);
              } else if (lead < -6) {
                speedMult = clamp(1 + (-lead - 6) * 0.005, 1.0, 1.12);
              }
            }
          }
        }

        const effectiveSpeed = PLAYER_SPEED * speedMult;
        const dx = ux * effectiveSpeed * dt;
        const dy = uy * effectiveSpeed * dt;
        const moved = moveWithCollision(local.x, local.y, dx, dy);
        local.x = moved.x;
        local.y = moved.y;

        if (Math.abs(ix) >= Math.abs(iy)) {
          local.dir = ix < 0 ? 'left' : 'right';
        } else {
          local.dir = iy < 0 ? 'up' : 'down';
        }
        local.moving = true;
        local.walkAnim += dt * 7;
        wasMoving = true;
        syncLocalPlayer(false);
      } else {
        local.moving = false;
        local.walkAnim = 0;
        if (wasMoving) {
          wasMoving = false;
          syncLocalPlayer(true);
        }
      }

      // Interpolate partner character
      if (partner.online) {
        const dist = Math.hypot(partner.targetX - partner.x, partner.targetY - partner.y);
        if (dist > 0.25) {
          const factor = Math.min(1, dt * 14);
          partner.x = lerp(partner.x, partner.targetX, factor);
          partner.y = lerp(partner.y, partner.targetY, factor);
          partner.moving = dist > 0.7;
          if (partner.moving) partner.walkAnim += dt * 7;
        } else {
          partner.x = partner.targetX;
          partner.y = partner.targetY;
          partner.moving = false;
          partner.walkAnim = 0;
        }
        if (!partner.moving || nowMs - (partner.lastTargetAt || 0) > 260) {
          const decay = Math.pow(0.05, dt);
          partner.vx *= decay;
          partner.vy *= decay;
          if (Math.hypot(partner.vx, partner.vy) < 1) {
            partner.vx = 0;
            partner.vy = 0;
          }
        }
      } else {
        partner.moving = false;
        partner.walkAnim = 0;
        partner.vx = 0;
        partner.vy = 0;
      }

      // Smooth closeness warmth (0..1)
      let targetWarmth = 0;
      if (characters.him.online && characters.her.online) {
        const pairDist = Math.hypot(
          characters.him.x - characters.her.x,
          characters.him.y - characters.her.y
        );
        if (pairDist <= CLOSENESS_MAX_DIST) {
          targetWarmth = clamp(1 - (pairDist - 16) / (CLOSENESS_MAX_DIST - 16), 0, 1);
        }
      }
      togetherWarmth = lerp(togetherWarmth, targetWarmth, Math.min(1, dt * 3.5));

      if (local.lanternReady) {
        const distToPartner = Math.hypot(local.x - partner.x, local.y - partner.y);
        if (
          !partner.online ||
          partner.isSitting ||
          local.isSitting ||
          distToPartner > COOP_LANTERN_CANCEL_RADIUS
        ) {
          cancelLocalLanternReady(true);
        }
      }

      // Smooth camera centering & clamping
      const targetCamX = clamp(
        local.x - viewport.viewW / 2,
        0,
        Math.max(0, WORLD_CONFIG.width - viewport.viewW)
      );
      let targetCamY;
      if (viewport.viewH <= WORLD_CONFIG.height) {
        targetCamY = clamp(
          local.y - viewport.viewH * 0.7,
          0,
          WORLD_CONFIG.height - viewport.viewH
        );
      } else {
        targetCamY = -Math.floor((viewport.viewH - WORLD_CONFIG.height) * 0.4);
      }
      const camLerp = Math.min(1, dt * 8);
      cam.x = lerp(cam.x, targetCamX, camLerp);
      cam.y = lerp(cam.y, targetCamY, camLerp);

      // Interactive prompt state
      updateInteractPrompt(local);
    } else {
      togetherWarmth = lerp(togetherWarmth, 0, Math.min(1, dt * 3.5));
      setVisible(btnNagaPhoto, false);
      // Gentle scenic camera behind entry overlay centered on Naga & full moon
      const idleTargetX = clamp(
        480 - viewport.viewW / 2 + Math.sin(tSec * 0.14) * 18,
        0,
        Math.max(0, WORLD_CONFIG.width - viewport.viewW)
      );
      const idleTargetY =
        viewport.viewH <= WORLD_CONFIG.height
          ? clamp(150 - viewport.viewH * 0.65, 0, WORLD_CONFIG.height - viewport.viewH)
          : -Math.floor((viewport.viewH - WORLD_CONFIG.height) * 0.4);
      cam.x = lerp(cam.x, idleTargetX, Math.min(1, dt * 3));
      cam.y = lerp(cam.y, idleTargetY, Math.min(1, dt * 3));
    }
  }

  function updateInteractPrompt(local) {
    if (isModalOpen()) {
      setVisible(interactPrompt, false);
      setVisible(btnNagaPhoto, false);
      return;
    }

    if (local.isSitting) {
      setVisible(btnNagaPhoto, false);
      activeZone = { type: 'stand' };
      if (interactPrompt) {
        interactPrompt.textContent = 'E · ลุกขึ้น · Stand Up';
        setVisible(interactPrompt, true);
      }
      if (touchInteractBtn) {
        touchInteractBtn.textContent = 'ลุกขึ้น';
        touchInteractBtn.classList.add('active');
      }
      return;
    }

    const otherChar = localChar === 'him' ? 'her' : 'him';
    const partner = characters[otherChar];
    const partnerName = CHAR_NAMES[otherChar];
    const nearForLantern = isPartnerNearForLantern();
    const togetherAtNaga = isTogetherAtNaga();
    setVisible(btnNagaPhoto, togetherAtNaga);

    if (touchLanternBtn) {
      const canJoinLantern = nearForLantern && partner.lanternReady;
      touchLanternBtn.classList.toggle('active', nearForLantern || local.lanternReady);
      touchLanternBtn.classList.toggle('holding', local.lanternReady);
      if (canJoinLantern) {
        touchLanternBtn.textContent = 'ปล่อยโคมคู่!';
      } else if (local.lanternReady) {
        touchLanternBtn.textContent = 'ยกเลิกโคม';
      } else {
        touchLanternBtn.textContent = 'โคมคู่';
      }
    }

    const found = findActiveZone(local.x, local.y);
    activeZone = found;

    let promptText = null;
    let touchText = 'E / โต้ตอบ';

    if (nearForLantern && partner.lanternReady) {
      promptText = 'E / L · ช่วยกันปล่อยโคมลอย! · Release Lantern Together!';
      touchText = 'ปล่อยโคมคู่';
    } else if (local.lanternReady) {
      promptText = 'กำลังถือโคมรอ' + partnerName.th + ' · E/L ยกเลิก';
      touchText = 'ยกเลิกโคม';
    } else if (found?.type === 'pierLantern') {
      if (nearForLantern) {
        promptText = 'E / L · ถือโคมลอยด้วยกัน · Lift Sky Lantern Together';
        touchText = 'ปล่อยโคมคู่';
      } else {
        promptText = 'รออีกฝ่ายมายืนใกล้กันเพื่อปล่อยโคม · Stand Together to Float Lantern';
        touchText = 'รออีกฝ่าย';
      }
    } else if (found?.type === 'krathong') {
      if (!local.hasKrathong) {
        promptText = 'แวะซื้อกระทงที่ร้านฝั่งขวาก่อน · Buy a Krathong at the Shop first';
        touchText = 'ไปร้านกระทง';
      } else {
        promptText = 'E · อธิษฐานและลอยกระทง · Float Krathong';
        touchText = 'ลอยกระทง';
      }
    } else if (found?.type === 'bench') {
      promptText = 'E · นั่งพักริมกว๊าน · Sit Together';
      touchText = 'นั่งพัก';
    } else if (found?.type === 'pavilion') {
      promptText = !local.hasKrathong
        ? 'E · ซื้อกระทง · Buy Krathong'
        : 'E · เปลี่ยนแบบกระทง · Change Krathong';
      touchText = !local.hasKrathong ? 'ซื้อกระทง' : 'เปลี่ยนแบบ';
    } else if (found?.type === 'musicBox') {
      promptText = audio.isMusicBoxPlaying()
        ? 'E · ปิดกล่องดนตรี (Canon in D) · Stop Music Box'
        : 'E · เปิดกล่องดนตรี (Canon in D) · Play Music Box';
      touchText = audio.isMusicBoxPlaying() ? 'ปิดเพลง' : 'กล่องดนตรี';
    } else if (nearForLantern) {
      promptText = 'E / L · ถือโคมลอยด้วยกัน · Lift Sky Lantern Together';
      touchText = 'ปล่อยโคมคู่';
    } else if (found?.type === 'nagaPhoto' && !togetherAtNaga) {
      promptText = 'เดินมาหน้าพญานาคด้วยกันเพื่อถ่ายรูปคู่ · Stand by Phaya Naga together for a photo';
      touchText = 'รออีกฝ่าย';
    }

    if (!promptText) {
      setVisible(interactPrompt, false);
      if (touchInteractBtn) {
        touchInteractBtn.textContent = togetherAtNaga ? 'ถ่ายรูปคู่' : 'E / โต้ตอบ';
        touchInteractBtn.classList.toggle('active', togetherAtNaga);
      }
      return;
    }

    if (interactPrompt) {
      interactPrompt.textContent = promptText;
      setVisible(interactPrompt, true);
    }
    if (touchInteractBtn) {
      touchInteractBtn.textContent = touchText;
      touchInteractBtn.classList.add('active');
    }
  }

  // -------------------------------------------------------------------------
  // Pixel-Crisp Rendering Pipeline
  // -------------------------------------------------------------------------
  function drawMusicNotePixel(targetCtx, x, y, color) {
    targetCtx.fillStyle = color;
    targetCtx.fillRect(x, y + 3, 2, 2);
    targetCtx.fillRect(x + 1, y, 1, 4);
    targetCtx.fillRect(x + 2, y, 1, 1);
  }

  function renderWorld(targetCtx, viewW, viewH, camX, camY, nowMs, tSec) {
    const wallNowMs = Date.now();
    targetCtx.imageSmoothingEnabled = false;

    // Clear entire viewport in deep sky indigo
    targetCtx.fillStyle = PALETTE.skyTop;
    targetCtx.fillRect(0, 0, viewW, viewH);

    targetCtx.save();
    targetCtx.translate(-camX, -camY);

    // 1. Sky bands (y: 0..68)
    targetCtx.fillStyle = PALETTE.skyMid;
    targetCtx.fillRect(0, 22, WORLD_CONFIG.width, 22);
    targetCtx.fillStyle = PALETTE.skyBottom;
    targetCtx.fillRect(0, 44, WORLD_CONFIG.width, 16);
    targetCtx.fillStyle = PALETTE.skyHorizon;
    targetCtx.fillRect(0, 60, WORLD_CONFIG.width, 8);

    // 2. Twinkling stars
    for (const s of scene.stars) {
      if (s.x < camX - 2 || s.x > camX + viewW + 2) continue;
      const tw = Math.sin(tSec * s.speed + s.phase);
      if (tw < -0.55) continue;
      targetCtx.fillStyle = tw > 0.45 && s.bright ? PALETTE.candleCore : PALETTE.moonGlow;
      targetCtx.fillRect(s.x, s.y, 1, 1);
    }

    // 3. Full moon + pixel halo
    targetCtx.fillStyle = 'rgba(247, 239, 214, 0.14)';
    targetCtx.fillRect(MOON_POS.x - 12, MOON_POS.y - 12, 24, 24);
    for (let dy = -MOON_POS.r; dy <= MOON_POS.r; dy++) {
      for (let dx = -MOON_POS.r; dx <= MOON_POS.r; dx++) {
        if (dx * dx + dy * dy <= MOON_POS.r * MOON_POS.r) {
          const isShade = (dx + dy > 5 && dx > 1) || (dx === -3 && dy === -2);
          targetCtx.fillStyle = isShade ? PALETTE.moonGlow : PALETTE.moon;
          targetCtx.fillRect(MOON_POS.x + dx, MOON_POS.y + dy, 1, 1);
        }
      }
    }

    // 4. Ambient distant khom loi sky lanterns (behind mountains/foreground)
    for (const lan of scene.ambientLanterns) {
      const lx = Math.round(lan.x);
      const ly = Math.round(lan.y);
      if (lx < camX - 4 || lx > camX + viewW + 4) continue;
      targetCtx.fillStyle = PALETTE.candleWarm;
      targetCtx.fillRect(lx, ly, lan.size, lan.size + 1);
      targetCtx.fillStyle = PALETTE.candleCore;
      targetCtx.fillRect(lx, ly + lan.size, lan.size, 1);
    }

    // 5. Doi Luang & Doi Nok mountain ridge silhouette
    const startX = Math.max(0, camX - 2);
    const endX = Math.min(WORLD_CONFIG.width - 1, camX + viewW + 2);
    targetCtx.fillStyle = PALETTE.mountainFar;
    for (let x = startX; x <= endX; x++) {
      const h = scene.farRidge[x];
      targetCtx.fillRect(x, WORLD_CONFIG.skyBottomY - h, 1, h);
    }
    targetCtx.fillStyle = PALETTE.mountainNear;
    for (let x = startX; x <= endX; x++) {
      const h = scene.nearRidge[x];
      targetCtx.fillRect(x, WORLD_CONFIG.skyBottomY - h, 1, h);
    }

    // 6. Kwan Phayao Lake (y: 68..162)
    targetCtx.fillStyle = PALETTE.lake;
    targetCtx.fillRect(0, WORLD_CONFIG.skyBottomY, WORLD_CONFIG.width, WORLD_CONFIG.waterBottomY - WORLD_CONFIG.skyBottomY);
    targetCtx.fillStyle = PALETTE.lakeMid;
    targetCtx.fillRect(0, WORLD_CONFIG.skyBottomY, WORLD_CONFIG.width, 22);

    // Moon water reflection column
    for (let ry = WORLD_CONFIG.skyBottomY + 3; ry < WORLD_CONFIG.waterBottomY - 2; ry += 3) {
      const progress = (ry - WORLD_CONFIG.skyBottomY) / 94;
      const halfW = Math.max(2, Math.round(3 + progress * 7 + Math.sin(tSec * 2.1 + ry * 0.3) * 1.5));
      const shiftX = Math.round(Math.sin(tSec * 1.8 + ry * 0.45) * 2.2);
      targetCtx.fillStyle = ry % 2 === 0 ? 'rgba(217, 200, 158, 0.28)' : 'rgba(247, 239, 214, 0.22)';
      targetCtx.fillRect(MOON_POS.x + shiftX - halfW, ry, halfW * 2, 1);
      if (halfW > 4) {
        targetCtx.fillStyle = 'rgba(255, 243, 209, 0.38)';
        targetCtx.fillRect(MOON_POS.x + shiftX - 2, ry, 4, 1);
      }
    }

    // Animated lake shimmer lines
    for (const gl of scene.lakeGlints) {
      if (gl.x + gl.w < camX || gl.x > camX + viewW) continue;
      const pulse = Math.sin(tSec * gl.speed + gl.phase);
      if (pulse < -0.25) continue;
      const drift = Math.round(Math.sin(tSec * 0.6 + gl.phase) * 2);
      targetCtx.fillStyle = PALETTE.lakeShimmer;
      targetCtx.fillRect(gl.x + drift, gl.y, gl.w, 1);
    }

    // Subtle reflections from lakeside lantern posts & Naga into water edge
    for (const post of WORLD_CONFIG.lanternPosts) {
      if (post.y > 170) continue;
      const flicker = Math.round(Math.sin(tSec * 4 + post.x) * 1);
      targetCtx.fillStyle = 'rgba(255, 183, 77, 0.22)';
      targetCtx.fillRect(post.x + 2 + flicker, 154, 4, 1);
      targetCtx.fillRect(post.x + 1 - flicker, 158, 6, 1);
    }

    // Wat Tilok Aram island stupa silhouette
    targetCtx.drawImage(sprites.props.watTilokAram, WAT_POS.x, WAT_POS.y);

    // 7. Synced floating krathongs on the lake (behind promenade & pier)
    const candleFrame = Math.floor(tSec * 5) % 2;
    for (const k of syncedKrathongs) {
      const ageSec = Math.max(0, (wallNowMs - k.createdAt) / 1000);
      const driftOut = 52 * (1 - Math.exp(-ageSec / 28));
      const swayX =
        (k.driftSeed - 0.5) * 26 * (1 - Math.exp(-ageSec / 36)) +
        Math.sin(tSec * 0.75 + k.driftSeed * 19) * 3.5;
      const bobY = Math.round(Math.sin(tSec * 2.3 + k.driftSeed * 11));
      const kx = Math.round(clamp(k.spawnX + swayX, 32, WORLD_CONFIG.width - 32));
      const ky = Math.round(155 - driftOut) + bobY;

      if (kx < camX - 24 || kx > camX + viewW + 24) continue;

      // Concentric water ripples
      const ripplePhase = (tSec * 0.65 + k.driftSeed * 5) % 1;
      const rW = Math.round(6 + ripplePhase * 10);
      targetCtx.fillStyle = PALETTE.lakeShimmer;
      targetCtx.fillRect(kx - Math.floor(rW / 2), ky + 2, rW, 1);
      if (ripplePhase > 0.3) {
        const rW2 = Math.round(4 + (ripplePhase - 0.3) * 10);
        targetCtx.fillRect(kx - Math.floor(rW2 / 2), ky + 4, rW2, 1);
      }

      // Warm candlelight reflection on water
      const reflectFlicker = Math.floor(tSec * 7 + k.driftSeed * 10) % 2;
      targetCtx.fillStyle = PALETTE.goldDark;
      targetCtx.fillRect(kx - 2 + reflectFlicker, ky + 3, 4, 1);
      targetCtx.fillStyle = PALETTE.candle;
      targetCtx.fillRect(kx - 1, ky + 1, 2, 1);

      const styleSet = sprites.krathongs[k.krathongStyle] || sprites.krathongs.marigold;
      const sprite = styleSet[(candleFrame + Math.floor(k.driftSeed * 2)) % 2];
      targetCtx.drawImage(sprite, kx - 7, ky - 10);
    }

    // 8. Stone Promenade (y: 162..246) & Foreground Grass Embankment (y >= 246)
    targetCtx.fillStyle = PALETTE.foliageDark;
    targetCtx.fillRect(0, WORLD_CONFIG.promenadeBottomY, WORLD_CONFIG.width, WORLD_CONFIG.height - WORLD_CONFIG.promenadeBottomY + Math.max(0, viewH));
    // Subtle grass tufts in foreground
    targetCtx.fillStyle = PALETTE.foliage;
    for (let gx = Math.max(8, camX - (camX % 24)); gx < endX; gx += 24) {
      const gy = 250 + ((gx * 7) % 12);
      targetCtx.fillRect(gx, gy, 3, 1);
      targetCtx.fillRect(gx + 1, gy - 1, 1, 1);
    }

    const tileStartCol = Math.max(0, Math.floor(camX / 16));
    const tileEndCol = Math.min(Math.ceil(WORLD_CONFIG.width / 16) - 1, Math.ceil((camX + viewW) / 16));

    for (let col = tileStartCol; col <= tileEndCol; col++) {
      const tx = col * 16;
      // Top coping curb row
      targetCtx.drawImage(sprites.tiles.stoneCurb, tx, WORLD_CONFIG.promenadeTopY);
      // Flagstone promenade rows (178..242)
      for (let row = 0; row < 4; row++) {
        const ty = 178 + row * 16;
        const tile = (col + row * 2) % 3 === 0 ? sprites.tiles.stoneB : sprites.tiles.stoneA;
        targetCtx.drawImage(tile, tx, ty);
      }
      // Bottom promenade curb edge (y: 242..246)
      targetCtx.fillStyle = PALETTE.stoneCurb;
      targetCtx.fillRect(tx, 242, 16, 2);
      targetCtx.fillStyle = PALETTE.stoneDark;
      targetCtx.fillRect(tx, 244, 16, 2);
    }

    // 9. Wooden Pier (left lakeside)
    targetCtx.fillStyle = PALETTE.woodDark;
    targetCtx.fillRect(PIER_BOUNDS.x + 2, 162, 4, 4);
    targetCtx.fillRect(PIER_BOUNDS.x + PIER_BOUNDS.w - 6, 162, 4, 4);
    for (let py = PIER_BOUNDS.y; py < PIER_BOUNDS.y + PIER_BOUNDS.h; py += 16) {
      for (let px = PIER_BOUNDS.x; px < PIER_BOUNDS.x + PIER_BOUNDS.w; px += 16) {
        targetCtx.drawImage(sprites.tiles.pierPlank, px, py);
      }
    }
    // Pier edge timber trim & corner bollards
    targetCtx.fillStyle = PALETTE.woodDark;
    targetCtx.fillRect(PIER_BOUNDS.x, PIER_BOUNDS.y, PIER_BOUNDS.w, 1);
    targetCtx.fillRect(PIER_BOUNDS.x, PIER_BOUNDS.y, 2, PIER_BOUNDS.h);
    targetCtx.fillRect(PIER_BOUNDS.x + PIER_BOUNDS.w - 2, PIER_BOUNDS.y, 2, PIER_BOUNDS.h);
    targetCtx.fillStyle = PALETTE.woodLight;
    targetCtx.fillRect(PIER_BOUNDS.x, PIER_BOUNDS.y - 3, 4, 5);
    targetCtx.fillRect(PIER_BOUNDS.x + PIER_BOUNDS.w - 4, PIER_BOUNDS.y - 3, 4, 5);
    targetCtx.fillStyle = PALETTE.candle;
    targetCtx.fillRect(PIER_BOUNDS.x + 1, PIER_BOUNDS.y - 4, 2, 1);
    targetCtx.fillRect(PIER_BOUNDS.x + PIER_BOUNDS.w - 3, PIER_BOUNDS.y - 4, 2, 1);

    // 10. Warm Ground Light Pools (+ subtle warming when Atom & Fahsai walk close together)
    const bothOnline = characters.him.online && characters.her.online;
    const pairMidX = (characters.him.x + characters.her.x) / 2;
    const pairMidY = (characters.him.y + characters.her.y) / 2;

    for (const post of WORLD_CONFIG.lanternPosts) {
      if (post.x < camX - 48 || post.x > camX + viewW + 48) continue;
      targetCtx.drawImage(sprites.lightPool, post.x - 28, post.y - 38);
      targetCtx.drawImage(sprites.lightPool, post.x - 30, post.y - 22);

      if (bothOnline && togetherWarmth > 0.02 && Math.hypot(post.x - pairMidX, post.y - pairMidY) < 160) {
        targetCtx.save();
        targetCtx.globalAlpha = 0.28 * togetherWarmth;
        targetCtx.drawImage(sprites.lightPool, post.x - 28, post.y - 38);
        targetCtx.drawImage(sprites.lightPool, post.x - 30, post.y - 22);
        targetCtx.restore();
      }
    }
    targetCtx.drawImage(sprites.lightPool, 785 - 32, 188 - 24);
    targetCtx.drawImage(sprites.lightPool, 480 - 32, 152 - 24);
    targetCtx.drawImage(sprites.lightPool, MUSIC_BOX_POS.x - 22, MUSIC_BOX_POS.y - 14);

    if (bothOnline && togetherWarmth > 0.02) {
      targetCtx.save();
      targetCtx.globalAlpha = 0.42 * togetherWarmth;
      targetCtx.drawImage(sprites.lightPool, Math.round(pairMidX - 32), Math.round(pairMidY - 26));
      targetCtx.restore();
    }

    // 11. Y-Sorted Depth Layer (Props, Bushes, Characters)
    const drawables = [];

    drawables.push({
      sortY: NAGA_POS.sortY,
      draw: () => {
        targetCtx.drawImage(sprites.props.nagaMonument, NAGA_POS.x, NAGA_POS.y);
      },
    });

    drawables.push({
      sortY: BENCH_POS.sortY,
      draw: () => {
        targetCtx.drawImage(sprites.props.bench, BENCH_POS.x, BENCH_POS.y);
      },
    });

    drawables.push({
      sortY: PAVILION_POS.sortY,
      draw: () => {
        targetCtx.drawImage(sprites.props.pavilion, PAVILION_POS.x, PAVILION_POS.y);
      },
    });

    drawables.push({
      sortY: MUSIC_BOX_POS.sortY,
      draw: () => {
        const mbSprite = audio.isMusicBoxPlaying()
          ? sprites.props.musicBoxOpen
          : sprites.props.musicBox;
        targetCtx.drawImage(mbSprite, MUSIC_BOX_POS.x, MUSIC_BOX_POS.y);
      },
    });

    for (const post of WORLD_CONFIG.lanternPosts) {
      drawables.push({
        sortY: post.y,
        draw: () => {
          targetCtx.drawImage(sprites.props.lanternPost, post.x - 8, post.y - 38);
        },
      });
    }

    for (const bush of SHORELINE_BUSHES) {
      drawables.push({
        sortY: bush.y,
        draw: () => {
          targetCtx.drawImage(sprites.props[bush.kind], bush.x - 12, bush.y - 16);
        },
      });
    }

    for (const charId of ['him', 'her']) {
      const ch = characters[charId];
      const sortY = ch.isSitting ? Math.max(Math.round(ch.y), BENCH_POS.sortY + 1) : Math.round(ch.y);
      drawables.push({
        sortY,
        draw: () => drawCharacterEntity(targetCtx, charId, ch, nowMs, tSec, candleFrame),
      });
    }

    drawables.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawables) {
      item.draw();
    }

    // Rising pixel music notes above the far-left Canon in D music box while playing
    if (audio.isMusicBoxPlaying()) {
      for (let i = 0; i < 3; i++) {
        const phase = (tSec * 0.55 + i * 0.33) % 1;
        const nx = Math.round(MUSIC_BOX_POS.x + 8 + Math.sin(tSec * 2.2 + i * 2.1) * 4);
        const ny = Math.round(MUSIC_BOX_POS.y - 2 - phase * 18);
        if (nx >= camX - 8 && nx <= camX + viewW + 8) {
          targetCtx.save();
          targetCtx.globalAlpha = Math.sin(phase * Math.PI);
          drawMusicNotePixel(targetCtx, nx, ny, i % 2 === 0 ? PALETTE.goldBright : PALETTE.candleCore);
          targetCtx.restore();
        }
      }
    }

    // 12. Held Co-op Sky Lantern & Synced Released Sky Lanterns
    if (
      characters.him.online &&
      characters.her.online &&
      (characters.him.lanternReady || characters.her.lanternReady)
    ) {
      const dist = Math.hypot(
        characters.him.x - characters.her.x,
        characters.him.y - characters.her.y
      );
      const holder = characters.him.lanternReady ? characters.him : characters.her;
      const hx = Math.round(
        dist <= COOP_LANTERN_RADIUS
          ? (characters.him.x + characters.her.x) / 2
          : holder.x
      );
      const hy = Math.round(
        (dist <= COOP_LANTERN_RADIUS
          ? (characters.him.y + characters.her.y) / 2
          : holder.y) - 24
      );
      const bob = Math.round(Math.sin(tSec * 3.2) * 1.5);
      const lFrame = Math.floor(tSec * 4) % 2;
      targetCtx.fillStyle = 'rgba(255, 183, 77, 0.22)';
      targetCtx.fillRect(hx - 8, hy - 16 + bob, 16, 18);
      targetCtx.fillStyle = 'rgba(255, 243, 209, 0.2)';
      targetCtx.fillRect(hx - 6, hy - 13 + bob, 12, 12);
      targetCtx.drawImage(sprites.skyLantern[lFrame], hx - 5, hy - 14 + bob);
    }

    for (const lan of syncedLanterns) {
      const ageSec = Math.max(0, (wallNowMs - lan.createdAt) / 1000);
      const ly = Math.round(160 - ageSec * 14);
      if (ly < -90) continue;
      const sway = Math.sin(tSec * 1.1 + lan.driftSeed * 15) * 4.5;
      const driftX = (lan.driftSeed - 0.5) * 38 * (ageSec / 10);
      const lx = Math.round(lan.spawnX + driftX + sway);
      if (lx < camX - 32 || lx > camX + viewW + 32) continue;

      targetCtx.fillStyle = 'rgba(255, 183, 77, 0.16)';
      targetCtx.fillRect(lx - 7, ly - 15, 14, 16);
      const lFrame = (Math.floor(tSec * 4) + Math.floor(lan.driftSeed * 2)) % 2;
      targetCtx.drawImage(sprites.skyLantern[lFrame], lx - 5, ly - 14);
    }

    // 13. Atmospheric Fireflies
    for (const ff of scene.fireflies) {
      const fx = Math.round(ff.baseX + Math.sin(tSec * ff.speed + ff.phase) * ff.ampX);
      const fy = Math.round(ff.baseY + Math.cos(tSec * ff.speed * 0.8 + ff.phase) * ff.ampY);
      if (fx < camX - 4 || fx > camX + viewW + 4) continue;
      const glow = Math.sin(tSec * 2.4 + ff.phase);
      if (glow < -0.15) continue;
      targetCtx.fillStyle = glow > 0.5 ? PALETTE.candleCore : PALETTE.goldBright;
      targetCtx.fillRect(fx, fy, 1, 1);
    }

    // 14. Fireflies Drifting Between Sprites & Soft Proximity Aura
    if (bothOnline) {
      if (togetherWarmth > 0.04) {
        targetCtx.save();
        for (const bf of scene.betweenFireflies) {
          const u = clamp(bf.u + Math.sin(tSec * bf.speed + bf.phase) * 0.1, 0.06, 0.94);
          const bx = Math.round(lerp(characters.him.x, characters.her.x, u));
          const by = Math.round(
            lerp(characters.him.y, characters.her.y, u) -
              10 +
              Math.sin(tSec * 2.2 + bf.phase) * bf.arc
          );
          const pulse = 0.45 + 0.55 * Math.sin(tSec * 3.1 + bf.phase);
          targetCtx.globalAlpha = togetherWarmth * pulse;
          targetCtx.fillStyle = pulse > 0.72 ? PALETTE.candleCore : PALETTE.candle;
          targetCtx.fillRect(bx, by, 1, 1);
        }
        targetCtx.restore();
      }

      const dist = Math.hypot(characters.him.x - characters.her.x, characters.him.y - characters.her.y);
      if (dist <= PROXIMITY_AURA_RADIUS) {
        const mx = pairMidX;
        const my = pairMidY - 11;
        for (let i = 0; i < 8; i++) {
          const ang = tSec * 1.6 + (Math.PI * 2 * i) / 8;
          const rx = Math.round(mx + Math.cos(ang) * 15);
          const ry = Math.round(my + Math.sin(ang) * 7 + Math.sin(tSec * 3 + i) * 2);
          targetCtx.fillStyle = i % 2 === 0 ? PALETTE.candleCore : PALETTE.candle;
          targetCtx.fillRect(rx, ry, 1, 1);
        }
      }
    }

    // 15. Celebratory Golden Firefly Burst
    for (const pt of burstParticles) {
      const alpha = 1 - (nowMs - pt.bornAt) / pt.lifeMs;
      if (alpha <= 0) continue;
      targetCtx.fillStyle = alpha > 0.45 ? PALETTE.candleCore : PALETTE.goldBright;
      targetCtx.fillRect(Math.round(pt.x), Math.round(pt.y), alpha > 0.7 ? 2 : 1, 1);
    }

    targetCtx.restore();
  }

  function render(nowMs, tSec) {
    renderWorld(
      ctx,
      viewport.viewW,
      viewport.viewH,
      Math.round(cam.x),
      Math.round(cam.y),
      nowMs,
      tSec
    );

    if (photoFlashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255, 248, 228, ${photoFlashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, viewport.viewW, viewport.viewH);
    }
  }

  function drawCharacterEntity(targetCtx, charId, ch, nowMs, tSec, candleFrame) {
    const px = Math.round(ch.x);
    const py = Math.round(ch.y);
    const drawX = px - 8;
    const drawY = py - 24;

    if (!ch.isSitting) {
      targetCtx.fillStyle = 'rgba(9, 16, 29, 0.45)';
      targetCtx.fillRect(px - 5, py - 2, 10, 3);
    }

    const charSet = sprites.characters[charId];
    let sprite;
    if (ch.isSitting) {
      sprite = charSet.sit;
    } else {
      const dirFrames = charSet[ch.dir] || charSet.down;
      const frameIdx = ch.moving ? Math.floor(ch.walkAnim) % 2 : 0;
      sprite = dirFrames[frameIdx];
    }
    targetCtx.drawImage(sprite, drawX, drawY);

    // Held tiny glowing krathong whenever carrying one (anywhere on the map)
    if (!ch.isSitting && ch.online && ch.hasKrathong) {
      const heldStyle = charId === localChar ? selectedStyle : ch.krathongStyle;
      const krSet = sprites.krathongs[heldStyle] || sprites.krathongs.marigold;
      let ox = 0;
      let oy = -12;
      if (ch.dir === 'left') ox = -7;
      else if (ch.dir === 'right') ox = 7;
      else if (ch.dir === 'up') {
        ox = 6;
        oy = -13;
      } else {
        ox = 0;
        oy = -11;
      }
      targetCtx.fillStyle = 'rgba(255, 183, 77, 0.2)';
      targetCtx.fillRect(px + ox - 5, py + oy - 5, 10, 8);
      targetCtx.drawImage(krSet[candleFrame], px + ox - 7, py + oy - 6);
    }

    // Active emote bubble (2.6s)
    if (ch.emote && ch.emoteAt) {
      const age = Date.now() - ch.emoteAt;
      if (age >= 0 && age < EMOTE_DURATION_MS && sprites.emotes[ch.emote]) {
        const popOffset = age < 180 ? -Math.round((1 - age / 180) * 3) : Math.round(Math.sin(tSec * 4) * 1);
        targetCtx.drawImage(sprites.emotes[ch.emote], px - 7, py - 40 + popOffset);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Main Loop & Boot
  // -------------------------------------------------------------------------
  function tick(nowMs) {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameTime) / 1000));
    lastFrameTime = nowMs;
    const tSec = nowMs / 1000;

    updateSimulation(dt, nowMs, tSec);
    render(nowMs, tSec);
    requestAnimationFrame(tick);
  }

  initEntryState().finally(() => {
    lastFrameTime = performance.now();
    requestAnimationFrame(tick);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
}
