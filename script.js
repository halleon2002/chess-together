<script>
(function () {
  "use strict";

  // ================= Shared board geometry (both games) =================
  const SIZE = 5;
  const PAD = 45;
  const SPACING = 90;

  function inBounds(p) { return p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE; }
  function isDiagCapable(p) {
    return (p.x % 2 === 0 && p.y % 2 === 0) || (p.x % 2 === 1 && p.y % 2 === 1);
  }
  function samePoint(a, b) { return a.x === b.x && a.y === b.y; }
  function coord(u) { return PAD + u * SPACING; }
  function cloneBoard(b) { return b.map(col => col.map(cell => (cell ? { ...cell } : null))); }
  function getPiece(b, p) { return b[p.x][p.y]; }
  function setPiece(b, p, v) { b[p.x][p.y] = v; }
  function allPoints() {
    const pts = [];
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) pts.push({x,y});
    return pts;
  }
  function getPiecesOf(b, owner) {
    return allPoints().filter(p => { const pc = getPiece(b,p); return pc && pc.owner === owner; });
  }

  function getOrthogonalNeighbors(p) {
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    return dirs.map(d => ({x: p.x+d.x, y: p.y+d.y})).filter(inBounds);
  }
  function getDiagonalNeighbors(p) {
    if (!isDiagCapable(p)) return [];
    const dirs = [{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}];
    return dirs.map(d => ({x: p.x+d.x, y: p.y+d.y})).filter(n => inBounds(n) && isDiagCapable(n));
  }
  function getAllNeighbors(p) { return getOrthogonalNeighbors(p).concat(getDiagonalNeighbors(p)); }

  // ================= KINGS & PAWNS MODULE =================
  const KAP = {};
  KAP.other = side => (side === "king" ? "pawn" : "king");

  KAP.createBoard = function () {
    const b = [];
    for (let x = 0; x < SIZE; x++) { b.push([]); for (let y = 0; y < SIZE; y++) b[x].push(null); }
    b[0][0] = { type: "king", owner: "king" };
    b[4][4] = { type: "king", owner: "king" };
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        const isKingCorner = (x === 0 && y === 0) || (x === 4 && y === 4);
        const isBorder = x === 0 || x === SIZE - 1 || y === 0 || y === SIZE - 1;
        if (isBorder && !isKingCorner) b[x][y] = { type: "pawn", owner: "pawn" };
      }
    }
    return b;
  };

  KAP.getLegalMoves = function (b, from) {
    const piece = getPiece(b, from);
    if (!piece) return [];
    return getAllNeighbors(from).filter(n => !getPiece(b, n));
  };

  KAP.getSandwichCaptures = function (b, p) {
    const result = [];
    const axisPairs = [ [{x:-1,y:0},{x:1,y:0}], [{x:0,y:-1},{x:0,y:1}] ];
    if (isDiagCapable(p)) {
      axisPairs.push([{x:-1,y:-1},{x:1,y:1}]);
      axisPairs.push([{x:-1,y:1},{x:1,y:-1}]);
    }
    for (const [dA, dB] of axisPairs) {
      const a = {x: p.x+dA.x, y: p.y+dA.y};
      const c = {x: p.x+dB.x, y: p.y+dB.y};
      if (!inBounds(a) || !inBounds(c)) continue;
      const pa = getPiece(b, a), pc = getPiece(b, c);
      if (pa && pa.type === "pawn" && pc && pc.type === "pawn") { result.push(a); result.push(c); }
    }
    return result;
  };

  KAP.tryMove = function (b, from, to) {
    const piece = getPiece(b, from);
    if (!piece) return null;
    const legal = KAP.getLegalMoves(b, from);
    if (!legal.some(m => samePoint(m, to))) return null;
    setPiece(b, to, piece);
    setPiece(b, from, null);
    let captured = [];
    if (piece.type === "king") {
      captured = KAP.getSandwichCaptures(b, to);
      for (const c of captured) setPiece(b, c, null);
    }
    return { captured };
  };

  KAP.countPawns = function (b) { return getPiecesOf(b, "pawn").length; };
  KAP.anyLegalMoveFor = function (b, owner) { return getPiecesOf(b, owner).some(p => KAP.getLegalMoves(b, p).length > 0); };
  KAP.checkWinner = function (b) {
    if (KAP.countPawns(b) === 0) return "king";
    if (!KAP.anyLegalMoveFor(b, "king")) return "pawn";
    return null;
  };

  function chebyshev(a, b) { return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)); }
  function distanceToNearestOwner(b, owner, point) {
    let best = Infinity;
    for (const p of getPiecesOf(b, owner)) best = Math.min(best, chebyshev(p, point));
    return best;
  }

  KAP.evaluatePawnMove = function (board, from, to) {
    const after = cloneBoard(board);
    KAP.tryMove(after, from, to);
    let score = 0;
    let worstCase = 0;
    for (const king of getPiecesOf(after, "king")) {
      for (const dest of KAP.getLegalMoves(after, king)) {
        const probe = cloneBoard(after);
        const res = KAP.tryMove(probe, king, dest);
        worstCase = Math.max(worstCase, res.captured.length);
      }
    }
    score -= worstCase * 50;
    let kingMobility = 0;
    for (const king of getPiecesOf(after, "king")) kingMobility += KAP.getLegalMoves(after, king).length;
    score -= kingMobility * 2;
    score += (distanceToNearestOwner(board, "king", from) - distanceToNearestOwner(after, "king", to)) * 3;
    if (kingMobility === 0) score += 10000;
    return score;
  };

  KAP.evaluateKingMove = function (board, from, to) {
    const after = cloneBoard(board);
    const result = KAP.tryMove(after, from, to);
    let score = result.captured.length * 100;
    const winner = KAP.checkWinner(after);
    if (winner === "pawn") score -= 100000;
    if (winner === "king") score += 100000;
    let kingMobility = 0;
    for (const king of getPiecesOf(after, "king")) kingMobility += KAP.getLegalMoves(after, king).length;
    score += kingMobility * 2;
    score += (distanceToNearestOwner(board, "pawn", from) - distanceToNearestOwner(after, "pawn", to)) * 3;
    return score;
  };

  KAP.chooseAIMove = function (board, side) {
    const pieces = getPiecesOf(board, side);
    const evalFn = side === "pawn" ? KAP.evaluatePawnMove : KAP.evaluateKingMove;
    const candidates = [];
    for (const piece of pieces) {
      for (const dest of KAP.getLegalMoves(board, piece)) {
        candidates.push({ from: piece, to: dest, score: evalFn(board, piece, dest) });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a,b) => b.score - a.score);
    const best = candidates[0].score;
    const top = candidates.filter(c => c.score >= best - 0.01);
    return top[Math.floor(Math.random() * top.length)];
  };

  KAP.pieceShape = function (piece, cx, cy) {
    return piece.type === "king" ? shapeKing(cx, cy) : shapePawn(cx, cy);
  };

  // ================= CHECKERS MODULE =================
  const CK = {};
  CK.other = side => (side === "white" ? "black" : "white");
  const CK_ALL_DIRS = [
    {dx:-1,dy:-1},{dx:0,dy:-1},{dx:1,dy:-1},
    {dx:-1,dy:0},{dx:1,dy:0},
    {dx:-1,dy:1},{dx:0,dy:1},{dx:1,dy:1}
  ];

  CK.createBoard = function () {
    const b = [];
    for (let x = 0; x < SIZE; x++) { b.push([]); for (let y = 0; y < SIZE; y++) b[x].push(null); }
    for (let x = 0; x < SIZE; x++) {
      b[x][0] = { type: "man", owner: "white" };
      b[x][1] = { type: "man", owner: "white" };
      b[x][3] = { type: "man", owner: "black" };
      b[x][4] = { type: "man", owner: "black" };
    }
    return b;
  };

  function ckForwardSign(owner) { return owner === "white" ? 1 : -1; }
  function ckDirsFor(piece) {
    return CK_ALL_DIRS; // both men and kings move/capture in any direction this point connects to
  }
  function ckCanStep(a, dir) {
    const b = {x:a.x+dir.dx, y:a.y+dir.dy};
    if (!inBounds(b)) return false;
    if (dir.dx !== 0 && dir.dy !== 0) return isDiagCapable(a);
    return true;
  }

  CK.getPlainMoves = function (board, point) {
    const piece = getPiece(board, point);
    if (!piece) return [];
    const moves = [];
    for (const dir of ckDirsFor(piece)) {
      if (!ckCanStep(point, dir)) continue;
      const dest = {x:point.x+dir.dx, y:point.y+dir.dy};
      if (!getPiece(board, dest)) moves.push(dest);
    }
    return moves;
  };

  CK.getCaptures = function (board, point) {
    const piece = getPiece(board, point);
    if (!piece) return [];
    const caps = [];
    for (const dir of ckDirsFor(piece)) {
      if (!ckCanStep(point, dir)) continue;
      const mid = {x:point.x+dir.dx, y:point.y+dir.dy};
      const midPiece = getPiece(board, mid);
      if (!midPiece || midPiece.owner === piece.owner) continue;
      if (!ckCanStep(mid, dir)) continue;
      const landing = {x:mid.x+dir.dx, y:mid.y+dir.dy};
      if (getPiece(board, landing)) continue;
      caps.push({ mid, landing });
    }
    return caps;
  };

  CK.anyCaptureForOwner = function (board, owner) {
    return getPiecesOf(board, owner).some(p => CK.getCaptures(board, p).length > 0);
  };

  CK.promoteIfNeeded = function (board, point) {
    const piece = getPiece(board, point);
    if (!piece || piece.type === "king") return false;
    const farRow = piece.owner === "white" ? SIZE - 1 : 0;
    if (point.y === farRow) { setPiece(board, point, { type: "king", owner: piece.owner }); return true; }
    return false;
  };

  CK.applyPlainMove = function (board, from, to) {
    const piece = getPiece(board, from);
    setPiece(board, to, piece);
    setPiece(board, from, null);
    const promoted = CK.promoteIfNeeded(board, to);
    return { captured: [], promoted, landedAt: to };
  };

  CK.applyCapture = function (board, from, capture) {
    const piece = getPiece(board, from);
    setPiece(board, capture.landing, piece);
    setPiece(board, from, null);
    setPiece(board, capture.mid, null);
    const promoted = CK.promoteIfNeeded(board, capture.landing);
    return { captured: [capture.mid], promoted, landedAt: capture.landing };
  };

  CK.checkWinner = function (board, turnPlayer) {
    const pieces = getPiecesOf(board, turnPlayer);
    if (pieces.length === 0) return CK.other(turnPlayer);
    const hasMove = pieces.some(p => CK.getPlainMoves(board,p).length>0 || CK.getCaptures(board,p).length>0);
    if (!hasMove) return CK.other(turnPlayer);
    return null;
  };

  // Recursively enumerate every complete capture chain starting from a point.
  CK.enumerateChains = function (board, point) {
    const results = [];
    function dfs(curBoard, curPoint, path) {
      const caps = CK.getCaptures(curBoard, curPoint);
      if (caps.length === 0) { results.push(path); return; }
      for (const cap of caps) {
        const nb = cloneBoard(curBoard);
        CK.applyCapture(nb, curPoint, cap);
        dfs(nb, cap.landing, path.concat([cap]));
      }
    }
    dfs(board, point, []);
    return results.filter(r => r.length > 0);
  };

  CK.chooseAIMove = function (board, side) {
    const pieces = getPiecesOf(board, side);
    const candidates = [];

    // Every possible capture chain, scored by pieces captured + resulting safety.
    for (const p of pieces) {
      for (const chain of CK.enumerateChains(board, p)) {
        candidates.push({ kind: "capture", from: p, chain, score: CK.evaluateCaptureChain(board, p, chain, side) });
      }
    }
    // Every possible plain move.
    for (const p of pieces) {
      for (const dest of CK.getPlainMoves(board, p)) {
        candidates.push({ kind: "plain", from: p, to: dest, score: CK.evaluatePlainMove(board, p, dest, side) });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a,b) => b.score - a.score);
    const best = candidates[0].score;
    const top = candidates.filter(c => c.score >= best - 0.01);
    return top[Math.floor(Math.random() * top.length)];
  };

  CK.evaluateCaptureChain = function (board, from, chain, side) {
    const after = cloneBoard(board);
    let cur = from;
    for (const step of chain) { CK.applyCapture(after, cur, step); cur = step.landing; }
    let score = chain.length * 60; // capturing is usually strong, but no longer mandatory
    const opp = CK.other(side);
    let exposed = false;
    for (const op of getPiecesOf(after, opp)) {
      if (CK.getCaptures(after, op).some(c => samePoint(c.mid, cur))) { exposed = true; break; }
    }
    if (exposed) score -= 25;
    return score;
  };

  CK.evaluatePlainMove = function (board, from, to, side) {
    const after = cloneBoard(board);
    const result = CK.applyPlainMove(after, from, to);
    let score = 0;
    if (result.promoted) score += 50;
    // Mild preference to advance toward the far row (no longer required, just a nudge).
    const fs = ckForwardSign(side);
    score += (to.y - from.y) * fs * 4;
    // Avoid leaving this piece capturable next turn.
    const opp = CK.other(side);
    let exposed = false;
    for (const op of getPiecesOf(after, opp)) {
      if (CK.getCaptures(after, op).some(c => samePoint(c.mid, to))) { exposed = true; break; }
    }
    if (exposed) score -= 30;
    // Mild pull toward board center for better mobility.
    score -= (Math.abs(to.x - 2) + Math.abs(to.y - 2)) * 1;
    return score;
  };

  CK.pieceShape = function (piece, cx, cy) {
    return shapeCheckers(piece, cx, cy);
  };

  // ================= Active game dispatch =================
  const GAMES = {
    kap: {
      key: "kap", title: "Kings & Pawns",
      sideA: { key: "king", label: "King" }, sideB: { key: "pawn", label: "Pawn" },
      firstTurn: "king",
      rulesNote: "<b>Kings</b> move one step along any line and capture by landing so that enemy pawns flank them on both sides of any straight line. <b>Pawns</b> move one step but cannot capture &mdash; they win by trapping both Kings with no legal move.",
      colors: { a: "var(--king)", aGlow: "var(--king-glow)", b: "var(--pawn)", bGlow: "var(--pawn-glow)" }
    },
    checkers: {
      key: "checkers", title: "Checkers",
      sideA: { key: "white", label: "White" }, sideB: { key: "black", label: "Black" },
      firstTurn: "white",
      rulesNote: "Pieces move one step forward (diagonal or straight). Capture by jumping over an adjacent enemy into the empty point beyond. Captures are <b>mandatory</b> and chain into multi-jumps. Reaching the far row promotes a piece to <b>King</b>, which can move and capture in any direction.",
      colors: { a: "var(--white-pc)", aGlow: "var(--white-glow)", b: "var(--black-pc)", bGlow: "var(--black-glow)" }
    }
  };

  let activeGame = "kap";

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

  function G() { return GAMES[activeGame]; }
  function otherSide(side) { return activeGame === "kap" ? KAP.other(side) : CK.other(side); }

  function isHumanTurn() {
    if (mode === "local") return true;
    if (mode === "online") return conn && conn.open && currentTurn === humanSide;
    return currentTurn === humanSide;
  }

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

  function shapeKing(cx, cy) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const w = 17, h = 14, bandH = 6;
    const d = `M ${cx-w},${cy+h-bandH} L ${cx-w},${cy+h} L ${cx+w},${cy+h} L ${cx+w},${cy+h-bandH}
               L ${cx+w*0.6},${cy-h*0.2} L ${cx+w*0.25},${cy+h*0.35} L ${cx},${cy-h}
               L ${cx-w*0.25},${cy+h*0.35} L ${cx-w*0.6},${cy-h*0.2} Z`;
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "king-shape");
    g.appendChild(p);
    return g;
  }

  function shapePawn(cx, cy) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const head = document.createElementNS(NS, "circle");
    head.setAttribute("cx", cx); head.setAttribute("cy", cy - 7); head.setAttribute("r", 8.5);
    head.setAttribute("class", "pawn-shape");
    g.appendChild(head);
    const base = document.createElementNS(NS, "path");
    base.setAttribute("d", `M ${cx-12},${cy+13} Q ${cx},${cy+3} ${cx+12},${cy+13} Z`);
    base.setAttribute("class", "pawn-shape");
    g.appendChild(base);
    return g;
  }

  function shapeCheckers(piece, cx, cy) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "piece-group");
    const disc = document.createElementNS(NS, "circle");
    disc.setAttribute("cx", cx); disc.setAttribute("cy", cy); disc.setAttribute("r", 15);
    disc.setAttribute("class", piece.owner === "white" ? "ck-white" : "ck-black");
    g.appendChild(disc);
    if (piece.type === "king") {
      const ring = document.createElementNS(NS, "circle");
      ring.setAttribute("cx", cx); ring.setAttribute("cy", cy); ring.setAttribute("r", 8);
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

  function syncPieces() {
    for (const p of allPoints()) {
      const key = p.x+","+p.y;
      const entry = pointEls[key];
      if (entry.pieceGroup) { pieceLayer.removeChild(entry.pieceGroup); entry.pieceGroup = null; }
      const piece = getPiece(board, p);
      if (!piece) continue;
      const cx = coord(p.x), cy = coord(p.y);
      const group = activeGame === "kap" ? KAP.pieceShape(piece, cx, cy) : CK.pieceShape(piece, cx, cy);
      pieceLayer.appendChild(group);
      entry.pieceGroup = group;
    }
  }

  function currentLegalPlain(point) {
    return activeGame === "kap" ? KAP.getLegalMoves(board, point) : CK.getPlainMoves(board, point);
  }
  function currentLegalCaptures(point) {
    return activeGame === "kap" ? [] : CK.getCaptures(board, point);
  }

  function refreshHighlights() {
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

  function updateStatus() {
    const g = G();
    const aLabel = g.sideA.label, bLabel = g.sideB.label;
    const turnIsA = currentTurn === g.sideA.key;
    turnLabel.textContent = isGameOver ? "Game Over" : ((turnIsA ? aLabel : bLabel) + "'s Turn");
    turnLabel.classList.toggle("active-a", turnIsA && !isGameOver);
    turnLabel.classList.toggle("active-b", !turnIsA && !isGameOver);

    if (activeGame === "kap") {
      pieceCountLabel.textContent = KAP.countPawns(board) + " pawns";
    } else {
      const w = getPiecesOf(board, "white").length, bl = getPiecesOf(board, "black").length;
      pieceCountLabel.textContent = "White " + w + " \u2013 Black " + bl;
    }
  }

  function applyThemeColors() {
    const g = G();
    document.documentElement.style.setProperty("--dot-a", g.colors.a);
    document.documentElement.style.setProperty("--dot-a-glow", g.colors.aGlow);
    document.documentElement.style.setProperty("--dot-b", g.colors.b);
    document.documentElement.style.setProperty("--dot-b-glow", g.colors.bGlow);
    gameTitle.textContent = g.title;
    rulesNote.innerHTML = g.rulesNote;
  }

  function updateSubtitle() {
    const g = G();
    if (mode === "local") { subtitle.textContent = "Local 2-player \u2014 pass the device each turn."; return; }
    if (mode === "online") {
      subtitle.textContent = "Online match \u2014 you are " + (humanSide === g.sideA.key ? g.sideA.label : g.sideB.label) + ".";
      return;
    }
    subtitle.textContent = "You are " + (humanSide === g.sideA.key ? g.sideA.label : g.sideB.label) + ". The machine plays the other side.";
  }

  function showGameOver(winner) {
    const g = G();
    overlay.classList.add("show");
    const isA = winner === g.sideA.key;
    overlayTitle.textContent = (isA ? g.sideA.label : g.sideB.label) + " Wins!";
    overlayTitle.className = isA ? "a-win" : "b-win";
    overlaySubtitle.textContent = activeGame === "kap"
      ? (winner === "king" ? "All pawns have been captured." : "Both Kings are trapped with no legal move.")
      : "The opponent has no pieces or moves left.";
  }

  // ================= Online networking =================
  function setOnlineStatus(text, cls) {
    onlineStatus.textContent = text || "";
    onlineStatus.className = "online-status" + (cls ? " " + cls : "");
  }
  function randomRoomCode(len) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
  function teardownConnection() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    peer = null; conn = null;
  }
  function createRoom() {
    teardownConnection();
    isHost = true;
    const code = randomRoomCode(4);
    roomCodeDisplay.style.display = "none";
    setOnlineStatus("Creating room\u2026");
    peer = new Peer(ROOM_PREFIX + code.toLowerCase());
    peer.on("open", () => {
      roomCodeDisplay.style.display = "block";
      roomCodeDisplay.textContent = code;
      setOnlineStatus("Waiting for your friend to join\u2026");
    });
    peer.on("connection", incoming => { conn = incoming; setupConnection(); });
    peer.on("error", err => setOnlineStatus("Connection error (" + err.type + "). Try creating a new room.", "error"));
  }
  function joinRoom(codeRaw) {
    const code = (codeRaw || "").trim().toLowerCase();
    if (!code) { setOnlineStatus("Enter a room code first.", "error"); return; }
    teardownConnection();
    isHost = false;
    setOnlineStatus("Connecting\u2026");
    peer = new Peer();
    peer.on("open", () => {
      conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
      setupConnection();
    });
    peer.on("error", err => setOnlineStatus("Connection error (" + err.type + "). Check the code and try again.", "error"));
  }
  function setupConnection() {
    conn.on("open", () => {
      setOnlineStatus("Connected!", "success");
      if (isHost) {
        conn.send({ type: "assignSide", game: activeGame, side: otherSide(humanSide) });
        beginOnlineGame();
      }
    });
    conn.on("data", onData);
    conn.on("close", () => setOnlineStatus("Your friend disconnected.", "error"));
    conn.on("error", () => setOnlineStatus("Connection error.", "error"));
  }
  function onData(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "assignSide") {
      activeGame = msg.game;
      humanSide = msg.side;
      beginOnlineGame();
    } else if (msg.type === "kapMove") {
      KAP.tryMove(board, msg.from, msg.to);
      afterKapMove({ broadcast: false });
    } else if (msg.type === "ckPlain") {
      CK.applyPlainMove(board, msg.from, msg.to);
      finishCheckersTurn({ broadcast: false });
    } else if (msg.type === "ckCapture") {
      let cur = msg.from;
      for (const step of msg.steps) { CK.applyCapture(board, cur, step); cur = step.landing; }
      finishCheckersTurn({ broadcast: false });
    } else if (msg.type === "restart") {
      resetBoardLocal();
    }
  }
  function beginOnlineGame() {
    mode = "online";
    startScreen.classList.remove("show");
    applyThemeColors();
    updateSubtitle();
    resetBoardLocal();
  }

  // ================= Interaction: dispatch by active game =================
  function onPointClicked(p) {
    if (isGameOver || !isHumanTurn()) return;
    if (activeGame === "kap") onKapPointClicked(p);
    else onCheckersPointClicked(p);
  }

  // ---- Kings & Pawns interaction ----
  function onKapPointClicked(p) {
    if (selected) {
      const from = selected;
      const result = KAP.tryMove(board, from, p);
      if (result) { selected = null; afterKapMove({ broadcast: true, from, to: p }); return; }
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
    syncPieces();
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
      if (match) performCheckersCapture(ckPendingFrom, match, [match]);
      return;
    }

    if (selected) {
      const caps = CK.getCaptures(board, selected);
      const capMatch = caps.find(c => samePoint(c.landing, p));
      if (capMatch) { performCheckersCapture(selected, capMatch, [capMatch]); return; }

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
    CK.applyPlainMove(board, from, to);
    selected = null;
    finishCheckersTurn({ broadcast: true, kind: "plain", from, to });
  }

  function performCheckersCapture(from, capture, stepsSoFar) {
    const result = CK.applyCapture(board, from, capture);
    const landedAt = result.landedAt;
    const canContinue = CK.getCaptures(board, landedAt).length > 0;
    syncPieces();
    if (canContinue) {
      ckPendingFrom = landedAt;
      selected = landedAt;
      updateStatus(); refreshHighlights();
      return;
    }
    ckPendingFrom = null;
    selected = null;
    finishCheckersTurn({ broadcast: true, kind: "capture", from, steps: stepsSoFar });
  }

  function finishCheckersTurn(opts) {
    opts = opts || {};
    syncPieces();
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
      KAP.tryMove(board, move.from, move.to);
      afterKapMove({ broadcast: false });
    } else {
      const move = CK.chooseAIMove(board, side);
      if (!move) return;
      if (move.kind === "plain") {
        CK.applyPlainMove(board, move.from, move.to);
        finishCheckersTurn({ broadcast: false });
      } else {
        let cur = move.from;
        for (const step of move.chain) { CK.applyCapture(board, cur, step); cur = step.landing; }
        finishCheckersTurn({ broadcast: false });
      }
    }
  }

  // ================= Reset / mode flow =================
  function resetBoardLocal() {
    board = activeGame === "kap" ? KAP.createBoard() : CK.createBoard();
    currentTurn = G().firstTurn;
    selected = null;
    isGameOver = false;
    ckPendingFrom = null;
    overlay.classList.remove("show");
    syncPieces();
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
    modeScreenTitle.textContent = g.title;
    const sideBtns = sideButtons.querySelectorAll(".mode-btn");
    sideBtns[0].textContent = g.sideA.label; sideBtns[0].dataset.value = "a";
    sideBtns[1].textContent = g.sideB.label; sideBtns[1].dataset.value = "b";
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
    restart();
  });

  document.getElementById("restartBtn").addEventListener("click", restart);
  document.getElementById("overlayRestartBtn").addEventListener("click", restart);
  document.getElementById("changeModeBtn").addEventListener("click", openModeScreen);
  document.getElementById("overlayModeBtn").addEventListener("click", openModeScreen);
  document.getElementById("backToGameChoice").addEventListener("click", openGameChoiceScreen);

  // ================= Init =================
  buildStaticLines();
  buildPoints();
  applyThemeColors();
  syncPieces();
  updateStatus();
  refreshHighlights();
})();
</script>