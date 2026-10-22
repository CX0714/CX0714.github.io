/* =========================================================
   Philos · 2.3
   聊天 / 通话 / 状态提示
   ========================================================= */
(function () {
    "use strict";

    var STORAGE_KEY = "private_chat_app_v1";
    var BLANK = "______";

    var DEFAULTS = {
        taName: "他",
        taAvatar: "",
        myName: "your账户名",
        myAvatar: "",
        chatHistory: [],
        cards: [],
        anniversaries: [],
        letters: [],
        themeMode: "auto",
        widgetLines: [BLANK, BLANK, BLANK, BLANK],
        settings: {
            appearance: {
                homeBg: { color: "#e9edf2", image: "", opacity: 100, blur: 20 },
                iconBg: { color: "#ffffff", image: "", opacity: 85, blur: 20, showLabel: true, labelSize: 11 },
                chatBg: { color: "#f2f4f7", image: "", opacity: 100, blur: 20 },
                avatar: { color: "#dfe5ec", image: "", opacity: 100, blur: 0, size: 84, radius: 50, mode: "each" }
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

    /* ---------------- 主题 ---------------- */
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

    /* ---------------- 路由 ---------------- */
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
        for (var i = 0; i < pages.length; i++) {
            pages[i].classList.toggle("active", pages[i].getAttribute("data-page") === current);
        }
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
        closeSheet();
        closeMsgMenu();
        navStack = [];
        showScreen("desktopView");
    }

    /* ---------------- 渲染基础 ---------------- */
    function isImageSource(value) {
        return typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/.test(value);
    }

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
            var el = $(id);
            if (el) el.innerHTML = taMarkup;
        });
        ["pvMyAvatar", "pvBubbleMe"].forEach(function (id) {
            var el = $(id);
            if (el) el.innerHTML = myMarkup;
        });
    }

    /* ---------------- 聊天渲染 ---------------- */
    function fmtTime(ts) {
        var d = new Date(ts);
        var h = d.getHours(), m = d.getMinutes();
        return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
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

            if (msg.type === "status") {
                var st = document.createElement("div");
                st.className = "msg-status";
                st.textContent = msg.text || "";
                container.appendChild(st);
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

    /* ---------------- 消息菜单 ---------------- */
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

        var mw = menu.offsetWidth;
        var mh = menu.offsetHeight;
        var rect = bubble.getBoundingClientRect();
        var left = rect.left + rect.width / 2 - mw / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));
        var top = rect.top - mh - 10;
        if (top < 60) top = rect.bottom + 10;

        menu.style.left = left + "px";
        menu.style.top = top + "px";
        menu.style.visibility = "";
    }

    function closeMsgMenu() {
        var menu = $("msgMenu");
        if (menu) menu.hidden = true;
        menuIndex = -1;
    }

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

    function clearQuote() {
        quoteTarget = null;
        var bar = $("quoteBar");
        if (bar) bar.hidden = true;
    }

    function deleteMessage() {
        if (menuIndex < 0) return;
        appData.chatHistory.splice(menuIndex, 1);
        saveData();
        renderChat();
    }

    /* ---------------- 发送 ---------------- */
    function updateSendBtn() {
        var input = $("chatInput");
        var btn = $("btnChatSend");
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

    /* ---------------- 拍一拍 ---------------- */
    function openPeek() {
        var mask = $("peekMask");
        if (mask) mask.hidden = false;
    }

    function closePeek() {
        var mask = $("peekMask");
        if (mask) mask.hidden = true;
    }

    function sendPeek() {
        appData.chatHistory.push({ type: "status", text: "—— 拍了拍他 ——", time: Date.now() });
        saveData();
        renderChat();
        closePeek();
    }

    /* ---------------- 通话 ---------------- */
    var callTimerId = null;
    var callSeconds = 0;
    var callState = "ongoing";

    function pad(n) { return n < 10 ? "0" + n : "" + n; }

    function fmtDuration(sec) {
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return pad(m) + ":" + pad(s);
    }

    function updateCallClock() {
        var text = fmtDuration(callSeconds);
        var t = $("callTimer");
        if (t) t.textContent = text;
        var p = $("callPillTime");
        if (p) p.textContent = text;
    }

    function startClock() {
        if (callTimerId) clearInterval(callTimerId);
        callTimerId = setInterval(function () {
            callSeconds++;
            updateCallClock();
        }, 1000);
    }

    function stopClock() {
        if (callTimerId) clearInterval(callTimerId);
        callTimerId = null;
    }

    function setCallUI(state) {
        callState = state;
        var stateEl = $("callState");
        var minBtn = $("callMin");
        var minLabel = $("callMinLabel");
        var minIcon = $("callMinIcon");

        if (state === "incoming") {
            if (stateEl) stateEl.textContent = "来电中";
            if (minBtn) minBtn.classList.add("answer");
            if (minLabel) minLabel.textContent = "接听";
            if (minIcon) minIcon.classList.add("call-answer-icon");
        } else {
            if (stateEl) stateEl.textContent = "通话中";
            if (minBtn) minBtn.classList.remove("answer");
            if (minLabel) minLabel.textContent = "最小化";
            if (minIcon) minIcon.classList.remove("call-answer-icon");
        }
    }

    function openCall(incoming) {
        var screen = $("callScreen");
        var pill = $("callPill");
        if (!screen) return;
        screen.hidden = false;
        if (pill) pill.hidden = true;
        callSeconds = 0;
        updateCallClock();
        stopClock();
        setCallUI(incoming ? "incoming" : "ongoing");
        if (!incoming) startClock();
    }

    function endCall() {
        stopClock();
        var screen = $("callScreen");
        var pill = $("callPill");
        if (screen) screen.hidden = true;
        if (pill) pill.hidden = true;
        callSeconds = 0;
        updateCallClock();
    }

    function handleCallAction() {
        var screen = $("callScreen");
        if (callState === "incoming") {
            setCallUI("ongoing");
            startClock();
            return;
        }
        if (screen) screen.hidden = true;
        var pill = $("callPill");
        if (pill) pill.hidden = false;
    }

    function restoreCall() {
        var pill = $("callPill");
        var screen = $("callScreen");
        if (pill) pill.hidden = true;
        if (screen) screen.hidden = false;
    }

    /* ---------------- 设置控件 ---------------- */
    function hexToRgba(hex, alpha) {
        if (typeof hex !== "string") return "rgba(255,255,255," + alpha + ")";
        var h = hex.replace("#", "");
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.substring(0, 2), 16);
        var g = parseInt(h.substring(2, 4), 16);
        var b = parseInt(h.substring(4, 6), 16);
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

        css.setProperty("--icon-bg-color", hexToRgba(a.iconBg.color, a.iconBg.opacity / 100));
        css.setProperty("--icon-bg-image", a.iconBg.image ? "url(" + a.iconBg.image + ")" : "none");
        css.setProperty("--icon-blur", (a.iconBg.blur / 100 * 30) + "px");
        css.setProperty("--app-label-size", (a.iconBg.labelSize || 11) + "px");
        root.classList.toggle("hide-app-label", a.iconBg.showLabel === false);

        css.setProperty("--chat-bg-color", hexToRgba(a.chatBg.color, a.chatBg.opacity / 100));
        css.setProperty("--chat-bg-image", a.chatBg.image ? "url(" + a.chatBg.image + ")" : "none");

        css.setProperty("--avatar-size", (a.avatar.size || 84) + "px");
        css.setProperty("--avatar-radius", (a.avatar.radius === undefined ? 50 : a.avatar.radius) + "px");
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

        var custom = $("bubbleCustom");
        if (custom) custom.textContent = s.bubble.css || "";
    }

    /* ---------------- 编辑面板 ---------------- */
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
        saveData();
        renderWidget();
        closeSheet();
    }

    /* ---------------- 图片 / 数据 ---------------- */
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
            saveData();
            applySettings();
            renderWidget();
            renderPreview();
        });
        input.value = "";
    }

    function saveProfile(field, inputId) {
        var input = $(inputId);
        if (!input) return;
        appData[field] = input.value.trim();
        saveData();
        renderWidget();
        renderPreview();
        renderChat();
    }

    function exportData() {
        try {
            var blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "philos-backup.json";
            document.body.appendChild(a);
            a.click();
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
        renderControls();
        applySettings();
    }

    /* ---------------- 事件 ---------------- */
    function handleControl(el) {
        var key = el.getAttribute("data-key");
        if (!key) return;
        var value;
        if (el.type === "checkbox") value = el.checked;
        else if (el.type === "range") value = Number(el.value);
        else value = el.value;
        setPath(appData.settings, key, value);
        if (el.type === "range") updateValLabel(key, value);
        saveData();
        applySettings();
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

        on("btnChatCall", "click", function () { openCall(false); });
        on("btnChatProfile", "click", openPeek);
        on("peekLater", "click", closePeek);
        on("peekGo", "click", sendPeek);
        on("peekMask", "click", function (e) { if (e.target === this) closePeek(); });

        on("callMin", "click", handleCallAction);
        on("callEnd", "click", endCall);
        on("callPill", "click", restoreCall);

        on("myProfileAvatar", "click", function () { var f = $("myProfileFile"); if (f) f.click(); });
        on("taProfileAvatar", "click", function () { var f = $("taProfileFile"); if (f) f.click(); });

        on("myProfileFile", "change", function () {
            var self = this;
            readImageFile(this.files && this.files[0], function (result) {
                appData.myAvatar = result;
                saveData();
                renderWidget();
                renderProfile();
                renderPreview();
                renderChat();
            });
            self.value = "";
        });

        on("taProfileFile", "change", function () {
            var self = this;
            readImageFile(this.files && this.files[0], function (result) {
                appData.taAvatar = result;
                saveData();
                renderWidget();
                renderProfile();
                renderPreview();
                renderChat();
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

        // 单击气泡 → 菜单（禁用长按选择）
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

        document.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            if (!t.closest("#msgMenu") && !t.closest(".msg-bubble")) closeMsgMenu();

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
            if (callState && $("callScreen") && !$("callScreen").hidden) { endCall(); return; }
            if (sheetOpen) { closeSheet(); return; }
            var active = document.querySelector(".screen.active");
            if (active && active.id === "settingsView") { popPage(); return; }
            if (active && active.id !== "desktopView") goDesktop();
        });
    }

    /* ---------------- 启动 ---------------- */
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
