// ================= CỜ THÚ (JUNGLE CHESS) MODULE =================
  const CT = {};
  const CT_COLS = 7, CT_ROWS = 9;
  CT.RANK = { rat:1, cat:2, dog:3, wolf:4, leopard:5, tiger:6, lion:7, elephant:8 };
  CT.LETTER = { rat:"R", cat:"C", dog:"D", wolf:"W", leopard:"P", tiger:"T", lion:"L", elephant:"E" };
  CT.other = side => (side === "top" ? "bottom" : "top");

  function ctInBounds(p) { return p.x >= 0 && p.x < CT_COLS && p.y >= 0 && p.y < CT_ROWS; }
  function ctAllPoints() {
    const pts = [];
    for (let x = 0; x < CT_COLS; x++) for (let y = 0; y < CT_ROWS; y++) pts.push({x,y});
    return pts;
  }
  function ctGetPiecesOf(b, owner) {
    return ctAllPoints().filter(p => { const pc = getPiece(b,p); return pc && pc.owner === owner; });
  }

  const CT_RIVER = new Set();
  for (const c of [1,2,4,5]) for (const r of [3,4,5]) CT_RIVER.add(c+","+r);
  function ctIsRiver(p) { return CT_RIVER.has(p.x+","+p.y); }

  const CT_DEN = { top: {x:3,y:0}, bottom: {x:3,y:8} };
  function ctDenOwnerAt(p) { if (p.x===3&&p.y===0) return "top"; if (p.x===3&&p.y===8) return "bottom"; return null; }

  const CT_TRAPS = { top: [{x:2,y:0},{x:4,y:0},{x:3,y:1}], bottom: [{x:2,y:8},{x:4,y:8},{x:3,y:7}] };
  function ctTrapOwnerAt(p) {
    for (const t of CT_TRAPS.top) if (t.x===p.x && t.y===p.y) return "top";
    for (const t of CT_TRAPS.bottom) if (t.x===p.x && t.y===p.y) return "bottom";
    return null;
  }

  const CT_JUMP_LINES = [];
  for (const r of [3,4,5]) {
    CT_JUMP_LINES.push({a:{x:0,y:r}, b:{x:3,y:r}, through:[{x:1,y:r},{x:2,y:r}]});
    CT_JUMP_LINES.push({a:{x:3,y:r}, b:{x:6,y:r}, through:[{x:4,y:r},{x:5,y:r}]});
  }
  for (const c of [1,2,4,5]) {
    CT_JUMP_LINES.push({a:{x:c,y:2}, b:{x:c,y:6}, through:[{x:c,y:3},{x:c,y:4},{x:c,y:5}]});
  }

  CT.createBoard = function () {
    const b = []; for (let x=0;x<CT_COLS;x++){ b.push([]); for(let y=0;y<CT_ROWS;y++) b[x].push(null); }
    const place = (type,x,y,owner) => { b[x][y] = { type, owner }; };
    place("lion",0,0,"top"); place("tiger",6,0,"top");
    place("dog",1,1,"top"); place("cat",5,1,"top");
    place("rat",0,2,"top"); place("leopard",2,2,"top"); place("wolf",4,2,"top"); place("elephant",6,2,"top");
    place("tiger",0,8,"bottom"); place("lion",6,8,"bottom");
    place("cat",1,7,"bottom"); place("dog",5,7,"bottom");
    place("elephant",0,6,"bottom"); place("wolf",2,6,"bottom"); place("leopard",4,6,"bottom"); place("rat",6,6,"bottom");
    return b;
  };

  function ctEffectiveRank(board, p) {
    const piece = getPiece(board, p); if (!piece) return 0;
    const trapOwner = ctTrapOwnerAt(p);
    if (trapOwner && trapOwner !== piece.owner) return 0; // standing on an enemy trap: defenseless
    return CT.RANK[piece.type];
  }

  function ctCanCapture(board, attackerPos, defenderPos) {
    const atk = getPiece(board, attackerPos), def = getPiece(board, defenderPos);
    if (!atk || !def || atk.owner === def.owner) return false;
    if (atk.type === "rat" && def.type === "elephant") return true;
    if (atk.type === "elephant" && def.type === "rat") return false;
    return CT.RANK[atk.type] >= ctEffectiveRank(board, defenderPos);
  }

  function ctCanEnter(piece, dest) {
    if (ctIsRiver(dest) && piece.type !== "rat") return false;
    if (ctDenOwnerAt(dest) === piece.owner) return false; // can't enter your own den
    return true;
  }

  CT.getLegalMoves = function (board, point) {
    const piece = getPiece(board, point);
    if (!piece) return [];
    const moves = [];
    const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    for (const d of dirs) {
      const dest = {x:point.x+d.dx, y:point.y+d.dy};
      if (!ctInBounds(dest) || !ctCanEnter(piece, dest)) continue;
      const occ = getPiece(board, dest);
      if (!occ) moves.push({ to: dest, capture: false });
      else if (occ.owner !== piece.owner && ctCanCapture(board, point, dest)) moves.push({ to: dest, capture: true });
    }
    if (piece.type === "lion" || piece.type === "tiger") {
      for (const line of CT_JUMP_LINES) {
        let dest = null, through = null;
        if (samePoint(line.a, point)) { dest = line.b; through = line.through; }
        else if (samePoint(line.b, point)) { dest = line.a; through = line.through; }
        if (!dest) continue;
        const blocked = through.some(t => { const o = getPiece(board, t); return o && o.type === "rat"; });
        if (blocked || !ctCanEnter(piece, dest)) continue;
        const occ = getPiece(board, dest);
        if (!occ) moves.push({ to: dest, capture: false, jump: true });
        else if (occ.owner !== piece.owner && ctCanCapture(board, point, dest)) moves.push({ to: dest, capture: true, jump: true });
      }
    }
    return moves;
  };

  CT.applyMove = function (board, from, to) {
    const piece = getPiece(board, from);
    const capturedPiece = getPiece(board, to);
    setPiece(board, to, piece);
    setPiece(board, from, null);
    const wonByDen = ctDenOwnerAt(to) === CT.other(piece.owner);
    return { captured: capturedPiece ? to : null, wonByDen };
  };

  CT.checkWinner = function (board, turnPlayer) {
    const pieces = ctGetPiecesOf(board, turnPlayer);
    if (pieces.length === 0) return CT.other(turnPlayer);
    const hasMove = pieces.some(p => CT.getLegalMoves(board, p).length > 0);
    if (!hasMove) return CT.other(turnPlayer);
    return null;
  };

  // Piece values for material evaluation (scaled by rank, elephant slightly less
  // than pure rank because rat can take it, rat slightly more because of that).
  const CT_PIECE_VALUE = {
    rat: 120, cat: 200, dog: 250, wolf: 300,
    leopard: 400, tiger: 500, lion: 520, elephant: 550
  };

  // Static evaluation of a position from `side`'s perspective.
  CT.evaluatePosition = function (board, side) {
    const opp = CT.other(side);
    let score = 0;

    // Immediate win / loss
    // (den occupancy is checked after moves; here we only see static board)
    const myDen = CT_DEN[side];
    const oppDen = CT_DEN[opp];
    if (getPiece(board, myDen) && getPiece(board, myDen).owner === opp) return -100000;
    if (getPiece(board, oppDen) && getPiece(board, oppDen).owner === side) return 100000;

    const myPieces = ctGetPiecesOf(board, side);
    const oppPieces = ctGetPiecesOf(board, opp);

    // Material
    for (const p of myPieces) score += CT_PIECE_VALUE[getPiece(board, p).type];
    for (const p of oppPieces) score -= CT_PIECE_VALUE[getPiece(board, p).type];

    // Trap: own piece on enemy trap is nearly dead (rank 0)
    for (const p of myPieces) {
      const trap = ctTrapOwnerAt(p);
      if (trap === opp) score -= CT_PIECE_VALUE[getPiece(board, p).type] * 0.7;
    }
    for (const p of oppPieces) {
      const trap = ctTrapOwnerAt(p);
      if (trap === side) score += CT_PIECE_VALUE[getPiece(board, p).type] * 0.7;
    }

    // Progress toward enemy den (weighted by piece strength)
    for (const p of myPieces) {
      const pc = getPiece(board, p);
      const dist = Math.abs(p.x - oppDen.x) + Math.abs(p.y - oppDen.y);
      score += (14 - dist) * (CT.RANK[pc.type] * 0.8 + 2);
      // Strong bonus when adjacent to enemy den (threat to enter)
      if (dist === 1) score += 80 + CT.RANK[pc.type] * 10;
    }
    for (const p of oppPieces) {
      const pc = getPiece(board, p);
      const dist = Math.abs(p.x - myDen.x) + Math.abs(p.y - myDen.y);
      score -= (14 - dist) * (CT.RANK[pc.type] * 0.8 + 2);
      if (dist === 1) score -= 80 + CT.RANK[pc.type] * 10;
    }

    // Mobility (cheap approximation: count legal moves)
    let myMob = 0, oppMob = 0;
    for (const p of myPieces) myMob += CT.getLegalMoves(board, p).length;
    for (const p of oppPieces) oppMob += CT.getLegalMoves(board, p).length;
    score += (myMob - oppMob) * 3;

    // Rat in river is often strong (controls jumps, threatens elephant path)
    for (const p of myPieces) {
      if (getPiece(board, p).type === "rat" && ctIsRiver(p)) score += 25;
    }
    for (const p of oppPieces) {
      if (getPiece(board, p).type === "rat" && ctIsRiver(p)) score -= 25;
    }

    // Hanging pieces: penalize if a piece can be captured next turn for free-ish
    // (opponent can capture it and our piece is valuable)
    for (const p of myPieces) {
      const val = CT_PIECE_VALUE[getPiece(board, p).type];
      for (const op of oppPieces) {
        for (const mv of CT.getLegalMoves(board, op)) {
          if (mv.capture && samePoint(mv.to, p)) {
            score -= val * 0.35;
            break;
          }
        }
      }
    }
    for (const p of oppPieces) {
      const val = CT_PIECE_VALUE[getPiece(board, p).type];
      for (const mp of myPieces) {
        for (const mv of CT.getLegalMoves(board, mp)) {
          if (mv.capture && samePoint(mv.to, p)) {
            score += val * 0.35;
            break;
          }
        }
      }
    }

    return score;
  };

  // Generate all moves for a side as { from, to } list.
  CT.allMoves = function (board, side) {
    const moves = [];
    for (const p of ctGetPiecesOf(board, side)) {
      for (const mv of CT.getLegalMoves(board, p)) {
        moves.push({ from: p, to: mv.to, capture: !!mv.capture });
      }
    }
    // Capture-first ordering helps alpha-beta pruning
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
    return moves;
  };

  // Alpha-beta minimax. Returns score from rootSide's perspective.
  CT.minimax = function (board, depth, alpha, beta, maximizing, rootSide) {
    const side = maximizing ? rootSide : CT.other(rootSide);

    // Terminal: den already occupied or no moves
    const oppDen = CT_DEN[CT.other(rootSide)];
    const myDen = CT_DEN[rootSide];
    if (getPiece(board, oppDen) && getPiece(board, oppDen).owner === rootSide) return 100000 + depth;
    if (getPiece(board, myDen) && getPiece(board, myDen).owner === CT.other(rootSide)) return -100000 - depth;

    if (depth === 0) return CT.evaluatePosition(board, rootSide);

    const moves = CT.allMoves(board, side);
    if (moves.length === 0) {
      // Side to move has no moves → loses
      return maximizing ? (-100000 - depth) : (100000 + depth);
    }

    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        const next = cloneBoard(board);
        const result = CT.applyMove(next, m.from, m.to);
        let val;
        if (result.wonByDen) val = 100000 + depth;
        else val = CT.minimax(next, depth - 1, alpha, beta, false, rootSide);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        const next = cloneBoard(board);
        const result = CT.applyMove(next, m.from, m.to);
        let val;
        if (result.wonByDen) val = -100000 - depth;
        else val = CT.minimax(next, depth - 1, alpha, beta, true, rootSide);
        if (val < best) best = val;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      return best;
    }
  };

  // Search depth: 2 is fast; 3 is stronger but still fine on modern phones.
  CT.AI_DEPTH = 3;

  CT.chooseAIMove = function (board, side) {
    const moves = CT.allMoves(board, side);
    if (moves.length === 0) return null;

    // Instant win if available
    for (const m of moves) {
      const next = cloneBoard(board);
      const result = CT.applyMove(next, m.from, m.to);
      if (result.wonByDen) return { from: m.from, to: m.to };
    }

    let bestScore = -Infinity;
    const scored = [];
    for (const m of moves) {
      const next = cloneBoard(board);
      CT.applyMove(next, m.from, m.to);
      const score = CT.minimax(next, CT.AI_DEPTH - 1, -Infinity, Infinity, false, side);
      scored.push({ from: m.from, to: m.to, score });
      if (score > bestScore) bestScore = score;
    }

    // Pick randomly among moves within a small margin of the best (variety)
    const top = scored.filter(c => c.score >= bestScore - 5);
    return top[Math.floor(Math.random() * top.length)];
  };

  // ---- Controller API (used by app.js) ----
  CT.getLegalPlain = function (point) {
    return CT.getLegalMoves(board, point).filter(m => !m.capture).map(m => m.to);
  };
  CT.getLegalCaptures = function (point) {
    return CT.getLegalMoves(board, point).filter(m => m.capture).map(m => ({ landing: m.to }));
  };

  CT.handleClick = function (p) {
    if (selected) {
      const moves = CT.getLegalMoves(board, selected);
      const match = moves.find(m => samePoint(m.to, p));
      if (match) {
        CT._performMove(selected, p);
        return;
      }
      const clicked = getPiece(board, p);
      if (clicked && clicked.owner === currentTurn) {
        selected = p;
        refreshHighlights();
        return;
      }
      selected = null;
      refreshHighlights();
      return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) {
      selected = p;
      refreshHighlights();
    }
  };

  CT._performMove = function (from, to) {
    const result = CT.applyMove(board, from, to);
    selected = null;
    ctAnimateMove(from, to);
    CT._finishTurn({
      broadcast: true,
      from,
      to,
      wonByDen: result.wonByDen,
      mover: currentTurn
    });
  };

  CT._finishTurn = function (opts) {
    opts = opts || {};
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      conn.send({ type: "ctMove", from: opts.from, to: opts.to });
    }
    if (opts.wonByDen) {
      isGameOver = true;
      lastCtWinWasDen = true;
      updateStatus();
      refreshHighlights();
      setTimeout(() => showGameOver(opts.mover), 300);
      return;
    }
    currentTurn = CT.other(currentTurn);
    const winner = CT.checkWinner(board, currentTurn);
    if (winner) {
      isGameOver = true;
      lastCtWinWasDen = false;
      updateStatus();
      refreshHighlights();
      setTimeout(() => showGameOver(winner), 300);
      return;
    }
    updateStatus();
    refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  };

  CT.runAI = function (side) {
    const move = CT.chooseAIMove(board, side);
    if (!move) return;
    const result = CT.applyMove(board, move.from, move.to);
    ctAnimateMove(move.from, move.to);
    CT._finishTurn({
      broadcast: false,
      wonByDen: result.wonByDen,
      mover: side
    });
  };

  CT.applyRemote = function (msg) {
    if (msg.type === "ctMove") {
      const result = CT.applyMove(board, msg.from, msg.to);
      ctAnimateMove(msg.from, msg.to);
      CT._finishTurn({
        broadcast: false,
        wonByDen: result.wonByDen,
        mover: currentTurn
      });
    }
  };
