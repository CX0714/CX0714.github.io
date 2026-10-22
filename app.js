/* =========================================================
   Philos · 阶段二
   主屏幕 + 设置系统（双入口路由 / 外观多级 / 气泡 / 权限 / 字体）
   数据仍使用 private_chat_app_v1
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
            bubble: {
                preset: "tail",
                radius: 16,
                height: 10,
                opacity: 100,
                bg: "#5b7fa6",
                border: false,
                borderColor: "#ffffff",
                css: ""
            },
            permission: {
                replyDelay: 3,
                activeEnabled: false,
                activeMin: 30,
                activeMax: 120,
                callEnabled: false,
                callMin: 60,
                callMax: 240,
                notify: false
            },
            font: { chat: 15, home: 16 }
        }
    };

    var appData = null;

    function $(id) {
        return document.getElementById(id);
    }

    function isPlainObject(v) {
        return !!v && typeof v === "object" && !Array.isArray(v);
    }

    function deepMerge(target, defaults) {
        var out = {};
        var key;
        for (key in defaults) {
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

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

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
            if (!Array.isArray(merged.widgetLines) || merged.widgetLines.length !== 4) {
                merged.widgetLines = defaults.widgetLines.slice();
            }
            if (!Array.isArray(merged.chatHistory)) merged.chatHistory = [];
            appData = merged;
        } catch (e) {
            appData = defaults;
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}
    }

    function getPath(obj, path) {
        var parts = path.split(".");
        var cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur === null || cur === undefined) return undefined;
            cur = cur[parts[i]];
        }
        return cur;
    }

    function setPath(obj, path, value) {
        var parts = path.split(".");
        var cur = obj;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }

    /* ---------------- 主题 ---------------- */
    function prefersDark() {
        try {
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        } catch (e) {
            return false;
        }
    }

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
            var handler = function () {
                if (!appData || appData.themeMode === "auto") applyTheme();
            };
            if (mq.addEventListener) mq.addEventListener("change", handler);
            else if (mq.addListener) mq.addListener(handler);
        } catch (e) {}
    }

    /* =========================================================
       路由：双入口 + 栈
       entryReturn 记录「从哪来的」：desktop / settings
       ========================================================= */
    var navStack = [];
    var entryReturn = "desktop";

    function showScreen(id) {
        var all = document.querySelectorAll(".screen");
        for (var i = 0; i < all.length; i++) {
            all[i].classList.toggle("active", all[i].id === id);
        }
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

    // 从外部进入设置：entryReturn 决定最终返回哪里
    function openSettings(page, returnTo) {
        navStack = [page || "main"];
        entryReturn = returnTo === "settings" ? "settings" : "desktop";
        showScreen("settingsView");
        renderNav();
    }

    function pushPage(page) {
        navStack.push(page);
        renderNav();
    }

    function popPage() {
        if (navStack.length > 1) {
            navStack.pop();
            renderNav();
            return;
        }
        if (entryReturn === "settings") {
            navStack = ["main"];
            renderNav();
            return;
        }
        goDesktop();
    }

    function goDesktop() {
        closeSheet();
        navStack = [];
        showScreen("desktopView");
    }

    /* ---------------- 占位页 ---------------- */
    var PAGE_TITLES = {
        myinfo: "我的信息",
        ta: "他的信息",
        data: "数据管理",
        about: "关于"
    };

    var PAGE_HINTS = {
        myinfo: "修改你的名字和头像，下个阶段开放。",
        ta: "他的名字、头像与资料，下个阶段开放。",
        data: "导出、备份与清理你的数据，下个阶段开放。",
        about: "Philos · 只为你们两个人做的网页。"
    };

    function openPlaceholder(key) {
        var title = $("placeholderTitle");
        var hint = $("placeholderHint");
        if (title) title.textContent = PAGE_TITLES[key] || "";
        if (hint) hint.textContent = PAGE_HINTS[key] || "下个阶段开放。";
        pushPage("__placeholder");
    }

    /* ---------------- 渲染 ---------------- */
    function isImageSource(value) {
        return typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/.test(value);
    }

    function avatarMarkup(value, fallbackText) {
        if (isImageSource(value)) {
            return '<img src="' + value.replace(/"/g, "&quot;") + '" alt="">';
        }
        return '<span class="avatar-text">' + fallbackText + "</span>";
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
        if (widgetAvatar) {
            var av = appData.settings.appearance.avatar;
            if (isImageSource(av.image)) {
                widgetAvatar.innerHTML = '<img src="' + av.image.replace(/"/g, "&quot;") + '" alt="">';
            } else if (isImageSource(appData.taAvatar)) {
                widgetAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");
            } else {
                widgetAvatar.innerHTML = '<span class="avatar-text">Me</span>';
            }
        }

        var myName = $("settingsMyName");
        if (myName) myName.textContent = appData.myName || "your账户名";

        var accountAvatar = $("settingsMyAvatar");
        if (accountAvatar) {
            if (isImageSource(appData.myAvatar)) {
                accountAvatar.innerHTML = '<img src="' + appData.myAvatar.replace(/"/g, "&quot;") + '" alt="">';
            }
        }

        var headerName = $("headerName");
        if (headerName) headerName.textContent = appData.taName || "他";

        var headerAvatar = $("headerAvatar");
        if (headerAvatar) headerAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");
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

        history.forEach(function (msg) {
            if (!msg) return;
            var row = document.createElement("div");
            row.className = "msg-row " + (msg.from === "me" ? "me" : "ta");

            var bubble = document.createElement("div");
            bubble.className = "msg-bubble";

            if (msg.type === "image" || msg.type === "sticker") {
                var img = document.createElement("img");
                img.src = msg.text || "";
                img.style.maxWidth = "140px";
                img.style.borderRadius = "10px";
                img.style.display = "block";
                bubble.appendChild(img);
            } else {
                bubble.textContent = msg.text || "";
            }

            row.appendChild(bubble);
            container.appendChild(row);
        });

        container.scrollTop = container.scrollHeight;
    }

    /* ---------------- 设置渲染 ---------------- */
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
            if (el.type === "checkbox") {
                el.checked = !!value;
            } else {
                el.value = value;
            }
            if (el.type === "range") updateValLabel(key, value);
        }

        // 分段控件
        var seg = document.querySelector('[data-segment="appearance.avatar.mode"]');
        if (seg) {
            var mode = appData.settings.appearance.avatar.mode;
            var btns = seg.querySelectorAll("[data-mode]");
            for (var j = 0; j < btns.length; j++) {
                btns[j].classList.toggle("active", btns[j].getAttribute("data-mode") === mode);
            }
        }

        // 气泡预设
        var cards = document.querySelectorAll("[data-preset]");
        var preset = appData.settings.bubble.preset;
        for (var k = 0; k < cards.length; k++) {
            cards[k].classList.toggle("selected", cards[k].getAttribute("data-preset") === preset);
        }
    }

    function applySettings() {
        var s = appData.settings;
        var a = s.appearance;
        var root = document.documentElement;
        var css = root.style;

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

        css.setProperty("--font-chat", s.font.chat + "px");
        css.setProperty("--font-home", s.font.home + "px");
        css.setProperty("--home-scale", (s.font.home / 16));

        var custom = $("bubbleCustom");
        if (custom) custom.textContent = s.bubble.css || "";
    }

    /* ---------------- 主页文字编辑面板 ---------------- */
    var sheetOpen = false;

    function openSheet() {
        var lines = Array.isArray(appData.widgetLines) ? appData.widgetLines : [];
        for (var i = 0; i < 4; i++) {
            var input = $("sheetLine" + (i + 1));
            if (!input) continue;
            var v = lines[i];
            input.value = (typeof v === "string" && v !== BLANK) ? v : "";
        }
        var mask = $("sheetMask");
        var sheet = $("editSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
        sheetOpen = true;
    }

    function closeSheet() {
        var mask = $("sheetMask");
        var sheet = $("editSheet");
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

    /* ---------------- 控件事件 ---------------- */
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

    function handleUpload(input) {
        var path = input.getAttribute("data-upload");
        var file = input.files && input.files[0];
        if (!path || !file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert("图片太大，请选择 2MB 以内的图片");
            input.value = "";
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            setPath(appData.settings, path, reader.result);
            saveData();
            applySettings();
            renderWidget();
        };
        reader.readAsDataURL(file);
    }

    function testNotify() {
        if (!("Notification" in window)) {
            alert("这个浏览器不支持系统通知");
            return;
        }
        Notification.requestPermission().then(function (perm) {
            if (perm === "granted") {
                try {
                    new Notification("☆Philos", { body: "这是一条测试通知" });
                } catch (e) {}
            } else {
                alert("通知权限未开启，请到系统设置里允许");
            }
        });
    }

    function on(id, evt, fn) {
        var el = $(id);
        if (el) el.addEventListener(evt, fn);
    }

    function bindEvents() {
        // 主屏入口
        on("appChat", "click", function () { renderChat(); showScreen("chatView"); });
        on("appCards", "click", function () { showScreen("cardsView"); });
        on("appLetter", "click", function () { showScreen("letterView"); });
        on("appCountdown", "click", function () { showScreen("countdownView"); });
        on("appWidgets", "click", function () { showScreen("widgetsView"); });

        // 设置图标 → 设置主界面（返回到桌面）
        on("appSettings", "click", function () { openSettings("main", "desktop"); });

        // 场景 A：Dock 直达子页面，返回直接回桌面
        on("dockAppearance", "click", function () { openSettings("appearance", "desktop"); });
        on("dockPermission", "click", function () { openSettings("permission", "desktop"); });

        // 各 App 返回
        ["btnChatBack", "btnCardsBack", "btnCountdownBack", "btnLetterBack", "btnWidgetsBack"].forEach(function (id) {
            on(id, "click", goDesktop);
        });

        // 通用返回（所有 < 按钮）
        document.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var back = t.closest('[data-nav="back"]');
            if (back) { popPage(); return; }

            var gotoEl = t.closest("[data-goto]");
            if (gotoEl) {
                var target = gotoEl.getAttribute("data-goto");
                if (target === "appearance" || target.indexOf("appearance.") === 0 || target === "bubble" || target === "permission") {
                    pushPage(target);
                } else {
                    openPlaceholder(target);
                }
                return;
            }

            var presetEl = t.closest("[data-preset]");
            if (presetEl) {
                appData.settings.bubble.preset = presetEl.getAttribute("data-preset");
                saveData();
                renderControls();
                applySettings();
                return;
            }

            var segmentEl = t.closest("[data-mode]");
            if (segmentEl) {
                appData.settings.appearance.avatar.mode = segmentEl.getAttribute("data-mode");
                saveData();
                renderControls();
                applySettings();
                return;
            }
        });

        // 滑块 / 颜色 / 开关 / 文本
        document.addEventListener("input", function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            if (el.getAttribute("data-key")) handleControl(el);
        });

        // 图片上传
        document.addEventListener("change", function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;
            if (el.getAttribute("data-upload")) handleUpload(el);
        });

        // 主页文字编辑
        var textArea = $("widgetTextArea");
        if (textArea) {
            textArea.addEventListener("click", openSheet);
            textArea.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSheet();
                }
            });
        }

        on("sheetMask", "click", closeSheet);
        on("sheetCancel", "click", closeSheet);
        on("sheetSave", "click", saveSheet);
        on("btnTestNotify", "click", testNotify);

        var sheet = $("editSheet");
        if (sheet) {
            sheet.addEventListener("keydown", function (e) {
                if (e.key === "Enter") saveSheet();
            });
        }

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
        renderChat();
        renderControls();
        applySettings();
        bindEvents();
        hideSplash();
        registerSW();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
