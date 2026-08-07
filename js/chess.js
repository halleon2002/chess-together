// ================= CHESS MODULE =================
const CHESS = {};
CHESS.other = side => (side === "white" ? "black" : "white");

function chessInBounds(p) { return p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 8; }
function chessAllPoints() {
  const pts = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) pts.push({x,y});
  return pts;
}
function chessGetPiecesOf(b, owner) {
  return chessAllPoints().filter(p => { const pc = getPiece(b,p); return pc && pc.owner === owner; });
}

CHESS.createBoard = function () {
  const b = []; for (let x=0;x<8;x++){ b.push([]); for(let y=0;y<8;y++) b[x].push(null); }
  const backRank = ["rook","knight","bishop","queen","king","bishop","knight","rook"];
  for (let x=0;x<8;x++) {
    b[x][0] = { type: backRank[x], owner: "black", hasMoved: false };
    b[x][1] = { type: "pawn", owner: "black", hasMoved: false };
    b[x][6] = { type: "pawn", owner: "white", hasMoved: false };
    b[x][7] = { type: backRank[x], owner: "white", hasMoved: false };
  }
  return b;
};

const CHESS_ROOK_DIRS = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
const CHESS_BISHOP_DIRS = [{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
const CHESS_QUEEN_DIRS = CHESS_ROOK_DIRS.concat(CHESS_BISHOP_DIRS);
const CHESS_KNIGHT_OFFSETS = [{dx:1,dy:2},{dx:2,dy:1},{dx:2,dy:-1},{dx:1,dy:-2},{dx:-1,dy:-2},{dx:-2,dy:-1},{dx:-2,dy:1},{dx:-1,dy:2}];

function chessSlide(board, point, dirs, owner) {
  const moves = [];
  for (const d of dirs) {
    let cur = {x:point.x, y:point.y};
    while (true) {
      const next = {x:cur.x+d.dx, y:cur.y+d.dy};
      if (!chessInBounds(next)) break;
      const occ = getPiece(board, next);
      if (!occ) { moves.push(next); cur = next; continue; }
      if (occ.owner !== owner) moves.push(next);
      break;
    }
  }
  return moves;
}

function chessStepMoves(board, point, offsets, owner) {
  const moves = [];
  for (const d of offsets) {
    const next = {x:point.x+d.dx, y:point.y+d.dy};
    if (!chessInBounds(next)) continue;
    const occ = getPiece(board, next);
    if (!occ || occ.owner !== owner) moves.push(next);
  }
  return moves;
}

// Pawn attack squares (diagonal-forward), regardless of occupancy — used for check detection.
function chessPawnAttackSquares(point, owner) {
  const dy = owner === "white" ? -1 : 1;
  return [{x:point.x-1,y:point.y+dy},{x:point.x+1,y:point.y+dy}].filter(chessInBounds);
}

// Pawn's actual pseudo-legal moves (forward push + captures + en passant).
function chessPawnMoves(board, point, owner, chessState) {
  const moves = [];
  const dy = owner === "white" ? -1 : 1;
  const startRank = owner === "white" ? 6 : 1;
  const one = {x:point.x, y:point.y+dy};
  if (chessInBounds(one) && !getPiece(board, one)) {
    moves.push({to:one, isDouble:false});
    const two = {x:point.x, y:point.y+2*dy};
    if (point.y === startRank && !getPiece(board, two)) moves.push({to:two, isDouble:true});
  }
  for (const atk of chessPawnAttackSquares(point, owner)) {
    const occ = getPiece(board, atk);
    if (occ && occ.owner !== owner) moves.push({to:atk, capture:true});
    else if (chessState && chessState.enPassantTarget && samePoint(atk, chessState.enPassantTarget)) {
      moves.push({to:atk, capture:true, enPassant:true});
    }
  }
  return moves;
}

// Attack squares for a piece — used only for "is this square attacked" (check/castling safety).
function chessAttackSquares(board, point, chessState) {
  const piece = getPiece(board, point);
  if (!piece) return [];
  switch (piece.type) {
    case "pawn": return chessPawnAttackSquares(point, piece.owner);
    case "knight": return chessStepMoves(board, point, CHESS_KNIGHT_OFFSETS, piece.owner);
    case "bishop": return chessSlide(board, point, CHESS_BISHOP_DIRS, piece.owner);
    case "rook": return chessSlide(board, point, CHESS_ROOK_DIRS, piece.owner);
    case "queen": return chessSlide(board, point, CHESS_QUEEN_DIRS, piece.owner);
    case "king": return chessStepMoves(board, point, CHESS_QUEEN_DIRS, piece.owner);
  }
  return [];
}

function chessIsSquareAttacked(board, point, byOwner, chessState) {
  for (const p of chessGetPiecesOf(board, byOwner)) {
    const atks = chessAttackSquares(board, p, chessState);
    if (atks.some(a => samePoint(a, point))) return true;
  }
  return false;
}

function chessFindKing(board, owner) {
  return chessGetPiecesOf(board, owner).find(p => getPiece(board,p).type === "king");
}

CHESS.isInCheck = function (board, owner, chessState) {
  const kingPos = chessFindKing(board, owner);
  if (!kingPos) return false;
  return chessIsSquareAttacked(board, kingPos, CHESS.other(owner), chessState);
};

// Pseudo-legal moves (piece movement rules only, ignoring whether it leaves own king in check).
function chessPseudoMoves(board, point, chessState) {
  const piece = getPiece(board, point);
  if (!piece) return [];
  switch (piece.type) {
    case "pawn": return chessPawnMoves(board, point, piece.owner, chessState).map(m => ({to:m.to, capture:!!m.capture, enPassant:!!m.enPassant, isDouble:!!m.isDouble}));
    case "knight": return chessStepMoves(board, point, CHESS_KNIGHT_OFFSETS, piece.owner).map(to => ({to}));
    case "bishop": return chessSlide(board, point, CHESS_BISHOP_DIRS, piece.owner).map(to => ({to}));
    case "rook": return chessSlide(board, point, CHESS_ROOK_DIRS, piece.owner).map(to => ({to}));
    case "queen": return chessSlide(board, point, CHESS_QUEEN_DIRS, piece.owner).map(to => ({to}));
    case "king": return chessStepMoves(board, point, CHESS_QUEEN_DIRS, piece.owner).map(to => ({to}));
  }
  return [];
}

function chessSimulateMove(board, from, to, extra, chessState) {
  const nb = cloneBoard(board);
  const piece = getPiece(nb, from);
  let captured = getPiece(nb, to) ? to : null;

  if (extra && extra.enPassant) {
    const dir = piece.owner === "white" ? 1 : -1;
    const capSq = {x:to.x, y:to.y+dir};
    captured = capSq;
    setPiece(nb, capSq, null);
  }

  setPiece(nb, to, { ...piece, hasMoved: true });
  setPiece(nb, from, null);

  let promoted = false;
  if (piece.type === "pawn") {
    const lastRank = piece.owner === "white" ? 0 : 7;
    if (to.y === lastRank) { setPiece(nb, to, { type: "queen", owner: piece.owner, hasMoved: true }); promoted = true; }
  }

  return { board: nb, captured, promoted };
}

// Castling moves for the king, appended separately (needs its own safety checks).
function chessCastlingMoves(board, point, chessState) {
  const piece = getPiece(board, point);
  if (!piece || piece.type !== "king" || piece.hasMoved) return [];
  const owner = piece.owner;
  const row = owner === "white" ? 7 : 0;
  if (point.x !== 4 || point.y !== row) return [];
  if (CHESS.isInCheck(board, owner, chessState)) return [];

  const moves = [];
  // Kingside: rook at x=7
  const kRook = getPiece(board, {x:7,y:row});
  if (kRook && kRook.type === "rook" && !kRook.hasMoved) {
    const empty = [{x:5,y:row},{x:6,y:row}].every(p => !getPiece(board,p));
    const safe = [{x:4,y:row},{x:5,y:row},{x:6,y:row}].every(p => !chessIsSquareAttacked(board, p, CHESS.other(owner), chessState));
    if (empty && safe) moves.push({ to:{x:6,y:row}, castle:"king" });
  }
  // Queenside: rook at x=0
  const qRook = getPiece(board, {x:0,y:row});
  if (qRook && qRook.type === "rook" && !qRook.hasMoved) {
    const empty = [{x:1,y:row},{x:2,y:row},{x:3,y:row}].every(p => !getPiece(board,p));
    const safe = [{x:4,y:row},{x:3,y:row},{x:2,y:row}].every(p => !chessIsSquareAttacked(board, p, CHESS.other(owner), chessState));
    if (empty && safe) moves.push({ to:{x:2,y:row}, castle:"queen" });
  }
  return moves;
}

// Fully legal moves: pseudo-legal moves filtered to not leave own king in check, plus castling.
CHESS.getLegalMoves = function (board, point, chessState) {
  const piece = getPiece(board, point);
  if (!piece) return [];
  const owner = piece.owner;
  const pseudo = chessPseudoMoves(board, point, chessState);
  const legal = [];
  for (const m of pseudo) {
    const sim = chessSimulateMove(board, point, m.to, m, chessState);
    if (!CHESS.isInCheck(sim.board, owner, chessState)) legal.push(m);
  }
  if (piece.type === "king") {
    for (const cm of chessCastlingMoves(board, point, chessState)) legal.push(cm);
  }
  return legal;
};

// Applies a chosen move (from GetLegalMoves) to the real board + chessState.
CHESS.applyMove = function (board, from, to, chessState) {
  const piece = getPiece(board, from);
  const legal = CHESS.getLegalMoves(board, from, chessState);
  const match = legal.find(m => samePoint(m.to, to));
  if (!match) return null;

  let captured = getPiece(board, to) ? to : null;
  let isCastle = null;
  let enPassant = false;

  if (match.enPassant) {
    const dir = piece.owner === "white" ? 1 : -1;
    const capSq = {x:to.x, y:to.y+dir};
    captured = capSq;
    setPiece(board, capSq, null);
    enPassant = true;
  }

  setPiece(board, to, { ...piece, hasMoved: true });
  setPiece(board, from, null);

  let promoted = false;
  if (piece.type === "pawn") {
    const lastRank = piece.owner === "white" ? 0 : 7;
    if (to.y === lastRank) { setPiece(board, to, { type: "queen", owner: piece.owner, hasMoved: true }); promoted = true; }
  }

  if (match.castle) {
    isCastle = match.castle;
    const row = to.y;
    if (match.castle === "king") {
      const rook = getPiece(board, {x:7,y:row});
      setPiece(board, {x:5,y:row}, { ...rook, hasMoved: true });
      setPiece(board, {x:7,y:row}, null);
    } else {
      const rook = getPiece(board, {x:0,y:row});
      setPiece(board, {x:3,y:row}, { ...rook, hasMoved: true });
      setPiece(board, {x:0,y:row}, null);
    }
  }

  // Update en passant target for the NEXT move only.
  chessState.enPassantTarget = null;
  if (piece.type === "pawn" && match.isDouble) {
    const dir = piece.owner === "white" ? 1 : -1;
    chessState.enPassantTarget = {x:to.x, y:to.y+dir};
  }

  return { captured, promoted, isCastle, enPassant };
};

CHESS.checkStatus = function (board, turnPlayer, chessState) {
  const pieces = chessGetPiecesOf(board, turnPlayer);
  const anyLegal = pieces.some(p => CHESS.getLegalMoves(board, p, chessState).length > 0);
  const inCheck = CHESS.isInCheck(board, turnPlayer, chessState);
  if (!anyLegal && inCheck) return { status: "checkmate", winner: CHESS.other(turnPlayer) };
  if (!anyLegal && !inCheck) return { status: "stalemate", winner: null };
  return { status: inCheck ? "check" : "ongoing", winner: null };
};

// ---- AI: minimax with alpha-beta pruning ----
const CHESS_VALUES = { pawn:100, knight:320, bishop:330, rook:500, queen:900, king:20000 };
// Simple centralization bonus (same table reused for all non-pawn/king pieces) — encourages
// central control without needing full per-piece-type tables.
const CHESS_CENTER_BONUS = [
  [0,5,5,5,5,5,5,0],
  [5,10,10,10,10,10,10,5],
  [5,10,20,20,20,20,10,5],
  [5,10,20,30,30,20,10,5],
  [5,10,20,30,30,20,10,5],
  [5,10,20,20,20,20,10,5],
  [5,10,10,10,10,10,10,5],
  [0,5,5,5,5,5,5,0]
];
const CHESS_PAWN_ADVANCE = [0,5,10,15,25,40,60,0]; // bonus by rank distance from own start (index = ranks advanced)

function chessAllLegalMoves(board, side, chessState) {
  const out = [];
  for (const p of chessGetPiecesOf(board, side)) {
    for (const m of CHESS.getLegalMoves(board, p, chessState)) out.push({ from: p, move: m });
  }
  return out;
}

function chessEvaluate(board, forSide) {
  let score = 0;
  for (const p of chessAllPoints()) {
    const piece = getPiece(board, p);
    if (!piece) continue;
    let val = CHESS_VALUES[piece.type];
    if (piece.type === "pawn") {
      const advanced = piece.owner === "white" ? (7 - p.y) : p.y;
      val += CHESS_PAWN_ADVANCE[advanced];
    } else if (piece.type !== "king") {
      val += CHESS_CENTER_BONUS[p.y][p.x];
    }
    score += (piece.owner === forSide) ? val : -val;
  }
  return score;
}

function chessOrderMoves(board, moves) {
  return moves.slice().sort((a, b) => {
    const av = getPiece(board, a.move.to) ? CHESS_VALUES[getPiece(board, a.move.to).type] : 0;
    const bv = getPiece(board, b.move.to) ? CHESS_VALUES[getPiece(board, b.move.to).type] : 0;
    return bv - av; // captures of valuable pieces first
  });
}

function chessMinimax(board, chessState, depth, alpha, beta, side, rootSide) {
  const status = CHESS.checkStatus(board, side, chessState);
  if (status.status === "checkmate") return side === rootSide ? -100000 - depth : 100000 + depth;
  if (status.status === "stalemate") return 0;
  if (depth === 0) return chessEvaluate(board, rootSide);

  const moves = chessOrderMoves(board, chessAllLegalMoves(board, side, chessState));
  const maximizing = side === rootSide;
  let best = maximizing ? -Infinity : Infinity;

  for (const { from, move } of moves) {
    const nb = cloneBoard(board);
    const nState = { enPassantTarget: chessState.enPassantTarget };
    CHESS.applyMove(nb, from, move.to, nState);
    const val = chessMinimax(nb, nState, depth - 1, alpha, beta, CHESS.other(side), rootSide);
    if (maximizing) { best = Math.max(best, val); alpha = Math.max(alpha, val); }
    else { best = Math.min(best, val); beta = Math.min(beta, val); }
    if (beta <= alpha) break;
  }
  return best;
}

CHESS.chooseAIMove = function (board, side, chessState, depth) {
  depth = depth || 3;
  const moves = chessOrderMoves(board, chessAllLegalMoves(board, side, chessState));
  if (moves.length === 0) return null;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const { from, move } of moves) {
    const nb = cloneBoard(board);
    const nState = { enPassantTarget: chessState.enPassantTarget };
    CHESS.applyMove(nb, from, move.to, nState);
    const val = chessMinimax(nb, nState, depth - 1, -Infinity, Infinity, CHESS.other(side), side);
    if (val > bestScore) { bestScore = val; bestMoves = [{ from, move }]; }
    else if (val === bestScore) { bestMoves.push({ from, move }); }
  }
  const pick = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return { from: pick.from, to: pick.move.to };
};

const CHESS_PIECE_IMAGES = {
  white_king: "images/wk.png",
  white_queen: "images/wq.png",
  white_rook: "images/wr.png",
  white_bishop: "images/wb.png",
  white_knight: "images/wn.png",
  white_pawn: "images/wp.png",
  black_king: "images/bk.png",
  black_queen: "images/bq.png",
  black_rook: "images/br.png",
  black_bishop: "images/bb.png",
  black_knight: "images/bn.png",
  black_pawn: "images/bp.png"
};


// ---- Controller API ----
CHESS.getLegalPlain = function (point) {
  return CHESS.getLegalMoves(board, point, chessState).map(m => m.to);
};
CHESS.getLegalCaptures = function (point) {
  return CHESS.getLegalMoves(board, point, chessState)
    .filter(m => getPiece(board, m.to) || m.enPassant)
    .map(m => ({ landing: m.to }));
};

CHESS.handleClick = function (p) {
  if (selected) {
    const moves = CHESS.getLegalMoves(board, selected, chessState);
    const match = moves.find(m => samePoint(m.to, p));
    if (match) { CHESS._performMove(selected, match); return; }
    const clicked = getPiece(board, p);
    if (clicked && clicked.owner === currentTurn) { selected = p; refreshHighlights(); return; }
    selected = null; refreshHighlights(); return;
  }
  const piece = getPiece(board, p);
  if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
};

CHESS._performMove = function (from, match) {
  const row = from.y;
  const result = CHESS.applyMove(board, from, match.to, chessState);
  selected = null;
  chessAnimateMove(from, match.to);
  if (result.enPassant) {
    const dir = getPiece(board, match.to).owner === "white" ? 1 : -1;
    chessAnimateSideCapture({ x: match.to.x, y: match.to.y + dir });
  }
  if (result.isCastle) chessAnimateCastleRook(result.isCastle, row);
  if (result.promoted) setTimeout(() => chessRefreshPieceAt(match.to), 280);
  CHESS._finishTurn({ broadcast: true, from, to: match.to });
};

CHESS._finishTurn = function (opts) {
  opts = opts || {};
  if (mode === "online" && opts.broadcast && conn && conn.open) {
    conn.send({ type: "chessMove", from: opts.from, to: opts.to });
  }
  currentTurn = CHESS.other(currentTurn);
  const status = CHESS.checkStatus(board, currentTurn, chessState);
  if (status.status === "checkmate") {
    isGameOver = true; updateStatus(); refreshHighlights();
    setTimeout(() => showGameOver(status.winner), 300); return;
  }
  if (status.status === "stalemate") {
    isGameOver = true; updateStatus(); refreshHighlights();
    setTimeout(() => showDraw(), 300); return;
  }
  updateStatus(); refreshHighlights();
  if (mode === "ai") maybeTriggerAI();
};

CHESS.runAI = function (side) {
  const move = CHESS.chooseAIMove(board, side, chessState, 3);
  if (!move) return;
  const row = move.from.y;
  const result = CHESS.applyMove(board, move.from, move.to, chessState);
  chessAnimateMove(move.from, move.to);
  if (result.enPassant) {
    const dir = getPiece(board, move.to).owner === "white" ? 1 : -1;
    chessAnimateSideCapture({ x: move.to.x, y: move.to.y + dir });
  }
  if (result.isCastle) chessAnimateCastleRook(result.isCastle, row);
  if (result.promoted) setTimeout(() => chessRefreshPieceAt(move.to), 280);
  CHESS._finishTurn({ broadcast: false, from: move.from, to: move.to });
};

CHESS.applyRemote = function (msg) {
  if (msg.type !== "chessMove") return;
  const row = msg.from.y;
  const result = CHESS.applyMove(board, msg.from, msg.to, chessState);
  chessAnimateMove(msg.from, msg.to);
  if (result.enPassant) {
    const dir = getPiece(board, msg.to).owner === "white" ? 1 : -1;
    chessAnimateSideCapture({ x: msg.to.x, y: msg.to.y + dir });
  }
  if (result.isCastle) chessAnimateCastleRook(result.isCastle, row);
  if (result.promoted) setTimeout(() => chessRefreshPieceAt(msg.to), 280);
  CHESS._finishTurn({ broadcast: false, from: msg.from, to: msg.to });
};
