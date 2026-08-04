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
