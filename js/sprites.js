/**
 * Kwan Phayao Yi Peng - Pixel/Geometric Sprites & World Layout (Phase 1)
 * Clean offscreen canvas sprites designed so Phase 2 16-bit pixel art
 * can drop in without altering game.js contracts.
 */

export const PALETTE = {
  // Sky & Lake
  skyTop: '#0d1326',
  skyMid: '#131c34',
  skyBottom: '#1b2642',
  skyHorizon: '#233154',
  mountainFar: '#121a30',
  mountainNear: '#17223d',
  lake: '#09101d',
  lakeMid: '#0d172a',
  lakeShimmer: '#1d2d4e',
  moon: '#f7efd6',
  moonGlow: '#d9c89e',

  // Warm Beeswax Candlelight & Lanterns
  candle: '#ffb74d',
  candleWarm: '#ff8a65',
  candleCore: '#fff3d1',
  lanternPaper: '#ffb74d',
  lanternShade: '#ff8a65',
  lanternRim: '#ffd88a',

  // Weathered Stone & Wood
  stone: '#4a5061',
  stoneLight: '#636b80',
  stoneDark: '#323744',
  stoneCurb: '#586074',
  woodDark: '#3b261d',
  woodMid: '#5c3c2e',
  woodLight: '#7d5440',

  // Lakeside Foliage
  foliage: '#1a332a',
  foliageLight: '#284c3f',
  foliageDark: '#10211b',

  // Pearl-White & Gold Phaya Naga
  nagaPearl: '#d8e0ea',
  nagaShade: '#9aa8be',
  nagaDeep: '#6c7a91',
  gold: '#d4af37',
  goldBright: '#ffcf6e',
  goldDark: '#997a1e',

  // Character & Flower Accents
  skin: '#f0c7a5',
  skinShade: '#d4a37d',
  hairDark: '#1e1b26',
  hairHighlight: '#363042',
  eyeDark: '#14111a',
  morhom: '#1f3356',
  morhomLight: '#2f4b7a',
  trousers: '#1a2030',
  shoeDark: '#121622',
  penguinWhite: '#eef2f7',
  penguinBeak: '#ffb74d',
  cardiganCream: '#e8dec8',
  cardiganTerracotta: '#c66b4e',
  skirtDark: '#23283b',
  amberClip: '#ffb74d',
  shirtWhite: '#f0f3f8',
  shirtShade: '#cfd6e3',
  uniformNavy: '#1e2d4f',
  uniformNavyDark: '#141e36',
  ribbonNavy: '#274073',
  sockWhite: '#e6ebf2',
  beltDark: '#2a2220',
  blush: '#e8a09a',

  // Krathong & Emote Accents
  marigold: '#ffa726',
  marigoldBright: '#ffd54f',
  lotus: '#e888a6',
  lotusBright: '#f7bfd1',
  jasmine: '#f2f4f7',
  jasmineShade: '#c6cedb',
  leafGreen: '#2e593f',
  heartRed: '#e85d5d',
};

export const WORLD_CONFIG = {
  width: 960,
  height: 270,
  skyBottomY: 68,
  waterBottomY: 162,
  promenadeTopY: 162,
  promenadeBottomY: 246,
  walkBounds: { minX: 26, maxX: 934, minY: 168, maxY: 242 },
  pierWalkRect: { x: 142, y: 138, w: 46, h: 34 },
  nagaCollider: { x: 422, y: 150, w: 116, h: 20 },
  benchCollider: { x: 232, y: 175, w: 48, h: 11 },
  pavilionCollider: { x: 756, y: 178, w: 58, h: 22 },
  musicBoxCollider: { x: 36, y: 171, w: 20, h: 12 },
  benchSeats: [{ x: 245, y: 181 }, { x: 267, y: 181 }],
  zones: {
    pierLantern: { x: 165, y: 142, rx: 28, ry: 18 },
    krathongSpots: [
      { x: 380, y: 170, rx: 36, ry: 16, spawnX: 380 },
      { x: 580, y: 170, rx: 36, ry: 16, spawnX: 580 },
      { x: 295, y: 170, rx: 28, ry: 16, spawnX: 295 },
    ],
    bench: { x: 256, y: 186, rx: 36, ry: 22 },
    pavilion: { x: 785, y: 206, rx: 40, ry: 22 },
    nagaPhoto: { x: 480, y: 186, rx: 64, ry: 22 },
    musicBox: { x: 48, y: 186, rx: 32, ry: 22 },
  },
  lanternPosts: [
    { x: 72, y: 164 }, { x: 218, y: 164 }, { x: 332, y: 164 },
    { x: 632, y: 164 }, { x: 720, y: 164 }, { x: 868, y: 164 },
    { x: 120, y: 244 }, { x: 400, y: 244 }, { x: 560, y: 244 }, { x: 840, y: 244 },
  ],
  defaultIdleSpots: {
    him: { x: 452, y: 186, dir: 'up' },
    her: { x: 508, y: 186, dir: 'up' },
  },
};

function makeCanvas(width, height) {
  let canvas;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    throw new Error('No 2D canvas constructor available in this environment.');
  }
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  return { canvas, ctx };
}

function buildSprite(width, height, drawFn) {
  const { canvas, ctx } = makeCanvas(width, height);
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  drawFn(rect, ctx);
  return canvas;
}

function createTiles() {
  const stoneA = buildSprite(16, 16, (r) => {
    r(0, 0, 16, 16, PALETTE.stone);
    // Flagstone seam lines
    r(0, 7, 16, 1, PALETTE.stoneDark);
    r(0, 15, 16, 1, PALETTE.stoneDark);
    r(7, 0, 1, 7, PALETTE.stoneDark);
    r(15, 8, 1, 7, PALETTE.stoneDark);
    // Subtle bevel highlights
    r(1, 1, 5, 1, PALETTE.stoneLight);
    r(9, 9, 5, 1, PALETTE.stoneLight);
    r(10, 3, 2, 1, PALETTE.stoneCurb);
    r(2, 11, 2, 1, PALETTE.stoneCurb);
  });

  const stoneB = buildSprite(16, 16, (r) => {
    r(0, 0, 16, 16, PALETTE.stone);
    r(1, 1, 6, 6, PALETTE.stoneCurb);
    r(9, 9, 6, 6, PALETTE.stoneCurb);
    r(0, 7, 16, 1, PALETTE.stoneDark);
    r(0, 15, 16, 1, PALETTE.stoneDark);
    r(11, 0, 1, 7, PALETTE.stoneDark);
    r(4, 8, 1, 7, PALETTE.stoneDark);
    r(2, 2, 3, 1, PALETTE.stoneLight);
    r(13, 12, 1, 1, PALETTE.stoneLight);
    r(6, 13, 2, 1, PALETTE.stoneDark);
  });

  const stoneCurb = buildSprite(16, 16, (r) => {
    r(0, 0, 16, 16, PALETTE.stone);
    // Shoreline lakeside coping rim
    r(0, 0, 16, 2, PALETTE.stoneLight);
    r(0, 2, 16, 3, PALETTE.stoneCurb);
    r(0, 5, 16, 1, PALETTE.stoneDark);
    r(7, 0, 1, 5, PALETTE.stoneDark);
    r(15, 0, 1, 5, PALETTE.stoneDark);
    // Lower promenade joints
    r(0, 15, 16, 1, PALETTE.stoneDark);
    r(4, 6, 1, 9, PALETTE.stoneDark);
    r(12, 6, 1, 9, PALETTE.stoneDark);
  });

  const pierPlank = buildSprite(16, 16, (r) => {
    r(0, 0, 16, 16, PALETTE.woodMid);
    // Horizontal wooden planks
    r(0, 3, 16, 1, PALETTE.woodDark);
    r(0, 7, 16, 1, PALETTE.woodDark);
    r(0, 11, 16, 1, PALETTE.woodDark);
    r(0, 15, 16, 1, PALETTE.woodDark);
    // Grain highlights & plank nails
    r(1, 1, 11, 1, PALETTE.woodLight);
    r(4, 9, 10, 1, PALETTE.woodLight);
    r(2, 5, 1, 1, PALETTE.woodDark);
    r(13, 5, 1, 1, PALETTE.woodDark);
    r(2, 13, 1, 1, PALETTE.woodDark);
    r(13, 13, 1, 1, PALETTE.woodDark);
  });

  return { stoneA, stoneB, stoneCurb, pierPlank };
}

function createNagaMonument() {
  // 124x40 authentic Kwan Phayao "พญานาคเล่นน้ำ"
  // Twin pearl-white & gold Phaya Naga curving along flat shoreline facing inward
  // toward a golden miniature Phra That Jom Thong chedi (NO stairs).
  return buildSprite(124, 40, (r) => {
    // 1. Flat shoreline stone plinth (no stairs)
    r(8, 34, 108, 1, PALETTE.stoneLight);
    r(6, 35, 112, 3, PALETTE.stone);
    r(6, 38, 112, 2, PALETTE.stoneDark);
    for (const sx of [22, 42, 62, 82, 102]) {
      r(sx, 35, 1, 3, PALETTE.stoneDark);
    }
    // Gentle shoreline water ripples below plinth
    r(14, 39, 12, 1, PALETTE.lakeShimmer);
    r(98, 39, 12, 1, PALETTE.lakeShimmer);

    // 2. Central Golden Miniature Chedi (พระธาตุจอมทองจำลอง) centered at x=62
    r(52, 31, 20, 3, PALETTE.goldDark);
    r(53, 30, 18, 2, PALETTE.gold);
    r(54, 29, 16, 1, PALETTE.goldBright);

    r(55, 26, 14, 3, PALETTE.gold);
    r(56, 25, 12, 1, PALETTE.goldBright);

    // Bell-shaped dome (anda)
    r(57, 20, 10, 5, PALETTE.gold);
    r(58, 18, 8, 2, PALETTE.gold);
    r(58, 19, 3, 5, PALETTE.goldBright);
    r(64, 19, 3, 5, PALETTE.goldDark);

    // Harmika & ringed finial
    r(59, 15, 6, 3, PALETTE.goldBright);
    r(60, 14, 4, 1, PALETTE.goldDark);
    r(60, 11, 4, 3, PALETTE.gold);
    r(61, 7, 2, 4, PALETTE.goldBright);
    r(61, 4, 2, 3, PALETTE.gold);
    r(61, 3, 2, 1, PALETTE.candleCore);

    // 3. Twin symmetrical Phaya Naga curving inward toward the chedi
    const drawNagaSide = (mirror) => {
      const m = (x, y, w, h, color) => {
        const px = mirror ? 124 - x - w : x;
        r(px, y, w, h, color);
      };

      // Tail curl & golden tail fin on outer water side
      m(8, 24, 4, 3, PALETTE.gold);
      m(7, 23, 2, 2, PALETTE.goldBright);
      m(11, 27, 4, 4, PALETTE.nagaPearl);
      m(11, 30, 3, 2, PALETTE.nagaShade);

      // First low coil dipping along the water surface
      m(14, 30, 9, 4, PALETTE.nagaPearl);
      m(15, 32, 8, 2, PALETTE.nagaShade);
      m(16, 33, 6, 1, PALETTE.nagaDeep);
      // Water splash flecks ("เล่นน้ำ")
      m(15, 33, 2, 1, PALETTE.nagaPearl);
      m(21, 34, 3, 1, PALETTE.lakeShimmer);

      // Rising mid-body arch
      m(22, 25, 5, 6, PALETTE.nagaPearl);
      m(23, 27, 4, 4, PALETTE.nagaShade);
      m(25, 22, 7, 5, PALETTE.nagaPearl);
      m(26, 24, 5, 3, PALETTE.nagaShade);
      // Gold dorsal crest on arch
      m(24, 21, 6, 1, PALETTE.gold);
      m(26, 20, 3, 1, PALETTE.goldBright);

      // Second dip before upright neck
      m(31, 26, 7, 6, PALETTE.nagaPearl);
      m(32, 29, 6, 4, PALETTE.nagaShade);
      m(34, 32, 4, 2, PALETTE.nagaDeep);

      // Proud upright neck rising toward center chedi
      m(37, 17, 6, 15, PALETTE.nagaPearl);
      m(37, 18, 2, 12, PALETTE.nagaShade);
      // Golden chest collar scales facing inward
      m(41, 18, 2, 10, PALETTE.gold);
      m(42, 19, 1, 7, PALETTE.goldBright);
      // Golden dorsal mane along back of neck
      m(35, 17, 2, 7, PALETTE.gold);
      m(34, 18, 1, 4, PALETTE.goldBright);

      // Sculpted Phaya Naga Head facing inward
      m(38, 11, 8, 6, PALETTE.nagaPearl);
      m(43, 13, 6, 3, PALETTE.nagaPearl);
      m(43, 15, 5, 2, PALETTE.nagaShade);
      // Snout highlight & subtle golden fang/whisker
      m(47, 13, 2, 1, PALETTE.nagaPearl);
      m(47, 16, 1, 1, PALETTE.goldBright);
      // Warm amber eye
      m(44, 13, 1, 1, PALETTE.candle);
      // Golden kanok crown & flame crest
      m(37, 9, 6, 2, PALETTE.gold);
      m(35, 7, 4, 3, PALETTE.goldBright);
      m(34, 6, 2, 2, PALETTE.gold);
      m(40, 7, 2, 2, PALETTE.goldBright);
    };

    drawNagaSide(false);
    drawNagaSide(true);
  });
}

function createProps() {
  const nagaMonument = createNagaMonument();

  // 48x16 two-seat lakeside wooden bench
  const bench = buildSprite(48, 16, (r) => {
    // Shadow / legs
    r(3, 11, 3, 5, PALETTE.woodDark);
    r(22, 11, 4, 5, PALETTE.woodDark);
    r(42, 11, 3, 5, PALETTE.woodDark);
    // Backrest posts & slats
    r(3, 2, 2, 6, PALETTE.woodDark);
    r(23, 2, 2, 6, PALETTE.woodDark);
    r(43, 2, 2, 6, PALETTE.woodDark);
    r(2, 2, 44, 2, PALETTE.woodLight);
    r(2, 4, 44, 1, PALETTE.woodDark);
    r(2, 5, 44, 2, PALETTE.woodMid);
    // Seat planks
    r(1, 8, 46, 3, PALETTE.woodLight);
    r(1, 10, 46, 2, PALETTE.woodMid);
    r(1, 12, 46, 1, PALETTE.woodDark);
    // Armrests & center divider
    r(1, 7, 3, 4, PALETTE.woodDark);
    r(23, 7, 2, 4, PALETTE.woodDark);
    r(44, 7, 3, 4, PALETTE.woodDark);
  });

  // 92x56 cozy Lanna flower / krathong pavilion with warm roof glow
  const pavilion = buildSprite(92, 56, (r) => {
    // Base stone plinth
    r(14, 49, 64, 2, PALETTE.stoneLight);
    r(13, 51, 66, 4, PALETTE.stone);
    r(13, 54, 66, 2, PALETTE.stoneDark);

    // Timber corner posts
    r(18, 25, 4, 24, PALETTE.woodMid);
    r(18, 25, 1, 24, PALETTE.woodDark);
    r(70, 25, 4, 24, PALETTE.woodMid);
    r(73, 25, 1, 24, PALETTE.woodDark);

    // Warm interior back wall / glow behind counter
    r(22, 26, 48, 12, PALETTE.skyTop);
    r(24, 26, 44, 7, '#2d2324');

    // Cozy krathong display counter
    r(22, 39, 48, 10, PALETTE.woodMid);
    r(22, 38, 48, 2, PALETTE.woodLight);
    r(22, 47, 48, 2, PALETTE.woodDark);
    // Krathong blossom trays on counter (marigold, lotus, jasmine)
    r(26, 35, 7, 3, PALETTE.leafGreen);
    r(27, 34, 5, 2, PALETTE.marigold);
    r(36, 35, 7, 3, PALETTE.leafGreen);
    r(37, 34, 5, 2, PALETTE.lotus);
    r(49, 35, 7, 3, PALETTE.leafGreen);
    r(50, 34, 5, 2, PALETTE.jasmine);
    // Warm candle pot in center of counter
    r(44, 36, 3, 2, PALETTE.goldDark);
    r(45, 34, 1, 2, PALETTE.candle);
    r(45, 33, 1, 1, PALETTE.candleCore);

    // Tiered Lanna gabled roof
    r(20, 6, 52, 4, PALETTE.stoneDark);
    r(14, 10, 64, 5, PALETTE.woodDark);
    r(9, 15, 74, 5, PALETTE.stoneDark);
    r(4, 20, 84, 4, PALETTE.woodDark);
    // Shingle highlight stripes
    r(21, 7, 50, 1, PALETTE.stone);
    r(15, 11, 62, 1, PALETTE.woodMid);
    r(10, 16, 72, 1, PALETTE.stone);
    r(5, 21, 82, 1, PALETTE.woodMid);

    // Golden Lanna roof ridge & crossed kalae finials
    r(45, 2, 2, 4, PALETTE.goldBright);
    r(18, 3, 2, 4, PALETTE.gold);
    r(16, 2, 2, 2, PALETTE.goldBright);
    r(72, 3, 2, 4, PALETTE.gold);
    r(74, 2, 2, 2, PALETTE.goldBright);
    // Warm golden eave trim
    r(4, 24, 84, 2, PALETTE.gold);
    r(6, 25, 80, 1, PALETTE.candleWarm);

    // Hanging glowing khom lanterns under the eaves
    for (const lx of [14, 34, 56, 76]) {
      r(lx + 1, 25, 1, 2, PALETTE.woodDark);
      r(lx, 27, 3, 4, PALETTE.candleWarm);
      r(lx + 1, 28, 1, 2, PALETTE.candleCore);
    }

    // Golden shop signboard plaque ("ร้านกระทง") above counter
    r(40, 25, 1, 1, PALETTE.woodDark);
    r(51, 25, 1, 1, PALETTE.woodDark);
    r(38, 26, 16, 6, PALETTE.gold);
    r(38, 31, 16, 1, PALETTE.goldDark);
    r(39, 27, 14, 4, PALETTE.woodDark);
    r(40, 28, 2, 2, PALETTE.goldBright);
    r(41, 27, 1, 1, PALETTE.candleCore);
    r(43, 28, 2, 2, PALETTE.goldBright);
    r(46, 28, 2, 2, PALETTE.candleCore);
    r(49, 28, 3, 2, PALETTE.goldBright);
    r(50, 27, 1, 1, PALETTE.candleCore);
  });

  // 16x38 wooden post with hanging glowing khom yee peng
  const lanternPost = buildSprite(16, 38, (r) => {
    // Base stone socket
    r(5, 34, 6, 4, PALETTE.stone);
    r(5, 37, 6, 1, PALETTE.stoneDark);
    r(6, 33, 4, 1, PALETTE.stoneLight);
    // Wooden post & top bracket
    r(7, 6, 2, 28, PALETTE.woodMid);
    r(8, 6, 1, 28, PALETTE.woodDark);
    r(6, 5, 4, 1, PALETTE.woodLight);
    r(8, 8, 5, 2, PALETTE.woodLight);
    r(12, 10, 1, 2, PALETTE.woodDark);
    // Glowing khom yee peng lantern
    r(10, 11, 5, 1, PALETTE.gold);
    r(9, 12, 7, 6, PALETTE.candleWarm);
    r(10, 13, 5, 4, PALETTE.candle);
    r(11, 14, 3, 2, PALETTE.candleCore);
    r(10, 18, 5, 1, PALETTE.gold);
    // Dangling tassel
    r(12, 19, 1, 2, PALETTE.candleWarm);
  });

  // 24x16 shoreline bushes
  const bushA = buildSprite(24, 16, (r) => {
    r(2, 9, 20, 6, PALETTE.foliageDark);
    r(4, 5, 16, 8, PALETTE.foliage);
    r(7, 3, 10, 5, PALETTE.foliage);
    r(6, 4, 5, 2, PALETTE.foliageLight);
    r(13, 6, 5, 2, PALETTE.foliageLight);
    r(4, 9, 4, 2, PALETTE.foliageLight);
  });

  const bushB = buildSprite(24, 16, (r) => {
    r(1, 8, 22, 7, PALETTE.foliageDark);
    r(3, 4, 17, 9, PALETTE.foliage);
    r(8, 2, 9, 5, PALETTE.foliage);
    r(9, 3, 5, 2, PALETTE.foliageLight);
    r(4, 6, 4, 2, PALETTE.foliageLight);
    r(15, 7, 4, 2, PALETTE.foliageLight);
    // Subtle night blossoms
    r(6, 8, 1, 1, PALETTE.candle);
    r(12, 5, 1, 1, PALETTE.lotusBright);
    r(17, 9, 1, 1, PALETTE.candle);
  });

  // 44x24 tiny glowing island stupa silhouette for distant lake (Wat Tilok Aram)
  const watTilokAram = buildSprite(44, 24, (r) => {
    // Low dark island landmass & distant tree silhouettes
    r(3, 18, 38, 4, PALETTE.foliageDark);
    r(6, 15, 9, 4, PALETTE.foliageDark);
    r(29, 15, 9, 4, PALETTE.foliageDark);
    r(9, 14, 4, 2, PALETTE.foliage);
    r(31, 14, 4, 2, PALETTE.foliage);

    // Distant Wat Tilok Aram chedi silhouette with warm gold candlelight glint
    r(17, 15, 10, 4, PALETTE.stoneDark);
    r(18, 11, 8, 4, PALETTE.skyHorizon);
    r(19, 8, 6, 3, PALETTE.stoneDark);
    r(21, 3, 2, 5, PALETTE.goldDark);
    r(21, 2, 2, 1, PALETTE.candle);

    // Subtle candlelight reflections on island shore & water
    r(18, 17, 1, 1, PALETTE.candle);
    r(22, 17, 1, 1, PALETTE.candleCore);
    r(25, 17, 1, 1, PALETTE.candleWarm);
    r(10, 22, 24, 1, PALETTE.lakeShimmer);
    r(21, 22, 2, 1, PALETTE.goldDark);
  });

  // 20x22 far-left vintage wood-and-brass music box on cozy pedestal
  const drawMusicBoxSprite = (isOpen) =>
    buildSprite(20, 22, (r) => {
      // Cozy dark-wood pedestal / table (y=11..21)
      r(3, 19, 14, 2, PALETTE.stoneDark);
      r(4, 13, 2, 7, PALETTE.woodDark);
      r(14, 13, 2, 7, PALETTE.woodDark);
      r(6, 13, 8, 5, PALETTE.woodMid);
      r(7, 14, 6, 3, PALETTE.woodDark);
      r(2, 11, 16, 2, PALETTE.woodLight);
      r(3, 12, 14, 1, PALETTE.woodDark);

      // Mahogany & brass music box casing (y=5..11)
      r(4, 6, 12, 5, PALETTE.woodDark);
      r(5, 7, 10, 3, PALETTE.cardiganTerracotta);
      r(4, 10, 12, 1, PALETTE.goldDark);
      // Brass clasp on front
      r(9, 7, 2, 2, PALETTE.goldBright);
      // Winding key on right side
      r(16, 8, 2, 1, PALETTE.gold);
      r(17, 7, 1, 3, PALETTE.goldBright);

      if (isOpen) {
        // Open tilted lid (y=1..6) revealing golden brass cylinder & glow
        r(4, 1, 12, 3, PALETTE.woodDark);
        r(5, 2, 10, 1, PALETTE.woodLight);
        r(5, 4, 10, 2, PALETTE.candleCore);
        r(6, 5, 8, 2, PALETTE.goldBright);
        r(7, 5, 2, 1, PALETTE.candle);
        r(10, 5, 3, 1, PALETTE.gold);
      } else {
        // Closed lid
        r(4, 5, 12, 2, PALETTE.woodLight);
        r(5, 5, 10, 1, PALETTE.gold);
      }
    });

  const musicBox = drawMusicBoxSprite(false);
  const musicBoxOpen = drawMusicBoxSprite(true);

  return {
    nagaMonument,
    bench,
    pavilion,
    lanternPost,
    bushA,
    bushB,
    watTilokAram,
    musicBox,
    musicBoxOpen,
  };
}

function drawPersonSprite(charId, dir, frame, isSitting) {
  const isHim = charId === 'him';
  const yBob = !isSitting && frame === 1 ? -1 : 0;

  return buildSprite(16, 24, (r) => {
    const yOff = (isSitting ? 2 : 0) + yBob;

    // 1. Bare Legs, White Student Socks & Black Student Shoes
    if (isSitting) {
      // Tucked seated legs facing 'up' on the bench
      r(5, 19 + yOff, 2, 1, PALETTE.skin);
      r(9, 19 + yOff, 2, 1, PALETTE.skin);
      r(5, 20 + yOff, 2, 1, PALETTE.sockWhite);
      r(9, 20 + yOff, 2, 1, PALETTE.sockWhite);
      r(5, 21 + yOff, 2, 1, PALETTE.shoeDark);
      r(9, 21 + yOff, 2, 1, PALETTE.shoeDark);
    } else if (dir === 'left') {
      if (frame === 1) {
        // Front leg planted forward, back leg lifted in stride
        r(5, 20 + yOff, 2, 2, PALETTE.skin);
        r(5, 22 + yOff, 2, 1, PALETTE.sockWhite);
        r(5, 23 + yOff, 2, 2, PALETTE.shoeDark);
        r(4, 24 + yOff, 1, 1, PALETTE.shoeDark);

        r(9, 20 + yOff, 2, 1, PALETTE.skinShade);
        r(9, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(9, 22 + yOff, 2, 2, PALETTE.shoeDark);
      } else {
        // Standing side profile
        r(6, 20 + yOff, 2, 1, PALETTE.skin);
        r(8, 20 + yOff, 2, 1, PALETTE.skinShade);
        r(6, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(8, 21 + yOff, 2, 1, PALETTE.shirtShade);
        r(6, 22 + yOff, 2, 2, PALETTE.shoeDark);
        r(8, 22 + yOff, 2, 2, PALETTE.shoeDark);
        r(5, 23 + yOff, 1, 1, PALETTE.shoeDark);
      }
    } else if (dir === 'right') {
      if (frame === 1) {
        // Exact horizontal mirror of 'left' stride
        r(9, 20 + yOff, 2, 2, PALETTE.skin);
        r(9, 22 + yOff, 2, 1, PALETTE.sockWhite);
        r(9, 23 + yOff, 2, 2, PALETTE.shoeDark);
        r(11, 24 + yOff, 1, 1, PALETTE.shoeDark);

        r(5, 20 + yOff, 2, 1, PALETTE.skinShade);
        r(5, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(5, 22 + yOff, 2, 2, PALETTE.shoeDark);
      } else {
        // Exact horizontal mirror of 'left' standing
        r(8, 20 + yOff, 2, 1, PALETTE.skin);
        r(6, 20 + yOff, 2, 1, PALETTE.skinShade);
        r(8, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(6, 21 + yOff, 2, 1, PALETTE.shirtShade);
        r(8, 22 + yOff, 2, 2, PALETTE.shoeDark);
        r(6, 22 + yOff, 2, 2, PALETTE.shoeDark);
        r(10, 23 + yOff, 1, 1, PALETTE.shoeDark);
      }
    } else {
      // 'down' or 'up'
      if (frame === 1) {
        // Left foot lifted, right foot planted (yOff = -1)
        r(5, 20 + yOff, 2, 1, PALETTE.skin);
        r(5, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(5, 22 + yOff, 2, 2, PALETTE.shoeDark);

        r(9, 20 + yOff, 2, 2, PALETTE.skin);
        r(9, 22 + yOff, 2, 1, PALETTE.sockWhite);
        r(9, 23 + yOff, 2, 2, PALETTE.shoeDark);
      } else {
        // Symmetric standing idle
        r(5, 20 + yOff, 2, 1, PALETTE.skin);
        r(9, 20 + yOff, 2, 1, PALETTE.skin);
        r(5, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(9, 21 + yOff, 2, 1, PALETTE.sockWhite);
        r(5, 22 + yOff, 2, 2, PALETTE.shoeDark);
        r(9, 22 + yOff, 2, 2, PALETTE.shoeDark);
      }
    }

    // 2. Torso & Outfit (Thai Student Uniforms)
    if (isHim) {
      // Crisp white short-sleeve student shirt (x=4..11, y=12..15)
      r(4, 12 + yOff, 8, 4, PALETTE.shirtWhite);
      r(4, 15 + yOff, 8, 1, PALETTE.shirtShade);

      // Dark belt + gold buckle (y=16)
      r(4, 16 + yOff, 8, 1, PALETTE.beltDark);

      // Dark navy student shorts (x=4..11, y=17..19)
      if (isSitting) {
        r(4, 17 + yOff, 8, 2, PALETTE.uniformNavy);
        r(7, 18 + yOff, 2, 1, PALETTE.uniformNavyDark);
      } else if (dir === 'left' || dir === 'right') {
        r(4, 17 + yOff, 8, 3, PALETTE.uniformNavy);
        r(4, 19 + yOff, 8, 1, PALETTE.uniformNavyDark);
        r(7, 18 + yOff, 2, 2, PALETTE.uniformNavyDark);
      } else {
        r(4, 17 + yOff, 8, 2, PALETTE.uniformNavy);
        r(7, 18 + yOff, 2, 1, PALETTE.uniformNavyDark);
        r(4, 19 + yOff, 3, 1, PALETTE.uniformNavyDark);
        r(9, 19 + yOff, 3, 1, PALETTE.uniformNavyDark);
      }

      if (dir === 'left' || dir === 'right') {
        const isLeft = dir === 'left';
        r(isLeft ? 11 : 4, 12 + yOff, 1, 4, PALETTE.shirtShade);
        r(isLeft ? 5 : 10, 12 + yOff, 1, 1, PALETTE.shirtShade);
        r(isLeft ? 4 : 11, 16 + yOff, 1, 1, PALETTE.gold);

        // Chest pocket & tiny penguin pin accent
        r(isLeft ? 4 : 10, 15 + yOff, 2, 1, PALETTE.shirtShade);
        r(isLeft ? 5 : 10, 14 + yOff, 1, 1, PALETTE.uniformNavyDark);
        r(isLeft ? 4 : 11, 14 + yOff, 1, 1, PALETTE.penguinBeak);

        // Side short sleeve + bare skin arm
        const armX = isLeft ? (frame === 1 ? 6 : 7) : (frame === 1 ? 8 : 7);
        r(armX, 12 + yOff, 2, 2, PALETTE.shirtWhite);
        r(armX, 13 + yOff, 2, 1, PALETTE.shirtShade);
        r(isLeft ? armX + 2 : armX - 1, 12 + yOff, 1, 2, PALETTE.shirtShade);
        r(armX, 14 + yOff, 2, 3, PALETTE.skin);
      } else {
        r(4, 12 + yOff, 1, 4, PALETTE.shirtShade);
        r(11, 12 + yOff, 1, 4, PALETTE.shirtShade);

        if (dir === 'down' && !isSitting) {
          // Open collar V & gold belt buckle
          r(7, 12 + yOff, 2, 1, PALETTE.skin);
          r(6, 12 + yOff, 1, 1, PALETTE.shirtShade);
          r(9, 12 + yOff, 1, 1, PALETTE.shirtShade);
          r(7, 16 + yOff, 2, 1, PALETTE.gold);
          // Chest pocket & tiny penguin pin accent (x=9..10, y=14)
          r(9, 15 + yOff, 2, 1, PALETTE.shirtShade);
          r(9, 14 + yOff, 1, 1, PALETTE.uniformNavyDark);
          r(10, 14 + yOff, 1, 1, PALETTE.penguinBeak);
        } else {
          // Crisp white shirt collar visible from behind
          r(6, 12 + yOff, 4, 1, PALETTE.shirtWhite);
          r(6, 13 + yOff, 4, 1, PALETTE.shirtShade);
        }

        // Short white sleeves + skin arms (x=3 & x=12)
        const leftArmShift = !isSitting && frame === 1 ? 1 : 0;
        r(3, 12 + yOff + leftArmShift, 1, 2, PALETTE.shirtWhite);
        r(3, 13 + yOff + leftArmShift, 1, 1, PALETTE.shirtShade);
        r(3, 14 + yOff + leftArmShift, 1, 3, PALETTE.skin);

        r(12, 12 + yOff, 1, 2, PALETTE.shirtWhite);
        r(12, 13 + yOff, 1, 1, PALETTE.shirtShade);
        r(12, 14 + yOff, 1, 3, PALETTE.skin);
      }
    } else {
      // Crisp white student blouse (x=4..11, y=12..15)
      r(4, 12 + yOff, 8, 4, PALETTE.shirtWhite);
      r(4, 15 + yOff, 8, 1, PALETTE.shirtShade);

      // Navy pleated student skirt (x=4..11, y=16..19)
      if (isSitting) {
        r(4, 16 + yOff, 8, 3, PALETTE.uniformNavy);
        r(4, 16 + yOff, 8, 1, PALETTE.uniformNavyDark);
        r(6, 17 + yOff, 1, 2, PALETTE.uniformNavyDark);
        r(9, 17 + yOff, 1, 2, PALETTE.uniformNavyDark);
      } else {
        r(4, 16 + yOff, 8, 4, PALETTE.uniformNavy);
        r(4, 16 + yOff, 8, 1, PALETTE.uniformNavyDark);
        if (dir === 'left') {
          r(6, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(9, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(11, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
        } else if (dir === 'right') {
          r(4, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(6, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(9, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
        } else {
          r(4, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(6, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(9, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
          r(11, 17 + yOff, 1, 3, PALETTE.uniformNavyDark);
        }
      }

      if (dir === 'left' || dir === 'right') {
        const isLeft = dir === 'left';
        r(isLeft ? 11 : 4, 12 + yOff, 1, 4, PALETTE.shirtShade);
        r(isLeft ? 5 : 10, 12 + yOff, 1, 1, PALETTE.shirtShade);
        // Subtle navy collar bow peek at front chest
        r(isLeft ? 4 : 11, 13 + yOff, 1, 1, PALETTE.ribbonNavy);

        // Side short sleeve + bare skin arm
        const armX = isLeft ? (frame === 1 ? 6 : 7) : (frame === 1 ? 8 : 7);
        r(armX, 12 + yOff, 2, 2, PALETTE.shirtWhite);
        r(armX, 13 + yOff, 2, 1, PALETTE.shirtShade);
        r(isLeft ? armX + 2 : armX - 1, 12 + yOff, 1, 2, PALETTE.shirtShade);
        r(armX, 14 + yOff, 2, 3, PALETTE.skin);
      } else {
        r(4, 12 + yOff, 1, 4, PALETTE.shirtShade);
        r(11, 12 + yOff, 1, 4, PALETTE.shirtShade);

        if (dir === 'down' && !isSitting) {
          // Collar & cute navy bow/ribbon at front chest (x=7..8, y=13)
          r(7, 12 + yOff, 2, 1, PALETTE.skin);
          r(6, 12 + yOff, 1, 1, PALETTE.shirtShade);
          r(9, 12 + yOff, 1, 1, PALETTE.shirtShade);
          r(7, 13 + yOff, 2, 1, PALETTE.ribbonNavy);
        } else {
          // Crisp white blouse collar visible under short bob
          r(5, 12 + yOff, 6, 1, PALETTE.shirtWhite);
          r(6, 13 + yOff, 4, 1, PALETTE.shirtShade);
        }

        // Short white sleeves + skin arms (x=3 & x=12)
        const leftArmShift = !isSitting && frame === 1 ? 1 : 0;
        r(3, 12 + yOff + leftArmShift, 1, 2, PALETTE.shirtWhite);
        r(3, 13 + yOff + leftArmShift, 1, 1, PALETTE.shirtShade);
        r(3, 14 + yOff + leftArmShift, 1, 3, PALETTE.skin);

        r(12, 12 + yOff, 1, 2, PALETTE.shirtWhite);
        r(12, 13 + yOff, 1, 1, PALETTE.shirtShade);
        r(12, 14 + yOff, 1, 3, PALETTE.skin);
      }
    }

    // 3. Head, Hair, Eyes & Accessories
    if (isHim) {
      if (dir === 'up' || isSitting) {
        r(6, 11 + yOff, 4, 1, PALETTE.skin);
        r(5, 2 + yOff, 5, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 8, PALETTE.hairDark);
        r(6, 4 + yOff, 4, 1, PALETTE.hairHighlight);
        r(3, 5 + yOff, 1, 3, PALETTE.hairDark);
        r(12, 5 + yOff, 1, 3, PALETTE.hairDark);
      } else if (dir === 'down') {
        r(5, 6 + yOff, 6, 6, PALETTE.skin);
        r(4, 6 + yOff, 1, 1, PALETTE.hairDark);
        r(11, 6 + yOff, 1, 1, PALETTE.hairDark);
        r(4, 7 + yOff, 1, 1, PALETTE.skinShade);
        r(11, 7 + yOff, 1, 1, PALETTE.skinShade);
        r(5, 2 + yOff, 5, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(6, 3 + yOff, 3, 1, PALETTE.hairHighlight);
        r(3, 5 + yOff, 1, 3, PALETTE.hairDark);
        r(12, 5 + yOff, 1, 3, PALETTE.hairDark);
        r(6, 8 + yOff, 1, 1, PALETTE.eyeDark);
        r(9, 8 + yOff, 1, 1, PALETTE.eyeDark);
      } else if (dir === 'left') {
        r(4, 6 + yOff, 4, 6, PALETTE.skin);
        r(8, 10 + yOff, 2, 1, PALETTE.skin);
        r(8, 11 + yOff, 1, 1, PALETTE.skinShade);
        r(5, 2 + yOff, 5, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(6, 3 + yOff, 3, 1, PALETTE.hairHighlight);
        r(8, 5 + yOff, 5, 5, PALETTE.hairDark);
        r(5, 8 + yOff, 1, 1, PALETTE.eyeDark);
      } else if (dir === 'right') {
        r(8, 6 + yOff, 4, 6, PALETTE.skin);
        r(6, 10 + yOff, 2, 1, PALETTE.skin);
        r(7, 11 + yOff, 1, 1, PALETTE.skinShade);
        r(6, 2 + yOff, 5, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(7, 3 + yOff, 3, 1, PALETTE.hairHighlight);
        r(3, 5 + yOff, 5, 5, PALETTE.hairDark);
        r(10, 8 + yOff, 1, 1, PALETTE.eyeDark);
      }
    } else {
      if (dir === 'up' || isSitting) {
        r(6, 11 + yOff, 4, 1, PALETTE.skin);
        r(5, 2 + yOff, 6, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 1, PALETTE.hairDark);
        r(3, 4 + yOff, 10, 7, PALETTE.hairDark);
        r(6, 4 + yOff, 4, 1, PALETTE.hairHighlight);
        r(10, 6 + yOff, 2, 1, PALETTE.amberClip);
      } else if (dir === 'down') {
        r(5, 6 + yOff, 6, 6, PALETTE.skin);
        r(5, 2 + yOff, 6, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(6, 3 + yOff, 4, 1, PALETTE.hairHighlight);
        r(5, 6 + yOff, 1, 1, PALETTE.hairDark);
        r(10, 6 + yOff, 1, 1, PALETTE.hairDark);
        r(3, 5 + yOff, 2, 6, PALETTE.hairDark);
        r(11, 5 + yOff, 2, 6, PALETTE.hairDark);
        r(10, 5 + yOff, 2, 1, PALETTE.amberClip);
        r(6, 8 + yOff, 1, 1, PALETTE.eyeDark);
        r(9, 8 + yOff, 1, 1, PALETTE.eyeDark);
        r(5, 9 + yOff, 1, 1, PALETTE.blush);
        r(10, 9 + yOff, 1, 1, PALETTE.blush);
      } else if (dir === 'left') {
        r(4, 6 + yOff, 4, 6, PALETTE.skin);
        r(8, 11 + yOff, 1, 1, PALETTE.skinShade);
        r(5, 2 + yOff, 6, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(6, 3 + yOff, 4, 1, PALETTE.hairHighlight);
        r(8, 5 + yOff, 5, 6, PALETTE.hairDark);
        r(8, 6 + yOff, 2, 1, PALETTE.amberClip);
        r(5, 8 + yOff, 1, 1, PALETTE.eyeDark);
        r(6, 9 + yOff, 1, 1, PALETTE.blush);
      } else if (dir === 'right') {
        r(8, 6 + yOff, 4, 6, PALETTE.skin);
        r(7, 11 + yOff, 1, 1, PALETTE.skinShade);
        r(5, 2 + yOff, 6, 1, PALETTE.hairDark);
        r(4, 3 + yOff, 8, 3, PALETTE.hairDark);
        r(6, 3 + yOff, 4, 1, PALETTE.hairHighlight);
        r(3, 5 + yOff, 5, 6, PALETTE.hairDark);
        r(6, 6 + yOff, 2, 1, PALETTE.amberClip);
        r(10, 8 + yOff, 1, 1, PALETTE.eyeDark);
        r(9, 9 + yOff, 1, 1, PALETTE.blush);
      }
    }
  });
}

function createCharacters() {
  const dirs = ['down', 'up', 'left', 'right'];
  const buildSet = (charId) => {
    const out = {};
    for (const dir of dirs) {
      out[dir] = [
        drawPersonSprite(charId, dir, 0, false),
        drawPersonSprite(charId, dir, 1, false),
      ];
    }
    out.sit = drawPersonSprite(charId, 'up', 0, true);
    return out;
  };
  return {
    him: buildSet('him'),
    her: buildSet('her'),
  };
}

function createKrathongs() {
  const styles = {
    marigold: { base: PALETTE.marigold, bright: PALETTE.marigoldBright },
    lotus: { base: PALETTE.lotus, bright: PALETTE.lotusBright },
    jasmine: { base: PALETTE.jasmineShade, bright: PALETTE.jasmine },
  };

  const out = {};
  for (const [name, colors] of Object.entries(styles)) {
    out[name] = [0, 1].map((frame) =>
      buildSprite(14, 12, (r) => {
        // Banana-leaf base
        r(2, 8, 10, 3, PALETTE.foliage);
        r(3, 7, 8, 2, PALETTE.leafGreen);
        // Flower petals ring
        r(3, 6, 8, 2, colors.base);
        r(4, 5, 6, 2, colors.bright);
        r(2, 7, 2, 1, colors.bright);
        r(10, 7, 2, 1, colors.bright);
        // Beeswax candle
        r(6, 3, 2, 3, PALETTE.moon);
        // 2-frame flickering candle flame
        if (frame === 0) {
          r(6, 1, 2, 2, PALETTE.candle);
          r(6, 1, 1, 1, PALETTE.candleCore);
        } else {
          r(6, 0, 2, 3, PALETTE.candleWarm);
          r(7, 1, 1, 2, PALETTE.candleCore);
        }
      })
    );
  }
  return out;
}

function createSkyLantern() {
  return [0, 1].map((frame) =>
    buildSprite(10, 14, (r) => {
      // Tapered khom loi paper dome
      r(3, 1, 4, 1, PALETTE.candleWarm);
      r(2, 2, 6, 2, PALETTE.candleWarm);
      r(1, 4, 8, 5, PALETTE.lanternPaper);
      r(2, 4, 6, 4, frame === 0 ? PALETTE.lanternRim : PALETTE.candle);
      r(2, 9, 6, 2, PALETTE.candleWarm);
      // Burner wire & bright flame core
      r(3, 11, 4, 1, PALETTE.woodDark);
      r(4, 9, 2, 2, PALETTE.candleCore);
      if (frame === 1) {
        r(4, 8, 2, 1, PALETTE.candleCore);
      }
    })
  );
}

function createEmotes() {
  const drawBubble = (r) => {
    r(2, 0, 10, 1, PALETTE.stoneDark);
    r(1, 1, 12, 9, PALETTE.stoneDark);
    r(2, 1, 10, 9, PALETTE.candleCore);
    r(2, 9, 10, 1, PALETTE.moonGlow);
    r(2, 10, 10, 1, PALETTE.stoneDark);
    // Speech pointer
    r(5, 11, 4, 1, PALETTE.stoneDark);
    r(6, 10, 2, 2, PALETTE.candleCore);
    r(6, 12, 2, 1, PALETTE.stoneDark);
  };

  const heart = buildSprite(14, 14, (r) => {
    drawBubble(r);
    r(4, 3, 2, 2, PALETTE.heartRed);
    r(8, 3, 2, 2, PALETTE.heartRed);
    r(3, 4, 8, 2, PALETTE.heartRed);
    r(4, 6, 6, 1, PALETTE.heartRed);
    r(5, 7, 4, 1, PALETTE.heartRed);
    r(6, 8, 2, 1, PALETTE.heartRed);
    r(4, 4, 1, 1, PALETTE.candleCore);
  });

  const lantern = buildSprite(14, 14, (r) => {
    drawBubble(r);
    r(5, 2, 4, 1, PALETTE.goldDark);
    r(4, 3, 6, 5, PALETTE.candleWarm);
    r(5, 4, 4, 3, PALETTE.candle);
    r(6, 5, 2, 2, PALETTE.candleCore);
    r(5, 8, 4, 1, PALETTE.goldDark);
  });

  const sparkle = buildSprite(14, 14, (r) => {
    drawBubble(r);
    r(6, 2, 2, 7, PALETTE.candle);
    r(3, 5, 8, 1, PALETTE.candle);
    r(5, 4, 4, 3, PALETTE.goldBright);
    r(6, 5, 2, 1, PALETTE.candleCore);
    r(3, 3, 1, 1, PALETTE.gold);
    r(10, 7, 1, 1, PALETTE.gold);
  });

  const wave = buildSprite(14, 14, (r) => {
    drawBubble(r);
    // Cheerful waving hand
    r(5, 4, 1, 3, PALETTE.skinShade);
    r(6, 3, 1, 4, PALETTE.skin);
    r(7, 3, 1, 4, PALETTE.skinShade);
    r(8, 4, 1, 3, PALETTE.skin);
    r(4, 6, 5, 3, PALETTE.skin);
    r(5, 8, 3, 1, PALETTE.skinShade);
    // Motion ticks
    r(3, 3, 1, 2, PALETTE.candle);
    r(10, 3, 1, 2, PALETTE.candle);
  });

  return { heart, lantern, sparkle, wave };
}

function createLightPool() {
  // 64x48 pixel-dithered warm radial light pool canvas
  const w = 64;
  const h = 48;
  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  return buildSprite(w, h, (r) => {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / (w / 2);
        const dy = (y - cy) / (h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist >= 1) continue;

        const intensity = Math.pow(1 - dist, 1.45);
        const threshold = (bayer4[y & 3][x & 3] + 0.5) / 16;
        if (intensity > threshold * 0.85) {
          if (dist < 0.35) {
            r(x, y, 1, 1, 'rgba(255, 224, 148, 0.32)');
          } else if (dist < 0.68) {
            r(x, y, 1, 1, 'rgba(255, 183, 77, 0.22)');
          } else {
            r(x, y, 1, 1, 'rgba(255, 138, 101, 0.14)');
          }
        }
      }
    }
  });
}

export function createSprites() {
  return {
    tiles: createTiles(),
    props: createProps(),
    characters: createCharacters(),
    krathongs: createKrathongs(),
    skyLantern: createSkyLantern(),
    emotes: createEmotes(),
    lightPool: createLightPool(),
  };
}

export function drawCharacterPreview(canvas, charId, sprites) {
  if (!canvas || !sprites?.characters?.[charId]?.down?.[0]) return;
  const sprite = sprites.characters[charId].down[0];
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cw = canvas.width || 48;
  const ch = canvas.height || 64;
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;

  const scale = Math.max(
    1,
    Math.floor(Math.min(cw / sprite.width, ch / sprite.height))
  );
  const drawW = sprite.width * scale;
  const drawH = sprite.height * scale;
  const dx = Math.floor((cw - drawW) / 2);
  const dy = Math.floor((ch - drawH) / 2);

  ctx.drawImage(sprite, dx, dy, drawW, drawH);
}
