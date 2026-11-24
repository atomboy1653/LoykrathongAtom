/**
 * Kwan Phayao Yi Peng - Procedural Web Audio Soundscape
 * Muted by default; initializes lazily on user unmute gesture.
 * Never throws when Web Audio API is unavailable.
 */

const LANNA_PENTATONIC_HZ = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];

// Pachelbel's Canon in D (~66 BPM eighth-note pulse)
const CANON_STEP_MS = 455;
const CANON_BASS_HZ = [293.66, 220.0, 246.94, 185.0, 196.0, 293.66, 196.0, 220.0];
const CANON_MELODY_HZ = [
  // Section A: iconic slow descending theme
  739.99, 0, 659.25, 0, 587.33, 0, 554.37, 0,
  493.88, 0, 440.0, 0, 493.88, 0, 554.37, 0,
  // Section B: flowing Canon variation
  587.33, 739.99, 880.0, 783.99, 739.99, 587.33, 739.99, 659.25,
  587.33, 493.88, 587.33, 880.0, 783.99, 987.77, 880.0, 783.99,
  // Section C: lyrical resolution
  739.99, 587.33, 659.25, 554.37, 587.33, 739.99, 880.0, 440.0,
  493.88, 783.99, 739.99, 659.25, 587.33, 554.37, 587.33, 659.25,
];

export function createAudioEngine() {
  let muted = true;
  let ctx = null;
  let masterGain = null;
  let ambientStarted = false;
  let waterSource = null;
  let waterLfo = null;
  let waterSwellLfo = null;
  let cricketTimer = null;
  let pluckTimer = null;
  let musicBoxPlaying = false;
  let musicBoxTimer = null;
  let musicBoxStep = 0;

  function getAudioContextCtor() {
    if (typeof window !== 'undefined') {
      return window.AudioContext || window.webkitAudioContext || null;
    }
    if (typeof globalThis !== 'undefined') {
      return globalThis.AudioContext || globalThis.webkitAudioContext || null;
    }
    return null;
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) return null;

    try {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      return ctx;
    } catch {
      ctx = null;
      masterGain = null;
      return null;
    }
  }

  function startWaterAmbience() {
    if (!ctx || !masterGain || ambientStarted) return;
    ambientStarted = true;

    try {
      // Soft brown-filtered noise loop for calm Kwan Phayao lake lapping
      const sampleRate = ctx.sampleRate || 44100;
      const length = sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.03 * white) / 1.03;
        data[i] = last * 2.4;
      }

      waterSource = ctx.createBufferSource();
      waterSource.buffer = buffer;
      waterSource.loop = true;

      const waterFilter = ctx.createBiquadFilter();
      waterFilter.type = 'lowpass';
      waterFilter.frequency.setValueAtTime(300, ctx.currentTime);
      waterFilter.Q.setValueAtTime(1.2, ctx.currentTime);

      const waterGain = ctx.createGain();
      waterGain.gain.setValueAtTime(0.065, ctx.currentTime);

      // Slow wave LFO modulating water cutoff frequency
      waterLfo = ctx.createOscillator();
      waterLfo.type = 'sine';
      waterLfo.frequency.setValueAtTime(0.14, ctx.currentTime);
      const filterModGain = ctx.createGain();
      filterModGain.gain.setValueAtTime(135, ctx.currentTime);
      waterLfo.connect(filterModGain);
      filterModGain.connect(waterFilter.frequency);

      // Gentle amplitude swell LFO
      waterSwellLfo = ctx.createOscillator();
      waterSwellLfo.type = 'sine';
      waterSwellLfo.frequency.setValueAtTime(0.09, ctx.currentTime);
      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.02, ctx.currentTime);
      waterSwellLfo.connect(swellGain);
      swellGain.connect(waterGain.gain);

      waterSource.connect(waterFilter);
      waterFilter.connect(waterGain);
      waterGain.connect(masterGain);

      waterSource.start();
      waterLfo.start();
      waterSwellLfo.start();
    } catch {
      ambientStarted = false;
    }
  }

  function triggerCricketChirp() {
    if (!ctx || !masterGain || muted || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const baseFreq = 3900 + Math.random() * 350;
      const pulseCount = 2 + (Math.random() > 0.45 ? 1 : 0);

      for (let i = 0; i < pulseCount; i++) {
        const start = now + i * 0.072;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq + i * 25, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.007, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(start + 0.055);
      }
    } catch {
      // Safe ignore
    }
  }

  function triggerLannaPluck() {
    if (!ctx || !masterGain || muted || musicBoxPlaying || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const freq =
        LANNA_PENTATONIC_HZ[Math.floor(Math.random() * LANNA_PENTATONIC_HZ.length)];

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, now);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.22, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1450, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 1.1);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);

      osc.connect(filter);
      overtone.connect(overtoneGain);
      overtoneGain.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 1.6);
      overtone.stop(now + 1.6);
    } catch {
      // Safe ignore
    }
  }

  function scheduleAmbientLoops() {
    clearAmbientTimers();
    if (muted) return;

    const queueCricket = () => {
      if (muted) return;
      cricketTimer = setTimeout(() => {
        triggerCricketChirp();
        queueCricket();
      }, 2200 + Math.random() * 2800);
    };

    const queuePluck = () => {
      if (muted) return;
      pluckTimer = setTimeout(() => {
        triggerLannaPluck();
        queuePluck();
      }, 4200 + Math.random() * 4800);
    };

    queueCricket();
    queuePluck();
  }

  function clearAmbientTimers() {
    if (cricketTimer !== null) {
      clearTimeout(cricketTimer);
      cricketTimer = null;
    }
    if (pluckTimer !== null) {
      clearTimeout(pluckTimer);
      pluckTimer = null;
    }
  }

  function playChimeSequence(notes, stepSec, durationSec, peakGain) {
    if (muted) return;
    const activeCtx = ensureContext();
    if (!activeCtx || !masterGain) return;

    try {
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {});
      }
      const now = activeCtx.currentTime;
      notes.forEach((freq, idx) => {
        const start = now + idx * stepSec;
        const osc = activeCtx.createOscillator();
        const shimmer = activeCtx.createOscillator();
        const shimmerGain = activeCtx.createGain();
        const gain = activeCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(freq * 2, start);
        shimmerGain.gain.setValueAtTime(0.14, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

        osc.connect(gain);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(gain);
        gain.connect(masterGain);

        osc.start(start);
        shimmer.start(start);
        osc.stop(start + durationSec + 0.05);
        shimmer.stop(start + durationSec + 0.05);
      });
    } catch {
      // Safe ignore
    }
  }

  function playMusicBoxTine(freq, peakGain, decaySec = 1.45) {
    if (!ctx || !masterGain || muted || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const fundamental = ctx.createOscillator();
      const harmonic2 = ctx.createOscillator();
      const harmonic3 = ctx.createOscillator();

      const h2Gain = ctx.createGain();
      const h3Gain = ctx.createGain();
      const noteGain = ctx.createGain();

      fundamental.type = 'sine';
      fundamental.frequency.setValueAtTime(freq, now);

      harmonic2.type = 'sine';
      harmonic2.frequency.setValueAtTime(freq * 2, now);
      h2Gain.gain.setValueAtTime(0.18, now);

      harmonic3.type = 'sine';
      harmonic3.frequency.setValueAtTime(freq * 3, now);
      h3Gain.gain.setValueAtTime(0.06, now);
      h3Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.006);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

      fundamental.connect(noteGain);
      harmonic2.connect(h2Gain);
      h2Gain.connect(noteGain);
      harmonic3.connect(h3Gain);
      h3Gain.connect(noteGain);
      noteGain.connect(masterGain);

      fundamental.start(now);
      harmonic2.start(now);
      harmonic3.start(now);
      fundamental.stop(now + decaySec + 0.04);
      harmonic2.stop(now + decaySec + 0.04);
      harmonic3.stop(now + 0.22);
    } catch {
      // Safe ignore
    }
  }

  function scheduleMusicBoxStep() {
    if (!musicBoxPlaying || muted) return;

    const step = musicBoxStep;
    musicBoxStep = (musicBoxStep + 1) % CANON_MELODY_HZ.length;

    if (step % 2 === 0) {
      const bassIdx = Math.floor((step % 16) / 2);
      playMusicBoxTine(CANON_BASS_HZ[bassIdx], 0.042, 1.35);
    }
    const melFreq = CANON_MELODY_HZ[step];
    if (melFreq > 0) {
      playMusicBoxTine(melFreq, 0.056, 1.45);
    }

    musicBoxTimer = setTimeout(scheduleMusicBoxStep, CANON_STEP_MS);
  }

  function stopMusicBox() {
    musicBoxPlaying = false;
    if (musicBoxTimer !== null) {
      clearTimeout(musicBoxTimer);
      musicBoxTimer = null;
    }
  }

  function startMusicBox() {
    if (muted) {
      setMuted(false);
    }
    stopMusicBox();
    const activeCtx = ensureContext();
    if (activeCtx && activeCtx.state === 'suspended') {
      activeCtx.resume().catch(() => {});
    }
    musicBoxStep = 0;
    musicBoxPlaying = true;
    scheduleMusicBoxStep();
    return musicBoxPlaying;
  }

  function toggleMusicBox() {
    if (musicBoxPlaying) {
      stopMusicBox();
      return false;
    }
    return startMusicBox();
  }

  function isMusicBoxPlaying() {
    return musicBoxPlaying;
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);

    if (muted) {
      stopMusicBox();
      clearAmbientTimers();
      if (ctx && masterGain) {
        try {
          const now = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setTargetAtTime(0, now, 0.08);
        } catch {
          // Safe ignore
        }
      }
      return muted;
    }

    const activeCtx = ensureContext();
    if (!activeCtx || !masterGain) {
      return muted;
    }

    try {
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {});
      }
      startWaterAmbience();
      const now = activeCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(0.65, now, 0.25);
      scheduleAmbientLoops();
    } catch {
      // Safe ignore
    }

    return muted;
  }

  function toggleMute() {
    return setMuted(!muted);
  }

  function isMuted() {
    return muted;
  }

  function playKrathongChime() {
    playChimeSequence([587.33, 783.99, 880.0, 1046.5], 0.095, 1.15, 0.075);
  }

  function playLanternChime() {
    playChimeSequence([440.0, 587.33, 659.25, 880.0], 0.11, 1.35, 0.068);
  }

  function playEmotePop() {
    if (muted) return;
    const activeCtx = ensureContext();
    if (!activeCtx || !masterGain) return;

    try {
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {});
      }
      const now = activeCtx.currentTime;
      const osc = activeCtx.createOscillator();
      const gain = activeCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.055);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Safe ignore
    }
  }

  function playCameraShutter() {
    if (muted) return;
    const activeCtx = ensureContext();
    if (!activeCtx || !masterGain) return;

    try {
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {});
      }
      const now = activeCtx.currentTime;
      // 2-stage mechanical shutter click
      [0, 0.062].forEach((offset, stage) => {
        const osc = activeCtx.createOscillator();
        const gain = activeCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(stage === 0 ? 1150 : 880, now + offset);
        osc.frequency.exponentialRampToValueAtTime(220, now + offset + 0.032);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.linearRampToValueAtTime(stage === 0 ? 0.06 : 0.045, now + offset + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.036);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.04);
      });

      // Gentle warm confirmation note
      const bell = activeCtx.createOscillator();
      const bellGain = activeCtx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(880, now + 0.09);
      bellGain.gain.setValueAtTime(0.0001, now + 0.09);
      bellGain.gain.linearRampToValueAtTime(0.035, now + 0.105);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      bell.connect(bellGain);
      bellGain.connect(masterGain);
      bell.start(now + 0.09);
      bell.stop(now + 0.58);
    } catch {
      // Safe ignore
    }
  }

  function unlock() {
    const activeCtx = ensureContext();
    if (!activeCtx) return false;
    try {
      if (activeCtx.state === 'suspended') {
        activeCtx.resume().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  return {
    unlock,
    isMuted,
    toggleMute,
    setMuted,
    playKrathongChime,
    playLanternChime,
    playEmotePop,
    playCameraShutter,
    startMusicBox,
    stopMusicBox,
    toggleMusicBox,
    isMusicBoxPlaying,
  };
}
