const APP_VERSION = "v1.2.2";
const storageKey = "poly-oracle-v11-state";
const firstRunHintKey = "poly_oracle_seen_hint_v1_2_1";
const verboseKey = "poly_oracle_verbose_details";
const chaosEnabledKey = "poly_oracle_chaos_theme";
const chaosPaletteKey = "poly_oracle_theme_palette";

const revealModes = [
  { id: "classic", label: "Classic Fade", duration: 2500 },
  { id: "dramatic", label: "Dramatic Flash", duration: 2500 },
  { id: "mist", label: "Mist Unveil", duration: 2500 },
  { id: "glitch", label: "Glitch Oracle", duration: 2500 },
];

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
};

const stage = document.getElementById("stage");
const orb = document.getElementById("orb");
const flash = document.getElementById("flash");
const mist = document.getElementById("mist");
const sparkles = document.getElementById("sparkles");
const revealAudio = document.getElementById("revealAudio");
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

init();

function init() {
  loadState();
  initGalaxyBackground();
  applyTheme();
  buildPackSelect();
  warmVoices();
  populateVoices();
  applySettingsToUi();
  renderVault();
  setIntentState();
  setupFirstRunHint();
  addListeners();
}

function addListeners() {
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

  orb.addEventListener("click", () => {
    const intensity = { sizeMultiplier: 1, brightnessMultiplier: 1, burstCount: 8 };
    playPixySound(intensity);
    spawnSparkles(intensity.burstCount, intensity.sizeMultiplier, intensity.brightnessMultiplier);
  });

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
      setSettingsOpen(false);
      vault.hidden = true;
    }
  });

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
  settingsBackdrop.hidden = !open;
  settingsPanel.hidden = !open;
  settingsPanel.classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
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
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  performRitualPulse(0.8);

  setTimeout(() => performRitualPulse(1.05), 400);
  setTimeout(() => performRitualPulse(1.25), 900);
  setTimeout(() => performRitualPulse(1.45), 1600);
  setTimeout(() => onDone(), mode.duration);
}

function runReducedRitualSequence(mode, onDone) {
  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  mist.classList.remove("active");
  void mist.offsetWidth;
  mist.classList.add("active");
  spawnSparkles(4, 1, 1);

  setTimeout(onDone, mode.duration);
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

function finishReveal({ normalizedQuestion, polarity, answerLine, microLine, revealVoice }) {
  spawnSparkles(prefersReducedMotion ? 5 : 18, 1.2, 1.35);
  playRevealSound();
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

  return { spamTapCount, sizeMultiplier, brightnessMultiplier, burstCount };
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

function playRevealSound() {
  if (!revealAudio) return;
  revealAudio.currentTime = 0;
  revealAudio.play().catch(() => {});
}

function playPixySound(intensity) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || state.minimal) return;
  if (!audioContext) audioContext = new AudioCtx();

  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.connect(audioContext.destination);

  const gainTop = state.whisper ? 0.06 : clamp(0.12 * intensity.brightnessMultiplier, 0.08, 0.3);
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
