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
    return CK_ALL_DIRS; // men move/capture one step in any direction this point connects to
  }
  function ckCanStep(a, dir) {
    const b = {x:a.x+dir.dx, y:a.y+dir.dy};
    if (!inBounds(b)) return false;
    if (dir.dx !== 0 && dir.dy !== 0) return isDiagCapable(a);
    return true;
  }

  // Flying-king slide: walk through empty points in one direction; if a single
  // enemy piece is hit followed by at least one empty point, that's a capture,
  // landable on ANY empty point beyond it (not just the very next one). Blocked
  // entirely by an own piece, or by an enemy piece with no empty point right after it.
  function ckSlideDir(board, point, dir, piece) {
    const moves = [];
    const captures = [];
    let cur = point;
    while (ckCanStep(cur, dir)) {
      const next = { x: cur.x + dir.dx, y: cur.y + dir.dy };
      const occ = getPiece(board, next);
      if (!occ) { moves.push(next); cur = next; continue; }
      if (occ.owner === piece.owner) break;
      let afterCur = next;
      while (ckCanStep(afterCur, dir)) {
        const landing = { x: afterCur.x + dir.dx, y: afterCur.y + dir.dy };
        if (getPiece(board, landing)) break;
        captures.push({ mid: next, landing });
        afterCur = landing;
      }
      break; // sliding always stops at the first non-empty point, capture or not
    }
    return { moves, captures };
  }

  CK.getPlainMoves = function (board, point) {
    const piece = getPiece(board, point);
    if (!piece) return [];
    if (piece.type === "king") {
      let moves = [];
      for (const dir of CK_ALL_DIRS) moves = moves.concat(ckSlideDir(board, point, dir, piece).moves);
      return moves;
    }
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
    if (piece.type === "king") {
      let caps = [];
      for (const dir of CK_ALL_DIRS) caps = caps.concat(ckSlideDir(board, point, dir, piece).captures);
      return caps;
    }
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


  // ---- Controller API ----
  CK.getLegalPlain = function (point) { return CK.getPlainMoves(board, point); };
  CK.getLegalCaptures = function (point) { return CK.getCaptures(board, point); };

  CK.handleClick = function (p) {
    if (ckPendingFrom) {
      const caps = CK.getCaptures(board, ckPendingFrom);
      const match = caps.find(c => samePoint(c.landing, p));
      if (match) CK._performCapture(match);
      return;
    }
    if (selected) {
      const caps = CK.getCaptures(board, selected);
      const capMatch = caps.find(c => samePoint(c.landing, p));
      if (capMatch) {
        ckChainOrigin = selected; ckChainSteps = [];
        CK._performCapture(capMatch); return;
      }
      const plains = CK.getPlainMoves(board, selected);
      if (plains.some(m => samePoint(m, p))) { CK._performPlain(selected, p); return; }
      const clicked = getPiece(board, p);
      if (clicked && clicked.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights(); return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
  };

  CK._performPlain = function (from, to) {
    const result = CK.applyPlainMove(board, from, to);
    selected = null;
    animateMove(from, to);
    if (result.promoted) setTimeout(() => refreshPieceAt(to), 280);
    CK._finishTurn({ broadcast: true, kind: "plain", from, to });
  };

  CK._performCapture = function (capture) {
    const from = ckPendingFrom || selected;
    const result = CK.applyCapture(board, from, capture);
    ckChainSteps.push(capture);
    const landedAt = result.landedAt;
    animateMove(from, landedAt);
    animateCapture(capture.mid);
    if (CK.getCaptures(board, landedAt).length > 0) {
      ckPendingFrom = landedAt; selected = landedAt;
      updateStatus(); refreshHighlights(); return;
    }
    const finalFrom = ckChainOrigin, finalSteps = ckChainSteps;
    ckPendingFrom = null; ckChainOrigin = null; ckChainSteps = []; selected = null;
    setTimeout(() => refreshPieceAt(landedAt), 280);
    CK._finishTurn({ broadcast: true, kind: "capture", from: finalFrom, steps: finalSteps });
  };

  CK._finishTurn = function (opts) {
    opts = opts || {};
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      if (opts.kind === "plain") conn.send({ type: "ckPlain", from: opts.from, to: opts.to });
      else if (opts.kind === "capture") conn.send({ type: "ckCapture", from: opts.from, steps: opts.steps });
    }
    currentTurn = CK.other(currentTurn);
    const winner = CK.checkWinner(board, currentTurn);
    if (winner) {
      isGameOver = true; updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(winner), 300); return;
    }
    updateStatus(); refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  };

  CK.runAI = function (side) {
    const move = CK.chooseAIMove(board, side);
    if (!move) return;
    if (move.kind === "plain") {
      const result = CK.applyPlainMove(board, move.from, move.to);
      animateMove(move.from, move.to);
      if (result.promoted) setTimeout(() => refreshPieceAt(move.to), 280);
      CK._finishTurn({ broadcast: false });
    } else {
      let cur = move.from;
      for (const step of move.chain) { CK.applyCapture(board, cur, step); cur = step.landing; }
      const finalPos = move.chain[move.chain.length - 1].landing;
      animateChainCaptures(move.from, move.chain, () => {
        refreshPieceAt(finalPos); CK._finishTurn({ broadcast: false });
      });
    }
  };

  CK.applyRemote = function (msg) {
    if (msg.type === "ckPlain") {
      const result = CK.applyPlainMove(board, msg.from, msg.to);
      animateMove(msg.from, msg.to);
      if (result.promoted) setTimeout(() => refreshPieceAt(msg.to), 280);
      CK._finishTurn({ broadcast: false });
    } else if (msg.type === "ckCapture") {
      let cur = msg.from;
      for (const step of msg.steps) { CK.applyCapture(board, cur, step); cur = step.landing; }
      const finalPos = msg.steps[msg.steps.length - 1].landing;
      animateChainCaptures(msg.from, msg.steps, () => {
        refreshPieceAt(finalPos); CK._finishTurn({ broadcast: false });
      });
    }
  };
