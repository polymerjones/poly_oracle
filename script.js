const APP_VERSION = "v1.4.3";
const storageKey = "poly-oracle-v11-state";
const firstRunHintKey = "poly_oracle_seen_hint_v1_2_1";
const verboseKey = "poly_oracle_verbose_details";
const chaosEnabledKey = "poly_oracle_chaos_theme";
const chaosPaletteKey = "poly_oracle_theme_palette";
const galaxyToolKey = "poly_oracle_galaxy_tool";
const debugTapsKey = "poly_oracle_debug_taps";

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
  tapTimestamps: [],
  galaxyTool: "draw",
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

const vault = document.getElementById("vault");
const closeVault = document.getElementById("closeVault");
const vaultSearch = document.getElementById("vaultSearch");
const vaultList = document.getElementById("vaultList");
const vaultFilterAll = document.getElementById("vaultFilterAll");
const vaultFilterFav = document.getElementById("vaultFilterFav");
const vaultStats = document.getElementById("vaultStats");

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

init();

function init() {
  setVh();
  resetUiOverlayState();
  loadState();
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
    primeBackgroundMedia();
  };
  document.addEventListener("pointerdown", primeMediaOnGesture, { once: true });
  document.addEventListener("touchstart", primeMediaOnGesture, { once: true, passive: true });
  document.addEventListener("keydown", primeMediaOnGesture, { once: true });

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
    closeGalaxyView();
  });

  toolDraw.addEventListener("click", () => {
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
    requestAnimationFrame(() => galaxyCanvasController.start());
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
  if (galaxyCanvasController) galaxyCanvasController.stop();
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

function revealAnswer() {
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
  setRevealing(true);

  // Speak the question during the ritual lead-in.
  speakText(normalizedQuestion, {
    rate: state.whisper ? 0.92 : 1.0,
    pitch: 1.12,
    preview: true,
    voiceName: revealVoice,
  });

  // v1.2.2 ritual reveal
  if (prefersReducedMotion) {
    runReducedRitualSequence(mode, () => finishReveal({
      normalizedQuestion,
      polarity,
      answerLine,
      microLine,
      revealVoice,
    }));
    return;
  }

  runRitualSequence(mode, () => finishReveal({
    normalizedQuestion,
    polarity,
    answerLine,
    microLine,
    revealVoice,
  }));
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
  await playRevealSoundAndWait();
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

  const spokenAnswer = answerSimple.textContent.trim() || entry.answer;
  speakText(spokenAnswer, {
    rate: state.whisper ? 0.95 : 1.05,
    pitch: 1.18,
    voiceName: revealVoice,
  });

  setRevealing(false);
  setIntentState();
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
  state.themePalette = createRandomPalette();
  applyTheme();
  saveThemeSettings();
  showChaosToast();
}

function resetChaosTheme() {
  state.chaosThemeEnabled = false;
  state.themePalette = null;
  applyTheme();
  saveThemeSettings();
}

function createRandomPalette() {
  const hueA = Math.floor(Math.random() * 360);
  const hueB = (hueA + 70 + Math.floor(Math.random() * 70)) % 360;
  const hueC = (hueA + 150 + Math.floor(Math.random() * 90)) % 360;

  return {
    accentA: `hsl(${hueA} 92% 74%)`,
    accentB: `hsl(${hueB} 88% 74%)`,
    accentC: `hsl(${hueC} 85% 74%)`,
    bgNebula1: `hsla(${hueA} 90% 70% / 0.17)`,
    bgNebula2: `hsla(${hueB} 86% 66% / 0.17)`,
    orbGlow: `0 0 34px hsla(${hueA} 94% 72% / 0.56), 0 0 96px hsla(${hueB} 86% 70% / 0.32)`,
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
  root.style.setProperty("--orbGlow", palette.orbGlow);
}

function showChaosToast() {
  if (!chaosToast) return;
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
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx && orbTapBuffer && !state.minimal) {
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = orbTapBuffer;
    gain.gain.value = state.whisper ? 0.52 : 0.92;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start(0);
    return;
  }

  if (orbTapPool.length) {
    const node = orbTapPool[orbTapPoolIndex % orbTapPool.length];
    orbTapPoolIndex += 1;
    node.currentTime = 0;
    node.volume = state.whisper ? 0.55 : 1;
    node.play().catch(() => {});
    return;
  }

  if (!AudioCtx || state.minimal) return;
  if (!audioContext) audioContext = new AudioCtx();

  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.connect(audioContext.destination);

  const gainTop = state.whisper ? 0.1 : clamp(0.24 * intensity.brightnessMultiplier, 0.12, 0.5);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(gainTop, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  [720, 980, 1240].forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.05;
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency * clamp(0.95 + intensity.sizeMultiplier * 0.08, 0.95, 1.18), start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.24);
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

// Galaxy Canvas v1
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

  const sim = {
    dpr: 1,
    width: 0,
    height: 0,
    last: 0,
    stars: [],
    asteroids: [],
    particles: [],
    shooting: null,
    shootingTimer: null,
    nextAsteroidId: 1,
    maxAsteroids: 120,
    lastTapAt: 0,
    nextDrawAt: 0,
  };
  let galaxyRaf = 0;
  let galaxyRunning = false;

  // HARDEN canvas loop
  function resizeGalaxyCanvas() {
    sim.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
    const height = Math.max(1, Math.floor(rect.height || (window.innerHeight - 80)));
    sim.width = width;
    sim.height = height;
    galaxyPlayCanvas.width = Math.floor(width * sim.dpr);
    galaxyPlayCanvas.height = Math.floor(height * sim.dpr);
    ctx.setTransform(sim.dpr, 0, 0, sim.dpr, 0, 0);
    sim.maxAsteroids = sim.width < 700 ? 80 : 120;
    seedStars();
  }

  function seedStars() {
    const target = Math.max(120, Math.min(220, Math.round((sim.width * sim.height) / 9000)));
    sim.stars = Array.from({ length: target }, () => ({
      x: Math.random() * sim.width,
      y: Math.random() * sim.height,
      r: 0.4 + Math.random() * 1.6,
      baseAlpha: 0.18 + Math.random() * 0.62,
      twinkleSpeed: 0.4 + Math.random() * 1.3,
      phase: Math.random() * Math.PI * 2,
      driftX: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.004,
      driftY: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.004,
    }));
  }

  function randomVelocity(min, max) {
    const angle = Math.random() * Math.PI * 2;
    const speed = min + Math.random() * (max - min);
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }

  function spawnAsteroid(x, y, radius = 18 + Math.random() * 16, speedMin = 18, speedMax = 55) {
    if (sim.asteroids.length >= sim.maxAsteroids) return;
    const v = randomVelocity(speedMin, speedMax);
    const pointCount = 10 + Math.floor(Math.random() * 4);
    const points = Array.from({ length: pointCount }, (_, i) => {
      const angle = (Math.PI * 2 * i) / pointCount;
      const offset = 0.76 + Math.random() * 0.42;
      return { angle, offset };
    });
    sim.asteroids.push({
      id: sim.nextAsteroidId++,
      x,
      y,
      vx: v.vx,
      vy: v.vy,
      r: radius,
      splitDepth: 0,
      shape: points,
      spin: (Math.random() - 0.5) * 0.08,
      rot: Math.random() * Math.PI * 2,
      alpha: 0.7 + Math.random() * 0.28,
    });
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

    const peak = clamp((state.whisper ? 0.09 : 0.28) * intensity, 0.07, 0.42);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.24);
    toneGain.gain.setValueAtTime(0.5, now);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    noise.type = "square";
    noise.frequency.setValueAtTime(38, now);
    noiseGain.gain.setValueAtTime(0.26, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.26);
    noise.stop(now + 0.22);
  }

  function spawnExplosion(x, y, count = 14) {
    if (prefersReducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      sim.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        ttl: 380 + Math.random() * 180,
        size: 2 + Math.random() * 2.8,
        glow: 0.65 + Math.random() * 0.35,
      });
    }
  }

  function spawnShootingStar() {
    if (prefersReducedMotion || !galaxyRunning) return;
    const startX = Math.random() * sim.width * 0.8;
    const startY = Math.random() * sim.height * 0.5;
    const speed = 0.9 + Math.random() * 0.7;
    sim.shooting = {
      x: startX,
      y: startY,
      vx: 0.95 * speed,
      vy: 0.55 * speed,
      length: 80 + Math.random() * 70,
      life: 0,
      ttl: 700 + Math.random() * 500,
    };
  }

  function scheduleShootingStar() {
    if (prefersReducedMotion) return;
    clearTimeout(sim.shootingTimer);
    const delay = 10000 + Math.random() * 15000;
    sim.shootingTimer = setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, delay);
  }

  function wrapAsteroid(a) {
    if (a.x < -a.r) a.x = sim.width + a.r;
    if (a.x > sim.width + a.r) a.x = -a.r;
    if (a.y < -a.r) a.y = sim.height + a.r;
    if (a.y > sim.height + a.r) a.y = -a.r;
  }

  function update(dt, now) {
    const driftScale = prefersReducedMotion ? 0 : 1;
    sim.stars.forEach((s) => {
      s.x += s.driftX * dt * driftScale;
      s.y += s.driftY * dt * driftScale;
      if (s.x < 0) s.x += sim.width;
      if (s.y < 0) s.y += sim.height;
      if (s.x > sim.width) s.x -= sim.width;
      if (s.y > sim.height) s.y -= sim.height;
    });

    sim.asteroids.forEach((a) => {
      a.x += a.vx * (dt / 1000);
      a.y += a.vy * (dt / 1000);
      a.rot += a.spin * (dt / 16);
      wrapAsteroid(a);
    });

    sim.particles = sim.particles.filter((p) => {
      p.life += dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      return p.life < p.ttl;
    });

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

    sim.stars.forEach((s) => {
      const twinkle = prefersReducedMotion ? 0 : Math.sin(now * 0.001 * s.twinkleSpeed + s.phase) * 0.25;
      const alpha = Math.max(0.06, Math.min(0.95, s.baseAlpha + twinkle));
      ctx.beginPath();
      ctx.fillStyle = `rgba(214,227,255,${alpha.toFixed(3)})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    sim.asteroids.forEach((a) => {
      const grad = ctx.createRadialGradient(a.x - a.r * 0.34, a.y - a.r * 0.38, a.r * 0.18, a.x, a.y, a.r);
      grad.addColorStop(0, `rgba(176,136,88,${(a.alpha + 0.2).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(112,78,44,${(a.alpha + 0.12).toFixed(3)})`);
      grad.addColorStop(1, `rgba(54,37,22,${a.alpha.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      a.shape.forEach((point, index) => {
        const px = a.x + Math.cos(point.angle + a.rot) * a.r * point.offset;
        const py = a.y + Math.sin(point.angle + a.rot) * a.r * point.offset;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(250,224,180,0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // subtle crater specks for rocky look
      ctx.fillStyle = "rgba(62,42,22,0.22)";
      ctx.beginPath();
      ctx.arc(a.x + Math.cos(a.rot) * a.r * 0.25, a.y + Math.sin(a.rot) * a.r * 0.22, Math.max(1.2, a.r * 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        a.x + Math.cos(a.rot + 1.9) * a.r * 0.18,
        a.y + Math.sin(a.rot + 1.9) * a.r * 0.16,
        Math.max(1, a.r * 0.09),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });

    sim.particles.forEach((p) => {
      const alpha = 1 - p.life / p.ttl;
      ctx.beginPath();
      ctx.fillStyle = `rgba(111,255,128,${Math.max(0, alpha * p.glow).toFixed(3)})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    if (sim.shooting && !prefersReducedMotion) {
      const progress = sim.shooting.life / sim.shooting.ttl;
      const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      const grad = ctx.createLinearGradient(
        sim.shooting.x,
        sim.shooting.y,
        sim.shooting.x - sim.shooting.length,
        sim.shooting.y - sim.shooting.length * 0.55,
      );
      grad.addColorStop(0, `rgba(255,255,255,${Math.max(0, fade).toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sim.shooting.x, sim.shooting.y);
      ctx.lineTo(sim.shooting.x - sim.shooting.length, sim.shooting.y - sim.shooting.length * 0.55);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (!galaxyRunning) return;
    if (now - sim.last < 33) {
      galaxyRaf = requestAnimationFrame(frame);
      return;
    }
    const dt = sim.last ? now - sim.last : 16;
    sim.last = now;
    update(dt, now);
    galaxyRaf = requestAnimationFrame(frame);
  }

  function pointFromEvent(event) {
    const rect = galaxyPlayCanvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY ?? event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function findHitAsteroid(x, y) {
    let best = null;
    let bestDist = Infinity;
    sim.asteroids.forEach((a) => {
      const dx = a.x - x;
      const dy = a.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= a.r + 10 && d < bestDist) {
        best = a;
        bestDist = d;
      }
    });
    return best;
  }

  function explodeAsteroid(parent) {
    sim.asteroids = sim.asteroids.filter((a) => a.id !== parent.id);
    // Two split levels: large -> medium -> small -> destroy.
    if (parent.splitDepth >= 2) {
      spawnExplosion(parent.x, parent.y, 12);
      playBoomSound(0.9);
      if (sim.asteroids.length === 0) setGalaxyTool("draw");
      return;
    }
    // Keep fewer tiny fragments: larger pieces, fewer chunks on later splits.
    const chunks = parent.splitDepth === 0 ? 3 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
    const parentSpeed = Math.sqrt(parent.vx * parent.vx + parent.vy * parent.vy);
    const allowTinySet = parent.splitDepth >= 1 && Math.random() < 0.25; // 1 out of 4 times
    for (let i = 0; i < chunks; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = parentSpeed * (1.4 + Math.random() * 0.8) + 16 + Math.random() * 28;
      const childRadius = allowTinySet
        ? clamp(parent.r * (0.26 + Math.random() * 0.16), 6, 14)
        : clamp(parent.r * (0.40 + Math.random() * 0.22), 9, 26);
      sim.asteroids.push({
        id: sim.nextAsteroidId++,
        x: parent.x + Math.cos(angle) * 4,
        y: parent.y + Math.sin(angle) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: childRadius,
        splitDepth: parent.splitDepth + 1,
        shape: (() => {
          const childPointCount = 9 + Math.floor(Math.random() * 4);
          return Array.from({ length: childPointCount }, (_, i) => ({
            angle: (Math.PI * 2 * i) / childPointCount,
            offset: 0.72 + Math.random() * 0.44,
          }));
        })(),
        spin: (Math.random() - 0.5) * 0.14,
        rot: Math.random() * Math.PI * 2,
        alpha: 0.62 + Math.random() * 0.28,
      });
    }
    spawnExplosion(parent.x, parent.y, 16);
    playBoomSound(1.15);
  }

  function onTap(event) {
    if (event.cancelable) event.preventDefault();
    const now = performance.now();
    if (now - sim.lastTapAt < 55) return;
    sim.lastTapAt = now;

    const point = pointFromEvent(event);
    if (debugTaps && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      // eslint-disable-next-line no-console
      console.log("elementFromPoint", document.elementFromPoint(event.clientX, event.clientY));
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    if (point.x < 0 || point.x > sim.width || point.y < 0 || point.y > sim.height) return;
    if (state.galaxyTool === "draw") {
      // Desktop browsers can fire multiple related events from one click;
      // enforce a hard spawn cooldown so one tap doesn't create duplicates.
      if (now < sim.nextDrawAt) return;
      sim.nextDrawAt = now + 500;
      spawnAsteroid(point.x, point.y);
      draw(performance.now());
      return;
    }
    if (sim.asteroids.length === 0) {
      setGalaxyTool("draw");
      spawnAsteroid(point.x, point.y);
      return;
    }
    const hit = findHitAsteroid(point.x, point.y);
    if (hit) {
      explodeAsteroid(hit);
      draw(performance.now());
    }
  }

  // HARDEN canvas input
  galaxyPlayCanvas.addEventListener("pointerdown", onTap);
  galaxyPlayCanvas.addEventListener("touchstart", onTap, { passive: false });
  galaxyPlayCanvas.addEventListener("mousedown", onTap);
  galaxyPlayCanvas.addEventListener("click", onTap);

  window.addEventListener("resize", resizeGalaxyCanvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGalaxyLoop();
    } else if (!galaxyView.hidden) {
      resizeGalaxyCanvas();
      startGalaxyLoop();
    }
  });

  function tick(now) {
    frame(now);
  }

  function startGalaxyLoop() {
    if (galaxyRunning) return;
    galaxyRunning = true;
    sim.last = 0;
    if (!prefersReducedMotion) scheduleShootingStar();
    if (sim.asteroids.length === 0) setGalaxyTool("draw");
    galaxyRaf = requestAnimationFrame(tick);
  }

  function stopGalaxyLoop() {
    galaxyRunning = false;
    if (galaxyRaf) cancelAnimationFrame(galaxyRaf);
    galaxyRaf = 0;
    clearTimeout(sim.shootingTimer);
    sim.shootingTimer = null;
  }

  // RESTORE galaxy + HARDEN resize
  resizeGalaxyCanvas();
  draw(performance.now());

  galaxyCanvasController = {
    start() {
      resizeGalaxyCanvas();
      setTimeout(resizeGalaxyCanvas, 50);
      setTimeout(resizeGalaxyCanvas, 250);
      startGalaxyLoop();
    },
    stop: stopGalaxyLoop,
    clear() {
      sim.asteroids = [];
      sim.particles = [];
      sim.shooting = null;
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
