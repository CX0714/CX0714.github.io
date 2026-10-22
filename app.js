/* =========================================================
   Philos · 2.5
   头像垂直位置 + 8 图标独立图片
   ========================================================= */
(function () {
    "use strict";

    var STORAGE_KEY = "private_chat_app_v1";
    var BLANK = "______";

    var ICON_KEYS = ["letter", "settings", "countdown", "widgets", "chat", "cards", "appearance", "permission"];

    var ICON_LIST = [
        { key: "letter", label: "信箱", symbol: "ic-mail" },
        { key: "settings", label: "设置", symbol: "ic-gear" },
        { key: "countdown", label: "倒数日", symbol: "ic-calendar" },
        { key: "widgets", label: "小组件", symbol: "ic-grid" },
        { key: "chat", label: "聊天", symbol: "ic-chat" },
        { key: "cards", label: "字卡", symbol: "ic-card" },
        { key: "appearance", label: "外观", symbol: "ic-palette" },
        { key: "permission", label: "权限", symbol: "ic-key" }
    ];

    var EMPTY_ICONS = {};
    ICON_KEYS.forEach(function (k) { EMPTY_ICONS[k] = ""; });

    var DEFAULTS = {
        taName: "他", taAvatar: "", myName: "your账户名", myAvatar: "",
        chatHistory: [], cards: [], stickers: [], pats: ["要抱抱"],
        anniversaries: [], letters: [], themeMode: "auto",
        widgetLines: [BLANK, BLANK, BLANK, BLANK],
        settings: {
            appearance: {
                homeBg: { color: "#e9edf2", image: "", opacity: 100, blur: 20 },
                iconBg: { color: "#ffffff", image: "", opacity: 85, blur: 20, showLabel: true, labelSize: 11, icons: JSON.parse(JSON.stringify(EMPTY_ICONS)) },
                chatBg: { color: "#f2f4f7", image: "", opacity: 100, blur: 20 },
                avatar: { color: "#dfe5ec", image: "", opacity: 100, blur: 0, size: 84, radius: 50, offsetY: 0, mode: "each" }
            },
            status: { color: "#8b909a", bgEnabled: false, bgColor: "#ffffff", bgOpacity: 60, bgBlur: 40 },
            bubble: { preset: "tail", radius: 16, height: 10, opacity: 100, bg: "#5b7fa6", border: false, borderColor: "#ffffff", css: "" },
            permission: { replyDelay: 3, activeEnabled: false, activeMin: 30, activeMax: 120, callEnabled: false, callMin: 60, callMax: 240, notify: false },
            font: { chat: 15, home: 16 }
        }
    };

    var appData = null;

    function $(id) { return document.getElementById(id); }
    function isPlainObject(v) { return !!v && typeof v === "object" && !Array.isArray(v); }

    function deepMerge(target, defaults) {
        var out = {};
        for (var key in defaults) {
            if (!Object.prototype.hasOwnProperty.call(defaults, key)) continue;
            if (isPlainObject(defaults[key])) {
                out[key] = deepMerge(isPlainObject(target[key]) ? target[key] : {}, defaults[key]);
            } else if (target[key] !== undefined && target[key] !== null) {
                out[key] = target[key];
            } else {
                out[key] = defaults[key];
            }
        }
        return out;
    }

    function clone(value) { return JSON.parse(JSON.stringify(value)); }

    function loadData() {
        var defaults = clone(DEFAULTS);
        appData = defaults;
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;
            var merged = {};
            for (var k in defaults) {
                if (!Object.prototype.hasOwnProperty.call(defaults, k)) continue;
                merged[k] = parsed[k] !== undefined && parsed[k] !== null ? parsed[k] : defaults[k];
            }
            merged.settings = deepMerge(isPlainObject(parsed.settings) ? parsed.settings : {}, defaults.settings);
            if (!Array.isArray(merged.widgetLines) || merged.widgetLines.length !== 4) merged.widgetLines = defaults.widgetLines.slice();
            if (!Array.isArray(merged.chatHistory)) merged.chatHistory = [];
            if (!Array.isArray(merged.stickers)) merged.stickers = [];
            if (!Array.isArray(merged.pats)) merged.pats = defaults.pats.slice();
            if (!Array.isArray(merged.cards)) merged.cards = [];
            if (!isPlainObject(merged.settings.appearance.iconBg.icons)) merged.settings.appearance.iconBg.icons = JSON.parse(JSON.stringify(EMPTY_ICONS));
            ICON_KEYS.forEach(function (k) {
                if (typeof merged.settings.appearance.iconBg.icons[k] !== "string") merged.settings.appearance.iconBg.icons[k] = "";
            });
            appData = merged;
        } catch (e) {
            appData = defaults;
        }
    }

    function saveData() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch (e) {} }

    function getPath(obj, path) {
        var parts = path.split("."), cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur === null || cur === undefined) return undefined;
            cur = cur[parts[i]];
        }
        return cur;
    }

    function setPath(obj, path, value) {
        var parts = path.split("."), cur = obj;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }

    /* 主题 */
    function prefersDark() { try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; } }
    function applyTheme() {
        var mode = appData && appData.themeMode ? appData.themeMode : "auto";
        var dark = mode === "dark" || (mode === "auto" && prefersDark());
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        var meta = document.querySelector("meta[name=\"theme-color\"]");
        if (meta) meta.setAttribute("content", dark ? "#000000" : "#eef1f5");
    }
    function watchTheme() {
        try {
            var mq = window.matchMedia("(prefers-color-scheme: dark)");
            var handler = function () { if (!appData || appData.themeMode === "auto") applyTheme(); };
            if (mq.addEventListener) mq.addEventListener("change", handler);
            else if (mq.addListener) mq.addListener(handler);
        } catch (e) {}
    }

    /* 路由 */
    var navStack = [];
    var entryReturn = "desktop";
    var REAL_PAGES = [
        "appearance", "appearance.home", "appearance.icon", "appearance.chat", "appearance.avatar",
        "status", "display", "bubble", "permission", "data", "about", "myinfo", "ta"
    ];

    function showScreen(id) {
        var all = document.querySelectorAll(".screen");
        for (var i = 0; i < all.length; i++) all[i].classList.toggle("active", all[i].id === id);
    }
    function renderNav() {
        var current = navStack.length ? navStack[navStack.length - 1] : "main";
        var pages = document.querySelectorAll(".set-page");
        for (var i = 0; i < pages.length; i++) pages[i].classList.toggle("active", pages[i].getAttribute("data-page") === current);
        var active = document.querySelector(".set-page.active");
        if (active) active.scrollTop = 0;
    }
    function openSettings(page, returnTo) {
        navStack = [page || "main"];
        entryReturn = returnTo === "settings" ? "settings" : "desktop";
        showScreen("settingsView");
        renderNav();
    }
    function pushPage(page) { navStack.push(page); renderNav(); }
    function popPage() {
        if (navStack.length > 1) { navStack.pop(); renderNav(); return; }
        if (entryReturn === "settings") { navStack = ["main"]; renderNav(); return; }
        goDesktop();
    }
    function goDesktop() {
        closeSheet(); closeMsgMenu(); closeDrawer();
        navStack = [];
        showScreen("desktopView");
    }

    /* 渲染基础 */
    function isImageSource(value) { return typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/.test(value); }
    function escAttr(value) { return String(value).replace(/"/g, "&quot;"); }
    function avatarMarkup(value, fallbackText) {
        if (isImageSource(value)) return '<img src="' + escAttr(value) + '" alt="">';
        return '<span class="avatar-text">' + fallbackText + "</span>";
    }

    function widgetAvatarMarkup() {
        var av = appData.settings.appearance.avatar;
        var src = isImageSource(appData.taAvatar) ? appData.taAvatar : (isImageSource(av.image) ? av.image : "");
        if (src) return '<img src="' + escAttr(src) + '" alt="">';
        return '<span class="avatar-text">Me</span>';
    }

    function renderWidget() {
        var lines = Array.isArray(appData.widgetLines) ? appData.widgetLines : [];
        for (var i = 0; i < 4; i++) {
            var el = $("wLine" + (i + 1));
            if (!el) continue;
            var value = lines[i];
            el.textContent = (typeof value === "string" && value.trim() && value !== BLANK) ? value : BLANK;
        }
        var widgetAvatar = $("widgetAvatar");
        if (widgetAvatar) widgetAvatar.innerHTML = widgetAvatarMarkup();

        var myName = $("settingsMyName");
        if (myName) myName.textContent = appData.myName || "your账户名";

        var accountAvatar = $("settingsMyAvatar");
        if (accountAvatar) {
            accountAvatar.innerHTML = isImageSource(appData.myAvatar)
                ? '<img src="' + escAttr(appData.myAvatar) + '" alt="">'
                : '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-person"></use></svg>';
        }

        var headerName = $("headerName");
        if (headerName) headerName.textContent = appData.taName || "他";

        var headerAvatar = $("headerAvatar");
        if (headerAvatar) headerAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");

        var callName = $("callName");
        if (callName) callName.textContent = appData.taName || "他";

        var callAvatar = $("callAvatar");
        if (callAvatar) callAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");

        var peekAvatar = $("peekAvatar");
        if (peekAvatar) peekAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");
    }

    function renderProfile() {
        var myAv = $("myProfileAvatar");
        if (myAv) {
            myAv.innerHTML = isImageSource(appData.myAvatar)
                ? '<img src="' + escAttr(appData.myAvatar) + '" alt="">'
                : '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-person"></use></svg>';
        }
        var taAv = $("taProfileAvatar");
        if (taAv) {
            taAv.innerHTML = isImageSource(appData.taAvatar)
                ? '<img src="' + escAttr(appData.taAvatar) + '" alt="">'
                : '<span class="emoji-avatar">🌙</span>';
        }
        var myInput = $("myProfileName");
        if (myInput && document.activeElement !== myInput) {
            myInput.value = appData.myName && appData.myName !== "your账户名" ? appData.myName : "";
        }
        var taInput = $("taProfileName");
        if (taInput && document.activeElement !== taInput) {
            taInput.value = appData.taName && appData.taName !== "他" ? appData.taName : "";
        }
    }

    function renderPreview() {
        var taMarkup = avatarMarkup(appData.taAvatar, "他");
        var myMarkup = avatarMarkup(appData.myAvatar, "Me");
        ["pvTaAvatar", "pvChatTa1", "pvChatTa2", "pvBubbleTa"].forEach(function (id) {
            var el = $(id); if (el) el.innerHTML = taMarkup;
        });
        ["pvMyAvatar", "pvBubbleMe"].forEach(function (id) {
            var el = $(id); if (el) el.innerHTML = myMarkup;
        });
    }

    /* 8 个图标的图片应用 */
    function applyIconImages() {
        var icons = appData.settings.appearance.iconBg.icons || {};
        var mainMap = { appLetter: "letter", appSettings: "settings", appCountdown: "countdown", appWidgets: "widgets" };
        Object.keys(mainMap).forEach(function (id) {
            var el = $(id);
            if (!el) return;
            var src = icons[mainMap[id]];
            var has = isImageSource(src);
            var box = el.querySelector(".app-icon-box");
            if (box) {
                if (has) box.style.backgroundImage = 'url("' + src + '")';
                else box.style.backgroundImage = "";
                box.classList.toggle("has-image", has);
            }
            el.classList.toggle("has-image", has);
        });

        var dockMap = { appChat: "chat", appCards: "cards", dockAppearance: "appearance", dockPermission: "permission" };
        Object.keys(dockMap).forEach(function (id) {
            var el = $(id);
            if (!el) return;
            var src = icons[dockMap[id]];
            var has = isImageSource(src);
            if (has) el.style.backgroundImage = 'url("' + src + '")';
            else el.style.backgroundImage = "";
            el.classList.toggle("has-image", has);
        });
    }

    /* 图标配置列表 */
    function renderIconConfigs() {
        var grid = $("iconCfgGrid");
        if (!grid) return;
        var icons = appData.settings.appearance.iconBg.icons || {};
        grid.innerHTML = "";

        ICON_LIST.forEach(function (item) {
            var src = icons[item.key];
            var has = isImageSource(src);

            var row = document.createElement("div");
            row.className = "icon-cfg";

            var preview = document.createElement("span");
            preview.className = "icon-cfg-preview" + (has ? " has-image" : "");
            if (has) preview.style.backgroundImage = 'url("' + src + '")';
            preview.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + item.symbol + '"></use></svg>';

            var name = document.createElement("span");
            name.className = "icon-cfg-name";
            name.textContent = item.label;

            var actions = document.createElement("div");
            actions.className = "icon-cfg-actions";

            var upload = document.createElement("label");
            upload.className = "mini-btn";
            upload.textContent = "上传";
            var file = document.createElement("input");
            file.type = "file";
            file.accept = "image/*";
            file.hidden = true;
            file.setAttribute("data-icon-upload", item.key);
            upload.appendChild(file);

            var clear = document.createElement("button");
            clear.type = "button";
            clear.className = "mini-btn danger";
            clear.textContent = "清除";
            clear.setAttribute("data-icon-clear", item.key);

            actions.appendChild(upload);
            actions.appendChild(clear);

            row.appendChild(preview);
            row.appendChild(name);
            row.appendChild(actions);
            grid.appendChild(row);
        });
    }

    /* 聊天渲染 */
    function fmtTime(ts) {
        var d = new Date(ts);
        var h = d.getHours(), m = d.getMinutes();
        return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
    }

    function appendSystem(container, text) {
        var el = document.createElement("div");
        el.className = "msg-status";
        el.textContent = text;
        container.appendChild(el);
    }

    function renderChat() {
        var container = $("chatMessages");
        if (!container) return;
        container.innerHTML = "";

        var history = Array.isArray(appData.chatHistory) ? appData.chatHistory : [];
        if (history.length === 0) {
            var empty = document.createElement("p");
            empty.className = "empty-hint";
            empty.textContent = "还没有聊天记录";
            container.appendChild(empty);
            return;
        }

        var lastStamp = 0;
        var lastFrom = null;
        var mode = appData.settings.appearance.avatar.mode;

        history.forEach(function (msg, index) {
            if (!msg) return;

            if (msg.time) {
                if (!lastStamp || msg.time - lastStamp > 5 * 60 * 1000) {
                    var t = document.createElement("div");
                    t.className = "msg-time";
                    t.textContent = msg.timeText || fmtTime(msg.time);
                    container.appendChild(t);
                }
                lastStamp = msg.time;
            }

            if (msg.type === "status" || msg.type === "call") {
                appendSystem(container, msg.text || "");
                lastFrom = null;
                return;
            }

            var row = document.createElement("div");
            row.className = "msg-row " + (msg.from === "me" ? "me" : "ta");

            var hideAvatar = (mode === "first" && lastFrom === msg.from);
            var av = document.createElement("span");
            av.className = "msg-avatar" + (hideAvatar ? " ghost" : "");
            av.innerHTML = msg.from === "me"
                ? avatarMarkup(appData.myAvatar, "Me")
                : avatarMarkup(appData.taAvatar, "他");

            var wrap = document.createElement("div");
            wrap.className = "msg-wrap";

            var bubble = document.createElement("div");
            bubble.className = "msg-bubble";
            bubble.setAttribute("data-index", String(index));

            if (msg.quote) {
                var q = document.createElement("div");
                q.className = "msg-quote";
                q.textContent = msg.quote;
                bubble.appendChild(q);
            }

            if (msg.type === "image" || msg.type === "sticker") {
                var img = document.createElement("img");
                img.src = msg.text || "";
                img.style.maxWidth = "140px";
                img.style.borderRadius = "10px";
                img.style.display = "block";
                bubble.appendChild(img);
            } else {
                var span = document.createElement("span");
                span.textContent = msg.text || "";
                bubble.appendChild(span);
            }

            wrap.appendChild(bubble);

            if (msg.from === "me" && msg.status) {
                var s = document.createElement("div");
                s.className = "msg-status-text";
                s.textContent = msg.status;
                wrap.appendChild(s);
            }

            row.appendChild(av);
            row.appendChild(wrap);
            container.appendChild(row);
            lastFrom = msg.from;
        });

        container.scrollTop = container.scrollHeight;
    }

    /* 消息菜单 */
    var menuIndex = -1;
    var quoteTarget = null;

    function openMsgMenu(bubble) {
        var menu = $("msgMenu");
        if (!menu) return;
        menuIndex = Number(bubble.getAttribute("data-index"));
        menu.hidden = false;
        menu.style.visibility = "hidden";
        menu.style.left = "0px";
        menu.style.top = "0px";

        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        var rect = bubble.getBoundingClientRect();
        var left = rect.left + rect.width / 2 - mw / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));
        var top = rect.top - mh - 10;
        if (top < 60) top = rect.bottom + 10;

        menu.style.left = left + "px";
        menu.style.top = top + "px";
        menu.style.visibility = "";
    }

    function closeMsgMenu() { var menu = $("msgMenu"); if (menu) menu.hidden = true; menuIndex = -1; }

    function quoteMessage() {
        var msg = appData.chatHistory[menuIndex];
        if (!msg) return;
        var who = msg.from === "me" ? (appData.myName || "我") : (appData.taName || "他");
        var text = msg.text || "";
        quoteTarget = who + "：" + (text.length > 20 ? text.slice(0, 20) + "…" : text);
        var bar = $("quoteBar"), label = $("quoteText");
        if (label) label.textContent = quoteTarget;
        if (bar) bar.hidden = false;
        var input = $("chatInput");
        if (input) input.focus();
    }

    function clearQuote() { quoteTarget = null; var bar = $("quoteBar"); if (bar) bar.hidden = true; }

    function deleteMessage() {
        if (menuIndex < 0) return;
        appData.chatHistory.splice(menuIndex, 1);
        saveData(); renderChat();
    }

    /* 发送 */
    function updateSendBtn() {
        var input = $("chatInput"), btn = $("btnChatSend");
        if (!input || !btn) return;
        btn.classList.toggle("active", input.value.trim().length > 0);
    }
    function autoGrow() {
        var input = $("chatInput");
        if (!input) return;
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 100) + "px";
    }
    function sendMessage() {
        var input = $("chatInput");
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        var msg = { from: "me", text: text, type: "text", time: Date.now(), status: "已送达" };
        if (quoteTarget) msg.quote = quoteTarget;
        appData.chatHistory.push(msg);
        saveData();
        input.value = "";
        input.style.height = "auto";
        clearQuote();
        updateSendBtn();
        renderChat();
    }

    /* 抽屉 */
    function openDrawer(tab) {
        var mask = $("drawerMask"), drawer = $("chatDrawer");
        if (mask) mask.classList.add("open");
        if (drawer) drawer.classList.add("open");
        switchTab(tab || "media");
        renderStickers();
        renderPats();
    }
    function closeDrawer() {
        var mask = $("drawerMask"), drawer = $("chatDrawer");
        if (mask) mask.classList.remove("open");
        if (drawer) drawer.classList.remove("open");
    }
    function switchTab(name) {
        var tabs = document.querySelectorAll(".drawer-tab");
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
        var panes = document.querySelectorAll(".drawer-pane");
        for (var j = 0; j < panes.length; j++) panes[j].classList.toggle("active", panes[j].getAttribute("data-pane") === name);
    }

    function renderStickers() {
        var grid = $("stickerGrid");
        if (!grid) return;
        grid.innerHTML = "";
        var list = Array.isArray(appData.stickers) ? appData.stickers : [];
        if (!list.length) {
            var p = document.createElement("div");
            p.className = "sticker-empty";
            p.textContent = "还没有表情，上传一张试试";
            grid.appendChild(p);
            return;
        }
        list.forEach(function (src, i) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sticker-cell";
            btn.setAttribute("data-sticker", String(i));
            var img = document.createElement("img");
            img.src = src; img.alt = "";
            btn.appendChild(img);
            grid.appendChild(btn);
        });
    }

    function renderPats() {
        var list = $("patList");
        if (!list) return;
        list.innerHTML = "";
        var arr = Array.isArray(appData.pats) ? appData.pats : [];
        if (!arr.length) {
            var p = document.createElement("div");
            p.className = "sticker-empty";
            p.textContent = "还没有文案，添加一条";
            list.appendChild(p);
            return;
        }
        arr.forEach(function (text, i) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pat-chip";
            btn.setAttribute("data-pat", String(i));
            btn.textContent = text;
            list.appendChild(btn);
        });
    }

    function sendStickerAt(i) {
        var src = appData.stickers[i];
        if (!src) return;
        appData.chatHistory.push({ from: "me", type: "sticker", text: src, time: Date.now(), status: "已送达" });
        saveData(); renderChat(); closeDrawer();
    }

    function sendPatAt(i) {
        var text = appData.pats[i];
        if (!text) return;
        appData.chatHistory.push({ type: "status", text: "—— " + text + " ——", time: Date.now() });
        saveData(); renderChat(); closeDrawer();
    }

    function addPat() {
        var input = $("patInput");
        var text = input ? input.value.trim() : "";
        if (!text) return;
        var sync = $("patSync") && $("patSync").checked;
        appData.pats.push(text);
        if (sync) appData.cards.push({ type: "pat", content: text, createdAt: Date.now() });
        saveData();
        if (input) input.value = "";
        renderPats();
    }

    function sendMedia(input) {
        var file = input.files && input.files[0];
        if (!file) return;
        readImageFile(file, function (result) {
            appData.chatHistory.push({ from: "me", type: "image", text: result, time: Date.now(), status: "已送达" });
            saveData(); renderChat(); closeDrawer();
        });
        input.value = "";
    }

    /* 拍一拍弹窗 */
    function openPeek() { var m = $("peekMask"); if (m) m.hidden = false; }
    function closePeek() { var m = $("peekMask"); if (m) m.hidden = true; }
    function sendPeek() {
        appData.chatHistory.push({ type: "status", text: "—— 拍了拍他 ——", time: Date.now() });
        saveData(); renderChat(); closePeek();
    }

    /* 通话状态机 */
    var call = {
        state: "idle", seconds: 0,
        connectTimer: null, rejectTimer: null, taTimer: null, tickTimer: null, closeTimer: null
    };

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtDuration(sec) {
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return pad(m) + ":" + pad(s);
    }

    function clearCallTimers() {
        if (call.connectTimer) clearTimeout(call.connectTimer);
        if (call.rejectTimer) clearTimeout(call.rejectTimer);
        if (call.taTimer) clearTimeout(call.taTimer);
        if (call.tickTimer) clearInterval(call.tickTimer);
        if (call.closeTimer) clearTimeout(call.closeTimer);
        call.connectTimer = call.rejectTimer = call.taTimer = call.tickTimer = call.closeTimer = null;
    }

    function updateCallClock() {
        var text = call.state === "calling" ? "呼叫中…" : fmtDuration(call.seconds);
        var t = $("callTimer");
        if (t) t.textContent = text;
        var p = $("callPillTime");
        if (p) p.textContent = text;
    }
    function setCallStateText(text) { var el = $("callState"); if (el) el.textContent = text; }
    function showCallScreen() {
        var screen = $("callScreen"), pill = $("callPill");
        if (screen) screen.hidden = false;
        if (pill) pill.hidden = true;
    }
    function hideCallScreen() { var screen = $("callScreen"); if (screen) screen.hidden = true; }

    function startCall() {
        clearCallTimers();
        call.state = "calling";
        call.seconds = 0;
        setCallStateText("正在呼叫…");
        updateCallClock();
        showCallScreen();

        var connectDelay = (1 + Math.random() * 29) * 1000;
        var willReject = Math.random() < 0.28;
        var rejectDelay = Math.max(2000, connectDelay * (0.25 + Math.random() * 0.6));

        call.connectTimer = setTimeout(onCallConnected, connectDelay);
        if (willReject && rejectDelay < connectDelay) {
            call.rejectTimer = setTimeout(function () {
                if (call.state !== "calling") return;
                finishCall("rejected");
            }, rejectDelay);
        }
    }

    function onCallConnected() {
        if (call.state !== "calling") return;
        call.state = "ongoing";
        setCallStateText("通话中");
        updateCallClock();
        call.tickTimer = setInterval(function () {
            call.seconds++;
            updateCallClock();
        }, 1000);

        if (Math.random() < 0.7) {
            var after = (15 + Math.random() * 45) * 1000;
            call.taTimer = setTimeout(function () {
                if (call.state !== "ongoing") return;
                finishCall("taHangup");
            }, after);
        }
    }

    function finishCall(reason) {
        if (call.state === "idle" || call.state === "ended") return;
        var wasOngoing = call.state === "ongoing";
        clearCallTimers();
        call.state = "ended";

        var label = "通话结束";
        var record = "";

        if (reason === "rejected") { label = "对方已拒绝"; record = "对方已拒绝"; }
        else if (reason === "cancelled") { label = "已取消"; record = "已取消"; }
        else if (reason === "taHangup") { label = "通话结束"; record = "语音通话 时长 " + fmtDuration(call.seconds) + " · 对方已挂断"; }
        else {
            label = "通话结束";
            record = wasOngoing ? "语音通话 时长 " + fmtDuration(call.seconds) : "已取消";
        }

        setCallStateText(label);
        appData.chatHistory.push({ type: "call", text: record, time: Date.now() });
        saveData();

        var pill = $("callPill");
        if (pill) pill.hidden = true;

        call.closeTimer = setTimeout(function () {
            hideCallScreen();
            goDesktop();
            call.state = "idle";
        }, 1400);
    }

    function endCallByMe() {
        if (call.state === "calling") { finishCall("cancelled"); return; }
        if (call.state === "ongoing") { finishCall("meHangup"); return; }
    }
    function minimizeCall() {
        if (call.state !== "calling" && call.state !== "ongoing") return;
        hideCallScreen();
        var pill = $("callPill");
        if (pill) pill.hidden = false;
        updateCallClock();
    }
    function restoreCall() {
        var pill = $("callPill");
        if (pill) pill.hidden = true;
        if (call.state === "calling" || call.state === "ongoing") showCallScreen();
    }

    /* 设置控件 */
    function hexToRgba(hex, alpha) {
        if (typeof hex !== "string") return "rgba(255,255,255," + alpha + ")";
        var h = hex.replace("#", "");
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
        return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }
    function unitOf(key) {
        var el = document.querySelector('[data-key="' + key + '"]');
        return el && el.dataset && el.dataset.unit ? el.dataset.unit : "";
    }
    function updateValLabel(key, value) {
        var labels = document.querySelectorAll('[data-val="' + key + '"]');
        var text = value + unitOf(key);
        for (var i = 0; i < labels.length; i++) labels[i].textContent = text;
    }
    function renderControls() {
        var inputs = document.querySelectorAll("[data-key]");
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var key = el.getAttribute("data-key");
            var value = getPath(appData.settings, key);
            if (value === undefined || value === null) continue;
            if (el.type === "checkbox") el.checked = !!value;
            else el.value = value;
            if (el.type === "range") updateValLabel(key, value);
        }
        var seg = document.querySelector('[data-segment="appearance.avatar.mode"]');
        if (seg) {
            var mode = appData.settings.appearance.avatar.mode;
            var btns = seg.querySelectorAll("[data-mode]");
            for (var j = 0; j < btns.length; j++) btns[j].classList.toggle("active", btns[j].getAttribute("data-mode") === mode);
        }
        var cards = document.querySelectorAll("[data-preset]");
        var preset = appData.settings.bubble.preset;
        for (var k = 0; k < cards.length; k++) cards[k].classList.toggle("selected", cards[k].getAttribute("data-preset") === preset);
    }

    function applySettings() {
        var s = appData.settings, a = s.appearance;
        var root = document.documentElement, css = root.style;

        css.setProperty("--home-bg-color", hexToRgba(a.homeBg.color, a.homeBg.opacity / 100));
        css.setProperty("--home-bg-image", a.homeBg.image ? "url(" + a.homeBg.image + ")" : "none");
        css.setProperty("--home-blur", (a.homeBg.blur / 100 * 30) + "px");

        /* 图标背景：颜色 / 透明度 / 磨砂度 → 8 个图标共用 */
        css.setProperty("--icon-bg-color", hexToRgba(a.iconBg.color, a.iconBg.opacity / 100));
        css.setProperty("--icon-blur", (a.iconBg.blur / 100 * 30) + "px");
        css.setProperty("--app-label-size", (a.iconBg.labelSize || 11) + "px");
        root.classList.toggle("hide-app-label", a.iconBg.showLabel === false);

        css.setProperty("--chat-bg-color", hexToRgba(a.chatBg.color, a.chatBg.opacity / 100));
        css.setProperty("--chat-bg-image", a.chatBg.image ? "url(" + a.chatBg.image + ")" : "none");

        css.setProperty("--avatar-size", (a.avatar.size || 84) + "px");
        css.setProperty("--avatar-radius", (a.avatar.radius === undefined ? 50 : a.avatar.radius) + "px");
        css.setProperty("--avatar-offset-y", (a.avatar.offsetY || 0) + "px");
        css.setProperty("--avatar-bg", hexToRgba(a.avatar.color, a.avatar.opacity / 100));

        css.setProperty("--bubble-bg", hexToRgba(s.bubble.bg, s.bubble.opacity / 100));
        css.setProperty("--bubble-radius", s.bubble.radius + "px");
        css.setProperty("--bubble-pad-y", s.bubble.height + "px");
        css.setProperty("--bubble-border", s.bubble.border ? ("1px solid " + s.bubble.borderColor) : "none");

        css.setProperty("--status-color", s.status.color);
        css.setProperty("--status-bg", s.status.bgEnabled ? hexToRgba(s.status.bgColor, s.status.bgOpacity / 100) : "transparent");
        css.setProperty("--status-blur", (s.status.bgBlur / 100 * 30) + "px");

        css.setProperty("--font-chat", s.font.chat + "px");
        css.setProperty("--font-home", s.font.home + "px");
        css.setProperty("--home-scale", s.font.home / 16);

        root.setAttribute("data-avatar-mode", a.avatar.mode || "each");

        applyIconImages();

        var custom = $("bubbleCustom");
        if (custom) custom.textContent = s.bubble.css || "";
    }

    /* 编辑面板 */
    var sheetOpen = false;
    function openSheet() {
        var lines = Array.isArray(appData.widgetLines) ? appData.widgetLines : [];
        for (var i = 0; i < 4; i++) {
            var input = $("sheetLine" + (i + 1));
            if (!input) continue;
            var v = lines[i];
            input.value = (typeof v === "string" && v !== BLANK) ? v : "";
        }
        var mask = $("sheetMask"), sheet = $("editSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
        sheetOpen = true;
    }
    function closeSheet() {
        var mask = $("sheetMask"), sheet = $("editSheet");
        if (mask) mask.classList.remove("show");
        if (sheet) sheet.classList.remove("show");
        sheetOpen = false;
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
    function saveSheet() {
        var next = [];
        for (var i = 0; i < 4; i++) {
            var input = $("sheetLine" + (i + 1));
            var value = input ? input.value.trim() : "";
            next.push(value || BLANK);
        }
        appData.widgetLines = next;
        saveData(); renderWidget(); closeSheet();
    }

    /* 图片 / 数据 */
    function readImageFile(file, cb) {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert("图片太大，请选择 2MB 以内的图片"); return; }
        var reader = new FileReader();
        reader.onload = function () { cb(reader.result); };
        reader.readAsDataURL(file);
    }

    function handleUpload(input) {
        var path = input.getAttribute("data-upload");
        if (!path) return;
        readImageFile(input.files && input.files[0], function (result) {
            setPath(appData.settings, path, result);
            saveData(); applySettings(); renderWidget(); renderPreview();
        });
        input.value = "";
    }

    function saveProfile(field, inputId) {
        var input = $(inputId);
        if (!input) return;
        appData[field] = input.value.trim();
        saveData(); renderWidget(); renderPreview(); renderChat();
    }

    function exportData() {
        try {
            var blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url; a.download = "philos-backup.json";
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
        } catch (e) { alert("导出失败，请重试"); }
    }

    function importData(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var parsed = JSON.parse(reader.result);
                if (!parsed || typeof parsed !== "object") throw new Error("bad");
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                refreshAll();
                alert("导入成功");
            } catch (e) { alert("导入失败：文件格式不正确"); }
        };
        reader.readAsText(file);
    }

    function clearData() {
        if (!confirm("将清空聊天记录、字卡、信笺和全部设置，且无法恢复。确定继续吗？")) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        refreshAll();
        alert("已清空");
    }

    function testNotify() {
        if (!("Notification" in window)) { alert("这个浏览器不支持系统通知"); return; }
        Notification.requestPermission().then(function (perm) {
            if (perm === "granted") { try { new Notification("☆Philos", { body: "这是一条测试通知" }); } catch (e) {} }
            else alert("通知权限未开启，请到系统设置里允许");
        });
    }

    function refreshAll() {
        loadData();
        applyTheme();
        renderWidget();
        renderProfile();
        renderPreview();
        renderChat();
        renderStickers();
        renderPats();
        renderControls();
        renderIconConfigs();
        applySettings();
    }

    /* 事件 */
    function handleControl(el) {
        var key = el.getAttribute("data-key");
        if (!key) return;
        var value;
        if (el.type === "checkbox") value = el.checked;
        else if (el.type === "range") value = Number(el.value);
        else value = el.value;
        setPath(appData.settings, key, value);
        if (el.type === "range") updateValLabel(key, value);
        saveData(); applySettings();
    }

    function on(id, evt, fn) {
        var el = $(id);
        if (el) el.addEventListener(evt, fn);
    }

    function bindEvents() {
        on("appChat", "click", function () { renderChat(); showScreen("chatView"); });
        on("appCards", "click", function () { showScreen("cardsView"); });
        on("appLetter", "click", function () { showScreen("letterView"); });
        on("appCountdown", "click", function () { showScreen("countdownView"); });
        on("appWidgets", "click", function () { showScreen("widgetsView"); });
        on("appSettings", "click", function () { openSettings("main", "desktop"); });
        on("dockAppearance", "click", function () { openSettings("appearance", "desktop"); });
        on("dockPermission", "click", function () { openSettings("permission", "desktop"); });

        ["btnChatBack", "btnCardsBack", "btnCountdownBack", "btnLetterBack", "btnWidgetsBack"].forEach(function (id) {
            on(id, "click", goDesktop);
        });

        on("btnChatCall", "click", startCall);
        on("callMin", "click", minimizeCall);
        on("callEnd", "click", endCallByMe);
        on("callPill", "click", restoreCall);

        on("btnChatMore", "click", function () { openDrawer("media"); });
        on("drawerMask", "click", closeDrawer);
        on("pickGallery", "click", function () { var f = $("mediaFile"); if (f) f.click(); });
        on("pickCamera", "click", function () { var f = $("cameraFile"); if (f) f.click(); });
        on("mediaFile", "change", function () { sendMedia(this); });
        on("cameraFile", "change", function () { sendMedia(this); });
        on("patAdd", "click", addPat);
        on("patInput", "keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addPat(); } });

        on("stickerFile", "change", function () {
            var self = this;
            var sync = $("stickerSync") && $("stickerSync").checked;
            readImageFile(this.files && this.files[0], function (result) {
                appData.stickers.push(result);
                if (sync) appData.cards.push({ type: "sticker", content: result, createdAt: Date.now() });
                saveData(); renderStickers();
            });
            self.value = "";
        });

        on("myProfileAvatar", "click", function () { var f = $("myProfileFile"); if (f) f.click(); });
        on("taProfileAvatar", "click", function () { var f = $("taProfileFile"); if (f) f.click(); });

        on("myProfileFile", "change", function () {
            var self = this;
            readImageFile(this.files && this.files[0], function (result) {
                appData.myAvatar = result;
                saveData(); renderWidget(); renderProfile(); renderPreview(); renderChat();
            });
            self.value = "";
        });
        on("taProfileFile", "change", function () {
            var self = this;
            readImageFile(this.files && this.files[0], function (result) {
                appData.taAvatar = result;
                saveData(); renderWidget(); renderProfile(); renderPreview(); renderChat();
            });
            self.value = "";
        });

        on("myProfileName", "input", function () { saveProfile("myName", "myProfileName"); });
        on("myProfileName", "blur", function () { saveProfile("myName", "myProfileName"); });
        on("taProfileName", "input", function () { saveProfile("taName", "taProfileName"); });
        on("taProfileName", "blur", function () { saveProfile("taName", "taProfileName"); });

        on("btnExportData", "click", exportData);
        on("importFile", "change", function () { importData(this.files && this.files[0]); this.value = ""; });
        on("btnClearData", "click", clearData);
        on("btnTestNotify", "click", testNotify);

        on("chatInput", "input", function () { autoGrow(); updateSendBtn(); });
        on("btnChatSend", "click", sendMessage);
        on("quoteClose", "click", clearQuote);

        var msgs = $("chatMessages");
        if (msgs) {
            msgs.addEventListener("contextmenu", function (e) { e.preventDefault(); });
            msgs.addEventListener("click", function (e) {
                var t = e.target;
                var bubble = t && t.closest ? t.closest(".msg-bubble") : null;
                if (bubble) { openMsgMenu(bubble); return; }
                closeMsgMenu();
            });
            msgs.addEventListener("scroll", closeMsgMenu);
        }

        var menu = $("msgMenu");
        if (menu) {
            menu.addEventListener("click", function (e) {
                var btn = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
                if (!btn) return;
                var act = btn.getAttribute("data-act");
                if (act === "quote") quoteMessage();
                if (act === "delete") deleteMessage();
                closeMsgMenu();
            });
        }

        /* 图标配置：上传 / 清除 */
        document.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var clearBtn = t.closest("[data-icon-clear]");
            if (clearBtn) {
                var key = clearBtn.getAttribute("data-icon-clear");
                appData.settings.appearance.iconBg.icons[key] = "";
                saveData();
                applySettings();
                renderIconConfigs();
                return;
            }

            if (!t.closest("#msgMenu") && !t.closest(".msg-bubble")) closeMsgMenu();

            var tabBtn = t.closest("[data-tab]");
            if (tabBtn) { switchTab(tabBtn.getAttribute("data-tab")); return; }

            var stickerBtn = t.closest("[data-sticker]");
            if (stickerBtn) { sendStickerAt(Number(stickerBtn.getAttribute("data-sticker"))); return; }

            var patBtn = t.closest("[data-pat]");
            if (patBtn) { sendPatAt(Number(patBtn.getAttribute("data-pat"))); return; }

            var back = t.closest('[data-nav="back"]');
            if (back) { popPage(); return; }

            var gotoEl = t.closest("[data-goto]");
            if (gotoEl) {
                var target = gotoEl.getAttribute("data-goto");
                if (REAL_PAGES.indexOf(target) >= 0) pushPage(target);
                return;
            }

            var presetEl = t.closest("[data-preset]");
            if (presetEl) {
                appData.settings.bubble.preset = presetEl.getAttribute("data-preset");
                saveData(); renderControls(); applySettings();
                return;
            }

            var segmentEl = t.closest("[data-mode]");
            if (segmentEl) {
                appData.settings.appearance.avatar.mode = segmentEl.getAttribute("data-mode");
                saveData(); renderControls(); applySettings(); renderChat();
                return;
            }
        });

        document.addEventListener("input", function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            if (el.getAttribute("data-key")) handleControl(el);
        });

        document.addEventListener("change", function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;

            var iconKey = el.getAttribute("data-icon-upload");
            if (iconKey) {
                var self = el;
                readImageFile(el.files && el.files[0], function (result) {
                    appData.settings.appearance.iconBg.icons[iconKey] = result;
                    saveData();
                    applySettings();
                    renderIconConfigs();
                });
                self.value = "";
                return;
            }

            if (el.getAttribute("data-upload")) handleUpload(el);
        });

        var textArea = $("widgetTextArea");
        if (textArea) {
            textArea.addEventListener("click", openSheet);
            textArea.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSheet(); }
            });
        }

        on("sheetMask", "click", closeSheet);
        on("sheetCancel", "click", closeSheet);
        on("sheetSave", "click", saveSheet);

        var sheet = $("editSheet");
        if (sheet) sheet.addEventListener("keydown", function (e) { if (e.key === "Enter") saveSheet(); });

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", function () {
                if (!sheetOpen) return;
                var el = $("editSheet");
                if (!el) return;
                var offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
                el.style.bottom = "calc(env(safe-area-inset-bottom) + 12px + " + offset + "px)";
            });
        }

        window.addEventListener("popstate", function () {
            var screen = $("callScreen");
            if (screen && !screen.hidden) { endCallByMe(); return; }
            if (sheetOpen) { closeSheet(); return; }
            var active = document.querySelector(".screen.active");
            if (active && active.id === "settingsView") { popPage(); return; }
            if (active && active.id !== "desktopView") goDesktop();
        });
    }

    /* 启动 */
    function hideSplash() {
        setTimeout(function () {
            var splash = $("splash");
            if (!splash) return;
            splash.classList.add("hide");
            setTimeout(function () { splash.style.display = "none"; }, 520);
        }, 600);
    }

    function registerSW() {
        if (!("serviceWorker" in navigator)) return;
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("./service-worker.js").catch(function () {});
        });
    }

    function init() {
        loadData();
        applyTheme();
        watchTheme();
        renderWidget();
        renderProfile();
        renderPreview();
        renderChat();
        renderStickers();
        renderPats();
        renderIconConfigs();
        renderControls();
        applySettings();
        bindEvents();
        updateSendBtn();
        hideSplash();
        registerSW();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
