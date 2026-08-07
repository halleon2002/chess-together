// ================= Game registry & helpers =================
const GAMES = {
  kap: {
    key: "kap",
    module: null,
    title: { en: "Kings & Pawns", vi: "Vua & Tốt" },
    sideA: { key: "king", label: { en: "King", vi: "Vua" } },
    sideB: { key: "pawn", label: { en: "Pawn", vi: "Tốt" } },
    firstTurn: "king",
    boardMode: "lattice",
    rulesNote: {
      en: "<b>Kings</b> move one step along any line and capture by landing so that enemy pawns flank them on both sides of any straight line. <b>Pawns</b> move one step but cannot capture &mdash; they win by trapping both Kings with no legal move.",
      vi: "<b>Vua</b> di chuyển một bước theo bất kỳ đường nào và ăn quân bằng cách đứng giữa hai Tốt đối phương trên cùng một đường thẳng. <b>Tốt</b> di chuyển một bước nhưng không thể ăn quân &mdash; Tốt thắng khi dồn cả hai Vua vào thế không còn nước đi."
    },
    colors: { a: "var(--king)", aGlow: "var(--king-glow)", b: "var(--pawn)", bGlow: "var(--pawn-glow)" }
  },
  checkers: {
    key: "checkers",
    module: null,
    title: { en: "Checkers", vi: "Cờ Nhào" },
    sideA: { key: "white", label: { en: "White", vi: "Trắng" } },
    sideB: { key: "black", label: { en: "Black", vi: "Đen" } },
    firstTurn: "white",
    boardMode: "lattice",
    rulesNote: {
      en: "Pieces move one step forward (diagonal or straight). Capture by jumping over an adjacent enemy into the empty point beyond. Captures are <b>mandatory</b> and chain into multi-jumps. Reaching the far row promotes a piece to <b>King</b>, which can move and capture in any direction.",
      vi: "Quân cờ di chuyển một bước (chéo hoặc thẳng). Ăn quân bằng cách nhảy qua quân đối phương liền kề để đáp xuống ô trống phía sau. Ăn quân là <b>bắt buộc</b> và có thể ăn liên hoàn nhiều lần. Khi đến hàng cuối cùng, quân sẽ được phong <b>Vương</b>, di chuyển và ăn quân theo mọi hướng."
    },
    colors: { a: "var(--white-pc)", aGlow: "var(--white-glow)", b: "var(--black-pc)", bGlow: "var(--black-glow)" }
  },
  cothu: {
    key: "cothu",
    module: null,
    title: { en: "Cờ Thú (Jungle Chess)", vi: "Cờ Thú" },
    sideA: { key: "top", label: { en: "Top", vi: "Trên" } },
    sideB: { key: "bottom", label: { en: "Bottom", vi: "Dưới" } },
    firstTurn: "top",
    boardMode: "cothu",
    rulesNote: {
      en: "8 ranked animals (Rat &lt; Cat &lt; Dog &lt; Wolf &lt; Leopard &lt; Tiger &lt; Lion &lt; Elephant). A piece captures any enemy of equal or lower rank &mdash; except the <b>Rat can capture the Elephant</b> (but not vice versa). Only the Rat may enter the river; Lion and Tiger can leap across it (blocked if a Rat sits in the water). Landing on an enemy trap (next to their own den) drops a piece's rank to 0. <b>Win by marching any piece into the opponent's den.</b>",
      vi: "8 con vật xếp hạng (Chuột &lt; Mèo &lt; Chó &lt; Sói &lt; Báo &lt; Hổ &lt; Sư Tử &lt; Tượng). Một quân ăn được bất kỳ quân địch nào cùng hạng hoặc thấp hơn &mdash; ngoại trừ <b>Chuột có thể ăn Tượng</b> (nhưng ngược lại thì không). Chỉ Chuột mới được xuống sông; Sư Tử và Hổ có thể nhảy qua sông (bị chặn nếu có Chuột đang ở dưới nước trên đường nhảy). Đứng vào bẫy của đối phương (cạnh chuồng của họ) khiến hạng của quân đó về 0. <b>Thắng khi đưa bất kỳ quân nào vào chuồng đối phương.</b>"
    },
    colors: { a: "var(--king)", aGlow: "var(--king-glow)", b: "var(--pawn)", bGlow: "var(--pawn-glow)" }
  },
  chess: {
    key: "chess",
    module: null,
    title: { en: "Chess", vi: "Cờ Vua" },
    sideA: { key: "white", label: { en: "White", vi: "Trắng" } },
    sideB: { key: "black", label: { en: "Black", vi: "Đen" } },
    firstTurn: "white",
    boardMode: "chess",
    rulesNote: {
      en: "Standard chess rules: all 6 piece types, castling, en passant, and pawns auto-promote to Queen. Win by checkmate; a player with no legal moves and not in check results in a draw by stalemate.",
      vi: "Luật cờ vua tiêu chuẩn: đủ 6 loại quân, nhập thành, bắt tốt qua đường, và Tốt tự động phong Hậu. Thắng bằng chiếu bí; nếu không còn nước đi hợp lệ mà không bị chiếu thì hòa (hết nước đi)."
    },
    colors: { a: "var(--white-pc)", aGlow: "var(--white-glow)", b: "var(--black-pc)", bGlow: "var(--black-glow)" }
  }
};

let activeGame = "kap";

function G() { return GAMES[activeGame]; }
function currentModule() { return G().module; }
function otherSide(side) { return currentModule().other(side); }

function wireGameModules() {
  GAMES.kap.module = KAP;
  GAMES.checkers.module = CK;
  GAMES.cothu.module = CT;
  GAMES.chess.module = CHESS;
}
