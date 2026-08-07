// ================= Central app state & orchestration =================
// Game-specific logic lives on KAP / CK / CT / CHESS (Controller API).
// This file owns shared state, mode flow, and wiring only.

let board = null;
let currentTurn = "king";
let selected = null;
let isGameOver = false;
let humanSide = "king";
let mode = "ai"; // "ai" | "local" | "online"

// Checkers multi-jump bookkeeping
let ckPendingFrom = null;
let ckChainOrigin = null;
let ckChainSteps = [];

// Cờ Thú / Chess extras
let lastCtWinWasDen = false;
let chessState = { enPassantTarget: null };

// Online
let peer = null, conn = null, isHost = false;
const ROOM_PREFIX = "kap-";

// Score
let score = { a: 0, b: 0 };
let lastWinner = null;

function isHumanTurn() {
  if (mode === "local") return true;
  if (mode === "online") return conn && conn.open && currentTurn === humanSide;
  return currentTurn === humanSide;
}

// ================= Interaction / AI dispatch =================
function onPointClicked(p) {
  if (isGameOver || !isHumanTurn()) return;
  currentModule().handleClick(p);
}

function maybeTriggerAI() {
  if (isGameOver) return;
  if (mode === "ai" && currentTurn !== humanSide) {
    setTimeout(() => aiMove(currentTurn), 550);
  }
}

function aiMove(side) {
  if (isGameOver || currentTurn !== side) return;
  currentModule().runAI(side);
}

// ================= Reset / mode flow =================
function resetBoardLocal() {
  const g = G();
  setBoardMode(g.boardMode || "lattice");
  board = currentModule().createBoard();
  currentTurn = g.firstTurn;
  selected = null;
  isGameOver = false;
  ckPendingFrom = null;
  ckChainOrigin = null;
  ckChainSteps = [];
  lastCtWinWasDen = false;
  chessState = { enPassantTarget: null };
  overlay.classList.remove("show");

  if (activeGame === "cothu") ctSyncPieces();
  else if (activeGame === "chess") chessSyncPieces();
  else syncPieces();

  updateStatus();
  refreshHighlights();
}

function restart() {
  resetBoardLocal();
  if (mode === "online" && conn && conn.open) conn.send({ type: "restart" });
  if (mode === "ai") maybeTriggerAI();
}

function openModeScreen() {
  overlay.classList.remove("show");
  teardownConnection();
  onlinePanel.style.display = "none";
  startBtn.style.display = "block";
  roomCodeDisplay.style.display = "none";
  setOnlineStatus("");
  startScreen.classList.add("show");
}

function openGameChoiceScreen() {
  teardownConnection();
  startScreen.classList.remove("show");
  overlay.classList.remove("show");
  gameChoiceScreen.classList.add("show");
  showLandingUI();
  gameTitle.textContent = t("appTitle");
  subtitle.textContent = t("chooseGameToBegin");
  rulesNote.innerHTML = "";
}

function selectGame(gameKey) {
  activeGame = gameKey;
  const g = G();
  humanSide = g.sideA.key;
  mode = "ai";
  resetScore();
  modeScreenTitle.textContent = gameTitleText(g);
  const sideBtns = sideButtons.querySelectorAll(".mode-btn");
  sideBtns[0].textContent = sideLabel(g, true);
  sideBtns[0].dataset.value = "a";
  sideBtns[1].textContent = sideLabel(g, false);
  sideBtns[1].dataset.value = "b";
  sideBtns.forEach((b, i) => b.classList.toggle("active", i === 0));
  onlinePanel.style.display = "none";
  startBtn.style.display = "block";
  document.getElementById("opponentButtons").querySelectorAll(".mode-btn").forEach((b, i) =>
    b.classList.toggle("active", i === 0)
  );
  gameChoiceScreen.classList.remove("show");
  startScreen.classList.add("show");
}

// ================= Wiring =================
document.querySelectorAll(".game-pick-btn").forEach(btn => {
  btn.addEventListener("click", () => selectGame(btn.dataset.game));
});

function wireToggleGroup(containerId, onChange) {
  const container = document.getElementById(containerId);
  const buttons = container.querySelectorAll(".mode-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(btn.dataset.value);
    });
  });
}

wireToggleGroup("sideButtons", value => {
  humanSide = value === "a" ? G().sideA.key : G().sideB.key;
});
wireToggleGroup("opponentButtons", value => {
  mode = value === "player" ? "local" : value;
  const showOnline = mode === "online";
  onlinePanel.style.display = showOnline ? "block" : "none";
  startBtn.style.display = showOnline ? "none" : "block";
  if (showOnline) setOnlineStatus("");
});
wireToggleGroup("onlineTabButtons", value => {
  document.getElementById("createTab").style.display = value === "create" ? "block" : "none";
  document.getElementById("joinTab").style.display = value === "create" ? "none" : "block";
  setOnlineStatus("");
});

document.getElementById("createRoomBtn").addEventListener("click", createRoom);
document.getElementById("joinRoomBtn").addEventListener("click", () => {
  joinRoom(document.getElementById("joinCodeInput").value);
});

document.getElementById("startBtn").addEventListener("click", () => {
  teardownConnection();
  startScreen.classList.remove("show");
  showPlayUI();
  applyThemeColors();
  updateSubtitle();
  resetScore();
  restart();
});

document.getElementById("restartBtn").addEventListener("click", restart);
document.getElementById("overlayRestartBtn").addEventListener("click", restart);
document.getElementById("changeModeBtn").addEventListener("click", openModeScreen);
document.getElementById("overlayModeBtn").addEventListener("click", openModeScreen);
document.getElementById("backToGameChoice").addEventListener("click", openGameChoiceScreen);

// ================= Language toggle =================
const langToggleBtn = document.getElementById("langToggle");
function refreshAllText() {
  applyStaticTranslations();
  langToggleBtn.textContent = lang === "en" ? "VI" : "EN";
  if (startScreen.classList.contains("show")) {
    const g = G();
    modeScreenTitle.textContent = gameTitleText(g);
    const sideBtns = sideButtons.querySelectorAll(".mode-btn");
    sideBtns[0].textContent = sideLabel(g, true);
    sideBtns[1].textContent = sideLabel(g, false);
  }
  if (overlay.classList.contains("show") && lastWinner) renderGameOverPanel(lastWinner);
  applyThemeColors();
  updateStatus();
  updateSubtitle();
}
langToggleBtn.addEventListener("click", () => {
  lang = lang === "en" ? "vi" : "en";
  refreshAllText();
});

// ================= Landing / play UI =================
function showPlayUI() {
  document.body.classList.remove("landing");
  document.body.classList.add("playing");
}

function showLandingUI() {
  document.body.classList.add("landing");
  document.body.classList.remove("playing");
}

// ================= Init =================
(async () => {
  wireGameModules();

  await preloadPieceImages();

  // Build lattice geometry once (hidden until a lattice game starts)
  buildStaticLines();
  buildPoints();
  applyStaticTranslations();
  langToggleBtn.textContent = lang === "en" ? "VI" : "EN";

  // Landing page: game chooser only — no board visible
  showLandingUI();
  gameTitle.textContent = t("appTitle");
  subtitle.textContent = t("chooseGameToBegin");
  rulesNote.innerHTML = "";
})();
