// ================= Online chat (reuses the existing PeerJS connection) =================
  const chatToggleBtn = document.getElementById("chatToggleBtn");
  const chatBadge = document.getElementById("chatBadge");
  const chatPanel = document.getElementById("chatPanel");
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const chatCloseBtn = document.getElementById("chatCloseBtn");

  let unreadChatCount = 0;

  function showChatUI() {
    chatToggleBtn.style.display = "flex";
  }
  function hideChatUI() {
    chatToggleBtn.style.display = "none";
    chatPanel.classList.remove("show");
  }
  function clearChatHistory() {
    chatMessagesEl.innerHTML = "";
    unreadChatCount = 0;
    updateChatBadge();
    appendSystemMessage(t("chatConnectedNotice"));
  }

  function updateChatBadge() {
    if (unreadChatCount > 0) {
      chatBadge.style.display = "flex";
      chatBadge.textContent = unreadChatCount > 9 ? "9+" : String(unreadChatCount);
    } else {
      chatBadge.style.display = "none";
    }
  }

  function appendBubble(text, cls) {
    const div = document.createElement("div");
    div.className = "chat-bubble " + cls;
    div.textContent = text;
    chatMessagesEl.appendChild(div);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
  function appendSystemMessage(text) {
    appendBubble(text, "system");
  }

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !conn || !conn.open) return;
    conn.send({ type: "chat", text });
    appendBubble(text, "mine");
    chatInput.value = "";
  }

  function receiveChatMessage(text) {
    if (!text) return;
    appendBubble(text, "theirs");
    if (!chatPanel.classList.contains("show")) {
      unreadChatCount++;
      updateChatBadge();
    }
  }

  chatToggleBtn.addEventListener("click", () => {
    chatPanel.classList.toggle("show");
    if (chatPanel.classList.contains("show")) {
      unreadChatCount = 0;
      updateChatBadge();
      chatInput.focus();
    }
  });
  chatCloseBtn.addEventListener("click", () => chatPanel.classList.remove("show"));
  chatSendBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
