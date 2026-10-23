const CACHE_NAME = "philos-v43";
const ASSETS = ["./", "./index.html", "./styles.css", "./widgets.css", "./app.js", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

/* =========================================================
   运行时补丁（app.js 末尾注入，原文件不动）
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

var RM_MOOD_KEY = "philos_moods";

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

function rmEnsureMoods() {
    if (!Array.isArray(appData.moods)) appData.moods = [];
    if (!appData.moodState || typeof appData.moodState !== "object") {
        appData.moodState = { text: "", until: 0 };
    }
    if (!appData.moodRange || typeof appData.moodRange !== "object") {
        appData.moodRange = { min: 20, max: 120 };
    }
    var f = appData.settings.font;
    if (typeof f.moodColor !== "string" || !f.moodColor) f.moodColor = "#8b909a";
    if (typeof f.moodSize !== "number") f.moodSize = 11;
}

function rmSaveMoodStore() {
    try {
        localStorage.setItem(RM_MOOD_KEY, JSON.stringify({
            moods: appData.moods || [],
            state: appData.moodState || { text: "", until: 0 },
            range: appData.moodRange || { min: 20, max: 120 }
        }));
    } catch (e) {}
}

function rmLoadMoodStore() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(RM_MOOD_KEY) || "null"); } catch (e) {}
    if (data && typeof data === "object") {
        if (Array.isArray(data.moods)) appData.moods = data.moods.filter(function (s) { return typeof s === "string" && s; });
        if (data.state && typeof data.state === "object") {
            appData.moodState = { text: String(data.state.text || ""), until: Number(data.state.until) || 0 };
        }
        if (data.range && typeof data.range === "object") {
            appData.moodRange = { min: Number(data.range.min) || 20, max: Number(data.range.max) || 120 };
        }
    } else {
        rmSaveMoodStore();
    }
}

function rmMoodRange() {
    var r = appData.moodRange;
    if (!r || typeof r !== "object") r = appData.moodRange = { min: 20, max: 120 };
    if (typeof r.min !== "number") r.min = 20;
    if (typeof r.max !== "number") r.max = 120;
    if (r.max < r.min) r.max = r.min;
    return r;
}

function rmApplyMoodStyle() {
    var f = appData.settings.font;
    document.documentElement.style.setProperty("--mood-color", f.moodColor || "#8b909a");
    document.documentElement.style.setProperty("--mood-size", (f.moodSize || 11) + "px");
}

function rmCurrentMood() {
    var moods = appData.moods || [];
    if (!moods.length) return "";
    var st = appData.moodState || (appData.moodState = { text: "", until: 0 });
    var now = Date.now();
    if (!st.text || !st.until || now >= st.until) {
        var range = rmMoodRange();
        var span = (range.min + Math.random() * (range.max - range.min)) * 60000;
        var next = moods[Math.floor(Math.random() * moods.length)];
        if (moods.length > 1 && next === st.text) {
            next = moods[(moods.indexOf(next) + 1) % moods.length];
        }
        st.text = next;
        st.until = now + span;
        rmSaveMoodStore();
    }
    return st.text;
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

function rmNotify(text) {
    var p = appData.settings && appData.settings.permission;
    if (!p || !p.notify) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var title = appData.taName || "他";
    try {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(function (reg) {
                reg.showNotification(title, {
                    body: text,
                    icon: "icon-192.png",
                    badge: "icon-192.png",
                    tag: "philos-msg"
                });
            }).catch(function () {});
        } else {
            new Notification(title, { body: text, icon: "icon-192.png" });
        }
    } catch (e) {}
}

function rmScrollChatBottom() {
    var box = $("chatMessages");
    if (!box) return;
    box.scrollTop = box.scrollHeight;
}

function rmAutoScrollChat() {
    rmScrollChatBottom();
    setTimeout(rmScrollChatBottom, 60);
    setTimeout(rmScrollChatBottom, 240);
}

function rmApplyPatBlur() {
    var b = appData.settings && appData.settings.bubble;
    var v = b && typeof b.patBlur === "number" ? b.patBlur : 70;
    document.documentElement.style.setProperty("--pat-blur", (v / 100 * 30).toFixed(1) + "px");
}

function rmHidePat() {
    var el = document.getElementById("patPop");
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function rmShowPat(text) {
    var existing = document.getElementById("patPop");
    if (existing) {
        var t = existing.querySelector(".pat-pop-text");
        if (t) t.textContent = text;
        return;
    }

    var wrap = document.createElement("div");
    wrap.className = "pat-pop";
    wrap.id = "patPop";

    var mask = document.createElement("div");
    mask.className = "pat-pop-mask";

    var card = document.createElement("div");
    card.className = "pat-pop-card";

    var avatar = document.createElement("div");
    avatar.className = "pat-pop-avatar";
    avatar.innerHTML = avatarMarkup(appData.taAvatar, "他");

    var body = document.createElement("div");
    body.className = "pat-pop-text";
    body.textContent = text;

    var actions = document.createElement("div");
    actions.className = "pat-pop-actions";

    var later = document.createElement("button");
    later.type = "button";
    later.className = "pat-pop-btn";
    later.textContent = "等下哦";
    later.addEventListener("click", rmHidePat);

    var go = document.createElement("button");
    go.type = "button";
    go.className = "pat-pop-btn primary";
    go.textContent = "闪去";
    go.addEventListener("click", function () {
        rmHidePat();
        showScreen("chatView");
        renderChat();
        rmAutoScrollChat();
    });

    actions.appendChild(later);
    actions.appendChild(go);
    card.appendChild(avatar);
    card.appendChild(body);
    card.appendChild(actions);
    wrap.appendChild(mask);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
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
        var notice = "";
        for (var i = 0; i < count; i++) {
            var msg = rmBuildMessage(p, pool);
            if (!msg) break;
            msg.time = now + i;
            appData.chatHistory.push(msg);
            if (!notice) notice = msg.type === "sticker" ? "给你发了一个表情包" : (msg.text || "");
            added++;
        }
        rmSetTyping(false);
        if (!added) return;

        var patPool = appData.cards.filter(function (c) { return c.kind === "status" && c.content; });
        var chance = p.patChance == null ? 30 : Number(p.patChance);
        if (patPool.length && Math.random() * 100 < chance) {
            var pat = patPool[Math.floor(Math.random() * patPool.length)];
            appData.chatHistory.push({ type: "status", text: "—— " + pat.content + " ——", time: now + added });
            if (!($("chatView") && $("chatView").classList.contains("active"))) {
                rmShowPat(pat.content);
            }
        }

        saveData();
        var inChat = $("chatView") && $("chatView").classList.contains("active");
        if (inChat) {
            renderChat();
            rmAutoScrollChat();
        } else if (notice) {
            rmNotify(notice);
        }
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
        ".rm-num{width:74px;text-align:right;border:none;border-radius:8px;padding:6px 8px;background:var(--input-bg);color:var(--text-primary);font-size:16px;outline:none;}" +
        ".widget-large,.dock{box-shadow:var(--shadow-card) !important;}" +
        "input:not([type=\"checkbox\"]):not([type=\"range\"]):not([type=\"color\"]):not([type=\"file\"]),textarea,select{font-size:16px !important;}" +
        ".msg-menu{flex-direction:row !important;gap:4px;padding:6px;border-radius:16px;background:var(--glass-bg) !important;-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);border:1px solid var(--glass-border);box-shadow:var(--shadow-card) !important;}" +
        ".msg-menu::after{display:none !important;}" +
        ".msg-menu-item{height:38px;padding:0 16px;border-radius:11px;color:var(--text-primary);font-size:14px;}" +
        ".msg-menu-item + .msg-menu-item{border-top:none !important;}" +
        ".msg-menu-item.danger{color:#ff3b30;}" +
        ".kind-seg.seg-5{grid-template-columns:repeat(5,1fr);}" +
        ".mood-editor{padding:12px 16px 6px;display:flex;flex-direction:column;gap:8px;}" +
        ".mood-input{width:100%;min-height:68px;padding:12px;border-radius:14px;border:1px solid var(--glass-border);background:var(--input-bg);color:var(--text-primary);font-size:16px;resize:vertical;outline:none;}" +
        ".mood-add{height:40px;}" +
        ".mood-list{padding:4px 16px 28px;}" +
        ".mood-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;margin-bottom:10px;border-radius:16px;background:var(--card-bg);box-shadow:var(--shadow-card);}" +
        ".mood-row-text{font-size:15px;color:var(--text-primary);word-break:break-word;}" +
        ".mood-del{font-size:13px;color:#ff3b30;background:none;border:none;padding:4px 0;flex:0 0 auto;}" +
        ".msg-mood{position:absolute;top:calc(100% + 4px);left:0;display:flex;align-items:center;gap:5px;font-size:var(--mood-size,11px);line-height:1.2;color:var(--mood-color,#8b909a);white-space:nowrap;pointer-events:none;z-index:5;}" +
        ".msg-row.rm-mood-row{padding-bottom:30px;}" +
        ".mood-dot{width:6px;height:6px;border-radius:50%;background:#34c759;flex:0 0 auto;animation:rmBreath 1.8s ease-in-out infinite;}" +
        "@keyframes rmBreath{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(52,199,89,.35);}50%{opacity:.55;box-shadow:0 0 0 4px rgba(52,199,89,0);}}" +
        "html[data-bubble-preset=\"large\"] .msg-row .msg-bubble,html[data-bubble-preset=\"large\"] .pv-row .pv-bubble{border-radius:var(--bubble-radius,16px);}" +
        "html[data-bubble-preset=\"tail\"] .msg-row .msg-bubble,html[data-bubble-preset=\"tail\"] .pv-row .pv-bubble{border-radius:var(--bubble-radius,16px);}" +
        "html[data-bubble-preset=\"tail\"] .msg-row.me .msg-bubble{border-bottom-right-radius:5px;}" +
        "html[data-bubble-preset=\"tail\"] .msg-row.ta .msg-bubble{border-bottom-left-radius:5px;}" +
        "html[data-bubble-preset=\"tail\"] .pv-row.me .pv-bubble{border-bottom-right-radius:5px;}" +
        "html[data-bubble-preset=\"tail\"] .pv-row.ta .pv-bubble{border-bottom-left-radius:5px;}" +
        "#chatMessages .msg-bubble.rm-sticker-bubble{background:transparent !important;border:none !important;padding:0 !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}" +
        "#chatMessages .rm-sticker-bubble img{max-width:112px !important;border-radius:10px;}" +
        ".chat-input-box{min-height:44px;padding:4px 8px 4px 16px;background:var(--glass-bg);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);border:1px solid var(--glass-border);box-shadow:none;}" +
        ".chat-input-box .input-row{align-items:center;}" +
        ".chat-input-box textarea{padding:0;line-height:1.5;}" +
        ".chat-circle-btn,.nav-back{background:var(--glass-bg);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);border:1px solid var(--glass-border);}" +
        ".pat-pop{position:fixed;inset:0;z-index:620;display:flex;align-items:center;justify-content:center;padding:24px;}" +
        ".pat-pop-mask{position:absolute;inset:0;background:rgba(16,20,26,.34);}" +
        ".pat-pop-card{position:relative;z-index:1;width:80%;max-width:320px;padding:28px 20px 18px;border-radius:30px;text-align:center;background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(var(--pat-blur,21px)) saturate(120%);backdrop-filter:blur(var(--pat-blur,21px)) saturate(120%);border:1px solid rgba(255,255,255,.55);box-shadow:0 24px 60px rgba(20,30,45,.28);}" +
        "[data-theme=\"dark\"] .pat-pop-card{background:rgba(32,34,39,.56);border-color:rgba(255,255,255,.12);box-shadow:0 24px 60px rgba(0,0,0,.55);}" +
        ".pat-pop-avatar{width:92px;height:92px;border-radius:50%;margin:0 auto 16px;overflow:hidden;background:rgba(255,255,255,.6);border:3px solid #fff;box-shadow:0 8px 22px rgba(50,70,95,.18);display:flex;align-items:center;justify-content:center;color:#7d8ea2;font-size:28px;font-weight:600;}" +
        ".pat-pop-avatar img{width:100%;height:100%;object-fit:cover;display:block;}" +
        ".pat-pop-text{font-size:15px;line-height:1.6;color:var(--text-primary);margin-bottom:20px;word-break:break-word;}" +
        ".pat-pop-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
        ".pat-pop-btn{height:44px;border-radius:14px;font-size:14px;font-weight:500;color:var(--text-primary);background:rgba(140,155,175,.20);}" +
        ".pat-pop-btn.primary{background:#5b7fa6;color:#fff;}" +
        ".pat-pop-btn:active{transform:scale(.97);opacity:.9;}";
    document.head.appendChild(st);
}

function rmDecorateChat() {
    var bubbles = document.querySelectorAll("#chatMessages .msg-bubble");
    var moodText = rmCurrentMood();
    for (var i = 0; i < bubbles.length; i++) {
        var idx = Number(bubbles[i].getAttribute("data-index"));
        var msg = appData.chatHistory[idx];
        if (!msg) continue;
        if (msg.type === "sticker") bubbles[i].classList.add("rm-sticker-bubble");
        var text = moodText || msg.mood || "";
        if (msg.from === "ta" && text) {
            var row = bubbles[i].closest(".msg-row");
            if (row) row.classList.add("rm-mood-row");
            var wrap = bubbles[i].parentNode;
            if (wrap && !wrap.querySelector(".msg-mood")) {
                var mood = document.createElement("div");
                mood.className = "msg-mood";
                var dot = document.createElement("span");
                dot.className = "mood-dot";
                var label = document.createElement("span");
                label.className = "mood-text";
                label.textContent = text;
                mood.appendChild(dot);
                mood.appendChild(label);
                wrap.appendChild(mood);
            }
        }
    }
}

var rmBaseRenderChat = renderChat;
renderChat = function () {
    rmBaseRenderChat.apply(null, arguments);
    rmDecorateChat();
    rmAutoScrollChat();
};

function rmRenderMood() {
    var view = $("cardsView");
    if (!view) return;
    var seg = view.querySelector(".kind-seg");
    if (seg) {
        var btns = seg.querySelectorAll("[data-kind]");
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle("active", btns[i].getAttribute("data-kind") === "mood");
        }
    }
    var catBar = view.querySelector(".cat-scroll");
    if (catBar) catBar.style.display = "none";
    var addRow = view.querySelector(".card-add-row");
    if (addRow) addRow.style.display = "none";

    var scroll = view.querySelector(".card-scroll");
    if (!scroll) return;
    scroll.innerHTML = "";

    var editor = document.createElement("div");
    editor.className = "mood-editor";
    editor.innerHTML = '<textarea class="mood-input" placeholder="一行一条，可一次加多条"></textarea>' +
        '<button class="wide-btn mood-add" type="button">添加状态</button>';
    scroll.appendChild(editor);

    var list = document.createElement("div");
    list.className = "mood-list";
    scroll.appendChild(list);

    var moods = appData.moods || [];
    if (!moods.length) {
        var empty = document.createElement("div");
        empty.className = "card-empty";
        empty.textContent = "还没有状态，写几句他的心情吧";
        list.appendChild(empty);
    }

    moods.forEach(function (text, idx) {
        var row = document.createElement("div");
        row.className = "mood-row";
        var span = document.createElement("span");
        span.className = "mood-row-text";
        span.textContent = text;
        var del = document.createElement("button");
        del.type = "button";
        del.className = "mood-del";
        del.textContent = "删除";
        del.addEventListener("click", function () {
            appData.moods.splice(idx, 1);
            rmSaveMoodStore();
            rmRenderMood();
        });
        row.appendChild(span);
        row.appendChild(del);
        list.appendChild(row);
    });

    var input = editor.querySelector(".mood-input");
    var addBtn = editor.querySelector(".mood-add");
    addBtn.addEventListener("click", function () {
        var lines = input.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!lines.length) return;
        lines.forEach(function (text) {
            if (appData.moods.indexOf(text) < 0) appData.moods.push(text);
        });
        rmSaveMoodStore();
        rmRenderMood();
    });
}

var rmBaseRenderCards = renderCards;
renderCards = function () {
    if (typeof activeCardKind !== "undefined" && activeCardKind === "mood") {
        rmRenderMood();
        return;
    }
    var view = $("cardsView");
    if (view) {
        var catBar = view.querySelector(".cat-scroll");
        if (catBar) catBar.style.display = "";
        var addRow = view.querySelector(".card-add-row");
        if (addRow) addRow.style.display = "";
    }
    rmBaseRenderCards.apply(null, arguments);
};

function rmSetupMoodTab() {
    var view = $("cardsView");
    if (!view) return;
    var seg = view.querySelector(".kind-seg");
    if (!seg) return;
    var statusBtn = seg.querySelector('[data-kind="status"]');
    if (statusBtn) statusBtn.textContent = "拍一拍";
    if (!seg.querySelector('[data-kind="mood"]')) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kind-btn";
        btn.setAttribute("data-kind", "mood");
        btn.textContent = "状态";
        seg.appendChild(btn);
    }
    seg.classList.add("seg-5");
}

function rmSetupMoodSettings() {
    var page = document.querySelector('[data-page="display"]');
    if (!page || page.querySelector("[data-mood-size]")) return;
    var f = appData.settings.font;
    var range = rmMoodRange();

    var card = document.createElement("div");
    card.className = "group-card control-card";
    card.innerHTML = '<div class="card-title">状态文字</div>' +
        '<div class="control-row"><span class="control-label">颜色</span><label class="color-dot"><input type="color" data-mood-color></label></div>' +
        '<div class="control-block"><div class="control-head"><span class="control-label">大小</span><span class="control-value" data-mood-size-val>' + f.moodSize + 'px</span></div>' +
        '<input type="range" class="slider" data-mood-size min="9" max="18" step="1"></div>' +
        '<div class="control-row"><span class="control-label">轮换最短</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="1" max="1440" step="1" data-mood-min><span class="control-label">分钟</span></div></div>' +
        '<div class="control-row"><span class="control-label">轮换最长</span><div class="row-actions"><input class="rm-num" type="number" inputmode="numeric" min="1" max="1440" step="1" data-mood-max><span class="control-label">分钟</span></div></div>';
    page.appendChild(card);

    var color = card.querySelector("[data-mood-color]");
    var size = card.querySelector("[data-mood-size]");
    var label = card.querySelector("[data-mood-size-val]");
    var minEl = card.querySelector("[data-mood-min]");
    var maxEl = card.querySelector("[data-mood-max]");
    color.value = f.moodColor;
    size.value = f.moodSize;
    minEl.value = range.min;
    maxEl.value = range.max;

    color.addEventListener("input", function () {
        f.moodColor = color.value;
        rmApplyMoodStyle();
        saveData();
    });
    size.addEventListener("input", function () {
        f.moodSize = Number(size.value) || 11;
        label.textContent = f.moodSize + "px";
        rmApplyMoodStyle();
        saveData();
    });
    minEl.addEventListener("change", function () {
        range.min = rmClampInput(minEl, 1, 1440);
        if (range.max < range.min) { range.max = range.min; maxEl.value = range.max; }
        rmSaveMoodStore();
    });
    maxEl.addEventListener("change", function () {
        range.max = rmClampInput(maxEl, range.min, 1440);
        if (range.max < range.min) { range.max = range.min; maxEl.value = range.max; }
        rmSaveMoodStore();
    });
}

function rmApplyCustomCss() {
    var area = document.querySelector('[data-key="bubble.css"]');
    if (!area) return;
    appData.settings.bubble.css = area.value;
    var target = document.getElementById("bubbleCustom");
    if (target) target.textContent = area.value;
    saveData();
}

function rmSetupCustomCss() {
    var area = document.querySelector('[data-key="bubble.css"]');
    if (!area || area.getAttribute("data-rm-css")) return;
    area.setAttribute("data-rm-css", "1");

    var block = area.closest(".control-block") || area.parentNode;
    var row = document.createElement("div");
    row.className = "control-block";
    row.innerHTML = '<button class="wide-btn" type="button" data-rm-css-apply>应用 CSS</button>' +
        '<p class="about-note" style="padding:8px 0 0;">写完点按钮生效。想覆盖预设圆角，选择器写具体一点（如 .msg-row.ta .msg-bubble）或加 !important。</p>';
    if (block.parentNode) block.parentNode.insertBefore(row, block.nextSibling);

    var btn = row.querySelector("[data-rm-css-apply]");
    if (btn) {
        btn.addEventListener("click", function () {
            rmApplyCustomCss();
            btn.textContent = "已应用";
            setTimeout(function () { btn.textContent = "应用 CSS"; }, 1200);
        });
    }

    var timer = null;
    area.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(rmApplyCustomCss, 400);
    });
}

function rmSetupPatSettings() {
    var b = appData.settings.bubble;
    if (typeof b.patBlur !== "number") b.patBlur = 70;
    rmApplyPatBlur();

    var anchor = document.querySelector("[data-preset]");
    var page = anchor ? anchor.closest(".set-page") : null;
    if (!page || page.querySelector("[data-pat-blur]")) return;

    var card = document.createElement("div");
    card.className = "group-card control-card";
    card.innerHTML = '<div class="card-title">拍一拍弹窗</div>' +
        '<div class="control-block"><div class="control-head"><span class="control-label">磨砂度</span><span class="control-value" data-pat-blur-val>' + b.patBlur + '%</span></div>' +
        '<input type="range" class="slider" data-pat-blur min="0" max="100" step="5"></div>';
    page.appendChild(card);

    var input = card.querySelector("[data-pat-blur]");
    var label = card.querySelector("[data-pat-blur-val]");
    input.value = b.patBlur;
    input.addEventListener("input", function () {
        b.patBlur = Number(input.value) || 0;
        label.textContent = b.patBlur + "%";
        rmApplyPatBlur();
        saveData();
    });
}

function rmSyncDarkToggle() {
    var el = document.querySelector("[data-rm-dark]");
    if (!el) return;
    el.checked = document.documentElement.getAttribute("data-theme") === "dark";
}

function rmSetupThemeToggle() {
    var page = document.querySelector('[data-page="main"]');
    if (!page || page.querySelector("[data-rm-dark-card]")) return;

    var card = document.createElement("div");
    card.className = "group-card";
    card.setAttribute("data-rm-dark-card", "");
    card.innerHTML = '<div class="settings-item"><span>深色模式</span>' +
        '<label class="switch"><input type="checkbox" data-rm-dark><span class="switch-track"></span></label></div>';

    var account = page.querySelector(".account-card");
    if (account && account.parentNode) account.parentNode.insertBefore(card, account.nextSibling);
    else page.appendChild(card);

    var input = card.querySelector("[data-rm-dark]");
    input.addEventListener("change", function () {
        appData.themeMode = input.checked ? "dark" : "light";
        saveData();
        applyTheme();
        applySettings();
        rmSyncDarkToggle();
    });

    rmSyncDarkToggle();

    if (window.MutationObserver) {
        var mo = new MutationObserver(rmSyncDarkToggle);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
}

function rmSyncBubblePreset() {
    var b = appData.settings && appData.settings.bubble;
    var preset = b && b.preset ? b.preset : "tail";
    document.documentElement.setAttribute("data-bubble-preset", preset);
}

function rmTuneIntervals() {
    var delay = document.querySelector('[data-key="permission.replyDelay"]');
    if (delay) { delay.setAttribute("max", "600"); delay.max = "600"; }
    var activeMin = document.querySelector('[data-key="permission.activeMin"]');
    if (activeMin) { activeMin.setAttribute("min", "1"); activeMin.min = "1"; }
    var activeMax = document.querySelector('[data-key="permission.activeMax"]');
    if (activeMax) { activeMax.setAttribute("min", "2"); activeMax.min = "2"; }
    var callMin = document.querySelector('[data-key="permission.callMin"]');
    if (callMin) { callMin.setAttribute("min", "1"); callMin.min = "1"; }
}

function rmTuneBubble() {
    var height = document.querySelector('[data-key="bubble.height"]');
    if (height) { height.setAttribute("min", "0"); height.min = "0"; }
    var radius = document.querySelector('[data-key="bubble.radius"]');
    if (radius) { radius.setAttribute("max", "60"); radius.max = "60"; }
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

function rmSetupMultiSticker() {
    var input = $("cardStickerFile");
    if (!input || input.getAttribute("data-rm-multi")) return;
    input.setAttribute("multiple", "multiple");
    input.setAttribute("data-rm-multi", "1");

    input.addEventListener("change", function (e) {
        e.stopImmediatePropagation();
        var files = input.files;
        if (!files || !files.length) return;
        var list = Array.prototype.slice.call(files);
        var pending = list.length;
        list.forEach(function (file) {
            var reader = new FileReader();
            reader.onload = function () {
                appData.cards.unshift({
                    id: uid(),
                    kind: "sticker",
                    content: reader.result,
                    category: "未分类",
                    createdAt: Date.now()
                });
                pending--;
                if (pending <= 0) { saveData(); renderCards(); }
            };
            reader.onerror = function () {
                pending--;
                if (pending <= 0) { saveData(); renderCards(); }
            };
            reader.readAsDataURL(file);
        });
        input.value = "";
    }, true);
}

function rmFixZoom() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
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

        if (t.getAttribute("data-rm-combo")) { p.comboMax = rmClampInput(t, 2, 6); saveData(); return; }
        if (t.getAttribute("data-rm-lettercount")) { p.letterMax = rmClampInput(t, 3, 12); saveData(); return; }
        if (t.getAttribute("data-rm-lettermin")) { p.letterDelayMin = rmClampInput(t, 0, 86400); saveData(); return; }
        if (t.getAttribute("data-rm-lettermax")) { p.letterDelayMax = rmClampInput(t, 0, 86400); saveData(); return; }
    });
}

var rmBaseApplySettings = applySettings;
applySettings = function () {
    rmBaseApplySettings.apply(null, arguments);
    rmSyncBubblePreset();
    rmApplyPatBlur();
    rmApplyMoodStyle();
};

function rmInit() {
    rmInjectStyles();
    rmFixZoom();
    rmTuneIntervals();
    rmTuneBubble();
    rmSettings();
    rmEnsureMoods();
    rmLoadMoodStore();
    rmApplyMoodStyle();
    rmTrimPresets();
    rmSyncBubblePreset();
    rmSetupMoodTab();
    rmSetupMoodSettings();
    rmSetupPatSettings();
    rmSetupThemeToggle();
    rmSetupMultiSticker();
    rmBuildUI();
    rmBind();
    rmRender();
    rmSetupCustomCss();

    var input = $("chatInput");
    if (input) input.placeholder = "iMessage";
    rmDecorateChat();

    var chatBtn = $("appChat");
    if (chatBtn) {
        chatBtn.addEventListener("click", function () {
            setTimeout(rmScrollChatBottom, 80);
            setTimeout(rmScrollChatBottom, 300);
        });
    }
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
        if (client.focus) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
