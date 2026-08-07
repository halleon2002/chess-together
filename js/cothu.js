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

  CT.evaluateMove = function (board, from, mv, side) {
    const to = mv.to;
    const targetPiece = getPiece(board, to);
    let score = 0;
    if (targetPiece) score += CT.RANK[targetPiece.type] * 20;
    if (ctDenOwnerAt(to) === CT.other(side)) score += 100000;
    const after = cloneBoard(board);
    CT.applyMove(after, from, to);
    const opp = CT.other(side);
    let danger = 0;
    for (const op of ctGetPiecesOf(after, opp)) {
      for (const omv of CT.getLegalMoves(after, op)) {
        if (samePoint(omv.to, to) && omv.capture) danger = Math.max(danger, CT.RANK[getPiece(after,to).type]);
      }
    }
    score -= danger * 15;
    const denPos = CT_DEN[opp];
    const distBefore = Math.abs(from.x-denPos.x) + Math.abs(from.y-denPos.y);
    const distAfter = Math.abs(to.x-denPos.x) + Math.abs(to.y-denPos.y);
    score += (distBefore - distAfter) * 2;
    return score;
  };

  CT.chooseAIMove = function (board, side) {
    const pieces = ctGetPiecesOf(board, side);
    const candidates = [];
    for (const p of pieces) {
      for (const mv of CT.getLegalMoves(board, p)) {
        candidates.push({ from: p, to: mv.to, score: CT.evaluateMove(board, p, mv, side) });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a,b) => b.score - a.score);
    const best = candidates[0].score;
    const top = candidates.filter(c => c.score >= best - 0.01);
    return top[Math.floor(Math.random() * top.length)];
  };

  // ---- Controller API ----
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
      if (match) { CT._performMove(selected, p); return; }
      const clicked = getPiece(board, p);
      if (clicked && clicked.owner === currentTurn) { selected = p; refreshHighlights(); return; }
      selected = null; refreshHighlights(); return;
    }
    const piece = getPiece(board, p);
    if (piece && piece.owner === currentTurn) { selected = p; refreshHighlights(); }
  };

  CT._performMove = function (from, to) {
    const result = CT.applyMove(board, from, to);
    selected = null;
    ctAnimateMove(from, to);
    CT._finishTurn({ broadcast: true, from, to, wonByDen: result.wonByDen, mover: currentTurn });
  };

  CT._finishTurn = function (opts) {
    opts = opts || {};
    if (mode === "online" && opts.broadcast && conn && conn.open) {
      conn.send({ type: "ctMove", from: opts.from, to: opts.to });
    }
    if (opts.wonByDen) {
      isGameOver = true; lastCtWinWasDen = true;
      updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(opts.mover), 300); return;
    }
    currentTurn = CT.other(currentTurn);
    const winner = CT.checkWinner(board, currentTurn);
    if (winner) {
      isGameOver = true; lastCtWinWasDen = false;
      updateStatus(); refreshHighlights();
      setTimeout(() => showGameOver(winner), 300); return;
    }
    updateStatus(); refreshHighlights();
    if (mode === "ai") maybeTriggerAI();
  };

  CT.runAI = function (side) {
    const move = CT.chooseAIMove(board, side);
    if (!move) return;
    const result = CT.applyMove(board, move.from, move.to);
    ctAnimateMove(move.from, move.to);
    CT._finishTurn({ broadcast: false, wonByDen: result.wonByDen, mover: side });
  };

  CT.applyRemote = function (msg) {
    if (msg.type !== "ctMove") return;
    const result = CT.applyMove(board, msg.from, msg.to);
    ctAnimateMove(msg.from, msg.to);
    CT._finishTurn({ broadcast: false, wonByDen: result.wonByDen, mover: currentTurn });
  };
