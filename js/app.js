// ================= Game state =================
  let board = KAP.createBoard();
  let currentTurn = "king";
  let selected = null;
  let isGameOver = false;
  let humanSide = "king";
  let mode = "ai"; // "ai" | "local" | "online"
  let ckPendingFrom = null; // checkers: piece forced to continue a multi-jump

  let peer = null, conn = null, isHost = false;
  const ROOM_PREFIX = "kap-";
  let ckChainOrigin = null;
  let ckChainSteps = [];
  let lastCtWinWasDen = false;
  let score = { a: 0, b: 0 };
  let lastWinner = null;

  function G() { return GAMES[activeGame]; }
  function otherSide(side) { return activeGame === "kap" ? KAP.other(side) : CK.other(side); }

  function isHumanTurn() {
    if (mode === "local") return true;
    if (mode === "online") return conn && conn.open && currentTurn === humanSide;
    return currentTurn === humanSide;
  }


// ================= Interaction: dispatch by active game =================
  function onPointClicked(p) {
    if (isGameOver || !isHumanTurn()) return;
    if (activeGame === "kap") onKapPointClicked(p);
    else if (activeGame === "checkers") onCheckersPointClicked(p);
    else onCoThuPointClicked(p);
  }

  // ---- Kings & Pawns interaction ----
  function onKapPointClicked(p) {
    if (selected) {
      const from = selected;
      const result = KAP.tryMove(board, from, p);
      if (result) { selected = null; afterKapMove({ broadcast: true, from, to: p, captured: result.captured }); return; }
      const piece = getPiece(board, p);
      if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights();
      return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
  }

  function afterKapMove(opts) {
    opts = opts || {};
    if (opts.from && opts.to) animateMove(opts.from, opts.to);
    if (opts.captured) for (const c of opts.captured) animateCapture(c);
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      conn.send({ type: "kapMove", from: opts.from, to: opts.to });
    }
    const winner = KAP.checkWinner(board);
    if (winner) {
      isGameOver = true; updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(winner), 300);
      return;
    }
    currentTurn = KAP.other(currentTurn);
    updateStatus(); refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  }

  // ---- Checkers interaction ----
  function onCheckersPointClicked(p) {
    if (ckPendingFrom) {
      const caps = CK.getCaptures(board, ckPendingFrom);
      const match = caps.find(c => samePoint(c.landing, p));
      if (match) performCheckersCapture(match);
      return;
    }

    if (selected) {
      const caps = CK.getCaptures(board, selected);
      const capMatch = caps.find(c => samePoint(c.landing, p));
      if (capMatch) {
        ckChainOrigin = selected;
        ckChainSteps = [];
        performCheckersCapture(capMatch);
        return;
      }

      const plains = CK.getPlainMoves(board, selected);
      if (plains.some(m => samePoint(m, p))) { performCheckersPlain(selected, p); return; }

      const clicked = getPiece(board, p);
      if (clicked && clicked.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights();
      return;
    }

    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) {
      selected = p; refreshHighlights();
    }
  }

  function performCheckersPlain(from, to) {
    const result = CK.applyPlainMove(board, from, to);
    selected = null;
    animateMove(from, to);
    if (result.promoted) setTimeout(() => refreshPieceAt(to), 280);
    finishCheckersTurn({ broadcast: true, kind: "plain", from, to });
  }

  function performCheckersCapture(capture) {
    const from = ckPendingFrom || selected;
    const result = CK.applyCapture(board, from, capture);
    ckChainSteps.push(capture);
    const landedAt = result.landedAt;
    animateMove(from, landedAt);
    animateCapture(capture.mid);

    const canContinue = CK.getCaptures(board, landedAt).length > 0;
    if (canContinue) {
      ckPendingFrom = landedAt;
      selected = landedAt;
      updateStatus(); refreshHighlights();
      return;
    }

    const finalFrom = ckChainOrigin;
    const finalSteps = ckChainSteps;
    ckPendingFrom = null; ckChainOrigin = null; ckChainSteps = [];
    selected = null;
    // Always refresh (not just when this specific hop promoted it) — promotion
    // may have happened on an earlier hop in the chain, in which case this final
    // hop's own "promoted" flag correctly comes back false (already a King).
    setTimeout(() => refreshPieceAt(landedAt), 280);
    finishCheckersTurn({ broadcast: true, kind: "capture", from: finalFrom, steps: finalSteps });
  }

  function finishCheckersTurn(opts) {
    opts = opts || {};
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      if (opts.kind === "plain") conn.send({ type: "ckPlain", from: opts.from, to: opts.to });
      else if (opts.kind === "capture") conn.send({ type: "ckCapture", from: opts.from, steps: opts.steps });
    }
    currentTurn = CK.other(currentTurn);
    const winner = CK.checkWinner(board, currentTurn);
    if (winner) {
      isGameOver = true; updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(winner), 300);
      return;
    }
    updateStatus(); refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  }

  // ---- Cờ Thú interaction ----
  function onCoThuPointClicked(p) {
    if (selected) {
      const moves = CT.getLegalMoves(board, selected);
      const match = moves.find(m => samePoint(m.to, p));
      if (match) { performCoThuMove(selected, p); return; }

      const clicked = getPiece(board, p);
      if (clicked && clicked.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights();
      return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
  }

  function performCoThuMove(from, to) {
    const result = CT.applyMove(board, from, to);
    selected = null;
    ctAnimateMove(from, to);
    finishCoThuTurn({ broadcast: true, from, to, wonByDen: result.wonByDen, mover: currentTurn });
  }

  function finishCoThuTurn(opts) {
    opts = opts || {};
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      conn.send({ type: "ctMove", from: opts.from, to: opts.to });
    }
    if (opts.wonByDen) {
      isGameOver = true;
      lastCtWinWasDen = true;
      updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(opts.mover), 300);
      return;
    }
    currentTurn = CT.other(currentTurn);
    const winner = CT.checkWinner(board, currentTurn);
    if (winner) {
      isGameOver = true;
      lastCtWinWasDen = false;
      updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(winner), 300);
      return;
    }
    updateStatus(); refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  }


// ================= AI dispatch =================
  function maybeTriggerAI() {
    if (isGameOver) return;
    if (mode === "ai" && currentTurn !== humanSide) setTimeout(() => aiMove(currentTurn), 550);
  }

  function aiMove(side) {
    if (isGameOver || currentTurn !== side) return;
    if (activeGame === "kap") {
      const move = KAP.chooseAIMove(board, side);
      if (!move) return;
      const result = KAP.tryMove(board, move.from, move.to);
      afterKapMove({ broadcast: false, from: move.from, to: move.to, captured: result.captured });
    } else if (activeGame === "checkers") {
      const move = CK.chooseAIMove(board, side);
      if (!move) return;
      if (move.kind === "plain") {
        const result = CK.applyPlainMove(board, move.from, move.to);
        animateMove(move.from, move.to);
        if (result.promoted) setTimeout(() => refreshPieceAt(move.to), 280);
        finishCheckersTurn({ broadcast: false });
      } else {
        let cur = move.from;
        for (const step of move.chain) { CK.applyCapture(board, cur, step); cur = step.landing; }
        const finalPos = move.chain[move.chain.length - 1].landing;
        animateChainCaptures(move.from, move.chain, () => {
          refreshPieceAt(finalPos);
          finishCheckersTurn({ broadcast: false });
        });
      }
    } else {
      const move = CT.chooseAIMove(board, side);
      if (!move) return;
      const result = CT.applyMove(board, move.from, move.to);
      ctAnimateMove(move.from, move.to);
      finishCoThuTurn({ broadcast: false, wonByDen: result.wonByDen, mover: side });
    }
  }


// ================= Reset / mode flow =================
  function resetBoardLocal() {
    const BOARD_FACTORY = {
    kap: KAP.createBoard,
    checkers: CK.createBoard,
    cothu: CT.createBoard
};

	board = BOARD_FACTORY[activeGame]();
    currentTurn = G().firstTurn;
    selected = null;
    isGameOver = false;
    ckPendingFrom = null;
    ckChainOrigin = null;
    ckChainSteps = [];
    overlay.classList.remove("show");
    if (activeGame === "cothu") ctSyncPieces(); else syncPieces();
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
  }

  function selectGame(gameKey) {
    activeGame = gameKey;
    const g = G();
    humanSide = g.sideA.key;
    mode = "ai";
    resetScore();
    modeScreenTitle.textContent = gameTitleText(g);
    const sideBtns = sideButtons.querySelectorAll(".mode-btn");
    sideBtns[0].textContent = sideLabel(g, true); sideBtns[0].dataset.value = "a";
    sideBtns[1].textContent = sideLabel(g, false); sideBtns[1].dataset.value = "b";
    sideBtns.forEach((b,i) => b.classList.toggle("active", i === 0));
    onlinePanel.style.display = "none";
    startBtn.style.display = "block";
    document.getElementById("opponentButtons").querySelectorAll(".mode-btn").forEach((b,i) => b.classList.toggle("active", i === 0));
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

  wireToggleGroup("sideButtons", value => { humanSide = value === "a" ? G().sideA.key : G().sideB.key; });
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


// ================= Init =================
  (async () => {

    await preloadPieceImages();

    buildStaticLines();
    buildPoints();
    applyStaticTranslations();
    langToggleBtn.textContent = lang === "en" ? "VI" : "EN";
    applyThemeColors();
    syncPieces();
    updateStatus();
    refreshHighlights();

})();
