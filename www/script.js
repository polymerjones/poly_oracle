const revealModes = [
  { id: "classic", label: "Classic Fade", duration: 1100 },
  { id: "dramatic", label: "Dramatic Flash", duration: 1800 },
  { id: "mist", label: "Mist Unveil", duration: 1450 },
  { id: "glitch", label: "Glitch Oracle", duration: 1500 },
];

const packs = {
  classic: {
    label: "Classic",
    yes: [
      "The current aligns in your favor.",
      "The signal is clean. Proceed.",
      "Momentum says yes.",
    ],
    no: [
      "Not this cycle.",
      "The signs ask for patience.",
      "Pause and return with clearer intent.",
    ],
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

const yesAnswers = ["Yes", "Yes - you know it", "Heck Yes", "Yeppurs", "Yeah, buddy"];
const noAnswers = ["No", "Nope", "Heck No", "Not today", "I don't think so"];

const stage = document.getElementById("stage");
const orb = document.getElementById("orb");
const flash = document.getElementById("flash");
const mist = document.getElementById("mist");
const sparkles = document.getElementById("sparkles");
const revealAudio = document.getElementById("revealAudio");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask");
const randomVoice = document.getElementById("randomVoice");
const voiceSelect = document.getElementById("voiceSelect");
const previewVoice = document.getElementById("previewVoice");
const voicePersona = document.getElementById("voicePersona");
const packSelect = document.getElementById("packSelect");
const modeRail = document.getElementById("modeRail");
const whisperModeButton = document.getElementById("whisperMode");
const minimalModeButton = document.getElementById("minimalMode");
const openVault = document.getElementById("openVault");
const closeVault = document.getElementById("closeVault");
const vault = document.getElementById("vault");
const vaultSearch = document.getElementById("vaultSearch");
const vaultList = document.getElementById("vaultList");
const vaultFilterAll = document.getElementById("vaultFilterAll");
const vaultFilterFav = document.getElementById("vaultFilterFav");
const vaultStats = document.getElementById("vaultStats");

const answerBox = document.getElementById("answer");
const answerCard = document.getElementById("answerCard");
const answerPolarity = document.getElementById("answerPolarity");
const answerText = document.getElementById("answerText");
const answerMicro = document.getElementById("answerMicro");
const answerMeta = document.getElementById("answerMeta");
const flipAnswer = document.getElementById("flipAnswer");
const favoriteAnswer = document.getElementById("favoriteAnswer");
const shareAnswer = document.getElementById("shareAnswer");

const storageKey = "poly-oracle-v11-state";
const prefersReducedMotion =
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  selectedMode: "classic",
  selectedPack: "classic",
  selectedVoice: "",
  whisper: false,
  minimal: false,
  vaultFilter: "all",
  vaultSearch: "",
  vault: [],
  currentAnswer: null,
  flip: false,
};

let audioContext;

init();

function init() {
  loadState();
  buildModeRail();
  buildPackSelect();
  restoreToggles();
  populateVoices();
  renderVault();
  setIntentState();

  questionInput.addEventListener("input", () => {
    setIntentState();
    hapticTap();
  });

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !askButton.disabled) {
      revealAnswer();
    }
  });

  askButton.addEventListener("click", revealAnswer);

  randomVoice.addEventListener("click", () => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (!voices.length) return;
    const pick = voices[Math.floor(Math.random() * voices.length)];
    state.selectedVoice = pick.name;
    voiceSelect.value = pick.name;
    updatePersonaChip();
    saveState();
  });

  previewVoice.addEventListener("click", () => {
    speakText("The Oracle is listening.", { rate: 1.02, pitch: 1.24, preview: true });
  });

  voiceSelect.addEventListener("change", (e) => {
    state.selectedVoice = e.target.value;
    updatePersonaChip();
    saveState();
  });

  packSelect.addEventListener("change", (e) => {
    state.selectedPack = e.target.value;
    saveState();
  });

  whisperModeButton.addEventListener("click", () => {
    state.whisper = !state.whisper;
    restoreToggles();
    saveState();
  });

  minimalModeButton.addEventListener("click", () => {
    state.minimal = !state.minimal;
    restoreToggles();
    saveState();
  });

  orb.addEventListener("click", () => {
    spawnSparkles(state.minimal ? 5 : 12);
    playPixySound();
  });

  flipAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    state.flip = !state.flip;
    renderAnswerCard();
  });

  favoriteAnswer.addEventListener("click", () => {
    if (!state.currentAnswer) return;
    const id = state.currentAnswer.id;
    const entry = state.vault.find((item) => item.id === id);
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

  openVault.addEventListener("click", () => {
    vault.hidden = false;
    renderVault();
  });

  closeVault.addEventListener("click", () => {
    vault.hidden = true;
  });

  vault.addEventListener("click", (e) => {
    if (e.target === vault) {
      vault.hidden = true;
    }
  });

  vaultSearch.addEventListener("input", (e) => {
    state.vaultSearch = e.target.value.trim().toLowerCase();
    renderVault();
  });

  vaultFilterAll.addEventListener("click", () => {
    state.vaultFilter = "all";
    renderVault();
  });

  vaultFilterFav.addEventListener("click", () => {
    state.vaultFilter = "fav";
    renderVault();
  });
}

function setIntentState() {
  const value = questionInput.value.trim();
  const hasText = value.length >= 2;
  askButton.disabled = !hasText;
  stage.classList.toggle("intent", hasText);
}

function normalizeQuestion(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

function revealAnswer() {
  const normalizedQuestion = normalizeQuestion(questionInput.value);
  if (!normalizedQuestion) return;
  questionInput.value = normalizedQuestion;

  hapticReveal();

  const polarity = Math.random() > 0.5 ? "yes" : "no";
  const answer = polarity === "yes" ? pick(yesAnswers) : pick(noAnswers);
  const micro = pick(packs[state.selectedPack][polarity]);
  const mode = revealModes.find((m) => m.id === state.selectedMode) || revealModes[0];

  orb.classList.remove("reveal");
  void orb.offsetWidth;
  orb.classList.add("reveal");

  flash.classList.remove("active");
  mist.classList.remove("active");
  void flash.offsetWidth;

  if (mode.id === "dramatic" || mode.id === "classic") flash.classList.add("active");
  if (mode.id === "mist") mist.classList.add("active");
  if (mode.id === "glitch") {
    stage.style.filter = "hue-rotate(24deg)";
    setTimeout(() => {
      stage.style.filter = "none";
    }, 180);
  }

  spawnSparkles(state.minimal ? 5 : 20);
  playRevealSound();

  setTimeout(() => {
    const entry = {
      id: makeId(),
      question: normalizedQuestion,
      polarity,
      answer,
      micro,
      mode: state.selectedMode,
      pack: state.selectedPack,
      voice: state.selectedVoice || "Default",
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

    speakText(`${normalizedQuestion} ${answer}`, { rate: 1.05, pitch: 1.26 });
  }, state.minimal || prefersReducedMotion ? 320 : mode.duration);
}

function renderAnswerCard() {
  if (!state.currentAnswer) return;

  const sourcePolarity = state.flip
    ? state.currentAnswer.polarity === "yes"
      ? "no"
      : "yes"
    : state.currentAnswer.polarity;

  answerPolarity.textContent = sourcePolarity.toUpperCase();
  answerPolarity.classList.toggle("yes", sourcePolarity === "yes");
  answerPolarity.classList.toggle("no", sourcePolarity === "no");

  const answerTextValue = sourcePolarity === state.currentAnswer.polarity
    ? state.currentAnswer.answer
    : sourcePolarity === "yes"
      ? pick(yesAnswers)
      : pick(noAnswers);

  const microTextValue = sourcePolarity === state.currentAnswer.polarity
    ? state.currentAnswer.micro
    : pick(packs[state.currentAnswer.pack][sourcePolarity]);

  answerText.textContent = answerTextValue;
  answerMicro.textContent = microTextValue;

  const date = new Date(state.currentAnswer.timestamp);
  answerMeta.textContent = `${state.currentAnswer.mode} mode • ${packs[state.currentAnswer.pack].label} pack • ${date.toLocaleString()}`;

  const fav = state.vault.find((item) => item.id === state.currentAnswer.id)?.favorite;
  favoriteAnswer.textContent = fav ? "Unfavorite" : "Favorite";

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
    return item.question.toLowerCase().includes(state.vaultSearch) || item.answer.toLowerCase().includes(state.vaultSearch);
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
          <div class="vault-actions">
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
    node.querySelector('[data-action="fav"]').addEventListener("click", () => toggleFavorite(id));
    node.querySelector('[data-action="load"]').addEventListener("click", () => loadFromVault(id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => removeFromVault(id));
  });
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
  state.selectedMode = entry.mode;
  state.selectedPack = entry.pack;
  state.flip = false;
  packSelect.value = state.selectedPack;
  buildModeRail();
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

function buildModeRail() {
  modeRail.innerHTML = "";
  revealModes.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mode-pill ${state.selectedMode === mode.id ? "active" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", () => {
      state.selectedMode = mode.id;
      buildModeRail();
      saveState();
    });
    modeRail.appendChild(button);
  });
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

function populateVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = "<option value=''>Voice unavailable</option>";
    voiceSelect.disabled = true;
    previewVoice.disabled = true;
    return;
  }

  const synth = window.speechSynthesis;
  const load = () => {
    const voices = synth.getVoices();
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

    if (!voices.some((voice) => voice.name === state.selectedVoice)) {
      const preferred =
        voices.find((voice) => voice.name === "Daniel" && voice.lang === "en-GB") ||
        voices.find((voice) => voice.name === "Daniel") ||
        voices.find((voice) => /en-GB/i.test(voice.lang)) ||
        voices.find((voice) => /en/i.test(voice.lang)) ||
        voices[0];
      state.selectedVoice = preferred.name;
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

function restoreToggles() {
  whisperModeButton.setAttribute("aria-pressed", String(state.whisper));
  minimalModeButton.setAttribute("aria-pressed", String(state.minimal));
  document.body.classList.toggle("whisper", state.whisper);
  document.body.classList.toggle("minimal", state.minimal);
  revealAudio.volume = state.whisper ? 0.32 : 0.82;
}

function playRevealSound() {
  if (!revealAudio) return;
  revealAudio.currentTime = 0;
  revealAudio.play().catch(() => {});
}

function playPixySound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || state.minimal) return;
  if (!audioContext) audioContext = new AudioCtx();

  const now = audioContext.currentTime;
  const master = audioContext.createGain();
  master.connect(audioContext.destination);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(state.whisper ? 0.05 : 0.16, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  [720, 980, 1240].forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.05;
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

function spawnSparkles(count) {
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
    sparkle.className = "sparkle";
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.animationDelay = `${Math.random() * 0.14}s`;
    sparkles.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

function speakText(text, { rate = 1, pitch = 1.2, preview = false } = {}) {
  if (!("speechSynthesis" in window) || !text) return;
  const synth = window.speechSynthesis;
  if (!preview) synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  utter.pitch = pitch;
  utter.volume = state.whisper ? 0.35 : 1;
  const voices = synth.getVoices();
  const selected = voices.find((voice) => voice.name === state.selectedVoice);
  if (selected) utter.voice = selected;
  synth.speak(utter);
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
  ctx.font = "700 80px 'Space Grotesk'";
  ctx.textAlign = "center";
  ctx.fillText("POLY ORACLE", 600, 170);

  ctx.font = "500 44px 'Space Grotesk'";
  drawWrappedText(ctx, `Q: ${entry.question}`, 600, 820, 920, 56);

  ctx.font = "700 96px 'Space Grotesk'";
  ctx.fillStyle = entry.polarity === "yes" ? "#8effd0" : "#ffc0d0";
  ctx.fillText(entry.polarity.toUpperCase(), 600, 1020);

  ctx.font = "500 52px 'Space Grotesk'";
  ctx.fillStyle = "#ffffff";
  drawWrappedText(ctx, entry.answer, 600, 1110, 860, 58);

  ctx.font = "400 36px 'Space Grotesk'";
  ctx.fillStyle = "#c6d8ff";
  drawWrappedText(ctx, entry.micro, 600, 1260, 860, 46);

  ctx.font = "400 30px 'Space Grotesk'";
  ctx.fillStyle = "#9db0e8";
  ctx.fillText(new Date(entry.timestamp).toLocaleDateString(), 600, 1412);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  const file = new File([blob], "oracle-card.png", { type: "image/png" });
  const shareData = { title: "Poly Oracle", text: `${entry.question} -> ${entry.polarity.toUpperCase()}`, files: [file] };

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
  if (navigator.vibrate) {
    navigator.vibrate(state.whisper ? [12, 14, 18] : [18, 24, 32]);
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);

    state.selectedMode = revealModes.some((mode) => mode.id === saved.selectedMode) ? saved.selectedMode : state.selectedMode;
    state.selectedPack = packs[saved.selectedPack] ? saved.selectedPack : state.selectedPack;
    state.selectedVoice = saved.selectedVoice || "";
    state.whisper = !!saved.whisper;
    state.minimal = !!saved.minimal;
    state.vault = Array.isArray(saved.vault) ? saved.vault.slice(0, 200) : [];
    state.vaultFilter = saved.vaultFilter === "fav" ? "fav" : "all";
  } catch {
    // ignore corrupt state
  }
}

function saveState() {
  const payload = {
    selectedMode: state.selectedMode,
    selectedPack: state.selectedPack,
    selectedVoice: state.selectedVoice,
    whisper: state.whisper,
    minimal: state.minimal,
    vault: state.vault,
    vaultFilter: state.vaultFilter,
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
