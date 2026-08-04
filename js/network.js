// ================= Online networking =================
  // Fill these in with your free Metered.ca (https://www.metered.ca/tools/openrelay/)
  // subdomain + API key to enable TURN relay for connections across strict NATs/firewalls.
  // Without these, only STUN is used, which fails for some cross-network connections.
  const TURN_CONFIG = {
    meteredSubdomain: "chess-together", // e.g. "myproject" (becomes myproject.metered.live)
    meteredApiKey: "df354fde4eb1f9d614b8afebb574078d2830"
  };
  const STUN_FALLBACK = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ];
  async function getIceServers() {
    if (!TURN_CONFIG.meteredSubdomain || !TURN_CONFIG.meteredApiKey) return STUN_FALLBACK;
    try {
      const res = await fetch(`https://${TURN_CONFIG.meteredSubdomain}.metered.live/api/v1/turn/credentials?apiKey=${TURN_CONFIG.meteredApiKey}`);
      const servers = await res.json();
      return (Array.isArray(servers) && servers.length) ? servers : STUN_FALLBACK;
    } catch (e) {
      return STUN_FALLBACK;
    }
  }

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
    clearConnectTimeout();
    hideChatUI();
  }
  let connectTimeoutId = null;
  function clearConnectTimeout() {
    if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
  }

  async function createRoom() {
    teardownConnection();
    isHost = true;
    const code = randomRoomCode(4);
    roomCodeDisplay.style.display = "none";
    setOnlineStatus(t("creatingRoom"));
    const iceServers = await getIceServers();
    peer = new Peer(ROOM_PREFIX + code.toLowerCase(), { config: { iceServers } });
    peer.on("open", () => {
      roomCodeDisplay.style.display = "block";
      roomCodeDisplay.textContent = code;
      setOnlineStatus(t("waitingForFriend"));
      clearConnectTimeout();
      connectTimeoutId = setTimeout(() => {
        if (!conn) setOnlineStatus(t("stillWaitingHint"), "error");
      }, 30000);
    });
    peer.on("connection", incoming => {
      clearConnectTimeout();
      conn = incoming;
      setupConnection();
    });
    peer.on("error", err => { clearConnectTimeout(); setOnlineStatus(t("connectionErrorCreate", err.type), "error"); });
  }
  async function joinRoom(codeRaw) {
    const code = (codeRaw || "").trim().toLowerCase();
    if (!code) { setOnlineStatus(t("enterRoomCodeFirst"), "error"); return; }
    teardownConnection();
    isHost = false;
    setOnlineStatus(t("connecting"));
    const iceServers = await getIceServers();
    peer = new Peer({ config: { iceServers } });
    peer.on("open", () => {
      conn = peer.connect(ROOM_PREFIX + code, { reliable: true });
      setupConnection();
      clearConnectTimeout();
      connectTimeoutId = setTimeout(() => {
        if (!conn || !conn.open) {
          setOnlineStatus(t("connectTimeoutJoin"), "error");
          teardownConnection();
        }
      }, 20000);
    });
    peer.on("error", err => { clearConnectTimeout(); setOnlineStatus(t("connectionErrorJoin", err.type), "error"); });
  }

  // Logs WebRTC ICE/connection state changes to the browser console (F12) —
  // useful for diagnosing why a specific connection fails (blocked UDP/TCP,
  // no TURN candidates gathered, etc.) without changing what the user sees.
  function logIceDiagnostics() {
    setTimeout(() => {
      const pc = conn && conn.peerConnection;
      if (!pc) return;
      pc.addEventListener("iceconnectionstatechange", () => {
        console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
      });
      pc.addEventListener("icegatheringstatechange", () => {
        console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
      });
      pc.addEventListener("connectionstatechange", () => {
        console.log("[WebRTC] Connection state:", pc.connectionState);
      });
    }, 50);
  }

  function setupConnection() {
    logIceDiagnostics();
    conn.on("open", () => {
      clearConnectTimeout();
      setOnlineStatus(t("connected"), "success");
      showChatUI();
      if (isHost) {
        conn.send({ type: "assignSide", game: activeGame, side: otherSide(humanSide) });
        beginOnlineGame();
      }
    });
    conn.on("data", onData);
    conn.on("close", () => setOnlineStatus(t("friendDisconnected"), "error"));
    conn.on("error", () => setOnlineStatus(t("connectionError"), "error"));
  }
  function onData(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "assignSide") {
      activeGame = msg.game;
      humanSide = msg.side;
      beginOnlineGame();
    } else if (msg.type === "kapMove") {
      const result = KAP.tryMove(board, msg.from, msg.to);
      afterKapMove({ broadcast: false, from: msg.from, to: msg.to, captured: result ? result.captured : [] });
    } else if (msg.type === "ckPlain") {
      const result = CK.applyPlainMove(board, msg.from, msg.to);
      animateMove(msg.from, msg.to);
      if (result.promoted) setTimeout(() => refreshPieceAt(msg.to), 280);
      finishCheckersTurn({ broadcast: false });
    } else if (msg.type === "ckCapture") {
      let cur = msg.from;
      for (const step of msg.steps) { CK.applyCapture(board, cur, step); cur = step.landing; }
      const finalPos = msg.steps[msg.steps.length - 1].landing;
      animateChainCaptures(msg.from, msg.steps, () => {
        refreshPieceAt(finalPos);
        finishCheckersTurn({ broadcast: false });
      });
    } else if (msg.type === "restart") {
      resetBoardLocal();
    } else if (msg.type === "ctMove") {
      const result = CT.applyMove(board, msg.from, msg.to);
      ctAnimateMove(msg.from, msg.to);
      finishCoThuTurn({ broadcast: false, wonByDen: result.wonByDen, mover: currentTurn });
    } else if (msg.type === "chat") {
      receiveChatMessage(msg.text);
    }
  }
  function beginOnlineGame() {
    mode = "online";
    startScreen.classList.remove("show");
    applyThemeColors();
    updateSubtitle();
    resetScore();
    clearChatHistory();
    resetBoardLocal();
  }
