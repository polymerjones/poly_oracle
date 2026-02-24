const APP_VERSION = "v1.4.3";
const storageKey = "poly-oracle-v11-state";
const firstRunHintKey = "poly_oracle_seen_hint_v1_2_1";
const verboseKey = "poly_oracle_verbose_details";
const chaosEnabledKey = "poly_oracle_chaos_theme";
const chaosPaletteKey = "poly_oracle_theme_palette";
const galaxyToolKey = "poly_oracle_galaxy_tool";
const debugTapsKey = "poly_oracle_debug_taps";
const STORAGE = {
  arcadeLevel: "poly_oracle_arcade_level",
  arcadeSaved: "poly_oracle_arcade_saved",
  arcadeHasSave: "poly_oracle_arcade_hasSave",
  arcadeWon: "poly_oracle_arcade_won",
  rewardCelestial: "poly_oracle_reward_celestial",
};

const BG = {
  A: "galaxybg1b-h264.mp4",
  B: "level5-h264.mp4",
  C: "level8-h264.mp4",
  D: "level10-h264.mp4",
};

const GAME_SFX = {
  orb_tap: "taporb.mp3",
  warp: "gamesfx/blip1.mp3",
  explosion_big: "gamesfx/explo1.mp3",
  explosion_med: "gamesfx/explo1.mp3",
  explosion_small: "gamesfx/smallboom1.mp3",
  reveal_magic: "newprereveal.mp3",
  reveal_flash: "reveal4.mp3",
  reveal2: "reveal2.mp3",
  landmine_arm: "gamesfx/minepreexplode.mp3",
  landmine_boom: "gamesfx/minefinalexplo.mp3",
  blip1: "gamesfx/blip1.mp3",
  gameover: "gamesfx/gameover.mp3",
  lastlevelstart: "gamesfx/lastlevelstart.mp3",
  astcollide1: "gamesfx/astcollide1.mp3",
  astcollide2: "gamesfx/astcollide2.mp3",
  newreveal001: "gamesfx/newreveal001.mp3",
  newreveal002: "gamesfx/newreveal002.mp3",
  newreveal003: "gamesfx/newreveal003.mp3",
  newreveal004: "gamesfx/newreveal004.mp3",
  newreveal005: "gamesfx/newreveal005.mp3",
  newreveal007: "gamesfx/newreveal007.mp3",
  newreveal008: "gamesfx/newreveal008.mp3",
};

const DEBUG_FORCE_LEVEL_SELECT = true;
const REVEAL_VARIANT_SFX = [
  "newreveal001",
  "newreveal002",
  "newreveal003",
  "newreveal004",
  "newreveal005",
  "newreveal007",
  "newreveal008",
];
const REVEAL = {
  TAP_BURST_MS: 1500,
  TAP_INTERVAL_MS_START: 60,
  TAP_INTERVAL_MS_END: 180,
  PULSE_MIN: 1.0,
  PULSE_MAX: 1.1,
  GROW_MAX: 1.18,
  FLASH_RATE_MS: 120,
  TOTAL_BASELINE_MS: 8000,
};
const SFX = {
  TAP: "orb_tap",
  MAIN: "newreveal005",
  PRE_A: "reveal_magic",
  PRE_B: "newreveal002",
  POST: "reveal2",
};

// === Level Config ===
const ARCADE_LEVELS = [
  { level: 1, time: 48, totalToClear: 2, startSpawn: 2, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 2, time: 50, totalToClear: 3, startSpawn: 3, spawnEveryMs: 0, maxOnScreen: 12 },
  { level: 3, time: 52, totalToClear: 7, startSpawn: 3, spawnEveryMs: 2200, maxOnScreen: 12 },
  { level: 4, time: 54, totalToClear: 9, startSpawn: 4, spawnEveryMs: 2200, maxOnScreen: 12 },
  { level: 5, time: 56, totalToClear: 11, startSpawn: 4, spawnEveryMs: 2000, maxOnScreen: 12 },
  { level: 6, time: 58, totalToClear: 13, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13 },
  { level: 7, time: 60, totalToClear: 15, startSpawn: 5, spawnEveryMs: 1800, maxOnScreen: 13 },
  { level: 8, time: 64, totalToClear: 17, startSpawn: 6, spawnEveryMs: 1600, maxOnScreen: 14 },
  { level: 9, time: 68, totalToClear: 20, startSpawn: 6, spawnEveryMs: 1500, maxOnScreen: 14 },
  { level: 10, time: 75, totalToClear: 24, startSpawn: 7, spawnEveryMs: 1400, maxOnScreen: 14 },
];

function getSavedArcadeLevel() {
  try {
    const n = parseInt(localStorage.getItem(STORAGE.arcadeLevel) || "1", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function setSavedArcadeLevel(level) {
  try {
    localStorage.setItem(STORAGE.arcadeLevel, String(level));
    localStorage.setItem(STORAGE.arcadeSaved, "1");
    localStorage.setItem(STORAGE.arcadeHasSave, "1");
  } catch {
    // ignore
  }
}

function clearArcadeProgress() {
  try {
    localStorage.removeItem(STORAGE.arcadeLevel);
    localStorage.removeItem(STORAGE.arcadeSaved);
    localStorage.removeItem(STORAGE.arcadeHasSave);
  } catch {
    // ignore
  }
}

function hasArcadeSave() {
  try {
    return localStorage.getItem(STORAGE.arcadeHasSave) === "1";
  } catch {
    return false;
  }
}

function setArcadeWon() {
  try {
    localStorage.setItem(STORAGE.arcadeWon, "1");
  } catch {
    // ignore
  }
}

function hasArcadeWon() {
  try {
    return localStorage.getItem(STORAGE.arcadeWon) === "1";
  } catch {
    return false;
  }
}

const revealModes = [
  { id: "classic", label: "Classic Fade", duration: 2500 },
  { id: "dramatic", label: "Dramatic Flash", duration: 2500 },
  { id: "mist", label: "Mist Unveil", duration: 2500 },
  { id: "glitch", label: "Glitch Oracle", duration: 2500 },
];

const revealSoundPool = ["reveal1.mp3", "reveal2.mp3", "reveal3.mp3", "reveal4.mp3"];

const canonicalAnswers = [
  "Yes - you know it",
  "Yeppurs",
  "Yeah, buddy",
  "Heck Yes",
  "Nope",
  "I don't think so",
  "That is for God to decide",
  "Ask another day",
  "You're asking the wrong question, think about it and ask another day",
  "Yes",
  "Not today",
  "Heck No",
  "No",
];

const packs = {
  classic: {
    label: "Classic",
    yes: ["The current aligns in your favor.", "The signal is clean. Proceed.", "Momentum says yes."],
    no: ["Not this cycle.", "The signs ask for patience.", "Pause and return with clearer intent."],
  },
  romantic: {
    label: "Romantic",
    yes: ["The heart says yes.", "Love is leaning your way.", "There is warmth ahead."],
    no: ["Not from this person, not today.", "Protect your energy first.", "Wait for reciprocation."],
  },
  business: {
    label: "Business",
    yes: ["The tradeoff is acceptable.", "Green light with discipline.", "Risk-adjusted yes."],
    no: ["Return with better numbers.", "Hold capital for now.", "Not enough edge yet."],
  },
  chaos: {
    label: "Chaos Goblin",
    yes: ["Absolutely. Do it loud.", "Chaos approves.", "Yes, and make it weird."],
    no: ["Nope. Universe said sit down.", "Hard no, tiny mortal.", "Not unless you enjoy drama."],
  },
  stoic: {
    label: "Stoic",
    yes: ["Act with virtue and continue.", "This is within your control.", "Proceed without attachment."],
    no: ["Decline what weakens you.", "Not essential. Let it go.", "Choose restraint."],
  },
};

const defaultPalette = {
  accentA: "#7be2ff",
  accentB: "#f6a7ff",
  accentC: "#8effd0",
  bgNebula1: "rgba(124, 153, 255, 0.14)",
  bgNebula2: "rgba(164, 111, 255, 0.16)",
  bgNebula3: "rgba(120, 208, 255, 0.12)",
  bgNebula4: "rgba(158, 255, 215, 0.09)",
  nebulaPos1: "12% 10%",
  nebulaPos2: "82% 16%",
  nebulaPos3: "56% 96%",
  nebulaPos4: "22% 78%",
  orbGlow: "0 0 36px rgba(124, 223, 255, 0.52), 0 0 92px rgba(196, 127, 255, 0.28)",
};

const prefersReducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOSWebKit = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const state = {
  selectedMode: "classic",
  selectedPack: "classic",
  selectedVoice: "",
  userVoiceOverride: false,
  whisper: false,
  minimal: false,
  randomVoiceEachReveal: false,
  verboseDetails: false,
  chaosThemeEnabled: false,
  themePalette: null,
  vaultFilter: "all",
  vaultSearch: "",
  vault: [],
  currentAnswer: null,
  flip: false,
  settingsOpen: false,
  isRevealing: false,
  sessionTapCount: 0,
  chaosShiftCount: 0,
  tapTimestamps: [],
  galaxyTool: "draw",
  voiceReadsAnswer: true,
};

const stage = document.getElementById("stage");
const orb = document.getElementById("orb");
const flash = document.getElementById("flash");
const mist = document.getElementById("mist");
const sparkles = document.getElementById("sparkles");
const revealAudio = document.getElementById("revealAudio");
const orbTapAudio = document.getElementById("orbTapAudio");
const revealFxVideo = document.getElementById("revealFxVideo");
const oracleBgVideo = document.getElementById("oracleBgVideo");
const galaxyBgVideo = document.getElementById("galaxyBgVideo");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask");

const answerBox = document.getElementById("answer");
const answerCard = document.getElementById("answerCard");
const answerSimple = document.getElementById("answerSimple");
const answerPolarity = document.getElementById("answerPolarity");
const answerText = document.getElementById("answerText");
const answerMicro = document.getElementById("answerMicro");
const answerMeta = document.getElementById("answerMeta");
const flipAnswer = document.getElementById("flipAnswer");
const favoriteAnswer = document.getElementById("favoriteAnswer");
const shareAnswer = document.getElementById("shareAnswer");

const openSettings = document.getElementById("openSettings");
const closeSettings = document.getElementById("closeSettings");
const settingsPanel = document.getElementById("settingsPanel");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const modeButtons = Array.from(document.querySelectorAll(".segment-btn[data-mode]"));
const packSelect = document.getElementById("packSelect");
const whisperModeToggle = document.getElementById("whisperMode");
const minimalModeToggle = document.getElementById("minimalMode");
const randomVoiceEachRevealToggle = document.getElementById("randomVoiceEachReveal");
const verboseDetailsToggle = document.getElementById("verboseDetails");
const randomVoiceNow = document.getElementById("randomVoiceNow");
const voiceSelect = document.getElementById("voiceSelect");
const previewVoice = document.getElementById("previewVoice");
const voicePersona = document.getElementById("voicePersona");
const openVault = document.getElementById("openVault");
const clearHistory = document.getElementById("clearHistory");
const resetThemeButton = document.getElementById("resetTheme");
const firstRunHint = document.getElementById("firstRunHint");
const chaosToast = document.getElementById("chaosToast");
const titleSparkles = document.getElementById("titleSparkles");
const oracleView = document.getElementById("oracleView");
const galaxyView = document.getElementById("galaxyView");
const openGalaxy = document.getElementById("openGalaxy");
const closeGalaxy = document.getElementById("closeGalaxy");
const toolDraw = document.getElementById("toolDraw");
const toolBoom = document.getElementById("toolBoom");
const clearGalaxy = document.getElementById("clearGalaxy");
const galaxyPlayCanvas = document.getElementById("galaxyPlayCanvas");
const canvasCrosshair = document.getElementById("canvasCrosshair");
const galaxyModeSelect = document.getElementById("galaxyModeSelect");
const btnArcade = document.getElementById("btnArcade");
const btnFreestyle = document.getElementById("btnFreestyle");
const btnGalaxyBack = document.getElementById("btnGalaxyBack");
const arcadeMenuPanel = document.getElementById("arcadeMenuPanel");
const arcadeLevelPanel = document.getElementById("arcadeLevelPanel");
const btnArcadeNew = document.getElementById("btnArcadeNew");
const btnArcadeResume = document.getElementById("btnArcadeResume");
const btnArcadeLevelSelect = document.getElementById("btnArcadeLevelSelect");
const btnArcadeMenuBack = document.getElementById("btnArcadeMenuBack");
const btnArcadeLevelBack = document.getElementById("btnArcadeLevelBack");
const arcadeLevelGrid = document.getElementById("arcadeLevelGrid");
const arcadeHud = document.getElementById("arcadeHud");
const arcadeBack = document.getElementById("arcadeBack");
const hudLevel = document.getElementById("hudLevel");
const hudTimer = document.getElementById("hudTimer");
const arcadeTimerBackdrop = document.getElementById("arcadeTimerBackdrop");
const arcadeTimerGhost = document.getElementById("arcadeTimerGhost");
const arcadeOverlay = document.getElementById("arcadeOverlay");
const arcadeOverlayText = document.getElementById("arcadeOverlayText");
const arcadeOverlaySub = document.getElementById("arcadeOverlaySub");
const arcadeOverlayBtn = document.getElementById("arcadeOverlayBtn");

const vault = document.getElementById("vault");
const closeVault = document.getElementById("closeVault");
const vaultSearch = document.getElementById("vaultSearch");
const vaultList = document.getElementById("vaultList");
const vaultFilterAll = document.getElementById("vaultFilterAll");
const vaultFilterFav = document.getElementById("vaultFilterFav");
const vaultStats = document.getElementById("vaultStats");
const openContact = document.getElementById("openContact");
const contactModal = document.getElementById("contactModal");
const closeContact = document.getElementById("closeContact");
const contactForm = document.getElementById("contactForm");
const contactHoney = document.getElementById("contactHoney");
const contactEmail = document.getElementById("contactEmail");
const contactSubject = document.getElementById("contactSubject");
const contactPlatform = document.getElementById("contactPlatform");
const contactMessage = document.getElementById("contactMessage");
const formspreeEndpoint = String(window.POLY_CONTACT_FORM_ENDPOINT || "").trim();

let audioContext;
let nativeTtsWarned = false;
let hintTimeout;
let chaosToastTimeout;
let galaxyController;
let galaxyCanvasController;
let oracleBgController;
let galaxyBgController;
let titleSparkleTimer = null;
let mediaPrimed = false;
const orbTapPool = [];
let orbTapPoolIndex = 0;
let lastOrbTapAt = 0;
let orbTapBuffer = null;
let orbTapBufferPromise = null;
let chaosShiftAudio = null;
const boomTimes = [];

const audioEngine = {
  ctx: null,
  masterGain: null,
  buffers: new Map(),
  unlocked: false,
  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.75;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  },
  async unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    this.unlocked = ctx.state === "running";
  },
  resume() {
    return this.unlock();
  },
  async loadSound(name, url) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const ctx = this.ensureContext();
    if (!ctx) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const arr = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arr.slice(0));
      this.buffers.set(name, decoded);
      return decoded;
    } catch {
      return null;
    }
  },
  loadMany(mapNameToUrl) {
    const entries = Object.entries(mapNameToUrl || {});
    return Promise.all(entries.map(([name, url]) => this.loadSound(name, url)));
  },
  play(name, { volume = 1, rate = 1, detune = 0 } = {}) {
    const ctx = this.ensureContext();
    if (!ctx || !this.unlocked) return { source: null, ended: Promise.resolve() };
    const buffer = this.buffers.get(name);
    if (!buffer) return { source: null, ended: Promise.resolve() };
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.detune.value = detune;
    gain.gain.value = clamp(volume, 0, 1);
    source.connect(gain);
    gain.connect(this.masterGain);
    const ended = new Promise((resolve) => {
      source.onended = resolve;
    });
    source.start(0);
    return { source, ended };
  },
  getDuration(name, rate = 1) {
    const buffer = this.buffers.get(name);
    if (!buffer) return 0;
    return buffer.duration / Math.max(0.01, rate || 1);
  },
};

function preloadSfx() {
  audioEngine.loadMany(GAME_SFX);
}

async function playSfxAndWait(name, { volume = 1, rate = 1, detune = 0, maxWaitMs = 8000 } = {}) {
  const handle = audioEngine.play(name, { volume, rate, detune });
  const durationMs = audioEngine.getDuration(name, rate) * 1000;
  const waitMs = clamp(durationMs || 300, 180, maxWaitMs);
  await Promise.race([handle?.ended || Promise.resolve(), delay(waitMs)]);
}

init();

function init() {
  setVh();
  resetUiOverlayState();
  loadState();
  preloadSfx();
  initGalaxyBackground();
  initGalaxyCanvas();
  initBackgroundVideos();
  applyTheme();
  buildPackSelect();
  warmVoices();
  populateVoices();
  applySettingsToUi();
  renderVault();
  setIntentState();
  setupFirstRunHint();
  initTitleSparkles();
  initOrbTapPool();
  addListeners();
  setGalaxyTool(state.galaxyTool);
}

function addListeners() {
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", setVh);
  questionInput.addEventListener("focus", setVh);
  questionInput.addEventListener("blur", setVh);

  const primeMediaOnGesture = () => {
    if (mediaPrimed) return;
    mediaPrimed = true;
    audioEngine.unlock();
    primeBackgroundMedia();
  };
  document.addEventListener("pointerdown", primeMediaOnGesture, { once: true });
  document.addEventListener("touchstart", primeMediaOnGesture, { once: true, passive: true });
  document.addEventListener("keydown", primeMediaOnGesture, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) audioEngine.resume();
  });

  questionInput.addEventListener("input", () => {
    setIntentState();
    hapticTap();
  });

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !askButton.disabled && !state.isRevealing) {
      revealAnswer();
    }
  });

  askButton.addEventListener("click", revealAnswer);

  const onOrbTap = (event) => {
    if (event.cancelable) event.preventDefault();
    audioEngine.unlock();
    const now = performance.now();
    if (now - lastOrbTapAt < 40) return;
    lastOrbTapAt = now;
    const intensity = registerOrbTap();
    const safeIntensity = isIOSWebKit
      ? {
          ...intensity,
          burstCount: Math.min(intensity.burstCount, 8),
          sizeMultiplier: Math.min(intensity.sizeMultiplier, 1.5),
          brightnessMultiplier: Math.min(intensity.brightnessMultiplier, 1.5),
        }
      : intensity;
    if (intensity.shouldShiftTheme) {
      triggerChaosTheme();
    }
    playPixySound(safeIntensity);
    spawnSparkles(safeIntensity.burstCount, safeIntensity.sizeMultiplier, safeIntensity.brightnessMultiplier);
  };
  if ("PointerEvent" in window) {
    orb.addEventListener("pointerdown", onOrbTap);
  } else {
    orb.addEventListener("touchstart", onOrbTap, { passive: false });
    orb.addEventListener("mousedown", onOrbTap);
  }

  flipAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    state.flip = !state.flip;
    renderAnswerCard();
  });

  favoriteAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    const entry = state.vault.find((item) => item.id === state.currentAnswer.id);
    if (!entry) return;
    entry.favorite = !entry.favorite;
    renderAnswerCard();
    renderVault();
    saveState();
  });

  shareAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    shareCurrentCard();
  });

  openSettings.addEventListener("click", () => {
    setSettingsOpen(true);
  });

  closeSettings.addEventListener("click", () => {
    setSettingsOpen(false);
  });

  settingsBackdrop.addEventListener("click", () => {
    setSettingsOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!galaxyView.hidden) {
        closeGalaxyView();
        return;
      }
      setSettingsOpen(false);
      vault.hidden = true;
    }
  });

  openGalaxy.addEventListener("click", () => {
    openGalaxyView();
  });

  closeGalaxy.addEventListener("click", () => {
    galaxyCanvasController?.showModeSelect?.();
  });

  toolDraw.addEventListener("click", () => {
    if (galaxyCanvasController?.isArcade?.()) return;
    setGalaxyTool("draw");
  });

  toolBoom.addEventListener("click", () => {
    setGalaxyTool("boom");
  });

  if (clearGalaxy) {
    clearGalaxy.addEventListener("click", () => {
      if (!galaxyCanvasController?.clear) return;
      galaxyCanvasController.clear();
    });
  }

  if (btnArcade) {
    btnArcade.addEventListener("click", () => {
      galaxyCanvasController?.openArcadeMenu?.();
    });
  }
  if (btnFreestyle) {
    btnFreestyle.addEventListener("click", () => {
      galaxyCanvasController?.startFreestyle?.();
    });
  }
  if (btnGalaxyBack) {
    btnGalaxyBack.addEventListener("click", () => closeGalaxyView());
  }
  if (arcadeBack) {
    arcadeBack.addEventListener("click", () => {
      galaxyCanvasController?.showModeSelect?.({ preserveArcade: true });
    });
  }
  if (btnArcadeNew) {
    btnArcadeNew.addEventListener("click", () => galaxyCanvasController?.startArcadeNew?.());
  }
  if (btnArcadeResume) {
    btnArcadeResume.addEventListener("click", () => galaxyCanvasController?.startArcadeResume?.());
  }
  if (btnArcadeLevelSelect) {
    btnArcadeLevelSelect.addEventListener("click", () => galaxyCanvasController?.openArcadeLevelSelect?.());
  }
  if (btnArcadeMenuBack) {
    btnArcadeMenuBack.addEventListener("click", () => galaxyCanvasController?.showModeSelect?.());
  }
  if (btnArcadeLevelBack) {
    btnArcadeLevelBack.addEventListener("click", () => galaxyCanvasController?.openArcadeMenu?.());
  }
  if (openContact && contactModal) {
    openContact.addEventListener("click", () => {
      contactModal.hidden = false;
      contactModal.setAttribute("aria-hidden", "false");
    });
  }
  if (closeContact && contactModal) {
    closeContact.addEventListener("click", () => {
      contactModal.hidden = true;
      contactModal.setAttribute("aria-hidden", "true");
    });
  }
  if (contactModal) {
    contactModal.addEventListener("click", (event) => {
      if (event.target === contactModal) {
        contactModal.hidden = true;
        contactModal.setAttribute("aria-hidden", "true");
      }
    });
  }
  if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {
        fromEmail: contactEmail?.value?.trim() || "",
        subject: contactSubject?.value?.trim() || "",
        platform: contactPlatform?.value || "desktop",
        message: contactMessage?.value?.trim() || "",
        website: contactHoney?.value || "",
        userAgent: navigator.userAgent,
        ts: Date.now(),
      };
      try {
        let sent = false;
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          sent = true;
        } else {
          const body = await response.json().catch(() => ({}));
          if (body?.fallback && formspreeEndpoint) {
            const fsRes = await fetch(formspreeEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                email: payload.fromEmail,
                subject: payload.subject,
                platform: payload.platform,
                message: payload.message,
                userAgent: payload.userAgent,
                ts: payload.ts,
              }),
            });
            sent = fsRes.ok;
          }
        }
        if (!sent) throw new Error("send failed");
        showChaosToast("Message sent.");
        contactModal.hidden = true;
        contactModal.setAttribute("aria-hidden", "true");
        contactForm.reset();
      } catch {
        const qs = new URLSearchParams({
          subject: `[Poly Oracle Contact] ${payload.subject} (${payload.platform})`,
          body: `From: ${payload.fromEmail}\nPlatform: ${payload.platform}\n\n${payload.message}`,
        });
        window.location.href = `mailto:?${qs.toString()}`;
      }
    });
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-mode");
      if (!next) return;
      state.selectedMode = next;
      saveState();
      applySettingsToUi();
    });
  });

  packSelect.addEventListener("change", (event) => {
    state.selectedPack = event.target.value;
    saveState();
  });

  whisperModeToggle.addEventListener("change", (event) => {
    state.whisper = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  minimalModeToggle.addEventListener("change", (event) => {
    state.minimal = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  randomVoiceEachRevealToggle.addEventListener("change", (event) => {
    state.randomVoiceEachReveal = !!event.target.checked;
    saveState();
  });

  verboseDetailsToggle.addEventListener("change", (event) => {
    state.verboseDetails = !!event.target.checked;
    applySettingsToUi();
    saveState();
  });

  randomVoiceNow.addEventListener("click", () => {
    const voice = pickRandomVoiceName();
    if (!voice) return;
    state.selectedVoice = voice;
    state.userVoiceOverride = true;
    voiceSelect.value = voice;
    updatePersonaChip();
    saveState();
  });

  voiceSelect.addEventListener("change", (event) => {
    state.selectedVoice = event.target.value;
    state.userVoiceOverride = true;
    updatePersonaChip();
    saveState();
  });

  previewVoice.addEventListener("click", () => {
    speakText("Question: The Oracle is listening. Answer: Proceed.", {
      rate: state.whisper ? 0.95 : 1.02,
      pitch: 1.2,
      preview: true,
      voiceName: state.selectedVoice,
    });
  });

  openVault.addEventListener("click", () => {
    setSettingsOpen(false);
    vault.hidden = false;
    renderVault();
  });

  clearHistory.addEventListener("click", () => {
    const ok = window.confirm("Clear all history and favorites? This cannot be undone.");
    if (!ok) return;
    state.vault = [];
    state.currentAnswer = null;
    answerBox.hidden = true;
    saveState();
    renderVault();
  });

  if (resetThemeButton) {
    resetThemeButton.addEventListener("click", () => {
      resetChaosTheme();
    });
  }

  closeVault.addEventListener("click", () => {
    vault.hidden = true;
  });

  vault.addEventListener("click", (event) => {
    if (event.target === vault) {
      vault.hidden = true;
    }
  });

  vaultSearch.addEventListener("input", (event) => {
    state.vaultSearch = event.target.value.trim().toLowerCase();
    renderVault();
  });

  vaultFilterAll.addEventListener("click", () => {
    state.vaultFilter = "all";
    renderVault();
    saveState();
  });

  vaultFilterFav.addEventListener("click", () => {
    state.vaultFilter = "fav";
    renderVault();
    saveState();
  });
}

function setupFirstRunHint() {
  if (!firstRunHint) return;

  let seen = false;
  try {
    seen = localStorage.getItem(firstRunHintKey) === "1";
  } catch {
    seen = true;
  }

  if (seen) {
    firstRunHint.classList.add("hidden");
    return;
  }

  try {
    localStorage.setItem(firstRunHintKey, "1");
  } catch {
    // ignore
  }

  firstRunHint.classList.remove("hidden");
  firstRunHint.classList.add("show");
  hintTimeout = setTimeout(hideFirstRunHint, 2200);
}

// HARDEN overlays
function showBackdrop(el) {
  if (!el) return;
  if (el.__hideTimer) {
    clearTimeout(el.__hideTimer);
    el.__hideTimer = null;
  }
  el.hidden = false;
  el.style.display = "block";
  el.style.pointerEvents = "auto";
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
}

function hideBackdrop(el) {
  if (!el) return;
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  if (el.__hideTimer) clearTimeout(el.__hideTimer);
  el.__hideTimer = setTimeout(() => {
    el.style.display = "none";
    el.hidden = true;
    el.__hideTimer = null;
  }, 180);
}

function resetUiOverlayState() {
  document.body.classList.remove("settings-open", "overlay-open", "is-revealing", "galaxy-open");
  hideBackdrop(settingsBackdrop);
}

function hideFirstRunHint() {
  if (!firstRunHint || firstRunHint.classList.contains("hidden")) return;
  firstRunHint.classList.remove("show");
  firstRunHint.classList.add("hidden");
  if (hintTimeout) {
    clearTimeout(hintTimeout);
    hintTimeout = null;
  }
}

function setSettingsOpen(open) {
  state.settingsOpen = open;
  if (open) {
    vault.hidden = true;
    hideFirstRunHint();
  }
  if (open) {
    showBackdrop(settingsBackdrop);
    settingsPanel.hidden = false;
    settingsPanel.style.display = "block";
    settingsPanel.style.pointerEvents = "auto";
    settingsPanel.classList.add("open");
  } else {
    hideBackdrop(settingsBackdrop);
    settingsPanel.classList.remove("open");
    settingsPanel.style.pointerEvents = "none";
    settingsPanel.style.display = "none";
    settingsPanel.hidden = true;
  }
  document.body.style.overflow = open ? "hidden" : "";
}

/* v1.2.4 iOS mobile patch */
function setVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

function openGalaxyView() {
  setSettingsOpen(false);
  vault.hidden = true;
  oracleView.hidden = true;
  galaxyView.hidden = false;
  galaxyView.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (!prefersReducedMotion) {
    if (oracleBgController) oracleBgController.stop();
    if (galaxyBgController) galaxyBgController.start();
  }
  if (galaxyCanvasController) {
    requestAnimationFrame(() => galaxyCanvasController.showModeSelect?.());
  }
}

function closeGalaxyView() {
  galaxyView.hidden = true;
  galaxyView.setAttribute("aria-hidden", "true");
  oracleView.hidden = false;
  document.body.style.overflow = "";
  if (!prefersReducedMotion) {
    if (galaxyBgController) galaxyBgController.stop();
    if (oracleBgController) oracleBgController.start();
  }
  if (galaxyCanvasController) galaxyCanvasController.stopAndMenu?.();
}

function initTitleSparkles() {
  if (!titleSparkles || prefersReducedMotion) return;
  clearInterval(titleSparkleTimer);
  titleSparkleTimer = setInterval(() => {
    if (oracleView.hidden) return;
    spawnTitleSparkles(1 + Math.floor(Math.random() * 2));
  }, 1150);
}

function spawnTitleSparkles(count = 2) {
  if (!titleSparkles) return;
  const width = titleSparkles.clientWidth || 240;
  const height = titleSparkles.clientHeight || 66;

  for (let i = 0; i < count; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "title-sparkle";
    const x = Math.random() * width;
    const y = Math.random() * height * 0.72;
    const size = 4 + Math.random() * 4;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.animationDelay = `${Math.random() * 0.18}s`;
    titleSparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function setGalaxyTool(tool) {
  if (galaxyCanvasController?.isArcade?.()) return;
  state.galaxyTool = tool === "boom" ? "boom" : "draw";
  toolDraw.classList.toggle("active", state.galaxyTool === "draw");
  toolBoom.classList.toggle("active", state.galaxyTool === "boom");
  try {
    localStorage.setItem(galaxyToolKey, state.galaxyTool);
  } catch {
    // ignore
  }
}

function setIntentState() {
  const value = questionInput.value.trim();
  askButton.disabled = value.length < 2 || state.isRevealing;
  stage.classList.toggle("intent", value.length >= 2);
}

function normalizeQuestion(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

function effectiveModeId() {
  if (prefersReducedMotion) return "classic";
  if (state.minimal && state.selectedMode === "glitch") return "classic";
  return state.selectedMode;
}

function buildPackSelect() {
  packSelect.innerHTML = "";
  Object.entries(packs).forEach(([id, pack]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = pack.label;
    packSelect.appendChild(option);
  });
  if (!packs[state.selectedPack]) state.selectedPack = "classic";
  packSelect.value = state.selectedPack;
}

function applySettingsToUi() {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-mode") === state.selectedMode);
  });

  packSelect.value = state.selectedPack;
  whisperModeToggle.checked = state.whisper;
  minimalModeToggle.checked = state.minimal;
  randomVoiceEachRevealToggle.checked = state.randomVoiceEachReveal;
  verboseDetailsToggle.checked = state.verboseDetails;

  document.body.classList.toggle("whisper", state.whisper);
  document.body.classList.toggle("minimal", state.minimal);
  document.body.classList.toggle("verbose-details", state.verboseDetails);

  revealAudio.volume = state.whisper ? 0.32 : 0.82;
  if (galaxyController) galaxyController.setMinimal(state.minimal);
}

function setRevealing(revealing) {
  state.isRevealing = revealing;
  document.body.classList.toggle("is-revealing", revealing);
  questionInput.disabled = revealing;
  askButton.disabled = revealing || questionInput.value.trim().length < 2;
  askButton.classList.toggle("loading", revealing);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flashBackground(intensity = 1, ms = 160) {
  if (!stage) return;
  stage.style.setProperty("--ritualFlashOpacity", String(clamp(intensity, 0, 1)));
  stage.classList.remove("ritual-flash");
  void stage.offsetWidth;
  stage.classList.add("ritual-flash");
  setTimeout(() => stage.classList.remove("ritual-flash"), ms);
}

function darkenStage(on) {
  if (!stage) return;
  stage.classList.toggle("ritual-dark", !!on);
}

async function speakLine(text, { rate = 1, pitch = 1.1, voiceName = "", timeoutMs = 6000 } = {}) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  const voices = getWebVoices();
  await new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = state.whisper ? 0.5 : 1;
    const selected = voices.find((voice) => voice.name === (voiceName || state.selectedVoice));
    if (selected) utter.voice = selected;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const tid = setTimeout(finish, timeoutMs);
    utter.onend = () => {
      clearTimeout(tid);
      finish();
    };
    utter.onerror = () => {
      clearTimeout(tid);
      finish();
    };
    synth.speak(utter);
  });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getCrystalOverlay() {
  return revealFxVideo || document.getElementById("crystalOverlayVideo");
}

async function startCrystalOverlay() {
  const video = getCrystalOverlay();
  if (!video) return;
  const desiredSrc = "crystalballfx.mp4";
  if (!video.getAttribute("src") || !video.getAttribute("src").includes("crystalballfx.mp4")) {
    video.setAttribute("src", desiredSrc);
  }
  try {
    video.currentTime = 0;
  } catch {
    // ignore seek errors
  }
  video.classList.add("active", "on");
  try {
    await video.play();
  } catch {
    // ignore autoplay errors
  }
}

function stopCrystalOverlay() {
  const video = getCrystalOverlay();
  if (!video) return;
  video.classList.remove("active", "on");
  setTimeout(() => {
    video.pause();
  }, 220);
}

function triggerOrbSparkle(intensity = 1) {
  spawnSparkles(Math.round(5 + intensity * 5), 1 + intensity * 0.12, 1 + intensity * 0.18);
}

function triggerScreenShake(intensity = 1) {
  stage.classList.remove("pre-reveal-shake");
  void stage.offsetWidth;
  stage.classList.add("pre-reveal-shake");
  setTimeout(() => stage.classList.remove("pre-reveal-shake"), Math.round(130 + intensity * 70));
}

function triggerBgFlashPinkPurple(intensity = 1) {
  flashBackground(clamp(0.35 + intensity * 0.65, 0.15, 1), Math.round(90 + intensity * 90));
}

function setOrbScale(mult) {
  if (!orb) return;
  orb.style.transform = `scale(${clamp(mult, 0.86, 1.35).toFixed(3)})`;
}

function setRevealBusy(on) {
  setRevealing(!!on);
}

function setRevealBgStrobe(on) {
  document.body.classList.toggle("reveal-bg-strobe", !!on);
}

function triggerLargeScreenShake() {
  document.body.classList.remove("reveal-screen-shake");
  void document.body.offsetWidth;
  document.body.classList.add("reveal-screen-shake");
  setTimeout(() => document.body.classList.remove("reveal-screen-shake"), 1000);
}

function hideAnswerBar() {
  if (!answerBox) return;
  answerBox.hidden = false;
  answerBox.classList.remove("on");
}

function fadeInAnswerBar() {
  if (!answerBox) return;
  answerBox.hidden = false;
  requestAnimationFrame(() => answerBox.classList.add("on"));
}

function setAnswerTextVisible(on) {
  answerSimple?.classList.toggle("on", !!on);
  answerText?.classList.toggle("on", !!on);
}

function triggerAnswerTextRevealFx() {
  [answerSimple, answerText].forEach((el) => {
    if (!el) return;
    el.classList.remove("shimmer");
    void el.offsetWidth;
    el.classList.add("shimmer");
  });
  spawnAnswerSparkles(prefersReducedMotion ? 8 : 18, prefersReducedMotion ? 1 : 1.18);
  if (!prefersReducedMotion) {
    setTimeout(() => spawnAnswerSparkles(10, 1.08), 120);
    setTimeout(() => spawnAnswerSparkles(8, 1), 240);
  }
}

async function speakAnswer(text, voiceName = "") {
  if (!text) return;
  await speakLine(text, {
    rate: state.whisper ? 0.96 : 1.04,
    pitch: 1.14,
    voiceName,
    timeoutMs: 6500,
  });
}

window.triggerOrbSparkle = triggerOrbSparkle;
window.triggerScreenShake = triggerScreenShake;
window.triggerBgFlashPinkPurple = triggerBgFlashPinkPurple;
window.setOrbScale = setOrbScale;
window.setRevealBusy = setRevealBusy;
window.fadeInAnswerBar = fadeInAnswerBar;
window.hideAnswerBar = hideAnswerBar;
window.setAnswerTextVisible = setAnswerTextVisible;
window.speakAnswer = speakAnswer;

async function runTapBurst() {
  const t0 = performance.now();
  const endAt = t0 + REVEAL.TAP_BURST_MS;
  let nextAt = t0;
  while (performance.now() < endAt) {
    const now = performance.now();
    const progress = Math.min(1, (now - t0) / REVEAL.TAP_BURST_MS);
    const interval = lerp(REVEAL.TAP_INTERVAL_MS_START, REVEAL.TAP_INTERVAL_MS_END, progress);
    if (now >= nextAt) {
      audioEngine.play(SFX.TAP, { volume: 0.45, rate: 0.96 + Math.random() * 0.1 });
      triggerOrbSparkle(1);
      triggerBgFlashPinkPurple(0.35);
      nextAt = now + interval;
    }
    const pulse = lerp(REVEAL.PULSE_MIN, REVEAL.PULSE_MAX, 0.5 + 0.5 * Math.sin(now / 90));
    const grow = lerp(1, REVEAL.GROW_MAX, progress);
    setOrbScale(pulse * grow);
    await new Promise(requestAnimationFrame);
  }
  setOrbScale(REVEAL.GROW_MAX * 0.98);
}

async function revealAnswer() {
  if (state.isRevealing) return;

  const normalizedQuestion = normalizeQuestion(questionInput.value);
  if (!normalizedQuestion) {
    questionInput.classList.remove("shake");
    void questionInput.offsetWidth;
    questionInput.classList.add("shake");
    setTimeout(() => questionInput.classList.remove("shake"), 320);
    return;
  }

  questionInput.value = normalizedQuestion;

  const answerLine = pick(canonicalAnswers);
  const polarity = inferPolarity(answerLine);
  const microLine = pick(packs[state.selectedPack][polarity]);
  const modeId = effectiveModeId();
  const mode = revealModes.find((item) => item.id === modeId) || revealModes[0];
  const revealVoice = state.randomVoiceEachReveal ? pickRandomVoiceName() || state.selectedVoice : state.selectedVoice;

  hapticReveal();
  primeSpeechFromGesture();
  await audioEngine.unlock();
  setRevealBusy(true);
  setRevealBgStrobe(true);
  triggerLargeScreenShake();
  try {
    setAnswerTextVisible(false);
    hideAnswerBar();

    startCrystalOverlay();
    audioEngine.play(SFX.MAIN, { volume: 0.9, rate: 1.0 });

    const burstPromise = runTapBurst();
    const burstFlashInterval = setInterval(() => {
      triggerScreenShake(0.45);
      triggerBgFlashPinkPurple(0.55);
      triggerOrbSparkle(0.9);
    }, REVEAL.FLASH_RATE_MS);
    await burstPromise;
    clearInterval(burstFlashInterval);

    await speakLine(normalizedQuestion, {
      rate: state.whisper ? 0.92 : 1,
      pitch: 1.1,
      voiceName: revealVoice,
      timeoutMs: 6500,
    });

    const pre = Math.random() < 0.5 ? SFX.PRE_A : SFX.PRE_B;
    audioEngine.play(pre, { volume: 0.85, rate: 1.0 });
    const tensionEnd = performance.now() + 700;
    while (performance.now() < tensionEnd) {
      const now = performance.now();
      triggerBgFlashPinkPurple(0.45);
      triggerOrbSparkle(0.6);
      setOrbScale(REVEAL.GROW_MAX * (1.02 + 0.02 * Math.sin(now / 80)));
      await new Promise(requestAnimationFrame);
    }

    for (let i = 0; i < 6; i += 1) {
      triggerScreenShake(1);
      triggerBgFlashPinkPurple(1);
      triggerOrbSparkle(1.3);
      await delay(60);
    }

    fadeInAnswerBar();
    const barRevealHandle = audioEngine.play(SFX.PRE_A, { volume: 0.95, rate: 1.0 });
    const postSpark = setInterval(() => triggerOrbSparkle(0.7), 140);
    await Promise.race([barRevealHandle?.ended || Promise.resolve(), delay(2000)]);
    clearInterval(postSpark);

    finishReveal({
      normalizedQuestion,
      polarity,
      answerLine,
      microLine,
      revealVoice,
    });
    setTimeout(() => stopCrystalOverlay(), 180);
    await delay(900);
    setAnswerTextVisible(true);
    setRevealBgStrobe(false);
    triggerAnswerTextRevealFx();
    const textRevealHandle = audioEngine.play(SFX.POST, { volume: 0.95, rate: 1.0 });
    await Promise.race([textRevealHandle?.ended || Promise.resolve(), delay(2200)]);
    await delay(120);

    if (state.voiceReadsAnswer !== false) {
      await speakAnswer(answerLine, revealVoice);
    }
  } finally {
    darkenStage(false);
    setOrbScale(1);
    stopCrystalOverlay();
    setRevealBgStrobe(false);
    setRevealBusy(false);
    setIntentState();
  }
}

function runRitualSequence(mode, onDone) {
  triggerRevealFx();
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  performRitualPulse(0.8);

  setTimeout(() => performRitualPulse(1.05), 400);
  setTimeout(() => performRitualPulse(1.25), 900);
  setTimeout(() => performRitualPulse(1.45), 1600);
  setTimeout(() => triggerPreRevealAccent(), Math.max(0, mode.duration - 280));
  setTimeout(() => onDone(), mode.duration);
}

function runReducedRitualSequence(mode, onDone) {
  triggerRevealFx({ reduced: true });
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  mist.classList.remove("active");
  void mist.offsetWidth;
  mist.classList.add("active");
  spawnSparkles(4, 1, 1);
  setTimeout(() => triggerPreRevealAccent({ reduced: true }), Math.max(0, mode.duration - 260));

  setTimeout(onDone, mode.duration);
}

function triggerPreRevealAccent({ reduced = false } = {}) {
  stage.classList.remove("pre-reveal-shake");
  void stage.offsetWidth;
  stage.classList.add("pre-reveal-shake");

  if (reduced) {
    mist.classList.remove("active");
    void mist.offsetWidth;
    mist.style.opacity = "0.22";
    mist.classList.add("active");
    spawnSparkles(4, 0.95, 0.9);
  } else {
    performRitualPulse(1.7);
  }

  setTimeout(() => {
    stage.classList.remove("pre-reveal-shake");
  }, 240);
}

function performRitualPulse(level = 1) {
  flash.classList.remove("active");
  mist.classList.remove("active");
  void flash.offsetWidth;

  if (!state.minimal) {
    flash.style.opacity = `${Math.min(0.5, 0.18 * level)}`;
    flash.classList.add("active");
  }

  mist.style.opacity = `${Math.min(0.5, 0.16 * level)}`;
  mist.classList.add("active");

  spawnSparkles(Math.round(6 + level * 5), 1 + level * 0.15, 1 + level * 0.2);
  if (level > 1.2) {
    hapticTap();
  }
}

async function finishReveal({ normalizedQuestion, polarity, answerLine, microLine, revealVoice }) {
  stage.classList.remove("pre-reveal-shake");
  spawnSparkles(prefersReducedMotion ? 5 : 18, 1.2, 1.35);
  flash.classList.remove("active");
  mist.classList.remove("active");
  flash.style.opacity = "";
  mist.style.opacity = "";

  const entry = {
    id: makeId(),
    question: normalizedQuestion,
    polarity,
    answer: answerLine,
    micro: microLine,
    mode: state.selectedMode,
    pack: state.selectedPack,
    voice: revealVoice || "Default",
    favorite: false,
    timestamp: Date.now(),
  };

  state.currentAnswer = entry;
  state.flip = false;
  state.vault.unshift(entry);
  state.vault = state.vault.slice(0, 200);

  renderAnswerCard();
  triggerAnswerRevealImpact();
  renderVault();
  saveState();
}

function triggerAnswerRevealImpact() {
  // Bright purple flash at answer reveal.
  flash.classList.remove("answer-hit");
  void flash.offsetWidth;
  flash.classList.add("answer-hit");
  setTimeout(() => {
    flash.classList.remove("answer-hit");
  }, prefersReducedMotion ? 180 : 320);

  // Sparkle burst around the revealed answer card.
  spawnAnswerSparkles(prefersReducedMotion ? 8 : 20, prefersReducedMotion ? 1 : 1.25);
}

function renderAnswerCard() {
  if (!state.currentAnswer) return;

  const sourcePolarity = state.flip
    ? state.currentAnswer.polarity === "yes"
      ? "no"
      : "yes"
    : state.currentAnswer.polarity;

  const answerValue =
    sourcePolarity === state.currentAnswer.polarity
      ? state.currentAnswer.answer
      : pick(canonicalAnswersByPolarity(sourcePolarity));

  const microValue = sourcePolarity === state.currentAnswer.polarity
    ? state.currentAnswer.micro
    : pick(packs[state.currentAnswer.pack][sourcePolarity]);

  answerSimple.textContent = answerValue;
  answerPolarity.textContent = sourcePolarity.toUpperCase();
  answerPolarity.classList.toggle("yes", sourcePolarity === "yes");
  answerPolarity.classList.toggle("no", sourcePolarity === "no");
  answerText.textContent = answerValue;
  answerMicro.textContent = microValue;

  const when = new Date(state.currentAnswer.timestamp).toLocaleString();
  answerMeta.textContent = `${packs[state.currentAnswer.pack]?.label || state.currentAnswer.pack} • ${state.currentAnswer.mode} • ${when}`;

  const favorite = state.vault.find((item) => item.id === state.currentAnswer.id)?.favorite;
  favoriteAnswer.textContent = favorite ? "Unfavorite" : "Favorite";

  answerBox.hidden = false;
  answerCard.classList.remove("reveal");
  void answerCard.offsetWidth;
  answerCard.classList.add("reveal");
}

function renderVault() {
  const all = state.vault;
  const filtered = all.filter((item) => {
    if (state.vaultFilter === "fav" && !item.favorite) return false;
    if (!state.vaultSearch) return true;
    return (
      item.question.toLowerCase().includes(state.vaultSearch) ||
      item.answer.toLowerCase().includes(state.vaultSearch) ||
      (item.micro || "").toLowerCase().includes(state.vaultSearch)
    );
  });

  vaultFilterAll.classList.toggle("active", state.vaultFilter === "all");
  vaultFilterFav.classList.toggle("active", state.vaultFilter === "fav");

  const rituals = all.length;
  const days = new Set(all.map((item) => new Date(item.timestamp).toDateString())).size;
  vaultStats.textContent = `Rituals: ${rituals} • Active days: ${days}`;

  if (!filtered.length) {
    vaultList.innerHTML = `<div class=\"vault-item\">No entries yet.</div>`;
    return;
  }

  vaultList.innerHTML = filtered
    .map((item) => {
      const when = new Date(item.timestamp).toLocaleString();
      return `
        <article class="vault-item" data-id="${item.id}">
          <div class="vault-q">${escapeHtml(item.question)}</div>
          <div class="vault-a">${item.polarity.toUpperCase()}: ${escapeHtml(item.answer)}</div>
          <div class="vault-meta">
            <span>${escapeHtml(packs[item.pack]?.label || item.pack)} • ${escapeHtml(item.mode)}</span>
            <span>${escapeHtml(when)}</span>
          </div>
          <div class="vault-details" data-details hidden>
            Voice: ${escapeHtml(item.voice || "Default")}<br />
            Pack: ${escapeHtml(packs[item.pack]?.label || item.pack)}<br />
            Reveal Mode: ${escapeHtml(item.mode)}
          </div>
          <div class="vault-actions">
            <button class="ghost small" data-action="details">View details</button>
            <button class="ghost small" data-action="fav">${item.favorite ? "Unfavorite" : "Favorite"}</button>
            <button class="ghost small" data-action="load">Load</button>
            <button class="ghost small" data-action="delete">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");

  vaultList.querySelectorAll(".vault-item").forEach((node) => {
    const id = node.getAttribute("data-id");
    node.querySelector('[data-action="details"]').addEventListener("click", () => toggleVaultDetails(node));
    node.querySelector('[data-action="fav"]').addEventListener("click", () => toggleFavorite(id));
    node.querySelector('[data-action="load"]').addEventListener("click", () => loadFromVault(id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => removeFromVault(id));
  });
}

function toggleVaultDetails(node) {
  const details = node.querySelector("[data-details]");
  if (!details) return;
  details.hidden = !details.hidden;
}

function toggleFavorite(id) {
  const entry = state.vault.find((item) => item.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  saveState();
  renderVault();
  renderAnswerCard();
}

function loadFromVault(id) {
  const entry = state.vault.find((item) => item.id === id);
  if (!entry) return;

  state.currentAnswer = { ...entry };
  state.selectedMode = revealModes.some((mode) => mode.id === entry.mode) ? entry.mode : state.selectedMode;
  state.selectedPack = packs[entry.pack] ? entry.pack : state.selectedPack;
  state.flip = false;
  applySettingsToUi();
  renderAnswerCard();
  saveState();
  vault.hidden = true;
}

function removeFromVault(id) {
  state.vault = state.vault.filter((item) => item.id !== id);
  if (state.currentAnswer?.id === id) {
    state.currentAnswer = null;
    answerBox.hidden = true;
  }
  saveState();
  renderVault();
}

function registerOrbTap() {
  const now = Date.now();
  state.sessionTapCount += 1;
  state.tapTimestamps.push(now);
  state.tapTimestamps = state.tapTimestamps.filter((stamp) => now - stamp <= 2000);

  const spamTapCount = state.tapTimestamps.length;
  const sizeMultiplier = clamp(1 + spamTapCount * 0.05, 1, 2.5);
  const brightnessMultiplier = clamp(1 + spamTapCount * 0.07, 1, 3);
  const burstCount = Math.round(clamp(6 + spamTapCount, 6, 34));
  const shouldShiftTheme = state.sessionTapCount % 20 === 0;

  return { spamTapCount, sizeMultiplier, brightnessMultiplier, burstCount, shouldShiftTheme };
}

function triggerChaosTheme() {
  state.chaosThemeEnabled = true;
  state.chaosShiftCount += 1;
  state.themePalette = createRandomPalette(state.chaosShiftCount);
  applyTheme();
  saveThemeSettings();
  showChaosToast();
}

function resetChaosTheme() {
  state.chaosThemeEnabled = false;
  state.themePalette = null;
  state.chaosShiftCount = 0;
  applyTheme();
  saveThemeSettings();
}

function createRandomPalette(shiftCount = 1) {
  const level = clamp(shiftCount, 1, 12);
  const heat = clamp(level / 10, 0.1, 1.3);
  const satBoost = Math.round(88 + heat * 8);
  const lightness = Math.round(clamp(70 + heat * 10, 70, 84));
  const nebulaAlpha = clamp(0.18 + heat * 0.12, 0.18, 0.36);

  const hueA = Math.floor(Math.random() * 360);
  const hueB = (hueA + 70 + Math.floor(Math.random() * 70)) % 360;
  const hueC = (hueA + 150 + Math.floor(Math.random() * 90)) % 360;
  const hueD = (hueA + 210 + Math.floor(Math.random() * 80)) % 360;

  const pos1 = `${Math.round(8 + Math.random() * 22)}% ${Math.round(6 + Math.random() * 24)}%`;
  const pos2 = `${Math.round(64 + Math.random() * 28)}% ${Math.round(8 + Math.random() * 26)}%`;
  const pos3 = `${Math.round(12 + Math.random() * 76)}% ${Math.round(60 + Math.random() * 34)}%`;
  const pos4 = `${Math.round(12 + Math.random() * 72)}% ${Math.round(30 + Math.random() * 56)}%`;

  return {
    accentA: `hsl(${hueA} ${satBoost}% ${lightness}%)`,
    accentB: `hsl(${hueB} ${Math.max(86, satBoost - 5)}% ${Math.max(70, lightness - 2)}%)`,
    accentC: `hsl(${hueC} ${Math.max(84, satBoost - 8)}% ${Math.max(69, lightness - 3)}%)`,
    bgNebula1: `hsla(${hueA} 96% 72% / ${nebulaAlpha.toFixed(2)})`,
    bgNebula2: `hsla(${hueB} 95% 70% / ${nebulaAlpha.toFixed(2)})`,
    bgNebula3: `hsla(${hueC} 94% 68% / ${(nebulaAlpha * 0.95).toFixed(2)})`,
    bgNebula4: `hsla(${hueD} 92% 70% / ${(nebulaAlpha * 0.84).toFixed(2)})`,
    nebulaPos1: pos1,
    nebulaPos2: pos2,
    nebulaPos3: pos3,
    nebulaPos4: pos4,
    orbGlow: `0 0 ${Math.round(34 + heat * 26)}px hsla(${hueA} 98% 74% / ${clamp(0.56 + heat * 0.18, 0.56, 0.88).toFixed(2)}), 0 0 ${Math.round(96 + heat * 90)}px hsla(${hueB} 94% 72% / ${clamp(0.32 + heat * 0.14, 0.32, 0.62).toFixed(2)})`,
  };
}

function applyTheme() {
  const palette = state.chaosThemeEnabled && state.themePalette ? state.themePalette : defaultPalette;
  const root = document.documentElement;

  root.style.setProperty("--accentA", palette.accentA);
  root.style.setProperty("--accentB", palette.accentB);
  root.style.setProperty("--accentC", palette.accentC);
  root.style.setProperty("--bgNebula1", palette.bgNebula1);
  root.style.setProperty("--bgNebula2", palette.bgNebula2);
  root.style.setProperty("--bgNebula3", palette.bgNebula3 || defaultPalette.bgNebula3);
  root.style.setProperty("--bgNebula4", palette.bgNebula4 || defaultPalette.bgNebula4);
  root.style.setProperty("--nebulaPos1", palette.nebulaPos1 || defaultPalette.nebulaPos1);
  root.style.setProperty("--nebulaPos2", palette.nebulaPos2 || defaultPalette.nebulaPos2);
  root.style.setProperty("--nebulaPos3", palette.nebulaPos3 || defaultPalette.nebulaPos3);
  root.style.setProperty("--nebulaPos4", palette.nebulaPos4 || defaultPalette.nebulaPos4);
  root.style.setProperty("--orbGlow", palette.orbGlow);
}

function showChaosToast() {
  if (!chaosToast) return;
  chaosToast.textContent = "✨ Oracle changed realities.";
  const intensity = clamp(1 + state.chaosShiftCount * 0.12, 1, 2.2);
  chaosToast.style.setProperty("--chaos-intensity", intensity.toFixed(2));
  playChaosShiftSound();
  chaosToast.hidden = false;
  chaosToast.classList.remove("show");
  void chaosToast.offsetWidth;
  chaosToast.classList.add("show");
  clearTimeout(chaosToastTimeout);
  chaosToastTimeout = setTimeout(() => {
    chaosToast.classList.remove("show");
    chaosToast.hidden = true;
  }, 1900);
}

function playChaosShiftSound() {
  try {
    if (!chaosShiftAudio) {
      chaosShiftAudio = new Audio("reveal3.mp3");
      chaosShiftAudio.preload = "auto";
    }
    chaosShiftAudio.currentTime = 0;
    chaosShiftAudio.volume = state.whisper ? 0.3 : 0.75;
    chaosShiftAudio.play().catch(() => {});
  } catch {
    // ignore audio errors
  }
}

function spawnSparkles(count, sizeMultiplier = 1, brightnessMultiplier = 1) {
  if (!sparkles) return;
  if (sparkles.childElementCount > 120) return;
  const stageRect = stage.getBoundingClientRect();
  const orbRect = orb.getBoundingClientRect();
  const centerX = orbRect.left - stageRect.left + orbRect.width / 2;
  const centerY = orbRect.top - stageRect.top + orbRect.height / 2;
  const radius = orbRect.width / 2;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius * 0.95;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const sparkle = document.createElement("span");
    const size = (4 + Math.random() * 7) * sizeMultiplier;
    const alpha = clamp(0.25 * brightnessMultiplier, 0.25, 1);

    sparkle.className = "sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.opacity = `${alpha}`;
    sparkle.style.animationDelay = `${Math.random() * 0.12}s`;
    sparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function spawnAnswerSparkles(count = 14, scale = 1) {
  if (!sparkles || !answerCard || answerBox.hidden) return;
  const stageRect = stage.getBoundingClientRect();
  const cardRect = answerCard.getBoundingClientRect();
  const centerX = cardRect.left - stageRect.left + cardRect.width / 2;
  const centerY = cardRect.top - stageRect.top + cardRect.height / 2;
  const radiusX = cardRect.width * 0.52;
  const radiusY = cardRect.height * 0.55;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const jitter = 0.55 + Math.random() * 0.5;
    const x = centerX + Math.cos(angle) * radiusX * jitter;
    const y = centerY + Math.sin(angle) * radiusY * jitter;
    const sparkle = document.createElement("span");
    const size = (4 + Math.random() * 6) * scale;

    sparkle.className = "sparkle answer-sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.opacity = prefersReducedMotion ? "0.5" : "0.82";
    sparkle.style.animationDelay = `${Math.random() * 0.09}s`;
    sparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function playRevealSoundAndWait() {
  if (!revealAudio) return Promise.resolve();
  const nextRevealSound = pick(revealSoundPool);
  if (nextRevealSound && revealAudio.getAttribute("src") !== nextRevealSound) {
    revealAudio.setAttribute("src", nextRevealSound);
    revealAudio.load();
  }
  revealAudio.currentTime = 0;
  const fallbackMs = Math.min(
    2400,
    Math.max(
      750,
      Number.isFinite(revealAudio.duration) && revealAudio.duration > 0 ? Math.round(revealAudio.duration * 1000) : 1250,
    ),
  );
  return new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      revealAudio.removeEventListener("ended", finish);
      revealAudio.removeEventListener("error", finish);
      resolve();
    };
    revealAudio.addEventListener("ended", finish, { once: true });
    revealAudio.addEventListener("error", finish, { once: true });
    timeoutId = setTimeout(finish, fallbackMs);
    revealAudio.play().catch(() => {
      setTimeout(finish, 220);
    });
  });
}

function triggerRevealFx({ reduced = false } = {}) {
  if (!revealFxVideo) return;
  revealFxVideo.classList.add("active");
  revealFxVideo.volume = state.whisper ? 0.4 : 0.85;

  try {
    revealFxVideo.currentTime = 0;
  } catch {
    // ignore seek errors
  }

  revealFxVideo.play().catch(() => {});

  const hold = reduced || prefersReducedMotion ? 600 : 1200;
  setTimeout(() => {
    revealFxVideo.classList.remove("active");
  }, hold);
}

function playPixySound(intensity) {
  if (state.minimal) return;
  const volume = state.whisper ? 0.38 : clamp(0.58 * intensity.brightnessMultiplier, 0.32, 0.9);
  audioEngine.play("orb_tap", {
    volume,
    rate: clamp(0.94 + intensity.sizeMultiplier * 0.08, 0.92, 1.08),
  });
}

function warmVoices() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
}

function getWebVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices() || [];
}

function pickRandomVoiceName() {
  const voices = getWebVoices();
  if (!voices.length) return "";
  return pick(voices).name;
}

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = "<option value=''>Voice unavailable</option>";
    voiceSelect.disabled = true;
    previewVoice.disabled = true;
    return;
  }

  const synth = window.speechSynthesis;
  const load = () => {
    const voices = getWebVoices();
    voiceSelect.innerHTML = "";

    voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });

    if (!voices.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Loading voices...";
      voiceSelect.appendChild(option);
      return;
    }

    const preferred =
      voices.find((voice) => voice.name === "Daniel" && voice.lang === "en-GB") ||
      voices.find((voice) => voice.name === "Daniel") ||
      voices.find((voice) => /en-GB/i.test(voice.lang)) ||
      voices.find((voice) => /en/i.test(voice.lang)) ||
      voices[0];

    const currentExists = voices.some((voice) => voice.name === state.selectedVoice);
    if (!state.userVoiceOverride || !currentExists) {
      state.selectedVoice = preferred.name;
      state.userVoiceOverride = false;
    }

    voiceSelect.value = state.selectedVoice;
    updatePersonaChip();
    saveState();
  };

  synth.onvoiceschanged = load;
  load();
}

function updatePersonaChip() {
  const name = (state.selectedVoice || "").toLowerCase();
  let persona = "Calm";
  if (name.includes("siri") || name.includes("narrator")) persona = "Deadpan";
  else if (name.includes("daniel") || name.includes("fred")) persona = "Mystical";
  else if (name.includes("junior") || name.includes("good news")) persona = "Hype";
  voicePersona.textContent = `Persona: ${persona}`;
}

async function speakText(text, { rate = 1, pitch = 1.2, preview = false, voiceName = "" } = {}) {
  if (!text) return;

  const nativeSpoken = await speakNativeText(text, { rate, pitch, voiceName });
  if (nativeSpoken) return;

  speakWebText(text, { rate, pitch, preview, voiceName });
}

function primeSpeechFromGesture() {
  if (!("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.resume();
    synth.getVoices();
  } catch {
    // ignore priming errors
  }
}

async function speakNativeText(text, { rate = 1, pitch = 1.2 } = {}) {
  const plugin = getNativeTtsPlugin();
  if (!plugin) return false;

  try {
    if (typeof plugin.stop === "function") await plugin.stop();

    await plugin.speak({
      text,
      lang: "en-GB",
      rate: Math.max(0.2, Math.min(2, rate)),
      pitch: Math.max(0.5, Math.min(2, pitch)),
      volume: state.whisper ? 0.5 : 1,
      category: "ambient",
    });
    return true;
  } catch (error) {
    if (!nativeTtsWarned) {
      nativeTtsWarned = true;
      console.warn("Native TTS unavailable, falling back to web speech.", error);
    }
    return false;
  }
}

function speakWebText(text, { rate = 1, pitch = 1.2, preview = false, voiceName = "" } = {}) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.resume();
  if (!preview) synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = state.whisper ? 0.5 : 1;

  const voices = getWebVoices();
  const selected = voices.find((voice) => voice.name === (voiceName || state.selectedVoice));
  if (selected) utter.voice = selected;
  synth.speak(utter);

  // Safari/iOS reliability fallback: if queued speech does not begin, retry with default voice.
  setTimeout(() => {
    if (synth.speaking || synth.pending) return;
    const retry = new SpeechSynthesisUtterance(text);
    retry.rate = rate;
    retry.pitch = pitch;
    retry.volume = state.whisper ? 0.5 : 1;
    synth.speak(retry);
  }, 220);
}

function getNativeTtsPlugin() {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function") return null;
  if (!cap.isNativePlatform()) return null;

  const plugin = cap?.Plugins?.TextToSpeech;
  return plugin && typeof plugin.speak === "function" ? plugin : null;
}

async function shareCurrentCard() {
  const entry = state.currentAnswer;
  if (!entry) return;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0a1023");
  gradient.addColorStop(0.55, "#122042");
  gradient.addColorStop(1, "#2b1f4f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(600, 450, 230, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f3f6ff";
  ctx.font = "700 80px Inter";
  ctx.textAlign = "center";
  ctx.fillText("POLY ORACLE", 600, 170);

  ctx.font = "500 44px Inter";
  drawWrappedText(ctx, `Q: ${entry.question}`, 600, 820, 920, 56);

  ctx.font = "700 96px Inter";
  ctx.fillStyle = entry.polarity === "yes" ? "#8effd0" : "#ffc0d0";
  ctx.fillText(entry.polarity.toUpperCase(), 600, 1020);

  ctx.font = "600 56px Inter";
  ctx.fillStyle = "#ffffff";
  drawWrappedText(ctx, entry.answer, 600, 1120, 860, 62);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  const file = new File([blob], "oracle-card.png", { type: "image/png" });
  const shareData = {
    title: "Poly Oracle",
    text: `${entry.question} -> ${entry.answer}`,
    files: [file],
  };

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // ignore cancel
    }
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "oracle-card.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function drawWrappedText(ctx, text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let y = startY;
  words.forEach((word) => {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line.length) {
      ctx.fillText(line.trim(), centerX, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line.trim()) ctx.fillText(line.trim(), centerX, y);
}

function hapticTap() {
  if (state.minimal) return;
  if (navigator.vibrate) navigator.vibrate(8);
}

function hapticReveal() {
  if (state.minimal) return;
  if (navigator.vibrate) navigator.vibrate(state.whisper ? [10, 12, 14] : [18, 24, 30]);
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      state.selectedMode = revealModes.some((mode) => mode.id === saved.selectedMode) ? saved.selectedMode : state.selectedMode;
      state.selectedPack = packs[saved.selectedPack] ? saved.selectedPack : state.selectedPack;
      state.selectedVoice = saved.selectedVoice || "";
      state.userVoiceOverride = !!saved.userVoiceOverride;
      state.whisper = !!saved.whisper;
      state.minimal = !!saved.minimal;
      state.randomVoiceEachReveal = !!saved.randomVoiceEachReveal;
      state.vault = Array.isArray(saved.vault) ? saved.vault.slice(0, 200) : [];
      state.vaultFilter = saved.vaultFilter === "fav" ? "fav" : "all";
      state.vaultSearch = typeof saved.vaultSearch === "string" ? saved.vaultSearch : "";
    }
  } catch {
    // ignore
  }

  try {
    state.verboseDetails = localStorage.getItem(verboseKey) === "1";
  } catch {
    state.verboseDetails = false;
  }

  state.chaosThemeEnabled = false;
  state.themePalette = null;
  state.randomVoiceEachReveal = false;
  state.verboseDetails = false;
  try {
    const savedTool = localStorage.getItem(galaxyToolKey);
    state.galaxyTool = savedTool === "boom" ? "boom" : "draw";
  } catch {
    state.galaxyTool = "draw";
  }
}

function saveState() {
  const payload = {
    selectedMode: state.selectedMode,
    selectedPack: state.selectedPack,
    selectedVoice: state.selectedVoice,
    userVoiceOverride: state.userVoiceOverride,
    whisper: state.whisper,
    minimal: state.minimal,
    randomVoiceEachReveal: state.randomVoiceEachReveal,
    vault: state.vault,
    vaultFilter: state.vaultFilter,
    vaultSearch: state.vaultSearch,
    version: APP_VERSION,
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    localStorage.setItem(verboseKey, state.verboseDetails ? "1" : "0");
  } catch {
    // ignore
  }

  saveThemeSettings();
}

function saveThemeSettings() {
  try {
    localStorage.setItem(chaosEnabledKey, state.chaosThemeEnabled ? "1" : "0");
    if (state.themePalette) {
      localStorage.setItem(chaosPaletteKey, JSON.stringify(state.themePalette));
    } else {
      localStorage.removeItem(chaosPaletteKey);
    }
  } catch {
    // ignore
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inferPolarity(answer) {
  const text = String(answer || "").toLowerCase();
  if (
    text === "no" ||
    text.includes("nope") ||
    text.includes("no ") ||
    text.includes("not ") ||
    text.includes("heck no") ||
    text.includes("don't")
  ) {
    return "no";
  }
  return "yes";
}

function canonicalAnswersByPolarity(polarity) {
  const filtered = canonicalAnswers.filter((answer) => inferPolarity(answer) === polarity);
  return filtered.length ? filtered : canonicalAnswers;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initBackgroundVideos() {
  oracleBgController = createLoopVideoController(oracleBgVideo);
  galaxyBgController = createLoopVideoController(galaxyBgVideo);

  if (prefersReducedMotion) {
    if (oracleBgVideo) oracleBgVideo.currentTime = 0;
    if (galaxyBgVideo) galaxyBgVideo.currentTime = 0;
  } else {
    if (oracleBgController) oracleBgController.start();
    if (galaxyBgController) galaxyBgController.stop();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (oracleBgController) oracleBgController.stop();
      if (galaxyBgController) galaxyBgController.stop();
      return;
    }

    if (prefersReducedMotion) return;

    if (!galaxyView.hidden) {
      if (galaxyBgController) galaxyBgController.start();
    } else {
      if (oracleBgController) oracleBgController.start();
    }
  });
}

function primeBackgroundMedia() {
  [oracleBgVideo, galaxyBgVideo].forEach((video) => {
    if (!video) return;
    video.play().then(() => {
      if (video !== oracleBgVideo || galaxyView.hidden) video.pause();
    }).catch(() => {});
  });
}

function initOrbTapPool() {
  orbTapPool.length = 0;
  if (!orbTapAudio) return;
  for (let i = 0; i < 8; i += 1) {
    const node = i === 0 ? orbTapAudio : orbTapAudio.cloneNode(true);
    node.preload = "auto";
    node.load();
    orbTapPool.push(node);
  }
  primeOrbTapBuffer();
}

function primeOrbTapBuffer() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || orbTapBuffer || orbTapBufferPromise) return;
  if (!audioContext) audioContext = new AudioCtx();

  const src = orbTapAudio?.getAttribute("src") || "taporb.mp3";
  orbTapBufferPromise = fetch(src)
    .then((response) => response.arrayBuffer())
    .then((arr) => audioContext.decodeAudioData(arr.slice(0)))
    .then((decoded) => {
      orbTapBuffer = decoded;
    })
    .catch(() => {
      orbTapBuffer = null;
    })
    .finally(() => {
      orbTapBufferPromise = null;
    });
}

function createLoopVideoController(video) {
  if (!video) return null;
  let watchdog = null;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    video.load();
  } catch {
    // ignore load errors
  }
  video.addEventListener("ended", () => {
    try {
      video.currentTime = 0;
    } catch {
      // ignore
    }
    video.play().catch(() => {});
  });

  return {
    start() {
      video.loop = true;
      video.play().catch(() => {});
      if (watchdog) clearInterval(watchdog);
      watchdog = setInterval(() => {
        if (video.paused) {
          video.play().catch(() => {});
        }
      }, 1800);
    },
    stop() {
      video.pause();
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
      }
    },
  };
}

// === Arcade Mode ===
function initGalaxyCanvas() {
  if (!galaxyPlayCanvas) return;
  const ctx = galaxyPlayCanvas.getContext("2d");
  if (!ctx) return;

  const debugTaps = (() => {
    try {
      return localStorage.getItem(debugTapsKey) === "1";
    } catch {
      return false;
    }
  })();
  if (debugTaps) document.body.classList.add("debug");

  const EPS = 0.01;
  const MIN_SPEED = 10;

  const sim = {
    dpr: 1,
    width: 0,
    height: 0,
    last: 0,
    stars: [],
    asteroids: [],
    particles: [],
    warpRings: [],
    shooting: null,
    shootingTimer: null,
    maxAsteroids: 120,
    lastTapAt: 0,
    nextDrawAt: 0,
    asteroidPool: [],
    particlePool: [],
    ringPool: [],
  };

  const asteroidSpritePaths = {
    roid01: "astgfx/roid01.png",
    roid02: "astgfx/roid02.png",
    roid03: "astgfx/roid03.png",
    hotroid01: "astgfx/hotroid01.png",
  };
  const asteroidSprites = {};
  Object.keys(asteroidSpritePaths).forEach((key) => {
    const img = new Image();
    img.decoding = "async";
    img.src = asteroidSpritePaths[key];
    asteroidSprites[key] = img;
  });

  let galaxyRaf = 0;
  let galaxyRunning = false;
  let engineMode = "menu"; // menu | freestyle | arcade
  let overlayTimer = null;
  let currentBgSrc = "";

  let arcadeActive = false;
  let currentLevelIndex = 0;
  let levelEndsAt = 0;
  let levelDurationMs = 0;
  let levelRunStartAt = 0;
  let arcadePausedUntil = 0;
  let nextSpawnAt = Infinity;
  let spawnQueue = 0;
  let totalToSpawn = 0;
  let spawnedTotal = 0;
  let maxOnScreen = 12;
  let landmine = null;
  let landmineSpawnedThisLevel = false;
  let arcadeResumeAvailable = false;
  let pausedLevelRemainingMs = 0;
  let pausedLandmineRemainingMs = 0;
  let landmineFlashUntil = 0;
  let asteroidImpactFlashUntil = 0;
  let asteroidImpactFlashIntensity = 1;
  let lastAsteroidCollisionSfxAt = 0;
  let debugLevelUnlocked = false;
  let debugModeTapCount = 0;
  let debugModeTapLastAt = 0;

  const galaxyModeTitleEl = document.getElementById("galaxyModeTitle");
  const debugLevelPanel = document.getElementById("debugLevelPanel");
  const debugLevelSelect = document.getElementById("debugLevelSelect");
  const btnDebugStartLevel = document.getElementById("btnDebugStartLevel");

  const playfield = { x: 0, y: 0, w: 0, h: 0, pad: 12, topPad: 0, bottomPad: 0 };
  const canShowCrosshair = typeof window.matchMedia === "function"
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function getSafeInsets() {
    const cs = getComputedStyle(document.documentElement);
    const top = parseFloat(cs.getPropertyValue("--sat") || "0") || 0;
    const bottom = parseFloat(cs.getPropertyValue("--sab") || "0") || 0;
    return { top, bottom };
  }

  function setGalaxyViewMode(mode) {
    galaxyView.classList.toggle("mode-menu", mode === "menu");
    galaxyView.classList.toggle("mode-freestyle", mode === "freestyle");
    galaxyView.classList.toggle("mode-arcade", mode === "arcade");
    if (galaxyModeSelect) galaxyModeSelect.setAttribute("aria-hidden", mode === "menu" ? "false" : "true");
    if (arcadeHud) arcadeHud.setAttribute("aria-hidden", mode === "arcade" ? "false" : "true");
  }

  function formatMs(ms) {
    const safe = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updateArcadeHud(now) {
    const remainingMs = levelEndsAt - now;
    const safeRemaining = Math.max(0, remainingMs);
    if (hudLevel) hudLevel.textContent = `LEVEL ${ARCADE_LEVELS[currentLevelIndex]?.level || 1}`;
    if (hudTimer) {
      hudTimer.textContent = formatMs(safeRemaining);
      hudTimer.classList.toggle("danger", safeRemaining <= 10000 && safeRemaining > 0);
    }
    if (arcadeTimerGhost) arcadeTimerGhost.textContent = formatMs(safeRemaining);
    if (arcadeTimerBackdrop) {
      const ratio = levelDurationMs > 0 ? 1 - safeRemaining / levelDurationMs : 0;
      const opacity = clamp(0.08 + ratio * 0.64, 0.08, 0.72);
      arcadeTimerBackdrop.style.opacity = String(opacity);
      arcadeTimerBackdrop.classList.toggle("danger", safeRemaining <= 10000 && safeRemaining > 0);
      if (galaxyBgVideo) {
        const brightness = clamp(1 - ratio * 0.42, 0.58, 1);
        galaxyBgVideo.style.filter = `saturate(110%) contrast(105%) brightness(${brightness.toFixed(3)})`;
      }
    }
  }

  function syncArcadeEntryLabel() {
    if (!btnArcade) return;
    btnArcade.textContent = "Arcade";
  }

  function setArcadeSubmenu(mode = "root") {
    const showRoot = mode === "root";
    const showArcade = mode === "arcade";
    const showLevels = mode === "levels";
    if (btnArcade) btnArcade.style.display = showRoot ? "" : "none";
    if (btnFreestyle) btnFreestyle.style.display = showRoot ? "" : "none";
    if (debugLevelPanel) debugLevelPanel.style.display = showRoot && debugLevelUnlocked ? "" : "none";
    if (arcadeMenuPanel) {
      arcadeMenuPanel.hidden = !showArcade;
      arcadeMenuPanel.classList.toggle("show", showArcade);
      arcadeMenuPanel.setAttribute("aria-hidden", showArcade ? "false" : "true");
    }
    if (arcadeLevelPanel) {
      arcadeLevelPanel.hidden = !showLevels;
      arcadeLevelPanel.classList.toggle("show", showLevels);
      arcadeLevelPanel.setAttribute("aria-hidden", showLevels ? "false" : "true");
    }
  }

  function buildArcadeLevelSelect() {
    if (!arcadeLevelGrid) return;
    if (arcadeLevelGrid.children.length) return;
    for (let i = 0; i < ARCADE_LEVELS.length; i += 1) {
      const level = ARCADE_LEVELS[i].level;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arcadeLevelBtn";
      button.textContent = String(level);
      button.addEventListener("click", () => {
        setSavedArcadeLevel(level);
        startArcadeAtLevel(level);
      });
      arcadeLevelGrid.appendChild(button);
    }
  }

  function syncArcadeMenuButtons() {
    if (btnArcadeResume) btnArcadeResume.disabled = !(arcadeResumeAvailable || hasArcadeSave());
    if (btnArcadeLevelSelect) btnArcadeLevelSelect.disabled = !(DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon());
  }

  function syncDebugLevelPanel() {
    if (!debugLevelPanel) return;
    const visible = debugLevelUnlocked && engineMode === "menu" && btnArcade?.style.display !== "none";
    debugLevelPanel.hidden = !visible;
    debugLevelPanel.classList.toggle("unlocked", visible);
    debugLevelPanel.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function buildDebugLevelSelect() {
    if (!debugLevelSelect) return;
    if (debugLevelSelect.options.length > 0) return;
    for (let i = 0; i < ARCADE_LEVELS.length; i += 1) {
      const level = ARCADE_LEVELS[i].level;
      const option = document.createElement("option");
      option.value = String(level);
      option.textContent = `Level ${level}`;
      debugLevelSelect.appendChild(option);
    }
    debugLevelSelect.value = "1";
  }

  function registerDebugLevelUnlockTap() {
    if (engineMode !== "menu") return;
    const now = performance.now();
    if (now - debugModeTapLastAt > 1600) debugModeTapCount = 0;
    debugModeTapLastAt = now;
    debugModeTapCount += 1;
    if (debugModeTapCount >= 7) {
      debugModeTapCount = 0;
      debugLevelUnlocked = true;
      syncDebugLevelPanel();
    }
  }

  function showArcadeOverlay(text, sub = "", durationMs = 0, opts = null) {
    if (!arcadeOverlay || !arcadeOverlayText || !arcadeOverlaySub || !arcadeOverlayBtn) return;
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    arcadeOverlayText.textContent = text || "";
    arcadeOverlaySub.textContent = sub || "";
    arcadeOverlayBtn.style.display = opts?.buttonText ? "inline-block" : "none";
    arcadeOverlayBtn.textContent = opts?.buttonText || "";
    arcadeOverlayBtn.onclick = opts?.buttonAction || null;
    arcadeOverlay.classList.add("show");
    if (durationMs > 0) {
      overlayTimer = setTimeout(() => {
        arcadeOverlay.classList.remove("show");
        overlayTimer = null;
      }, durationMs);
    }
  }

  function hideArcadeOverlay() {
    if (!arcadeOverlay || !arcadeOverlayText) return;
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    arcadeOverlay.classList.remove("show");
    arcadeOverlayText.classList.remove("show", "fadeOut");
  }

  function showLevelIntro(levelNum) {
    if (!arcadeOverlay || !arcadeOverlayText || !arcadeOverlaySub || !arcadeOverlayBtn) return;
    if (overlayTimer) clearTimeout(overlayTimer);

    arcadeOverlay.classList.add("show");
    arcadeOverlay.setAttribute("aria-hidden", "false");
    arcadeOverlayBtn.style.display = "none";
    arcadeOverlaySub.textContent = "";
    arcadeOverlayText.textContent = `LEVEL ${levelNum}`;
    arcadeOverlayText.classList.remove("fadeOut");
    void arcadeOverlayText.offsetWidth;
    arcadeOverlayText.classList.add("show");

    overlayTimer = setTimeout(() => {
      arcadeOverlayText.classList.add("fadeOut");
      overlayTimer = setTimeout(() => {
        arcadeOverlay.classList.remove("show");
        arcadeOverlay.setAttribute("aria-hidden", "true");
        arcadeOverlayText.classList.remove("show", "fadeOut");
        overlayTimer = null;
      }, 1000);
    }, 400);
  }

  function getAsteroid() {
    return sim.asteroidPool.pop() || {};
  }

  function releaseAsteroid(a) {
    a.shape = null;
    sim.asteroidPool.push(a);
  }

  function getParticle() {
    return sim.particlePool.pop() || {};
  }

  function releaseParticle(p) {
    sim.particlePool.push(p);
  }

  function getRing() {
    return sim.ringPool.pop() || {};
  }

  function releaseRing(ring) {
    sim.ringPool.push(ring);
  }

  function randomVelocity(min, max) {
    const angle = Math.random() * Math.PI * 2;
    const speed = min + Math.random() * (max - min);
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function makeShape(pointCount) {
    const points = [];
    for (let i = 0; i < pointCount; i += 1) {
      points.push({
        angle: (Math.PI * 2 * i) / pointCount,
        offset: 0.74 + Math.random() * 0.4,
      });
    }
    return points;
  }

  function getBgForLevel(levelNum) {
    if (levelNum >= 10) return BG.D;
    if (levelNum >= 8) return BG.C;
    if (levelNum >= 5) return BG.B;
    return BG.A;
  }

  function getAsteroidSpriteForLevel(levelNum) {
    if (levelNum >= 10) return asteroidSprites.hotroid01;
    if (levelNum >= 7) return asteroidSprites.roid03;
    if (levelNum >= 4) return asteroidSprites.roid02;
    return asteroidSprites.roid01;
  }

  function getAsteroidSpriteKeyForLevel(levelNum) {
    if (levelNum >= 10) return "hotroid01";
    if (levelNum >= 7) return "roid03";
    if (levelNum >= 4) return "roid02";
    if (levelNum === 2) return Math.random() < 0.5 ? "roid01" : "roid02";
    return "roid01";
  }

  function setGalaxyBackgroundForLevel(levelNum) {
    const bgVideo = galaxyBgVideo;
    if (!bgVideo) return;
    const src = getBgForLevel(levelNum);
    if (src === currentBgSrc) return;
    const isFirstLoad = !currentBgSrc;
    currentBgSrc = src;

    if (isFirstLoad) {
      bgVideo.src = src;
      bgVideo.load();
      bgVideo.play().catch(() => {});
      return;
    }

    bgVideo.style.transition = "opacity 280ms ease";
    bgVideo.style.opacity = "0";
    setTimeout(() => {
      bgVideo.src = src;
      bgVideo.load();
      bgVideo.play().catch(() => {});
      bgVideo.style.opacity = "";
    }, 120);
  }

  function computePlayfield() {
    const hudHeight = arcadeHud && arcadeHud.offsetParent !== null ? Math.ceil(arcadeHud.getBoundingClientRect().height) : 0;
    const topBar = galaxyView.querySelector(".galaxy-topbar");
    const topBarHeight = topBar && topBar.offsetParent !== null ? Math.ceil(topBar.getBoundingClientRect().height) : 0;
    const hint = galaxyView.querySelector(".galaxy-hint");
    const hintHeight = hint && hint.offsetParent !== null ? Math.ceil(hint.getBoundingClientRect().height) : 0;
    const safe = getSafeInsets();
    const pad = 12;
    const topPad = Math.max(hudHeight, topBarHeight) + safe.top + pad;
    const bottomPad = hintHeight + safe.bottom + 44 + pad;

    playfield.x = pad;
    playfield.y = topPad;
    playfield.w = Math.max(120, sim.width - pad * 2);
    playfield.h = Math.max(200, sim.height - topPad - bottomPad);
    playfield.pad = pad;
    playfield.topPad = topPad;
    playfield.bottomPad = bottomPad;
  }

  function randomPerimeterPoint() {
    const edge = Math.floor(Math.random() * 4);
    const left = playfield.x;
    const top = playfield.y;
    const right = playfield.x + playfield.w;
    const bottom = playfield.y + playfield.h;
    const pad = 20;
    if (edge === 0) return { x: left + Math.random() * playfield.w, y: top - pad };
    if (edge === 1) return { x: right + pad, y: top + Math.random() * playfield.h };
    if (edge === 2) return { x: left + Math.random() * playfield.w, y: bottom + pad };
    return { x: left - pad, y: top + Math.random() * playfield.h };
  }

  function clampSpeed(entity) {
    const s = Math.hypot(entity.vx, entity.vy);
    if (!Number.isFinite(s)) {
      entity.vx = 30;
      entity.vy = 20;
      return;
    }
    if (s < MIN_SPEED) {
      const ang = Math.random() * Math.PI * 2;
      entity.vx = Math.cos(ang) * MIN_SPEED;
      entity.vy = Math.sin(ang) * MIN_SPEED;
    }
  }

  function wrapEntity(entity) {
    const left = playfield.x;
    const top = playfield.y;
    const right = playfield.x + playfield.w;
    const bottom = playfield.y + playfield.h;

    if (entity.x < left - entity.r) entity.x = right + entity.r - EPS;
    else if (entity.x > right + entity.r) entity.x = left - entity.r + EPS;
    if (entity.y < top - entity.r) entity.y = bottom + entity.r - EPS;
    else if (entity.y > bottom + entity.r) entity.y = top - entity.r + EPS;
  }

  function applyMotionHealth(entity, now) {
    const moved = Math.hypot(entity.x - entity.lastX, entity.y - entity.lastY);
    if (moved > 0.2) {
      entity.lastX = entity.x;
      entity.lastY = entity.y;
      entity.lastMoveAt = now;
      return;
    }
    if (now - entity.lastMoveAt > 600) {
      const ang = Math.random() * Math.PI * 2;
      entity.vx += Math.cos(ang) * 15;
      entity.vy += Math.sin(ang) * 15;
      entity.lastMoveAt = now;
    }
  }

  function boomStackVolume(baseVolume) {
    const now = performance.now();
    while (boomTimes.length && now - boomTimes[0] > 150) boomTimes.shift();
    const count = boomTimes.length;
    boomTimes.push(now);
    return baseVolume * (1 / (1 + count * 0.35));
  }

  function playGameSfx(name, volume = 0.9, opts = {}) {
    if (state.minimal) return;
    audioEngine.play(name, {
      volume: clamp(volume * (state.whisper ? 0.55 : 1), 0, 1),
      rate: opts.rate || 1,
      detune: opts.detune || 0,
    });
  }

  // === Warp Spawns ===
  function playWarpSound() {
    if (prefersReducedMotion || state.minimal) return;
    playGameSfx("warp", 0.48, { rate: 0.98 + Math.random() * 0.08 });
  }

  function playArmSound() {
    playGameSfx("landmine_arm", 0.84);
  }

  function playBigBoomSound() {
    playGameSfx("landmine_boom", 0.92);
  }

  function triggerLandmineScreenFlash() {
    landmineFlashUntil = performance.now() + 220;
  }

  function triggerAsteroidImpactFlash(intensity = 1) {
    const safeIntensity = clamp(intensity, 0, 1);
    asteroidImpactFlashIntensity = safeIntensity;
    const duration = safeIntensity <= 0.25 ? 80 : safeIntensity <= 0.55 ? 120 : (prefersReducedMotion ? 100 : 220);
    asteroidImpactFlashUntil = performance.now() + duration;
  }

  function addWarpRing(x, y, color = "rgba(112,255,178,1)") {
    const ring = getRing();
    ring.x = x;
    ring.y = y;
    ring.life = 0;
    ring.ttl = prefersReducedMotion ? 300 : 450;
    ring.baseR = prefersReducedMotion ? 8 : 10;
    ring.maxR = prefersReducedMotion ? 36 : 54;
    ring.alpha = prefersReducedMotion ? 0.24 : 0.42;
    ring.color = color;
    sim.warpRings.push(ring);
  }

  function spawnAsteroid(x, y, kind = 3, warp = true) {
    if (sim.asteroids.length >= sim.maxAsteroids) return null;
    const a = getAsteroid();
    const r = kind === 3 ? 26 + Math.random() * 12 : kind === 2 ? 18 + Math.random() * 8 : 10 + Math.random() * 6;
    const speed = kind === 3 ? 18 + Math.random() * 20 : kind === 2 ? 28 + Math.random() * 27 : 45 + Math.random() * 35;
    const v = randomVelocity(speed * 0.8, speed);
    a.x = x;
    a.y = y;
    a.vx = v.vx;
    a.vy = v.vy;
    a.r = r;
    a.mass = r * r;
    a.kind = kind;
    const levelNum = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
    a.spriteKey = getAsteroidSpriteKeyForLevel(levelNum);
    a.rot = Math.random() * Math.PI * 2;
    a.spin = (Math.random() - 0.5) * 0.06;
    a.shape = makeShape(8 + Math.floor(Math.random() * 4));
    a.lastX = x;
    a.lastY = y;
    a.lastMoveAt = performance.now();
    sim.asteroids.push(a);
    if (warp) {
      playWarpSound();
      addWarpRing(x, y);
    }
    return a;
  }

  function spawnLandmine() {
    const x = playfield.x + playfield.w * (0.25 + Math.random() * 0.5);
    const y = playfield.y + playfield.h * (0.25 + Math.random() * 0.5);
    const r = 14;
    landmine = {
      x,
      y,
      r,
      mass: r * r * 2,
      vx: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25),
      vy: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25),
      armedAt: 0,
      explodeAt: 0,
      lastX: x,
      lastY: y,
      lastMoveAt: performance.now(),
    };
    playGameSfx("blip1", 0.8, { rate: 1.05 });
    addWarpRing(x, y, "rgba(124,255,91,1)");
  }

  function levelHasLandmine(levelNum) {
    return levelNum === 3 || levelNum === 5 || levelNum === 8;
  }

  function spawnExplosion(x, y, count = 14, fire = false, blastScale = 1, ttlScale = 1) {
    const emitCount = prefersReducedMotion ? Math.min(6, count) : count;
    for (let i = 0; i < emitCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 110;
      const p = getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0;
      p.ttl = (320 + Math.random() * 180) * ttlScale;
      p.size = (1.7 + Math.random() * 2.4) * blastScale;
      p.alpha = 0.45 + Math.random() * 0.4;
      if (fire) {
        p.color = `rgba(${220 + Math.floor(Math.random() * 35)},${100 + Math.floor(Math.random() * 90)},${30 + Math.floor(Math.random() * 40)},`;
      } else {
        const tone = Math.random();
        if (tone < 0.48) {
          p.color = `rgba(${245 + Math.floor(Math.random() * 10)},${238 + Math.floor(Math.random() * 14)},${210 + Math.floor(Math.random() * 24)},`;
        } else if (tone < 0.84) {
          p.color = `rgba(${242 + Math.floor(Math.random() * 13)},${188 + Math.floor(Math.random() * 44)},${70 + Math.floor(Math.random() * 50)},`;
        } else {
          p.color = `rgba(${12 + Math.floor(Math.random() * 18)},${10 + Math.floor(Math.random() * 18)},${8 + Math.floor(Math.random() * 18)},`;
          p.ttl += 520 + Math.random() * 260;
          p.size *= 1.35;
          p.vx *= 0.42;
          p.vy *= 0.42;
          p.alpha = Math.max(p.alpha, 0.62);
        }
      }
      sim.particles.push(p);
    }
  }

  function playBoomSound(intensity = 1) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || state.minimal) return;
    if (!audioContext) audioContext = new AudioCtx();
    const now = audioContext.currentTime;
    const master = audioContext.createGain();
    const osc = audioContext.createOscillator();
    const noise = audioContext.createOscillator();
    const toneGain = audioContext.createGain();
    const noiseGain = audioContext.createGain();
    master.connect(audioContext.destination);
    osc.connect(toneGain);
    noise.connect(noiseGain);
    toneGain.connect(master);
    noiseGain.connect(master);
    const peak = clamp((state.whisper ? 0.08 : 0.26) * intensity, 0.06, 0.42);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    toneGain.gain.setValueAtTime(0.4, now);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    noise.type = "square";
    noise.frequency.setValueAtTime(40, now);
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.24);
    noise.stop(now + 0.2);
  }

  function resolveCircleCollision(a, b, restitution = 0.92, playCollisionSfx = true) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const minDist = a.r + b.r;
    let distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return;

    if (distSq <= EPS) {
      const ang = Math.random() * Math.PI * 2;
      dx = Math.cos(ang);
      dy = Math.sin(ang);
      distSq = 1;
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const totalMass = a.mass + b.mass;
    const pushA = overlap * (b.mass / totalMass);
    const pushB = overlap * (a.mass / totalMass);
    a.x -= nx * pushA;
    a.y -= ny * pushA;
    b.x += nx * pushB;
    b.y += ny * pushB;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) return;

    const impulse = (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
    const ix = impulse * nx;
    const iy = impulse * ny;
    a.vx -= ix / a.mass;
    a.vy -= iy / a.mass;
    b.vx += ix / b.mass;
    b.vy += iy / b.mass;

    if (playCollisionSfx) {
      const now = performance.now();
      const impact = Math.abs(velAlongNormal);
      if (impact > 8 && now - lastAsteroidCollisionSfxAt > 95) {
        const isBigCollision = (a.kind || 1) >= 3 || (b.kind || 1) >= 3;
        playGameSfx(isBigCollision ? "astcollide2" : "astcollide1", 0.44);
        lastAsteroidCollisionSfxAt = now;
      }
    }
  }

  // === Collisions ===
  function resolveAsteroidCollisions() {
    const count = sim.asteroids.length;
    if (count < 2) return;
    if (count > 30 && engineMode !== "arcade") return;
    for (let i = 0; i < count - 1; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        resolveCircleCollision(sim.asteroids[i], sim.asteroids[j], 0.92);
      }
    }
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      wrapEntity(sim.asteroids[i]);
      clampSpeed(sim.asteroids[i]);
    }
  }

  function collideLandmineWithAsteroids() {
    if (!landmine) return;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      resolveCircleCollision(landmine, sim.asteroids[i], 0.9, false);
    }
    wrapEntity(landmine);
    clampSpeed(landmine);
  }

  function findHitAsteroidIndex(x, y) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const dx = a.x - x;
      const dy = a.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= a.r + 10 && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  function isPointOnLandmine(x, y) {
    if (!landmine) return false;
    const d = Math.hypot(landmine.x - x, landmine.y - y);
    return d <= landmine.r + 10;
  }

  function removeAsteroidAt(index) {
    const a = sim.asteroids[index];
    if (!a) return null;
    const last = sim.asteroids.length - 1;
    sim.asteroids[index] = sim.asteroids[last];
    sim.asteroids.pop();
    return a;
  }

  function splitAsteroidByIndex(targetIndex) {
    const a = removeAsteroidAt(targetIndex);
    if (!a) return;

    const wasKind = a.kind;
    const baseX = a.x;
    const baseY = a.y;
    const parentSpeed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    releaseAsteroid(a);

    if (wasKind > 1) {
      const childCount = wasKind === 3 ? (3 + Math.floor(Math.random() * 3)) : (2 + Math.floor(Math.random() * 2));
      for (let i = 0; i < childCount; i += 1) {
        if (sim.asteroids.length >= sim.maxAsteroids) break;
        const child = spawnAsteroid(baseX, baseY, wasKind - 1, true);
        if (!child) break;
        const boost = 1.5 + Math.random() * 0.7;
        child.vx += (child.vx / Math.max(1, Math.abs(child.vx))) * parentSpeed * 0.2 * boost;
        child.vy += (child.vy / Math.max(1, Math.abs(child.vy))) * parentSpeed * 0.2 * boost;
      }
    }

    const bigBlast = wasKind === 3;
    const mediumBlast = wasKind === 2;
    const ttlScale = bigBlast ? 1.4 : mediumBlast ? 1.18 : 1;
    spawnExplosion(baseX, baseY, bigBlast ? 32 : 16, false, bigBlast ? 1.8 : 1.15, ttlScale);
    const explodeKey = wasKind === 3 ? "explosion_big" : wasKind === 2 ? "explosion_med" : "explosion_small";
    playGameSfx(explodeKey, boomStackVolume(wasKind === 3 ? 0.9 : wasKind === 2 ? 0.72 : 0.56), {
      rate: 0.92 + Math.random() * 0.16,
    });
    if (bigBlast) {
      triggerAsteroidImpactFlash(1);
    } else if (mediumBlast) {
      triggerAsteroidImpactFlash(0.5);
      setTimeout(() => {
        triggerAsteroidImpactFlash(0.4);
      }, 90);
    } else {
      triggerAsteroidImpactFlash(0.2);
    }
  }

  function vaporizeAsteroidByIndex(targetIndex) {
    const a = removeAsteroidAt(targetIndex);
    if (!a) return;
    const bigBlast = a.kind === 3;
    spawnExplosion(a.x, a.y, bigBlast ? 24 : 14, false, bigBlast ? 1.6 : 1.1);
    const explodeKey = bigBlast ? "explosion_big" : a.kind === 2 ? "explosion_med" : "explosion_small";
    playGameSfx(explodeKey, boomStackVolume(bigBlast ? 0.82 : 0.56), { rate: 0.92 + Math.random() * 0.14 });
    releaseAsteroid(a);
  }

  function armLandmine() {
    if (!landmine || landmine.explodeAt) return;
    const now = performance.now();
    landmine.armedAt = now;
    landmine.explodeAt = now + 1000;
    playGameSfx("landmine_arm", 0.96);
  }

  function explodeLandmine() {
    if (!landmine) return;
    const x = landmine.x;
    const y = landmine.y;
    const radius = 700;
    landmine = null;

    const toDestroy = [];
    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      if (Math.hypot(a.x - x, a.y - y) <= radius + a.r) toDestroy.push(i);
    }
    for (let i = toDestroy.length - 1; i >= 0; i -= 1) {
      vaporizeAsteroidByIndex(toDestroy[i]);
    }
    addWarpRing(x, y, "rgba(255,90,90,1)");
    spawnExplosion(x, y, 80, true);
    triggerLandmineScreenFlash();
    playBigBoomSound();
  }

  function pointFromEvent(event) {
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function clearGameplayEntities() {
    while (sim.asteroids.length) releaseAsteroid(sim.asteroids.pop());
    while (sim.particles.length) releaseParticle(sim.particles.pop());
    while (sim.warpRings.length) releaseRing(sim.warpRings.pop());
    sim.shooting = null;
    landmine = null;
    landmineSpawnedThisLevel = false;
  }

  function levelComplete() {
    arcadeActive = false;
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    const cfg = ARCADE_LEVELS[currentLevelIndex];
    const nextLevel = cfg.level + 1;
    if (nextLevel <= ARCADE_LEVELS.length) {
      setSavedArcadeLevel(nextLevel);
      showLevelIntro(nextLevel);
      setTimeout(() => startLevel(currentLevelIndex + 1), 420);
      return;
    }
    setArcadeWon();
    clearArcadeProgress();
    syncArcadeMenuButtons();
    try {
      localStorage.setItem(STORAGE.rewardCelestial, "1");
    } catch {
      // ignore
    }
    showArcadeOverlay("YOU WIN", "Reward unlocked: Celestial Pack", 0, {
      buttonText: "Back to Modes",
      buttonAction: () => showModeSelect(),
    });
  }

  function triggerGameOver() {
    arcadeActive = false;
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    clearArcadeProgress();
    syncArcadeMenuButtons();
    playGameSfx("gameover", 0.96);
    showArcadeOverlay("GAME OVER", "You died. Progress lost. Try again.", 0, {
      buttonText: "Back to Modes",
      buttonAction: () => showModeSelect(),
    });
  }

  function startLevel(idx) {
    const safeIdx = clamp(idx, 0, ARCADE_LEVELS.length - 1);
    currentLevelIndex = safeIdx;
    const cfg = ARCADE_LEVELS[safeIdx];
    const now = performance.now();
    setSavedArcadeLevel(cfg.level);

    clearGameplayEntities();
    totalToSpawn = cfg.totalToClear;
    spawnedTotal = 0;
    spawnQueue = Math.max(0, cfg.totalToClear - cfg.startSpawn);
    maxOnScreen = cfg.maxOnScreen;
    sim.maxAsteroids = cfg.maxOnScreen;
    levelDurationMs = cfg.time * 1000;
    levelRunStartAt = now + 400;
    arcadePausedUntil = levelRunStartAt;
    levelEndsAt = levelRunStartAt + levelDurationMs;
    nextSpawnAt = cfg.spawnEveryMs > 0 ? levelRunStartAt + cfg.spawnEveryMs : Infinity;
    landmine = null;
    landmineSpawnedThisLevel = false;
    pausedLevelRemainingMs = 0;
    pausedLandmineRemainingMs = 0;
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();

    setGalaxyBackgroundForLevel(cfg.level);
    if (cfg.level === 10) {
      playGameSfx("lastlevelstart", 0.96);
    }
    for (let i = 0; i < cfg.startSpawn; i += 1) {
      const p = randomPerimeterPoint();
      spawnAsteroid(p.x, p.y, 3, false);
      spawnedTotal += 1;
    }

    arcadeActive = true;
    updateArcadeHud(now);
    showLevelIntro(cfg.level);
  }

  function startArcadeFromSave() {
    hideArcadeOverlay();
    if (arcadeResumeAvailable && arcadeActive) {
      const now = performance.now();
      levelEndsAt = now + pausedLevelRemainingMs;
      if (landmine && landmine.explodeAt) {
        landmine.explodeAt = now + pausedLandmineRemainingMs;
      }
      engineMode = "arcade";
      setGalaxyViewMode("arcade");
      setGalaxyTool("draw");
      resizeGalaxyCanvas();
      computePlayfield();
      setTimeout(computePlayfield, 50);
      startGalaxyLoop();
      arcadeResumeAvailable = false;
      syncArcadeEntryLabel();
      return;
    }
    engineMode = "arcade";
    arcadeActive = true;
    setGalaxyViewMode("arcade");
    setGalaxyTool("draw");
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    const saved = getSavedArcadeLevel();
    const idx = clamp(saved - 1, 0, ARCADE_LEVELS.length - 1);
    startLevel(idx);
    startGalaxyLoop();
  }

  function startArcadeNew() {
    clearArcadeProgress();
    setSavedArcadeLevel(1);
    startArcadeAtLevel(1);
  }

  function startArcadeResume() {
    startArcadeFromSave();
  }

  function openArcadeMenu() {
    setArcadeSubmenu("arcade");
    syncArcadeMenuButtons();
  }

  function openArcadeLevelSelect() {
    if (!(DEBUG_FORCE_LEVEL_SELECT || hasArcadeWon())) return;
    buildArcadeLevelSelect();
    setArcadeSubmenu("levels");
  }

  function startArcadeAtLevel(levelNum) {
    hideArcadeOverlay();
    engineMode = "arcade";
    arcadeActive = true;
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    setGalaxyViewMode("arcade");
    setGalaxyTool("draw");
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    const numericLevel = Math.floor(Number(levelNum));
    const idx = clamp((Number.isFinite(numericLevel) ? numericLevel : 1) - 1, 0, ARCADE_LEVELS.length - 1);
    startLevel(idx);
    startGalaxyLoop();
  }

  function startFreestyleMode() {
    hideArcadeOverlay();
    engineMode = "freestyle";
    arcadeActive = false;
    arcadeResumeAvailable = false;
    syncArcadeEntryLabel();
    setGalaxyViewMode("freestyle");
    sim.maxAsteroids = sim.width < 700 ? 80 : 120;
    setGalaxyBackgroundForLevel(1);
    setGalaxyTool("draw");
    sim.nextDrawAt = 0;
    resizeGalaxyCanvas();
    computePlayfield();
    setTimeout(computePlayfield, 50);
    startGalaxyLoop();
  }

  function showModeSelect({ preserveArcade = false } = {}) {
    hideArcadeOverlay();
    const canPreserve = preserveArcade && engineMode === "arcade" && arcadeActive;
    if (canPreserve) {
      const now = performance.now();
      pausedLevelRemainingMs = Math.max(0, levelEndsAt - now);
      pausedLandmineRemainingMs = landmine && landmine.explodeAt ? Math.max(0, landmine.explodeAt - now) : 0;
      arcadeResumeAvailable = true;
    } else {
      clearGameplayEntities();
      arcadeActive = false;
      arcadeResumeAvailable = false;
      if (galaxyBgVideo) {
        galaxyBgVideo.style.filter = "saturate(110%) contrast(105%) brightness(1)";
      }
    }
    engineMode = "menu";
    syncArcadeEntryLabel();
    setArcadeSubmenu("root");
    syncArcadeMenuButtons();
    setGalaxyViewMode("menu");
    sim.maxAsteroids = sim.width < 700 ? 80 : 120;
    setGalaxyTool("draw");
    if (!canPreserve) {
      setGalaxyBackgroundForLevel(1);
    }
    if (arcadeTimerBackdrop) {
      arcadeTimerBackdrop.style.opacity = "0";
      arcadeTimerBackdrop.classList.remove("danger");
    }
    resizeGalaxyCanvas();
    computePlayfield();
    updateArcadeHud(performance.now());
    if (debugLevelSelect) {
      const fallbackLevel = ARCADE_LEVELS[currentLevelIndex]?.level || getSavedArcadeLevel();
      debugLevelSelect.value = String(fallbackLevel);
    }
    syncDebugLevelPanel();
    startGalaxyLoop();
    draw(performance.now());
  }

  function resizeGalaxyCanvas() {
    sim.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const height = Math.max(1, Math.floor(rect.height || window.innerHeight));
    sim.width = width;
    sim.height = height;
    galaxyPlayCanvas.width = Math.floor(width * sim.dpr);
    galaxyPlayCanvas.height = Math.floor(height * sim.dpr);
    ctx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
    if (engineMode !== "arcade") sim.maxAsteroids = sim.width < 700 ? 80 : 120;
    seedStars();
    computePlayfield();
  }

  function seedStars() {
    const target = Math.max(90, Math.min(190, Math.round((sim.width * sim.height) / 10000)));
    sim.stars = Array.from({ length: target }, () => ({
      x: Math.random() * sim.width,
      y: Math.random() * sim.height,
      r: 0.5 + Math.random() * 1.4,
      baseAlpha: 0.18 + Math.random() * 0.5,
      twinkleSpeed: 0.4 + Math.random(),
      phase: Math.random() * Math.PI * 2,
      driftX: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.003,
      driftY: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.003,
    }));
  }

  function spawnShootingStar() {
    if (prefersReducedMotion || !galaxyRunning || state.minimal) return;
    const startX = Math.random() * sim.width * 0.8;
    const startY = Math.random() * sim.height * 0.5;
    const speed = 0.9 + Math.random() * 0.7;
    sim.shooting = {
      x: startX,
      y: startY,
      vx: 0.95 * speed,
      vy: 0.55 * speed,
      length: 70 + Math.random() * 50,
      life: 0,
      ttl: 650 + Math.random() * 450,
    };
  }

  function scheduleShootingStar() {
    if (prefersReducedMotion || state.minimal) return;
    clearTimeout(sim.shootingTimer);
    const delay = 10000 + Math.random() * 15000;
    sim.shootingTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, delay);
  }

  function update(dt, now) {
    const driftScale = prefersReducedMotion ? 0 : 1;
    for (let i = 0; i < sim.stars.length; i += 1) {
      const s = sim.stars[i];
      s.x += s.driftX * dt * driftScale;
      s.y += s.driftY * dt * driftScale;
      if (s.x < 0) s.x += sim.width;
      if (s.y < 0) s.y += sim.height;
      if (s.x > sim.width) s.x -= sim.width;
      if (s.y > sim.height) s.y -= sim.height;
    }

    if (engineMode === "arcade" && arcadeActive) {
      const cfg = ARCADE_LEVELS[currentLevelIndex];
      const remainingMs = levelEndsAt - now;
      updateArcadeHud(now);

      if (remainingMs <= 0) {
        triggerGameOver();
      }

      if (now >= arcadePausedUntil) {
        if (cfg.spawnEveryMs > 0 && spawnQueue > 0 && now >= nextSpawnAt) {
          if (sim.asteroids.length < maxOnScreen) {
            const p = randomPerimeterPoint();
            spawnAsteroid(p.x, p.y, 3, true);
            spawnQueue -= 1;
            spawnedTotal += 1;
            nextSpawnAt += cfg.spawnEveryMs;
          } else {
            nextSpawnAt = now + 180;
          }
        }

        const elapsedMs = Math.max(0, now - levelRunStartAt);
        if (!landmineSpawnedThisLevel && levelHasLandmine(cfg.level) && elapsedMs >= levelDurationMs / 2) {
          spawnLandmine();
          landmineSpawnedThisLevel = true;
        }
      }

      if (spawnQueue === 0 && spawnedTotal >= totalToSpawn && sim.asteroids.length === 0) {
        levelComplete();
      }
    }

    const gameplayAllowed = engineMode === "freestyle" || (engineMode === "arcade" && now >= arcadePausedUntil);
    if (gameplayAllowed) {
      for (let i = 0; i < sim.asteroids.length; i += 1) {
        const a = sim.asteroids[i];
        a.x += a.vx * (dt / 1000);
        a.y += a.vy * (dt / 1000);
        a.rot += a.spin * (dt / 16);
        wrapEntity(a);
        clampSpeed(a);
        applyMotionHealth(a, now);
      }
      resolveAsteroidCollisions();

      if (landmine) {
        landmine.x += landmine.vx * (dt / 1000);
        landmine.y += landmine.vy * (dt / 1000);
        wrapEntity(landmine);
        clampSpeed(landmine);
        applyMotionHealth(landmine, now);
        collideLandmineWithAsteroids();
        if (landmine.explodeAt && now >= landmine.explodeAt) {
          explodeLandmine();
        }
      }
    }

    for (let i = sim.particles.length - 1; i >= 0; i -= 1) {
      const p = sim.particles[i];
      p.life += dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      if (p.life >= p.ttl) {
        sim.particles[i] = sim.particles[sim.particles.length - 1];
        sim.particles.pop();
        releaseParticle(p);
      }
    }

    for (let i = sim.warpRings.length - 1; i >= 0; i -= 1) {
      const ring = sim.warpRings[i];
      ring.life += dt;
      if (ring.life >= ring.ttl) {
        sim.warpRings[i] = sim.warpRings[sim.warpRings.length - 1];
        sim.warpRings.pop();
        releaseRing(ring);
      }
    }

    if (sim.shooting) {
      sim.shooting.life += dt;
      sim.shooting.x += sim.shooting.vx * dt;
      sim.shooting.y += sim.shooting.vy * dt;
      if (sim.shooting.life >= sim.shooting.ttl) sim.shooting = null;
    }

    draw(now);
  }

  function draw(now) {
    ctx.clearRect(0, 0, sim.width, sim.height);

    for (let i = 0; i < sim.stars.length; i += 1) {
      const s = sim.stars[i];
      const twinkle = prefersReducedMotion ? 0 : Math.sin(now * 0.001 * s.twinkleSpeed + s.phase) * 0.2;
      const alpha = Math.max(0.08, Math.min(0.9, s.baseAlpha + twinkle));
      ctx.beginPath();
      ctx.fillStyle = `rgba(214,227,255,${alpha.toFixed(3)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < sim.asteroids.length; i += 1) {
      const a = sim.asteroids[i];
      const levelNum = engineMode === "arcade" ? (ARCADE_LEVELS[currentLevelIndex]?.level || 1) : 1;
      const sprite = asteroidSprites[a.spriteKey] || getAsteroidSpriteForLevel(levelNum);
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const d = a.r * 2;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.drawImage(sprite, -a.r, -a.r, d, d);
        ctx.restore();
      } else {
        ctx.beginPath();
        for (let j = 0; j < a.shape.length; j += 1) {
          const point = a.shape[j];
          const px = a.x + Math.cos(point.angle + a.rot) * a.r * point.offset;
          const py = a.y + Math.sin(point.angle + a.rot) * a.r * point.offset;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const fill = a.kind === 3 ? "rgba(145,106,68,0.82)" : a.kind === 2 ? "rgba(126,92,61,0.82)" : "rgba(112,84,58,0.82)";
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(246,220,184,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (landmine) {
      ctx.save();
      ctx.translate(landmine.x, landmine.y);
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      const armed = !!landmine.explodeAt;
      const hullGradient = ctx.createRadialGradient(-landmine.r * 0.35, -landmine.r * 0.35, 2, 0, 0, landmine.r * 1.15);
      hullGradient.addColorStop(0, armed ? "rgba(92,44,44,0.98)" : "rgba(56,58,66,0.98)");
      hullGradient.addColorStop(0.6, armed ? "rgba(38,28,28,0.98)" : "rgba(26,30,40,0.98)");
      hullGradient.addColorStop(1, "rgba(12,16,24,0.98)");
      ctx.beginPath();
      ctx.arc(0, 0, landmine.r, 0, Math.PI * 2);
      ctx.fillStyle = hullGradient;
      ctx.fill();
      ctx.strokeStyle = armed ? "rgba(255,90,90,0.4)" : "rgba(255,255,255,0.16)";
      ctx.stroke();

      const blink = Math.sin(now / 120) > 0 ? 1 : 0;
      const lightColor = armed
        ? `rgba(255,80,80,${0.6 + 0.4 * blink})`
        : `rgba(255,220,80,${0.5 + 0.5 * blink})`;

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(230,238,255,0.16)";
      for (let i = 0; i < 4; i += 1) {
        const ang = (Math.PI * 2 * i) / 4 + now * 0.0002;
        const x1 = Math.cos(ang) * (landmine.r * 0.25);
        const y1 = Math.sin(ang) * (landmine.r * 0.25);
        const x2 = Math.cos(ang) * (landmine.r * 0.85);
        const y2 = Math.sin(ang) * (landmine.r * 0.85);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(30,36,48,0.95)";
      for (let i = 0; i < 6; i += 1) {
        const ang = (Math.PI * 2 * i) / 6 + 0.35;
        const bx = Math.cos(ang) * (landmine.r * 0.68);
        const by = Math.sin(ang) * (landmine.r * 0.68);
        ctx.beginPath();
        ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(landmine.r * 0.35, -landmine.r * 0.35, 4 + 2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();

      if (armed) {
        const t = Math.max(0, Math.min(1, (landmine.explodeAt - now) / 1000));
        ctx.beginPath();
        ctx.arc(0, 0, landmine.r + 10 + (1 - t) * 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,80,80,0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    for (let i = 0; i < sim.warpRings.length; i += 1) {
      const ring = sim.warpRings[i];
      const t = ring.life / ring.ttl;
      const radius = ring.baseR + (ring.maxR - ring.baseR) * t;
      const alpha = ring.alpha * (1 - t);
      const base = ring.color || "rgba(112,255,178,1)";
      ctx.beginPath();
      ctx.strokeStyle = base.replace(/[\d.]+\)$/u, `${Math.max(0, alpha).toFixed(3)})`);
      ctx.lineWidth = prefersReducedMotion ? 1.2 : 1.8;
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < sim.particles.length; i += 1) {
      const p = sim.particles[i];
      const alpha = (1 - p.life / p.ttl) * p.alpha;
      ctx.beginPath();
      ctx.fillStyle = `${p.color || "rgba(111,255,128,"}${Math.max(0, alpha).toFixed(3)})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (landmineFlashUntil > now) {
      const t = (landmineFlashUntil - now) / 220;
      const alpha = Math.max(0, Math.min(1, t)) * 0.45;
      ctx.fillStyle = `rgba(255,214,170,${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, sim.width, sim.height);
    }
    if (asteroidImpactFlashUntil > now) {
      const t = (asteroidImpactFlashUntil - now) / 220;
      const base = prefersReducedMotion ? 0.13 : 0.2;
      const alpha = Math.max(0, Math.min(1, t)) * base * asteroidImpactFlashIntensity;
      ctx.fillStyle = `rgba(255,245,220,${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, sim.width, sim.height);
    }

    if (sim.shooting && !prefersReducedMotion && !state.minimal) {
      const progress = sim.shooting.life / sim.shooting.ttl;
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, fade).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sim.shooting.x, sim.shooting.y);
      ctx.lineTo(sim.shooting.x - sim.shooting.length, sim.shooting.y - sim.shooting.length * 0.55);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (!galaxyRunning) return;
    if (now - sim.last < 16) {
      galaxyRaf = requestAnimationFrame(frame);
      return;
    }
    const rawDt = sim.last ? now - sim.last : 16;
    const dt = Math.min(rawDt, 33);
    sim.last = now;
    update(dt, now);
    galaxyRaf = requestAnimationFrame(frame);
  }

  function onTap(event) {
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    if (now - sim.lastTapAt < 55) return;
    sim.lastTapAt = now;

    const point = pointFromEvent(event);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    if (point.x < 0 || point.x > sim.width || point.y < 0 || point.y > sim.height) return;

    if (debugTaps && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      // eslint-disable-next-line no-console
      console.log("elementFromPoint", document.elementFromPoint(event.clientX, event.clientY));
    }

    if (engineMode === "arcade") {
      if (landmine && isPointOnLandmine(point.x, point.y)) {
        triggerCrosshairFire();
        armLandmine();
        return;
      }
      const hitIndex = findHitAsteroidIndex(point.x, point.y);
      if (hitIndex >= 0) {
        triggerCrosshairFire();
        splitAsteroidByIndex(hitIndex);
        draw(now);
      }
      return;
    }
    if (engineMode !== "freestyle") return;

    const freestyleBoom = state.galaxyTool === "boom";
    if (!freestyleBoom) {
      if (now < sim.nextDrawAt) return;
      sim.nextDrawAt = now + 120;
      triggerCrosshairFire();
      spawnAsteroid(point.x, point.y, 3, false);
      draw(now);
      return;
    }

    if (sim.asteroids.length === 0) {
      setGalaxyTool("draw");
      sim.nextDrawAt = 0;
      triggerCrosshairFire();
      spawnAsteroid(point.x, point.y, 3, false);
      draw(now);
      return;
    }

    const hitIndex = findHitAsteroidIndex(point.x, point.y);
    if (hitIndex >= 0) {
      triggerCrosshairFire();
      splitAsteroidByIndex(hitIndex);
      draw(now);
      return;
    }

    if (now < sim.nextDrawAt) return;
    sim.nextDrawAt = now + 120;
    triggerCrosshairFire();
    spawnAsteroid(point.x, point.y, 3, false);
    draw(now);
  }

  function setCrosshairVisible(visible) {
    if (!canvasCrosshair || !canShowCrosshair) return;
    canvasCrosshair.style.display = visible ? "block" : "none";
  }

  function updateCrosshairPosition(event) {
    if (!canvasCrosshair || !canShowCrosshair) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    canvasCrosshair.style.left = `${clientX}px`;
    canvasCrosshair.style.top = `${clientY}px`;
  }

  function triggerCrosshairFire() {
    if (!canvasCrosshair || !canShowCrosshair) return;
    canvasCrosshair.classList.remove("fire");
    void canvasCrosshair.offsetWidth;
    canvasCrosshair.classList.add("fire");
    setTimeout(() => canvasCrosshair.classList.remove("fire"), 110);
  }

  function startGalaxyLoop() {
    if (galaxyRunning) return;
    galaxyRunning = true;
    sim.last = 0;
    if (!prefersReducedMotion) scheduleShootingStar();
    galaxyRaf = requestAnimationFrame(frame);
  }

  function stopGalaxyLoop() {
    galaxyRunning = false;
    if (galaxyRaf) cancelAnimationFrame(galaxyRaf);
    galaxyRaf = 0;
    clearTimeout(sim.shootingTimer);
    sim.shootingTimer = null;
  }

  function stopAndMenu() {
    stopGalaxyLoop();
    showModeSelect({ preserveArcade: false });
    stopGalaxyLoop();
  }

  galaxyPlayCanvas.addEventListener("pointerdown", onTap);
  galaxyPlayCanvas.addEventListener("touchstart", onTap, { passive: false });
  galaxyPlayCanvas.addEventListener("mousedown", onTap);
  galaxyPlayCanvas.addEventListener("click", onTap);
  galaxyPlayCanvas.addEventListener("pointerenter", (event) => {
    setCrosshairVisible(true);
    updateCrosshairPosition(event);
  });
  galaxyPlayCanvas.addEventListener("pointermove", updateCrosshairPosition);
  galaxyPlayCanvas.addEventListener("pointerleave", () => setCrosshairVisible(false));

  window.addEventListener("resize", () => {
    resizeGalaxyCanvas();
    computePlayfield();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGalaxyLoop();
    } else if (!galaxyView.hidden) {
      resizeGalaxyCanvas();
      computePlayfield();
      startGalaxyLoop();
    }
  });

  resizeGalaxyCanvas();
  computePlayfield();
  buildArcadeLevelSelect();
  buildDebugLevelSelect();
  syncDebugLevelPanel();
  if (galaxyModeTitleEl) {
    galaxyModeTitleEl.addEventListener("pointerdown", registerDebugLevelUnlockTap);
  }
  if (btnDebugStartLevel) {
    btnDebugStartLevel.addEventListener("click", () => {
      const selected = parseInt(debugLevelSelect?.value || "1", 10);
      startArcadeAtLevel(selected);
    });
  }
  draw(performance.now());

  galaxyCanvasController = {
    showModeSelect(opts = { preserveArcade: false }) {
      resizeGalaxyCanvas();
      computePlayfield();
      setTimeout(computePlayfield, 50);
      setTimeout(computePlayfield, 250);
      showModeSelect(opts);
    },
    startFreestyle() {
      startFreestyleMode();
    },
    startArcadeFromSave() {
      startArcadeFromSave();
    },
    startArcadeNew() {
      startArcadeNew();
    },
    startArcadeResume() {
      startArcadeResume();
    },
    openArcadeMenu() {
      openArcadeMenu();
    },
    openArcadeLevelSelect() {
      openArcadeLevelSelect();
    },
    startArcadeAtLevel(levelNum) {
      startArcadeAtLevel(levelNum);
    },
    triggerBoom() {
      // no-op in current arcade interaction model
    },
    isArcade() {
      return engineMode === "arcade";
    },
    stopAndMenu,
    stop: stopGalaxyLoop,
    clear() {
      if (engineMode === "arcade") return;
      clearGameplayEntities();
      setGalaxyTool("draw");
      draw(performance.now());
    },
  };
}

// v1.2.2 galaxy bg
function initGalaxyBackground() {
  const canvas = document.getElementById("galaxyCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const galaxy = {
    canvas,
    ctx,
    width: 0,
    height: 0,
    dpr: 1,
    stars: [],
    raf: null,
    last: 0,
    shooting: null,
    shootingTimer: null,
    paused: false,
    minimal: state.minimal,
  };

  galaxyController = {
    setMinimal(value) {
      galaxy.minimal = value;
    },
  };

  function starCountForSize(width, height) {
    const area = width * height;
    return Math.max(80, Math.min(140, Math.round(area / 13000)));
  }

  function randomStar() {
    return {
      x: Math.random() * galaxy.width,
      y: Math.random() * galaxy.height,
      r: 0.6 + Math.random() * 1.7,
      baseAlpha: 0.2 + Math.random() * 0.55,
      twinkleSpeed: 0.35 + Math.random() * 1.25,
      twinkleRange: 0.07 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      dx: (Math.random() - 0.5) * 0.012,
      dy: (Math.random() - 0.5) * 0.012,
    };
  }

  function resize() {
    galaxy.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    galaxy.width = Math.floor(window.innerWidth);
    galaxy.height = Math.floor(window.innerHeight);

    canvas.width = Math.floor(galaxy.width * galaxy.dpr);
    canvas.height = Math.floor(galaxy.height * galaxy.dpr);
    canvas.style.width = `${galaxy.width}px`;
    canvas.style.height = `${galaxy.height}px`;
    ctx.setTransform(galaxy.dpr, 0, 0, galaxy.dpr, 0, 0);

    const targetCount = starCountForSize(galaxy.width, galaxy.height);
    galaxy.stars = Array.from({ length: targetCount }, randomStar);
    draw(performance.now());
  }

  function spawnShootingStar() {
    if (prefersReducedMotion || galaxy.paused) return;
    const startX = Math.random() * galaxy.width * 0.75;
    const startY = Math.random() * galaxy.height * 0.45;
    const speed = 0.9 + Math.random() * 0.8;
    galaxy.shooting = {
      x: startX,
      y: startY,
      vx: 0.95 * speed,
      vy: 0.55 * speed,
      length: 90 + Math.random() * 70,
      life: 0,
      maxLife: 760 + Math.random() * 420,
      alpha: 0.75,
    };
  }

  function scheduleShootingStar() {
    if (prefersReducedMotion) return;
    clearTimeout(galaxy.shootingTimer);
    const nextIn = 12000 + Math.random() * 13000;
    galaxy.shootingTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, nextIn);
  }

  function update(dt, now) {
    if (!prefersReducedMotion) {
      galaxy.stars.forEach((star) => {
        star.x += star.dx * dt;
        star.y += star.dy * dt;
        if (star.x < -2) star.x = galaxy.width + 2;
        if (star.y < -2) star.y = galaxy.height + 2;
        if (star.x > galaxy.width + 2) star.x = -2;
        if (star.y > galaxy.height + 2) star.y = -2;
      });
    }

    if (galaxy.shooting) {
      galaxy.shooting.life += dt;
      galaxy.shooting.x += galaxy.shooting.vx * dt;
      galaxy.shooting.y += galaxy.shooting.vy * dt;
      if (galaxy.shooting.life >= galaxy.shooting.maxLife) galaxy.shooting = null;
    }

    draw(now);
  }

  function draw(now) {
    ctx.clearRect(0, 0, galaxy.width, galaxy.height);

    const minimalFactor = galaxy.minimal ? 0.56 : 1;
    const reducedFactor = prefersReducedMotion ? 0.88 : 1;

    galaxy.stars.forEach((star) => {
      let alpha = star.baseAlpha;
      if (!prefersReducedMotion) {
        alpha += Math.sin(now * 0.001 * star.twinkleSpeed + star.phase) * star.twinkleRange;
      }
      alpha = Math.max(0.08, Math.min(0.95, alpha * minimalFactor * reducedFactor));

      ctx.beginPath();
      ctx.fillStyle = `rgba(210,226,255,${alpha.toFixed(3)})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (galaxy.shooting && !prefersReducedMotion) {
      const shoot = galaxy.shooting;
      const progress = shoot.life / shoot.maxLife;
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      const alpha = Math.max(0, fade * shoot.alpha * (galaxy.minimal ? 0.5 : 1));

      const grad = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.length, shoot.y - shoot.length * 0.55);
      grad.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shoot.x, shoot.y);
      ctx.lineTo(shoot.x - shoot.length, shoot.y - shoot.length * 0.55);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (galaxy.paused) return;
    if (now - galaxy.last < 33) {
      galaxy.raf = requestAnimationFrame(frame);
      return;
    }

    const dt = galaxy.last ? now - galaxy.last : 16;
    galaxy.last = now;
    update(dt, now);
    galaxy.raf = requestAnimationFrame(frame);
  }

  function pause() {
    galaxy.paused = true;
    if (galaxy.raf) cancelAnimationFrame(galaxy.raf);
    galaxy.raf = null;
  }

  function resume() {
    if (galaxy.paused === false && galaxy.raf) return;
    galaxy.paused = false;
    galaxy.last = 0;
    if (!prefersReducedMotion) galaxy.raf = requestAnimationFrame(frame);
    else draw(performance.now());
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });

  window.addEventListener("resize", resize);
  resize();

  if (!prefersReducedMotion) {
    scheduleShootingStar();
    resume();
  } else {
    draw(performance.now());
  }
}
