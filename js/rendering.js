// ================= Rendering =================
  const svg = document.getElementById("board");
  const NS = "http://www.w3.org/2000/svg";
  const turnLabel = document.getElementById("turnLabel");
  const pieceCountLabel = document.getElementById("pieceCount");
  const subtitle = document.getElementById("subtitle");
  const gameTitle = document.getElementById("gameTitle");
  const rulesNote = document.getElementById("rulesNote");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySubtitle = document.getElementById("overlaySubtitle");
  const scoreLineEl = document.getElementById("scoreLine");
  const startScreen = document.getElementById("startScreen");
  const modeScreenTitle = document.getElementById("modeScreenTitle");
  const gameChoiceScreen = document.getElementById("gameChoiceScreen");
  const onlinePanel = document.getElementById("onlinePanel");
  const onlineStatus = document.getElementById("onlineStatus");
  const startBtn = document.getElementById("startBtn");
  const roomCodeDisplay = document.getElementById("roomCodeDisplay");
  const sideButtons = document.getElementById("sideButtons");

  const lineLayer = document.createElementNS(NS, "g");
  const dotLayer = document.createElementNS(NS, "g");
  const pieceLayer = document.createElementNS(NS, "g");
  const hitLayer = document.createElementNS(NS, "g");
  svg.appendChild(lineLayer);
  svg.appendChild(dotLayer);
  svg.appendChild(pieceLayer);
  svg.appendChild(hitLayer);

  // ---- Cờ Thú (grid) rendering layers, coexisting with the lattice layers above ----
  const CT_CELL = 58, CT_PAD_X = 12, CT_PAD_Y = 12;
  const CT_VIEW_W = CT_COLS * CT_CELL + CT_PAD_X * 2;
  const CT_VIEW_H = CT_ROWS * CT_CELL + CT_PAD_Y * 2;
  function ctCoordX(col) { return CT_PAD_X + col * CT_CELL + CT_CELL / 2; }
  function ctCoordY(row) { return CT_PAD_Y + row * CT_CELL + CT_CELL / 2; }

  const ctTerrainLayer = document.createElementNS(NS, "g");
  const ctGridLayer = document.createElementNS(NS, "g");
  const ctPieceLayer = document.createElementNS(NS, "g");
  const ctHitLayer = document.createElementNS(NS, "g");
  svg.appendChild(ctTerrainLayer);
  svg.appendChild(ctGridLayer);
  svg.appendChild(ctPieceLayer);
  svg.appendChild(ctHitLayer);

  const ctPointEls = {};
  let ctBoardBuilt = false;

  function setBoardMode(isGrid) {
    const latDisplay = isGrid ? "none" : "";
    const ctDisplay = isGrid ? "" : "none";
    lineLayer.style.display = latDisplay; dotLayer.style.display = latDisplay;
    pieceLayer.style.display = latDisplay; hitLayer.style.display = latDisplay;
    ctTerrainLayer.style.display = ctDisplay; ctGridLayer.style.display = ctDisplay;
    ctPieceLayer.style.display = ctDisplay; ctHitLayer.style.display = ctDisplay;
    svg.setAttribute("viewBox", isGrid ? `0 0 ${CT_VIEW_W} ${CT_VIEW_H}` : "0 0 450 450");
    if (isGrid && !ctBoardBuilt) { buildCoThuBoard(); ctBoardBuilt = true; }
  }

  function renderBoard() {
    const isGrid = !!G().isGrid;
    setBoardMode(isGrid);
    if (isGrid) ctSyncPieces();
    else syncPieces();
  }


  function buildCoThuBoard() {
    for (const p of ctAllPoints()) {
      const x = CT_PAD_X + p.x * CT_CELL, y = CT_PAD_Y + p.y * CT_CELL;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", x); rect.setAttribute("y", y);
      rect.setAttribute("width", CT_CELL); rect.setAttribute("height", CT_CELL);
      let fill = "transparent";
      if (ctIsRiver(p)) fill = "rgba(79,143,209,0.35)";
      else if (ctDenOwnerAt(p)) fill = "rgba(217,151,63,0.45)";
      else if (ctTrapOwnerAt(p)) fill = "rgba(224,122,74,0.3)";
      rect.setAttribute("fill", fill);
      ctTerrainLayer.appendChild(rect);

      const border = document.createElementNS(NS, "rect");
      border.setAttribute("x", x); border.setAttribute("y", y);
      border.setAttribute("width", CT_CELL); border.setAttribute("height", CT_CELL);
      border.setAttribute("fill", "none");
      border.setAttribute("stroke", "var(--line-dim)");
      border.setAttribute("stroke-width", "1.5");
      ctGridLayer.appendChild(border);

      const hit = document.createElementNS(NS, "rect");
      hit.setAttribute("x", x); hit.setAttribute("y", y);
      hit.setAttribute("width", CT_CELL); hit.setAttribute("height", CT_CELL);
      hit.setAttribute("fill", "transparent");
      hit.setAttribute("class", "point-hit");
      hit.addEventListener("click", () => onPointClicked(p));
      ctHitLayer.appendChild(hit);

      ctPointEls[p.x+","+p.y] = { hit, pieceGroup: null };
    }
  }

  

const pieceImageCache = {};

async function preloadPieceImages() {

    const tasks = [];

    for (const [type, src] of Object.entries(CT_PIECE_IMAGES)) {

        const img = new Image();

        img.src = src;

        pieceImageCache[type] = img;

        tasks.push(
            new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            })
        );
    }

    await Promise.all(tasks);

    // Force browser to decode every image
    await Promise.all(
        Object.values(pieceImageCache).map(img =>
            img.decode ? img.decode().catch(() => {}) : Promise.resolve()
        )
    );
}

  function ctMakePieceShape(piece) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", 0); ring.setAttribute("cy", 0); ring.setAttribute("r", 26);
    ring.style.fill = piece.owner === "top" ? "var(--king)" : "var(--pawn)";
    g.appendChild(ring);
    const img = document.createElementNS(NS, "image");
    const size = 50;
    img.setAttribute("href", pieceImageCache[piece.type].src);
    img.setAttribute("x", -size/2); img.setAttribute("y", -size/2);
    img.setAttribute("width", size); img.setAttribute("height", size);
    g.appendChild(img);
    return g;
  }

  function ctPlaceGroupAt(group, point, animate) {
    const cx = ctCoordX(point.x), cy = ctCoordY(point.y);
    group.style.transition = animate ? "transform 0.28s ease" : "none";
    group.style.transform = `translate(${cx}px, ${cy}px)`;
  }

  function ctSyncPieces() {
    for (const p of ctAllPoints()) {
      const key = p.x+","+p.y;
      const entry = ctPointEls[key];
      if (entry.pieceGroup) { ctPieceLayer.removeChild(entry.pieceGroup); entry.pieceGroup = null; }
      const piece = getPiece(board, p);
      if (!piece) continue;
      const group = ctMakePieceShape(piece);
      ctPlaceGroupAt(group, p, false);
      ctPieceLayer.appendChild(group);
      entry.pieceGroup = group;
    }
  }

  function ctAnimateMove(from, to) {
    const fromEntry = ctPointEls[from.x+","+from.y];
    const toEntry = ctPointEls[to.x+","+to.y];
    const group = fromEntry.pieceGroup;
    fromEntry.pieceGroup = null;
    if (!group) return;

    // A piece already at the destination means this move captured it — fade
    // it out here (captures in Cờ Thú land on the same square as the victim,
    // unlike Checkers, so this can't be handled as a separate "capture" step).
    if (toEntry.pieceGroup) {
      const capturedGroup = toEntry.pieceGroup;
      toEntry.pieceGroup = null;
      capturedGroup.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      capturedGroup.style.opacity = "0";
      const cx = ctCoordX(to.x), cy = ctCoordY(to.y);
      capturedGroup.style.transform = `translate(${cx}px, ${cy}px) scale(0.2)`;
      setTimeout(() => { if (capturedGroup.parentNode) ctPieceLayer.removeChild(capturedGroup); }, 260);
    }

    toEntry.pieceGroup = group;
    ctPlaceGroupAt(group, to, true);
  }


  function buildStaticLines() {
    const lines = [];
    const full = SIZE - 1;
    lines.push({x1:coord(0),y1:coord(0),x2:coord(full),y2:coord(0), w:4});
    lines.push({x1:coord(0),y1:coord(full),x2:coord(full),y2:coord(full), w:4});
    lines.push({x1:coord(0),y1:coord(0),x2:coord(0),y2:coord(full), w:4});
    lines.push({x1:coord(full),y1:coord(0),x2:coord(full),y2:coord(full), w:4});
    lines.push({x1:coord(2),y1:coord(0),x2:coord(2),y2:coord(full), w:4});
    lines.push({x1:coord(0),y1:coord(2),x2:coord(full),y2:coord(2), w:4});
    lines.push({x1:coord(1),y1:coord(0),x2:coord(1),y2:coord(full), w:1.5});
    lines.push({x1:coord(3),y1:coord(0),x2:coord(3),y2:coord(full), w:1.5});
    lines.push({x1:coord(0),y1:coord(1),x2:coord(full),y2:coord(1), w:1.5});
    lines.push({x1:coord(0),y1:coord(3),x2:coord(full),y2:coord(3), w:1.5});
    const quads = [[0,0],[2,0],[0,2],[2,2]];
    for (const [qx,qy] of quads) {
      lines.push({x1:coord(qx),y1:coord(qy),x2:coord(qx+2),y2:coord(qy+2), w:1.5});
      lines.push({x1:coord(qx+2),y1:coord(qy),x2:coord(qx),y2:coord(qy+2), w:1.5});
    }
    for (const l of lines) {
      const el = document.createElementNS(NS, "line");
      el.setAttribute("x1", l.x1); el.setAttribute("y1", l.y1);
      el.setAttribute("x2", l.x2); el.setAttribute("y2", l.y2);
      el.setAttribute("stroke", "var(--line-dim)");
      el.setAttribute("stroke-width", l.w);
      el.setAttribute("stroke-linecap", "round");
      el.style.pointerEvents = "none";
      lineLayer.appendChild(el);
    }
  }

  function shapeKing() {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const w = 17, h = 14, bandH = 6;
    const d = `M ${-w},${h-bandH} L ${-w},${h} L ${w},${h} L ${w},${h-bandH}
               L ${w*0.6},${-h*0.2} L ${w*0.25},${h*0.35} L 0,${-h}
               L ${-w*0.25},${h*0.35} L ${-w*0.6},${-h*0.2} Z`;
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "king-shape");
    g.appendChild(p);
    return g;
  }

  function shapePawn() {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const head = document.createElementNS(NS, "circle");
    head.setAttribute("cx", 0); head.setAttribute("cy", -7); head.setAttribute("r", 8.5);
    head.setAttribute("class", "pawn-shape");
    g.appendChild(head);
    const base = document.createElementNS(NS, "path");
    base.setAttribute("d", `M -12,13 Q 0,3 12,13 Z`);
    base.setAttribute("class", "pawn-shape");
    g.appendChild(base);
    return g;
  }

  function shapeCheckers(piece) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const disc = document.createElementNS(NS, "circle");
    disc.setAttribute("cx", 0); disc.setAttribute("cy", 0); disc.setAttribute("r", 15);
    disc.setAttribute("class", piece.owner === "white" ? "ck-white" : "ck-black");
    g.appendChild(disc);
    if (piece.type === "king") {
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("cx", 0); ring.setAttribute("cy", 0); ring.setAttribute("r", 8);
      ring.setAttribute("class", "ck-king-mark " + (piece.owner === "white" ? "on-white" : "on-black"));
      g.appendChild(ring);
    }
    return g;
  }

  const pointEls = {};

  function buildPoints() {
    for (const p of allPoints()) {
      const cx = coord(p.x), cy = coord(p.y);

      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("r", 6);
      dot.setAttribute("fill", "var(--point)");
      dot.setAttribute("class", "point-dot");
      dot.style.pointerEvents = "none";
      dotLayer.appendChild(dot);

      const hit = document.createElementNS(NS, "circle");
      hit.setAttribute("cx", cx); hit.setAttribute("cy", cy); hit.setAttribute("r", 38);
      hit.setAttribute("fill", "transparent");
      hit.setAttribute("class", "point-hit");
      hit.addEventListener("click", () => onPointClicked(p));
      hitLayer.appendChild(hit);

      pointEls[p.x+","+p.y] = { hit, dot, pieceGroup: null };
    }
  }

  function makePieceShape(piece) {
    if (activeGame === "kap") return piece.type === "king" ? shapeKing() : shapePawn();
    return shapeCheckers(piece);
  }

  function placeGroupAt(group, point, animate) {
    const cx = coord(point.x), cy = coord(point.y);
    group.style.transition = animate ? "transform 0.28s ease" : "none";
    group.style.transform = `translate(${cx}px, ${cy}px)`;
  }

  // Full (non-animated) rebuild of every piece from the current board state.
  // Used only for initial setup and full board resets.
  function syncPieces() {
    for (const p of allPoints()) {
      const key = p.x+","+p.y;
      const entry = pointEls[key];
      if (entry.pieceGroup) { pieceLayer.removeChild(entry.pieceGroup); entry.pieceGroup = null; }
      const piece = getPiece(board, p);
      if (!piece) continue;
      const group = makePieceShape(piece);
      placeGroupAt(group, p, false);
      pieceLayer.appendChild(group);
      entry.pieceGroup = group;
    }
  }

  // Animate an existing piece sliding from one point to another (same DOM element).
  function animateMove(from, to) {
    const fromEntry = pointEls[from.x+","+from.y];
    const toEntry = pointEls[to.x+","+to.y];
    const group = fromEntry.pieceGroup;
    fromEntry.pieceGroup = null;
    if (!group) return;
    toEntry.pieceGroup = group;
    placeGroupAt(group, to, true);
  }

  // Fade + shrink a captured piece out, then remove it from the DOM.
  function animateCapture(at) {
    const entry = pointEls[at.x+","+at.y];
    const group = entry.pieceGroup;
    entry.pieceGroup = null;
    if (!group) return;
    group.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    group.style.opacity = "0";
    const cx = coord(at.x), cy = coord(at.y);
    group.style.transform = `translate(${cx}px, ${cy}px) scale(0.2)`;
    setTimeout(() => { if (group.parentNode) pieceLayer.removeChild(group); }, 260);
  }

  // Re-render a single piece in place (e.g. after promotion changes its shape).
  function refreshPieceAt(point) {
    const entry = pointEls[point.x+","+point.y];
    if (entry.pieceGroup) { pieceLayer.removeChild(entry.pieceGroup); entry.pieceGroup = null; }
    const piece = getPiece(board, point);
    if (!piece) return;
    const group = makePieceShape(piece);
    placeGroupAt(group, point, false);
    pieceLayer.appendChild(group);
    entry.pieceGroup = group;
  }

  // Plays a completed multi-jump chain hop-by-hop (board state is already fully
  // applied; this just replays the visuals in sequence), then calls onComplete.
  function animateChainCaptures(from, steps, onComplete) {
    let idx = 0, cur = from;
    function next() {
      if (idx >= steps.length) { if (onComplete) onComplete(); return; }
      const s = steps[idx++];
      animateMove(cur, s.landing);
      animateCapture(s.mid);
      cur = s.landing;
      setTimeout(next, 300);
    }
    next();
  }

  function currentLegalPlain(point) {
    return currentModule().getLegalPlain(point);
  }
  function currentLegalCaptures(point) {
    return currentModule().getLegalCaptures(point);
  }

  function refreshHighlights() {
    if (activeGame === "cothu") { ctRefreshHighlights(); return; }

    let plainDests = [], captureDests = [];
    if (selected) {
      plainDests = currentLegalPlain(selected);
      captureDests = currentLegalCaptures(selected).map(c => c.landing);
    }
    const humanTurn = isHumanTurn();

    for (const p of allPoints()) {
      const entry = pointEls[p.x+","+p.y];
      const isSelected = selected && samePoint(selected, p);
      const isCapture = captureDests.some(m => samePoint(m, p));
      const isPlain = !isCapture && plainDests.some(m => samePoint(m, p));
      entry.dot.classList.toggle("selected", !!isSelected);
      entry.dot.classList.toggle("capture", !!isCapture);
      entry.dot.classList.toggle("legal", !!isPlain);
      if (!isSelected && !isCapture && !isPlain) entry.dot.setAttribute("fill", "var(--point)");

      const piece = getPiece(board, p);
      let clickable = !isGameOver && humanTurn;
      if (clickable) {
        if (ckPendingFrom) {
          clickable = samePoint(p, ckPendingFrom) || isCapture;
        } else if (piece && piece.owner === currentTurn) {
          clickable = true;
        } else {
          clickable = isPlain || isCapture;
        }
      }
      entry.hit.classList.toggle("clickable", !!clickable);
    }
  }

  function ctRefreshHighlights() {
    let dests = [];
    if (selected) dests = CT.getLegalMoves(board, selected).map(m => m.to);
    const humanTurn = isHumanTurn();

    for (const p of ctAllPoints()) {
      const entry = ctPointEls[p.x+","+p.y];
      const isSelected = selected && samePoint(selected, p);
      const isDest = dests.some(m => samePoint(m, p));
      entry.hit.classList.remove("legal-marker");
      if (entry._marker) { entry.hit.parentNode && ctHitLayer.removeChild(entry._marker); entry._marker = null; }
      if (isSelected || isDest) {
        const marker = document.createElementNS(NS, "circle");
        marker.setAttribute("cx", ctCoordX(p.x));
        marker.setAttribute("cy", ctCoordY(p.y));
        marker.setAttribute("r", isSelected ? 27 : 8);
        marker.setAttribute("fill", isSelected ? "none" : "var(--legal)");
        marker.setAttribute("stroke", isSelected ? "var(--selected)" : "none");
        marker.setAttribute("stroke-width", "3");
        marker.style.pointerEvents = "none";
        ctHitLayer.insertBefore(marker, entry.hit);
        entry._marker = marker;
      }

      const piece = getPiece(board, p);
      let clickable = !isGameOver && humanTurn;
      if (clickable) {
        if (piece && piece.owner === currentTurn) clickable = true;
        else clickable = isDest;
      }
      entry.hit.classList.toggle("clickable", !!clickable);
    }
  }

  function sideLabel(g, isA) {
    return (isA ? g.sideA.label : g.sideB.label)[lang];
  }
  function gameTitleText(g) { return g.title[lang]; }
  function rulesNoteHtml(g) { return g.rulesNote[lang]; }

  function updateStatus() {
    const g = G();
    const turnIsA = currentTurn === g.sideA.key;
    const label = sideLabel(g, turnIsA);
    turnLabel.textContent = isGameOver ? t("gameOver") : t("turnOf", label);
    turnLabel.classList.toggle("active-a", turnIsA && !isGameOver);
    turnLabel.classList.toggle("active-b", !turnIsA && !isGameOver);

    if (activeGame === "kap") {
      pieceCountLabel.textContent = t("pawnsCount", KAP.countPawns(board));
    } else if (activeGame === "checkers") {
      const w = getPiecesOf(board, "white").length, bl = getPiecesOf(board, "black").length;
      pieceCountLabel.textContent = t("whiteBlackCount", w, bl);
    } else {
      const top = ctGetPiecesOf(board, "top").length, bo = ctGetPiecesOf(board, "bottom").length;
      pieceCountLabel.textContent = t("topBottomCount", top, bo);
    }
  }

  function applyThemeColors() {
    const g = G();
    document.documentElement.style.setProperty("--dot-a", g.colors.a);
    document.documentElement.style.setProperty("--dot-a-glow", g.colors.aGlow);
    document.documentElement.style.setProperty("--dot-b", g.colors.b);
    document.documentElement.style.setProperty("--dot-b-glow", g.colors.bGlow);
    gameTitle.textContent = gameTitleText(g);
    rulesNote.innerHTML = rulesNoteHtml(g);
  }

  function updateSubtitle() {
    const g = G();
    if (mode === "local") { subtitle.textContent = t("subtitleLocal"); return; }
    const label = sideLabel(g, humanSide === g.sideA.key);
    if (mode === "online") { subtitle.textContent = t("subtitleOnline", label); return; }
    subtitle.textContent = t("subtitleAI", label);
  }

  function renderGameOverPanel(winner) {
    const g = G();
    overlay.classList.add("show");
    const isA = winner === g.sideA.key;
    overlayTitle.textContent = t("winsSuffix", sideLabel(g, isA));
    overlayTitle.className = isA ? "a-win" : "b-win";
    if (activeGame === "kap") {
      overlaySubtitle.textContent = winner === "king" ? t("kapWinAllPawns") : t("kapWinTrapped");
    } else if (activeGame === "checkers") {
      overlaySubtitle.textContent = t("noMovesLeft");
    } else {
      overlaySubtitle.textContent = lastCtWinWasDen ? t("cothuWinDen") : t("noMovesLeft");
    }
    renderScoreLine();
  }

  function showGameOver(winner) {
    lastWinner = winner;
    const g = G();
    const isA = winner === g.sideA.key;
    if (isA) score.a++; else score.b++;
    renderGameOverPanel(winner);
  }

  function renderScoreLine() {
    const g = G();
    scoreLineEl.innerHTML =
      `<span class="score-a">${sideLabel(g, true)} ${score.a}</span>` +
      `<span class="score-sep">–</span>` +
      `<span class="score-b">${sideLabel(g, false)} ${score.b}</span>`;
  }

  function resetScore() {
    score = { a: 0, b: 0 };
  }
