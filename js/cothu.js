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


  const GAMES = {
    kap: {
      key: "kap",
      title: { en: "Kings & Pawns", vi: "Vua & Tốt" },
      sideA: { key: "king", label: { en: "King", vi: "Vua" } },
      sideB: { key: "pawn", label: { en: "Pawn", vi: "Tốt" } },
      firstTurn: "king",
      rulesNote: {
        en: "<b>Kings</b> move one step along any line and capture by landing so that enemy pawns flank them on both sides of any straight line. <b>Pawns</b> move one step but cannot capture &mdash; they win by trapping both Kings with no legal move.",
        vi: "<b>Vua</b> di chuyển một bước theo bất kỳ đường nào và ăn quân bằng cách đỮứng giữa hai Tốt đối phương trên cùng một đường thẳng. <b>Tốt</b> di chuyển một bước nhưng không thể ăn quân &mdash; Tốt thắng khi dồn cả hai Vua vào thế không còn nước đi."
      },
      colors: { a: "var(--king)", aGlow: "var(--king-glow)", b: "var(--pawn)", bGlow: "var(--pawn-glow)" }
    },
    checkers: {
      key: "checkers",
      title: { en: "Checkers", vi: "Cờ Nhào" },
      sideA: { key: "white", label: { en: "White", vi: "Trắng" } },
      sideB: { key: "black", label: { en: "Black", vi: "Đen" } },
      firstTurn: "white",
      rulesNote: {
        en: "Pieces move one step forward (diagonal or straight). Capture by jumping over an adjacent enemy into the empty point beyond. Captures are <b>mandatory</b> and chain into multi-jumps. Reaching the far row promotes a piece to <b>King</b>, which can move and capture in any direction.",
        vi: "Quân cờ di chuyển một bước (chéo hoặc thẳng). Ăn quân bằng cách nhảy qua quân đối phương liền kề để đáp xuống ô trống phía sau. Ăn quân là <b>bắt buộc</b> và có thể ăn liên hoàn nhiều lần. Khi đến hàng cuối cùng, quân sẽ được phong <b>Vương</b>, di chuyển và ăn quân theo mọi hướng."
      },
      colors: { a: "var(--white-pc)", aGlow: "var(--white-glow)", b: "var(--black-pc)", bGlow: "var(--black-glow)" }
    },
    cothu: {
      key: "cothu",
      title: { en: "Cờ Thú (Jungle Chess)", vi: "Cờ Thú" },
      sideA: { key: "top", label: { en: "Top", vi: "Trên" } },
      sideB: { key: "bottom", label: { en: "Bottom", vi: "Dưới" } },
      firstTurn: "top",
      rulesNote: {
        en: "8 ranked animals (Rat &lt; Cat &lt; Dog &lt; Wolf &lt; Leopard &lt; Tiger &lt; Lion &lt; Elephant). A piece captures any enemy of equal or lower rank &mdash; except the <b>Rat can capture the Elephant</b> (but not vice versa). Only the Rat may enter the river; Lion and Tiger can leap across it (blocked if a Rat sits in the water). Landing on an enemy trap (next to their own den) drops a piece's rank to 0. <b>Win by marching any piece into the opponent's den.</b>",
        vi: "8 con vật xếp hạng (Chuột &lt; Mèo &lt; Chó &lt; Sói &lt; Báo &lt; Hổ &lt; Sư Tử &lt; Tượng). Một quân ăn được bất kỳ quân địch nào cùng hạng hoặc thấp hơn &mdash; ngoại trừ <b>Chuột có thể ăn Tượng</b> (nhưng ngược lại thì không). Chỉ Chuột mới được xuống sông; Sư Tử và Hổ có thể nhảy qua sông (bị chặn nếu có Chuột đang ở dưới nước trên đường nhảy). Đứng vào bẫy của đối phương (cạnh chuồng của họ) khiến hạng của quân đó về 0. <b>Thắng khi đưa bất kỳ quân nào vào chuồng đối phương.</b>"
      },
      colors: { a: "var(--king)", aGlow: "var(--king-glow)", b: "var(--pawn)", bGlow: "var(--pawn-glow)" },
      isGrid: true
    }
  };

  let activeGame = "kap";
