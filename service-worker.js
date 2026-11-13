const CACHE_NAME = "philos-v51";
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
var RM_SETTINGS_KEY = "philos_patch_settings";
var rmWarnedStorage = false;

var rmDb = null;
var rmDbOk = false;
var rmDbPromise = null;
var rmImgMap = new Map();
var rmStoredIds = {};
var rmImgSeq = 0;
var rmReplyRound = 0;

function rmOpenDb() {
    if (rmDbPromise) return rmDbPromise;
    rmDbPromise = new Promise(function (resolve) {
        try {
            var req = indexedDB.open("philos_images", 1);
            req.onupgradeneeded = function () {
                try { req.result.createObjectStore("images"); } catch (e) {}
            };
            req.onsuccess = function () { rmDb = req.result; rmDbOk = true; resolve(rmDb); };
            req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
    });
    return rmDbPromise;
}

function rmIdbPut(id, value) {
    if (!rmDbOk || rmStoredIds[id]) return;
    rmStoredIds[id] = true;
    try {
        var tx = rmDb.transaction("images", "readwrite");
        tx.objectStore("images").put(value, id);
    } catch (e) {}
}

function rmIdbGet(id) {
    return new Promise(function (resolve) {
        if (!rmDb) { resolve(null); return; }
        try {
            var req = rmDb.transaction("images").objectStore("images").get(id);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
    });
}

function rmHash(str) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        h1 = (h1 * 33 ^ c) >>> 0;
        h2 = (h2 * 31 + c) >>> 0;
    }
    return h1.toString(36) + h2.toString(36) + str.length.toString(36);
}

function rmImgId(url) {
    var id = rmImgMap.get(url);
    if (!id) {
        id = "i" + (++rmImgSeq).toString(36) + rmHash(url);
        rmImgMap.set(url, id);
    }
    rmIdbPut(id, url);
    return id;
}

function rmCollectRefs(obj, out) {
    if (!obj || typeof obj !== "object") return;
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var v = obj[k];
        if (typeof v === "string") {
            if (v.indexOf("idb://") === 0) out.push(v.slice(6));
        } else if (v && typeof v === "object") {
            rmCollectRefs(v, out);
        }
    }
}

function rmHydrateWalk(obj, map) {
    if (!obj || typeof obj !== "object") return;
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var v = obj[k];
        if (typeof v === "string") {
            if (map[v]) obj[k] = map[v];
        } else if (v && typeof v === "object") {
            rmHydrateWalk(v, map);
        }
    }
}

function rmHydrateImages() {
    var refs = [];
    rmCollectRefs(appData, refs);
    if (!refs.length) return;
    var unique = refs.filter(function (v, i) { return refs.indexOf(v) === i; });
    Promise.all(unique.map(function (id) {
        return rmIdbGet(id).then(function (url) { return { id: id, url: url }; });
    })).then(function (list) {
        var map = {};
        list.forEach(function (item) {
            if (item.url) {
                map["idb://" + item.id] = item.url;
                rmImgMap.set(item.url, item.id);
                rmStoredIds[item.id] = true;
            }
        });
        rmHydrateWalk(appData, map);
        rmRefreshAll();
    });
}

function rmRefreshAll() {
    try {
        renderWidget();
        renderProfile();
        renderPreview();
        renderChat();
        renderStickers();
        renderPats();
        renderIconConfigs();
        renderControls();
        renderCountdown();
        renderLetters();
        renderCards();
        renderWidgetConfig();
        applySettings();
        applyHeroImages();
    } catch (e) {}
}

function rmWarnStorage() {
    if (rmWarnedStorage) return;
    rmWarnedStorage = true;
    setTimeout(function () { alert("存储空间不足，刚添加的图片可能没有保存。"); }, 60);
}

function rmSaveAppData() {
    try {
        var json;
        if (rmDbOk) {
            json = JSON.stringify(appData, function (k, v) {
                if (typeof v === "string" && v.indexOf("data:image/") === 0) {
                    return "idb://" + rmImgId(v);
                }
                return v;
            });
        } else {
            json = JSON.stringify(appData);
        }
        localStorage.setItem(STORAGE_KEY, json);
    } catch (e) { rmWarnStorage(); }
}

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

function rmSavePatch() {
    var s = appData.settings || {};
    var p = s.permission || {};
    var b = s.bubble || {};
    var f = s.font || {};
    try {
        localStorage.setItem(RM_SETTINGS_KEY, JSON.stringify({
            permission: {
                replyModes: p.replyModes || null,
                comboMax: p.comboMax,
                letterMax: p.letterMax,
                letterDelayMin: p.letterDelayMin,
                letterDelayMax: p.letterDelayMax
            },
            bubble: { patBlur: b.patBlur },
            font: { moodColor: f.moodColor, moodSize: f.moodSize }
        }));
    } catch (e) {}
}

function rmLoadPatch() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(RM_SETTINGS_KEY) || "null"); } catch (e) {}
    if (!data) { rmSavePatch(); return; }
    var s = appData.settings;
    if (data.permission) {
        var p = s.permission;
        if (data.permission.replyModes && typeof data.permission.replyModes === "object") p.replyModes = data.permission.replyModes;
        var keys = ["comboMax", "letterMax", "letterDelayMin", "letterDelayMax"];
        for (var i = 0; i < keys.length; i++) {
            if (typeof data.permission[keys[i]] === "number") p[keys[i]] = data.permission[keys[i]];
        }
    }
    if (data.bubble && typeof data.bubble.patBlur === "number") s.bubble.patBlur = data.bubble.patBlur;
    if (data.font) {
        if (typeof data.font.moodColor === "string" && data.font.moodColor) s.font.moodColor = data.font.moodColor;
        if (typeof data.font.moodSize === "number") s.font.moodSize = data.font.moodSize;
    }
}

function rmEnsureMoods() {
    if (!Array.isArray(appData.moods)) appData.moods = [];
    if (!appData.moodState || typeof appData.moodState !== "object") appData.moodState = { text: "", until: 0 };
    if (!appData.moodRange || typeof appData.moodRange !== "object") appData.moodRange = { min: 20, max: 120 };
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
        if (moods.length > 1 && next === st.text) next = moods[(moods.indexOf(next) + 1) % moods.length];
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

function rmPick(list) { return list[Math.floor(Math.random() * list.length)]; }

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

    if (mode === "text") return { from: "ta", type: "text", text: rmPick(pool.text), status: "" };
    if (mode === "emoji") return { from: "ta", type: "text", text: rmPick(pool.emoji), status: "" };
    if (mode === "sticker") return { from: "ta", type: "sticker", text: rmPick(pool.sticker), status: "" };
    if (mode === "textEmoji") {
        var text = rmPick(pool.text);
        var n = 1 + Math.floor(Math.random() * 2);
        if (pool.emoji.length) { for (var i = 0; i < n; i++) text += rmPick(pool.emoji); }
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
                reg.showNotification(title, { body: text, icon: "icon-192.png", badge: "icon-192.png", tag: "philos-msg" });
            }).catch(function () {});
        } else {
            new Notification(title, { body: text, icon: "icon-192.png" });
        }
    } catch (e) {}
}

function rmScrollChatBottom() {
    var box = $("chatMessages");
    if (box) box.scrollTop = box.scrollHeight;
}

function rmAutoScrollChat() {
    rmScrollChatBottom();
    setTimeout(rmScrollChatBottom, 60);
    setTimeout(rmScrollChatBottom, 240);
}

function rmRefreshChat() {
    renderChat();
    rmAutoScrollChat();
}

function rmInChat() {
    var v = $("chatView");
    return !!(v && v.classList.contains("active"));
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
    var mask = document.createElement("div"); mask.className = "pat-pop-mask";
    var card = document.createElement("div"); card.className = "pat-pop-card";
    var avatar = document.createElement("div"); avatar.className = "pat-pop-avatar";
    avatar.innerHTML = avatarMarkup(appData.taAvatar, "他");
    var body = document.createElement("div"); body.className = "pat-pop-text"; body.textContent = text;
    var actions = document.createElement("div"); actions.className = "pat-pop-actions";
    var later = document.createElement("button"); later.type = "button"; later.className = "pat-pop-btn"; later.textContent = "等下哦";
    later.addEventListener("click", rmHidePat);
    var go = document.createElement("button"); go.type = "button"; go.className = "pat-pop-btn primary"; go.textContent = "闪去";
    go.addEventListener("click", function () { rmHidePat(); showScreen("chatView"); renderChat(); rmAutoScrollChat(); });
    actions.appendChild(later); actions.appendChild(go);
    card.appendChild(avatar); card.appendChild(body); card.appendChild(actions);
    wrap.appendChild(mask); wrap.appendChild(card);
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

    rmReplyRound++;
    var round = rmReplyRound;
    if (replyTimer) clearTimeout(replyTimer);
    rmSetTyping(true);

    replyTimer = setTimeout(function () {
        if (round !== rmReplyRound) return;

        var list = [];
        for (var i = 0; i < count; i++) {
            var one = rmBuildMessage(p, pool);
            if (!one) break;
            list.push(one);
        }
        if (!list.length) { rmSetTyping(false); return; }

        var patText = "";
        var patPool = appData.cards.filter(function (c) { return c.kind === "status" && c.content; });
        var chance = p.patChance == null ? 30 : Number(p.patChance);
        if (patPool.length && Math.random() * 100 < chance) {
            patText = patPool[Math.floor(Math.random() * patPool.length)].content;
        }

        var notice = "";
        var step = 0;

        function deliver() {
            if (round !== rmReplyRound) return;
            var msg = list[step];
            msg.time = Date.now();
            appData.chatHistory.push(msg);
            if (!notice) notice = msg.type === "sticker" ? "给你发了一个表情包" : (msg.text || "");
            saveData();

            if (rmInChat()) {
                rmRefreshChat();
            } else if (step === 0 && notice) {
                rmNotify(notice);
            }

            step++;
            if (step >= list.length) {
                if (patText) {
                    appData.chatHistory.push({ type: "status", text: "—— " + patText + " ——", time: Date.now() });
                    saveData();
                    if (rmInChat()) rmRefreshChat();
                    else rmShowPat(patText);
                }
                rmSetTyping(false);
                return;
            }
            replyTimer = setTimeout(deliver, 900 + Math.floor(Math.random() * 700));
        }

        deliver();
    }, delay);
};

window.philosRefreshChat = rmRefreshChat;

function rmLetterDate() {
    var d = new Date();
    return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate());
}

function rmLetterText(body) {
    var myName = appData.myName && appData.myName !== "your账户名" ? appData.myName : "你";
    var taName = appData.taName && appData.taName !== "他" ? appData.taName : "他";
    return "亲爱的" + myName + "：\n\n  见字如晤：\n  " + body + "\n\n　　　　　　" + taName + "\n　　　　　" + rmLetterDate();
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
    var total = 0, i;
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

function rmCompressImage(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
        var max = 480;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        var out = "";
        try { out = canvas.toDataURL("image/webp", 0.72); } catch (e) {}
        if (!out || out.indexOf("data:image/") !== 0) out = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        cb(out);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(""); };
    img.src = url;
}

function rmAppButton(id, label, symbol) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "app-icon";
    btn.id = id;
    btn.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + symbol + '"></use></svg></span><span class="app-label">' + label + '</span>';
    return btn;
}

function rmBuildHomePages() {
    var content = document.querySelector(".desktop-content");
    if (!content) return;
    if (content.querySelector(".home-pager")) return;
    var widget = document.getElementById("widgetLarge");
    var dock = content.querySelector(".dock");
    if (!widget || !dock) return;

    var iconGrid = content.querySelector(".icon-grid");
    var pager = document.createElement("div");
    pager.className = "home-pager";
    pager.id = "homePager";

    var page1 = document.createElement("section"); page1.className = "home-page";
    var page2 = document.createElement("section"); page2.className = "home-page";
    var grid1 = document.createElement("div"); grid1.className = "home-app-grid";
    var grid2 = document.createElement("div"); grid2.className = "home-app-grid";

    page1.appendChild(widget);
    page1.appendChild(grid1);
    page2.appendChild(grid2);

    var chatBtn = document.getElementById("appChat");
    var setBtn = document.getElementById("appSettings");
    var letterBtn = document.getElementById("appLetter");
    var cdBtn = document.getElementById("appCountdown");
    var widgetsBtn = document.getElementById("appWidgets");

    var phoneBtn = rmAppButton("btnPhone", "电话", "ic-phone");
    var wechatBtn = rmAppButton("btnWechat", "微信", "ic-chat");
    var galleryBtn = rmAppButton("btnGallery", "图库", "ic-image");
    var quizBtn = rmAppButton("btnQuiz", "出题", "ic-card");
    var freqBtn = rmAppButton("btnFreq", "频率", "ic-calendar");

    grid1.appendChild(phoneBtn);
    if (chatBtn) grid1.appendChild(chatBtn);
    grid1.appendChild(wechatBtn);
    if (setBtn) grid1.appendChild(setBtn);

    if (widgetsBtn) grid2.appendChild(widgetsBtn);
    if (letterBtn) grid2.appendChild(letterBtn);
    if (cdBtn) grid2.appendChild(cdBtn);
    grid2.appendChild(galleryBtn);
    grid2.appendChild(quizBtn);
    grid2.appendChild(freqBtn);

    if (iconGrid && iconGrid.parentNode) iconGrid.parentNode.removeChild(iconGrid);

    pager.appendChild(page1);
    pager.appendChild(page2);
    content.insertBefore(pager, dock);

    phoneBtn.addEventListener("click", function () { startCall(); });
    wechatBtn.addEventListener("click", function () { alert("微信聊天还在搭建，等气泡 CSS。"); });
    galleryBtn.addEventListener("click", function () { alert("图库还没做。"); });
    quizBtn.addEventListener("click", function () { alert("出题还没做。"); });
    freqBtn.addEventListener("click", function () { alert("频率还没拆分完成。"); });
}

function rmInjectStyles() {
    if (document.getElementById("rm-style")) return;
    var st = document.createElement("style");
    st.id = "rm-style";
    st.textContent =
        ".rm-num{width:74px;text-align:right;border:none;border-radius:8px;padding:6px 8px;background:var(--input-bg);color:var(--text-primary);font-size:16px;outline:none;}" +
        ".widget-large,.dock{box-shadow:var(--shadow-card) !important;}" +
        ".desktop-content{overflow:hidden !important;}" +
        ".home-pager{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;width:100%;}" +
        ".home-pager::-webkit-scrollbar{display:none;}" +
        ".home-page{flex:0 0 100%;width:100%;scroll-snap-align:start;display:flex;flex-direction:column;gap:20px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:4px;}" +
        ".home-app-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;width:100%;align-content:start;}" +
        ".dock{grid-template-columns:repeat(3,1fr) !important;}" +
        ".chat-center{padding-top:10px !important;}" +
        ".chat-avatar{width:50px !important;height:50px !important;}" +
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
                var mood = document.createElement("div"); mood.className = "msg-mood";
                var dot = document.createElement("span"); dot.className = "mood-dot";
                var label = document.createElement("span"); label.className = "mood-text"; label.textContent = text;
                mood.appendChild(dot); mood.appendChild(label); wrap.appendChild(mood);
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

saveData = function () { rmSaveAppData(); };

function rmMarkVersion() {
    try {
        var page = document.querySelector('[data-page="about"]');
        if (!page) return;
        var items = page.querySelectorAll(".settings-item");
        for (var i = 0; i < items.length; i++) {
            if ((items[i].textContent || "").indexOf("版本") >= 0) {
                var val = items[i].querySelector(".control-value");
                if (val) val.textContent = "3.9 · v51";
            }
        }
    } catch (e) {}
}

function rmInit() {
    rmOpenDb();
    rmInjectStyles();
    rmFixZoom();
    rmTuneIntervals();
    rmTuneBubble();
    rmSettings();
    rmLoadPatch();
    rmEnsureMoods();
    rmLoadMoodStore();
    rmApplyMoodStyle();
    rmTrimPresets();
    rmSyncBubblePreset();
    rmBuildHomePages();
    setTimeout(rmBuildHomePages, 400);
    setTimeout(rmBuildHomePages, 1200);
    rmSetupMoodTab();
    rmSetupMoodSettings();
    rmSetupPatSettings();
    rmSetupThemeToggle();
    rmSetupMultiSticker();
    rmBuildUI();
    rmBind();
    rmRender();
    rmSetupCustomCss();
    rmMarkVersion();

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

    rmOpenDb().then(function () { setTimeout(rmHydrateImages, 0); });
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
      } catch (e) { if (raw) body = raw; }
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
      body: body, icon: "icon-192.png", badge: "icon-192.png",
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
