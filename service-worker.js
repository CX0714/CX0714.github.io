const CACHE_NAME = "philos-v33";
const ASSETS = ["./", "./index.html", "./styles.css", "./widgets.css", "./app.js", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

/* =========================================================
   运行时补丁：回复方式 / 气泡预设 / 表情包 / Typing / 输入栏
   app.js 原文件不动，只在末尾注入。
   ========================================================= */
const REPLY_PATCH = String.raw`
/* PHILOS_REPLY_PATCH */
var RM_MODES = [
    { key: "text", label: "单条文字" },
    { key: "emoji", label: "纯 emoji" },
    { key: "sticker", label: "表情包" },
    { key: "textEmoji", label: "文字 + emoji" },
    { key: "combo", label: "多条文字组合" }
];

function rmDefaults() {
    return {
        text: { on: true, weight: 40 },
        emoji: { on: true, weight: 10 },
        sticker: { on: true, weight: 10 },
        textEmoji: { on: true, weight: 20 },
        combo: { on: true, weight: 20 }
    };
}

function rmSettings() {
    if (!appData || !appData.settings) return null;
    var p = appData.settings.permission;
    if (!p) return null;
    if (!p.replyModes || typeof p.replyModes !== "object") p.replyModes = rmDefaults();
    for (var i = 0; i < RM_MODES.length; i++) {
        var k = RM_MODES[i].key;
        var m = p.replyModes[k];
        if (!m || typeof m !== "object") m = p.replyModes[k] = { on: true, weight: 0 };
        if (typeof m.on !== "boolean") m.on = true;
        if (typeof m.weight !== "number") m.weight = 0;
    }
    if (typeof p.comboMax !== "number") p.comboMax = 3;
    if (typeof p.letterMax !== "number") p.letterMax = 8;
    if (typeof p.letterDelayMin !== "number") p.letterDelayMin = 5;
    if (typeof p.letterDelayMax !== "number") p.letterDelayMax = 15;
    return p;
}

function rmPool() {
    var pool = { text: [], emoji: [], sticker: [] };
    var cards = Array.isArray(appData.cards) ? appData.cards : [];
    for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (!c || typeof c.content !== "string" || !c.content) continue;
        if (c.kind === "text") pool.text.push(c.content);
        else if (c.kind === "emoji") pool.emoji.push(c.content);
        else if (c.kind === "sticker" && isImageSource(c.content)) pool.sticker.push(c.content);
    }
    return pool;
}

function rmAvailable(mode, pool) {
    if (mode === "text") return pool.text.length > 0;
    if (mode === "emoji") return pool.emoji.length > 0;
    if (mode === "sticker") return pool.sticker.length > 0;
    if (mode === "textEmoji") return pool.text.length > 0;
    if (mode === "combo") return pool.text.length >= 2;
    return false;
}

function rmPick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function rmPickMode(p, pool) {
    var list = [];
    var total = 0;
    for (var i = 0; i < RM_MODES.length; i++) {
        var key = RM_MODES[i].key;
        var cfg = p.replyModes[key];
        var weight = Number(cfg.weight) || 0;
        if (!cfg.on || weight <= 0) continue;
        if (!rmAvailable(key, pool)) continue;
        list.push({ key: key, w: weight });
        total += weight;
    }
    if (!total) return "";
    var r = Math.random() * total;
    for (var j = 0; j < list.length; j++) {
        r -= list[j].w;
        if (r <= 0) return list[j].key;
    }
    return list[list.length - 1].key;
}

function rmTakeCards(pool, count) {
    var rest = pool.text.slice();
    var out = [];
    while (rest.length && out.length < count) {
        out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }
    return out;
}

function rmBuildMessage(p, pool) {
    var mode = rmPickMode(p, pool);
    if (!mode) return null;

    if (mode === "text") {
        return { from: "ta", type: "text", text: rmPick(pool.text), status: "" };
    }
    if (mode === "emoji") {
        return { from: "ta", type: "text", text: rmPick(pool.emoji), status: "" };
    }
    if (mode === "sticker") {
        return { from: "ta", type: "sticker", text: rmPick(pool.sticker), status: "" };
    }
    if (mode === "textEmoji") {
        var text = rmPick(pool.text);
        var n = 1 + Math.floor(Math.random() * 2);
        if (pool.emoji.length) {
            for (var i = 0; i < n; i++) text += rmPick(pool.emoji);
        }
        return { from: "ta", type: "text", text: text, status: "" };
    }
    if (mode === "combo") {
        var max = clamp(Number(p.comboMax) || 3, 2, 6);
        var count = 2 + Math.floor(Math.random() * (max - 1));
        return { from: "ta", type: "text", text: rmTakeCards(pool, count).join("，"), status: "" };
    }
    return null;
}

function rmSetTyping(on) {
    var el = $("headerName");
    if (!el) return;
    el.textContent = on ? "Typing..." : (appData.taName || "他");
}

scheduleReply = function () {
    var p = rmSettings();
    if (!p) return;
    var pool = rmPool();
    if (!rmPickMode(p, pool)) return;

    var min = clamp(Number(p.replyMin) || 1, 1, 10);
    var max = clamp(Number(p.replyMax) || min, min, 10);
    var count = min + Math.floor(Math.random() * (max - min + 1));
    var delay = Math.max(0, Number(p.replyDelay) || 0) * 1000;

    rmSetTyping(true);

    if (replyTimer) clearTimeout(replyTimer);
    replyTimer = setTimeout(function () {
        var now = Date.now();
        var added = 0;
        for (var i = 0; i < count; i++) {
            var msg = rmBuildMessage(p, pool);
            if (!msg) break;
            msg.time = now + i;
            appData.chatHistory.push(msg);
            added++;
        }
        rmSetTyping(false);
        if (!added) return;

        var patPool = appData.cards.filter(function (c) { return c.kind === "status" && c.content; });
        var chance = p.patChance == null ? 30 : Number(p.patChance);
        if (patPool.length && Math.random() * 100 < chance) {
            var pat = patPool[Math.floor(Math.random() * patPool.length)];
            appData.chatHistory.push({ type: "status", text: "—— " + pat.content + " ——", time: now + added });
        }

        saveData();
        if ($("chatView") && $("chatView").classList.contains("active")) renderChat();
    }, delay);
};

function rmLetterDate() {
    var d = new Date();
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
}

function rmLetterText(body) {
    var myName = appData.myName && appData.myName !== "your账户名" ? appData.myName : "你";
    var taName = appData.taName && appData.taName !== "他" ? appData.taName : "他";
    return "亲爱的" + myName + "：\n\n  见字如晤：\n  " + body +
        "\n\n　　　　　　" + taName + "\n　　　　　" + rmLetterDate();
}

maybeReply = function (letterId) {
    var p = rmSettings();
    if (!p) return;
    var pool = rmPool();
    if (!pool.text.length) return;

    var max = clamp(Number(p.letterMax) || 8, 3, 12);
    var count = 3 + Math.floor(Math.random() * (max - 2));
    var body = rmTakeCards(pool, count).join("。") + "。";

    var dMin = Math.max(0, Number(p.letterDelayMin) || 0);
    var dMax = Math.max(dMin, Number(p.letterDelayMax) || dMin);
    var delay = (dMin + Math.random() * (dMax - dMin)) * 1000;

    setTimeout(function () {
        var target = null;
        for (var i = 0; i < appData.letters.length; i++) {
            if (appData.letters[i].id === letterId) { target = appData.letters[i]; break; }
        }
        if (!target || target.reply) return;
        target.reply = rmLetterText(body);
        saveData();
        if ($("letterView") && $("letterView").classList.contains("active")) renderLetters();
    }, delay);
};

function rmUpdatePct() {
    var p = rmSettings();
    if (!p) return;
    var total = 0;
    var i;
    for (i = 0; i < RM_MODES.length; i++) {
        var c = p.replyModes[RM_MODES[i].key];
        if (c.on) total += Math.max(0, Number(c.weight) || 0);
    }
    for (i = 0; i < RM_MODES.length; i++) {
        var key = RM_MODES[i].key;
        var el = document.querySelector('[data-rm-pct="' + key + '"]');
        if (!el) continue;
        var w = Math.max(0, Number(p.replyModes[key].weight) || 0);
        el.textContent = (!p.replyModes[key].on || !total || w <= 0) ? "—" : Math.round(w / total * 100) + "%";
    }
}

function rmRender() {
    var p = rmSettings();
    if (!p) return;
    for (var i = 0; i < RM_MODES.length; i++) {
        var key = RM_MODES[i].key;
        var onEl = document.querySelector('[data-rm-on="' + key + '"]');
        var wEl = document.querySelector('[data-rm-weight="' + key + '"]');
        if (onEl) onEl.checked = !!p.replyModes[key].on;
        if (wEl) wEl.value = p.replyModes[key].weight;
    }
    var combo = document.querySelector("[data-rm-combo]");
    var letterCount = document.querySelector("[data-rm-lettercount]");
    var delayMin = document.querySelector("[data-rm-lettermin]");
    var delayMax = document.querySelector("[data-rm-lettermax]");
    if (combo) combo.value = p.comboMax;
    if (letterCount) letterCount.value = p.letterMax;
    if (delayMin) delayMin.value = p.letterDelayMin;
    if (delayMax) delayMax.value = p.letterDelayMax;
    rmUpdatePct();
}

function rmClampInput(el, min, max) {
    var v = Math.round(Number(el.value));
    if (isNaN(v)) v = min;
    v = Math.min(max, Math.max(min, v));
    el.value = v;
    return v;
}

function rmInjectStyles() {
    if (document.getElementById("rm-style")) return;
    var st = document.createElement("style");
    st.id = "rm-style";
    st.textContent =
        ".rm-num{width:74px;text-align:right;border:none;border-radius:8px;padding:6px 8px;background:var(--input-bg);color:var(--text-primary);font-size:15px;outline:none;}" +
        "html[data-bubble-preset=\"large\"] .msg-bubble,html[data-bubble-preset=\"large\"] .pv-bubble{border-radius:var(--bubble-radius,16px) !important;}" +
        "html[data-bubble-preset=\"tail\"] .msg-bubble,html[data-bubble-preset=\"tail\"] .pv-bubble{border-radius:var(--bubble-radius,16px) !important;}" +
        "html[data-bubble-preset=\"tail\"] .msg-row.me .msg-bubble{border-bottom-right-radius:5px !important;}" +
        "html[data-bubble-preset=\"tail\"] .msg-row.ta .msg-bubble{border-bottom-left-radius:5px !important;}" +
        "html[data-bubble-preset=\"tail\"] .pv-row.me .pv-bubble{border-bottom-right-radius:5px !important;}" +
        "html[data-bubble-preset=\"tail\"] .pv-row.ta .pv-bubble{border-bottom-left-radius:5px !important;}" +
        "#chatMessages .msg-bubble.rm-sticker-bubble{background:transparent !important;border:none !important;padding:0 !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}" +
        "#chatMessages .rm-sticker-bubble img{max-width:112px !important;border-radius:10px;}" +
        ".chat-input-box{min-height:44px;padding:4px 8px 4px 16px;}" +
        ".chat-input-box .input-row{align-items:center;}" +
        ".chat-input-box textarea{padding:0;line-height:1.5;}";
    document.head.appendChild(st);
}

function rmDecorateChat() {
    var bubbles = document.querySelectorAll("#chatMessages .msg-bubble");
    for (var i = 0; i < bubbles.length; i++) {
        var idx = Number(bubbles[i].getAttribute("data-index"));
        var msg = appData.chatHistory[idx];
        if (msg && msg.type === "sticker") {
            bubbles[i].classList.add("rm-sticker-bubble");
        }
    }
}

var rmBaseRenderChat = renderChat;
renderChat = function () {
    rmBaseRenderChat.apply(null, arguments);
    rmDecorateChat();
};

function rmSyncBubblePreset() {
    var b = appData.settings && appData.settings.bubble;
    var preset = b && b.preset ? b.preset : "tail";
    document.documentElement.setAttribute("data-bubble-preset", preset);
}

function rmTuneBubble() {
    var height = document.querySelector('[data-key="bubble.height"]');
    if (height) {
        height.setAttribute("min", "0");
        height.min = "0";
    }
    var radius = document.querySelector('[data-key="bubble.radius"]');
    if (radius) {
        radius.setAttribute("max", "60");
        radius.max = "60";
    }
}

function rmTrimPresets() {
    var b = appData.settings && appData.settings.bubble;
    if (b && (b.preset === "small" || b.preset === "square")) {
        b.preset = "large";
        saveData();
    }
    var old = document.querySelectorAll('.preset-card[data-preset="small"], .preset-card[data-preset="square"]');
    for (var i = 0; i < old.length; i++) {
        if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
    var cards = document.querySelectorAll(".preset-card");
    var current = b && b.preset ? b.preset : "tail";
    for (var j = 0; j < cards.length; j++) {
        cards[j].classList.toggle("selected", cards[j].getAttribute("data-preset") === current);
    }
}

function rmBuildUI() {
    var page = document.querySelector('[data-page="permission"]');
    if (!page || page.querySelector("[data-rm-card]")) return;
    var p = rmSettings();
    if (!p) return;

    var rows = "";
    for (var i = 0; i < RM_MODES.length; i++) {
        var m = RM_MODES[i];
        rows += '<div class="control-row">' +
                    '<span class="control-label">' + m.label + '</span>' +
                    '<div class="row-actions">' +
                        '<span class="control-value" data-rm-pct="' + m.key + '">—</span>' +
                        '<label class="switch"><input type="checkbox" data-rm-on="' + m.key + '"><span class="switch-track"></span></label>' +
                    '</div>' +
                '</div>' +
                '<div class="control-block"><input type="range" class="slider" data-rm-weight="' + m.key + '" min="0" max="100" step="5"></div>';
    }

    var card1 = document.createElement("div");
    card1.className = "group-card control-card";
    card1.setAttribute("data-rm-card", "");
    card1.innerHTML = '<div class="card-title">他的回复方式（按权重随机）</div>' + rows +
        '<p class="about-note" style="padding:0 16px 14px;">没有对应字卡的方式会自动跳过；全部关闭或字卡为空时不自动回复。</p>';

    var card2 = document.createElement("div");
    card2.className = "group-card control-card";
    card2.setAttribute("data-rm-card", "");
    card2.innerHTML =
        '<div class="card-title">组合与信笺</div>' +
        '<div class="control-row"><span class="control-label">多条组合最多</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="2" max="6" step="1" data-rm-combo><span class="control-label">条</span></div></div>' +
        '<div class="control-row"><span class="control-label">信笺最多字卡</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="3" max="12" step="1" data-rm-lettercount><span class="control-label">条</span></div></div>' +
        '<div class="control-row"><span class="control-label">回信最短间隔</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="0" max="86400" step="1" data-rm-lettermin><span class="control-label">秒</span></div></div>' +
        '<div class="control-row"><span class="control-label">回信最长间隔</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="0" max="86400" step="1" data-rm-lettermax><span class="control-label">秒</span></div></div>' +
        '<p class="about-note" style="padding:0 16px 14px;">信笺只用文字字卡回信，固定格式：称呼 / 见字如晤 / 正文 / 落款和日期。</p>';

    page.appendChild(card1);
    page.appendChild(card2);
}

function rmBind() {
    var page = document.querySelector('[data-page="permission"]');
    if (!page || page.getAttribute("data-rm-bound")) return;
    page.setAttribute("data-rm-bound", "1");

    page.addEventListener("input", function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var key = t.getAttribute("data-rm-weight");
        if (!key) return;
        var p = rmSettings();
        if (!p || !p.replyModes[key]) return;
        p.replyModes[key].weight = Math.round(Number(t.value) || 0);
        rmUpdatePct();
        saveData();
    });

    page.addEventListener("change", function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var p = rmSettings();
        if (!p) return;

        var onKey = t.getAttribute("data-rm-on");
        if (onKey) {
            if (p.replyModes[onKey]) p.replyModes[onKey].on = !!t.checked;
            rmUpdatePct();
            saveData();
            return;
        }

        var wKey = t.getAttribute("data-rm-weight");
        if (wKey && p.replyModes[wKey]) {
            p.replyModes[wKey].weight = Math.round(Number(t.value) || 0);
            rmUpdatePct();
            saveData();
            return;
        }

        if (t.getAttribute("data-rm-combo")) {
            p.comboMax = rmClampInput(t, 2, 6);
            saveData();
            return;
        }
        if (t.getAttribute("data-rm-lettercount")) {
            p.letterMax = rmClampInput(t, 3, 12);
            saveData();
            return;
        }
        if (t.getAttribute("data-rm-lettermin")) {
            p.letterDelayMin = rmClampInput(t, 0, 86400);
            saveData();
            return;
        }
        if (t.getAttribute("data-rm-lettermax")) {
            p.letterDelayMax = rmClampInput(t, 0, 86400);
            saveData();
            return;
        }
    });
}

var rmBaseApplySettings = applySettings;
applySettings = function () {
    rmBaseApplySettings.apply(null, arguments);
    rmSyncBubblePreset();
};

function rmInit() {
    rmInjectStyles();
    rmTuneBubble();
    rmSettings();
    rmTrimPresets();
    rmSyncBubblePreset();
    rmBuildUI();
    rmBind();
    rmRender();

    var input = $("chatInput");
    if (input) input.placeholder = "iMessage";
    rmDecorateChat();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rmInit);
} else {
    setTimeout(rmInit, 0);
}
`;

function patchAppSource(src) {
    if (src.indexOf("PHILOS_REPLY_PATCH") !== -1) return src;
    const idx = src.lastIndexOf("})();");
    if (idx < 0) return src;
    const out = src.slice(0, idx) + "\n" + REPLY_PATCH + "\n" + src.slice(idx);
    try { new Function(out); } catch (e) { return src; }
    return out;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res || !res.ok) return res;
          return res.text().then((text) => {
            const out = new Response(patchAppSource(text), {
              headers: { "Content-Type": "application/javascript; charset=utf-8" }
            });
            caches.open(CACHE_NAME).then((c) => c.put(req, out.clone()));
            return out;
          });
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener("push", (event) => {
  let body = "他给你发消息了";
  let msgId = null;
  try {
    if (event.data) {
      const raw = event.data.text();
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.text) body = String(parsed.text);
        if (parsed && parsed.id) msgId = String(parsed.id);
      } catch (e) {
        if (raw) body = raw;
      }
    }
  } catch (e) {}

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = clients.find((c) => c.visibilityState === "visible");
    if (visible) {
      visible.postMessage({ type: "push-msg", id: msgId, text: body });
      return;
    }
    return self.registration.showNotification("☆Philos", {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
