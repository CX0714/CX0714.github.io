/* =========================================================
   Philos · 阶段一：主屏幕 + 设置主界面 + 基础路由
   数据仍使用 private_chat_app_v1，旧数据只做默认值合并
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
        fontChat: 15,
        fontHome: 16
    };

    var appData = null;

    function $(id) {
        return document.getElementById(id);
    }

    function cloneDefaults() {
        var copy = {};
        for (var k in DEFAULTS) {
            if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
                copy[k] = DEFAULTS[k];
            }
        }
        copy.widgetLines = DEFAULTS.widgetLines.slice();
        return copy;
    }

    function loadData() {
        appData = cloneDefaults();
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;
            for (var k in parsed) {
                if (Object.prototype.hasOwnProperty.call(parsed, k) && parsed[k] !== undefined && parsed[k] !== null) {
                    appData[k] = parsed[k];
                }
            }
            if (!Array.isArray(appData.widgetLines) || appData.widgetLines.length !== 4) {
                appData.widgetLines = DEFAULTS.widgetLines.slice();
            }
            if (!Array.isArray(appData.chatHistory)) appData.chatHistory = [];
        } catch (e) {
            appData = cloneDefaults();
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}
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
        if (meta) meta.setAttribute("content", dark ? "#0b0c0e" : "#eef1f5");
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

    /* ---------------- 路由 ---------------- */
    function showScreen(id) {
        var all = document.querySelectorAll(".screen");
        for (var i = 0; i < all.length; i++) {
            all[i].classList.toggle("active", all[i].id === id);
        }
    }

    function showSettingsMainPage() {
        var main = $("settingsMainPage");
        var sub = $("settingsSubPage");
        if (main) main.hidden = false;
        if (sub) sub.hidden = true;
    }

    function goDesktop() {
        closeSheet();
        showSettingsMainPage();
        showScreen("desktopView");
    }

    function openSettingsMain() {
        showSettingsMainPage();
        showScreen("settingsView");
        var main = $("settingsMainPage");
        if (main) main.scrollTop = 0;
    }

    var SUB_TITLES = {
        myinfo: "我的信息",
        ta: "他的信息",
        bubble: "气泡",
        permission: "权限",
        appearance: "外观",
        data: "数据管理",
        about: "关于"
    };

    var SUB_HINTS = {
        myinfo: "在这里修改你的名字和头像，下个阶段开放。",
        ta: "他的名字、头像与资料，下个阶段开放。",
        bubble: "聊天气泡的样式与配色，下个阶段开放。",
        permission: "通知与系统权限，下个阶段开放。",
        appearance: "主题、配色与主页显示，下个阶段开放。",
        data: "导出、备份与清理你的数据，下个阶段开放。",
        about: "Philos · 只为你们两个人做的网页。"
    };

    var subReturnTo = "settings";

    function openSub(key, returnTo) {
        var title = $("subPageTitle");
        var content = $("subPageContent");
        var main = $("settingsMainPage");
        var sub = $("settingsSubPage");

        if (title) title.textContent = SUB_TITLES[key] || "";
        if (content) {
            content.innerHTML = "";
            var p = document.createElement("div");
            p.className = "sub-empty";
            p.textContent = SUB_HINTS[key] || "下个阶段开放。";
            content.appendChild(p);
        }
        if (main) main.hidden = true;
        if (sub) sub.hidden = false;

        subReturnTo = returnTo === "desktop" ? "desktop" : "settings";
        showScreen("settingsView");
    }

    function closeSub() {
        if (subReturnTo === "desktop") {
            goDesktop();
            return;
        }
        var main = $("settingsMainPage");
        var sub = $("settingsSubPage");
        if (sub) sub.hidden = true;
        if (main) main.hidden = false;
    }

    /* ---------------- 渲染 ---------------- */
    function isImageSource(value) {
        return typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/.test(value);
    }

    function avatarMarkup(value, fallbackText) {
        if (isImageSource(value)) {
            var safe = value.replace(/"/g, "&quot;");
            return '<img src="' + safe + '" alt="">';
        }
        return '<span class="avatar-text">' + fallbackText + "</span>";
    }

    function renderWidget() {
        var lines = Array.isArray(appData.widgetLines) ? appData.widgetLines : [];
        for (var i = 0; i < 4; i++) {
            var el = $("wLine" + (i + 1));
            if (!el) continue;
            var value = lines[i];
            if (typeof value !== "string" || !value.trim() || value === BLANK) {
                el.textContent = BLANK;
            } else {
                el.textContent = value;
            }
        }

        var widgetAvatar = $("widgetAvatar");
        if (widgetAvatar) widgetAvatar.innerHTML = avatarMarkup(appData.taAvatar, "Me");

        var myAvatar = $("settingsMyAvatar");
        if (myAvatar) myAvatar.innerHTML = avatarMarkup(appData.myAvatar, "Me");

        var myName = $("settingsMyName");
        if (myName) myName.textContent = appData.myName || "your账户名";

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

    /* ---------------- 事件 ---------------- */
    function on(id, evt, fn) {
        var el = $(id);
        if (el) el.addEventListener(evt, fn);
    }

    function bindEvents() {
        // Dock
        on("appChat", "click", function () { renderChat(); showScreen("chatView"); });
        on("appCards", "click", function () { showScreen("cardsView"); });
        on("dockAppearance", "click", function () { openSub("appearance", "desktop"); });
        on("dockPermission", "click", function () { openSub("permission", "desktop"); });

        // 4 个图标
        on("appLetter", "click", function () { showScreen("letterView"); });
        on("appSettings", "click", function () { openSettingsMain(); });
        on("appCountdown", "click", function () { showScreen("countdownView"); });
        on("appWidgets", "click", function () { showScreen("widgetsView"); });

        // 各 App 返回
        ["btnChatBack", "btnCardsBack", "btnCountdownBack", "btnLetterBack", "btnWidgetsBack"].forEach(function (id) {
            on(id, "click", goDesktop);
        });

        // 设置：主界面返回 / 账户卡 / 列表项
        on("btnSettingsBack", "click", goDesktop);
        on("btnSubBack", "click", closeSub);
        on("btnEditMyInfo", "click", function () { openSub("myinfo", "settings"); });

        var items = document.querySelectorAll(".settings-item[data-sub]");
        for (var i = 0; i < items.length; i++) {
            (function (item) {
                item.addEventListener("click", function () {
                    openSub(item.getAttribute("data-sub"), "settings");
                });
            })(items[i]);
        }

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

        var sheet = $("editSheet");
        if (sheet) {
            sheet.addEventListener("keydown", function (e) {
                if (e.key === "Enter") saveSheet();
            });
        }

        // iOS 键盘弹出时，把面板推上来
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", function () {
                if (!sheetOpen) return;
                var el = $("editSheet");
                if (!el) return;
                var offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
                el.style.bottom = "calc(env(safe-area-inset-bottom) + 12px + " + offset + "px)";
            });
        }

        // 系统返回键 / 手势
        window.addEventListener("popstate", function () {
            if (sheetOpen) { closeSheet(); return; }
            var active = document.querySelector(".screen.active");
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
