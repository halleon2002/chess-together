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


  // ---- Controller API ----
  KAP.getLegalPlain = function (point) { return KAP.getLegalMoves(board, point); };
  KAP.getLegalCaptures = function () { return []; };

  KAP.handleClick = function (p) {
    if (selected) {
      const from = selected;
      const result = KAP.tryMove(board, from, p);
      if (result) {
        selected = null;
        KAP._afterMove({ broadcast: true, from, to: p, captured: result.captured });
        return;
      }
      const piece = getPiece(board, p);
      if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights();
      return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
  };

  KAP._afterMove = function (opts) {
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
  };

  KAP.runAI = function (side) {
    const move = KAP.chooseAIMove(board, side);
    if (!move) return;
    const result = KAP.tryMove(board, move.from, move.to);
    KAP._afterMove({ broadcast: false, from: move.from, to: move.to, captured: result ? result.captured : [] });
  };

  KAP.applyRemote = function (msg) {
    if (msg.type !== "kapMove") return;
    const result = KAP.tryMove(board, msg.from, msg.to);
    KAP._afterMove({ broadcast: false, from: msg.from, to: msg.to, captured: result ? result.captured : [] });
  };
