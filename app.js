/* =========================================================
   Philos · 3.3
   ========================================================= */
(function () {
    "use strict";

    var STORAGE_KEY = "private_chat_app_v1";
    var BLANK = "______";

    var ICON_KEYS = ["letter", "settings", "countdown", "widgets", "chat", "cards", "appearance", "permission"];
    var KINDS = ["text", "emoji", "sticker", "status"];

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

    var EMPTY_CATS = { text: [], emoji: [], sticker: [], status: [] };

    var DEFAULT_WIDGET = {
        template: "",
        title: "",
        subtitle: "",
        days: "",
        daysSourceId: "",
        imgLeft: "",
        imgRight: "",
        imgCard: "",
        imgTop: "",
        imgBg: "",
        centerText: "",
        opacity: 100,
        blur: 20
    };

    var DEFAULT_HERO = { mode: "", img1: "", img2: "" };

    var DEFAULTS = {
        taName: "他", taAvatar: "", myName: "your账户名", myAvatar: "",
        chatHistory: [], cards: [], stickers: [], pats: ["要抱抱"],
        anniversaries: [], activeCountdownId: "", letters: [],
        cardCategories: JSON.parse(JSON.stringify(EMPTY_CATS)),
        widgetConfig: JSON.parse(JSON.stringify(DEFAULT_WIDGET)),
        heroConfig: JSON.parse(JSON.stringify(DEFAULT_HERO)),
        themeMode: "auto",
        widgetLines: [BLANK, BLANK, BLANK, BLANK],
        settings: {
            appearance: {
                homeBg: { color: "#e9edf2", image: "", opacity: 100, blur: 20 },
                iconBg: { color: "#ffffff", image: "", opacity: 85, blur: 20, showLabel: true, labelSize: 11, icons: JSON.parse(JSON.stringify(EMPTY_ICONS)) },
                chatBg: { color: "#f2f4f7", image: "", opacity: 100, blur: 20 },
                avatar: { color: "#dfe5ec", image: "", opacity: 100, blur: 0, size: 36, radius: 50, offsetY: 0, mode: "each" }
            },
            status: { color: "#8b909a", bgEnabled: false, bgColor: "#ffffff", bgOpacity: 60, bgBlur: 40 },
            bubble: { preset: "tail", radius: 16, height: 10, opacity: 100, bg: "#5b7fa6", border: false, borderColor: "#ffffff", css: "" },
            permission: { replyDelay: 3, activeEnabled: false, activeMin: 30, activeMax: 120, callEnabled: false, callMin: 60, callMax: 240, notify: false },
            font: { chat: 15, home: 16 }
        }
    };

    var appData = null;
    var activeCardKind = "text";
    var activeCat = "全部";
    var editingCardId = null;
    var activeWidgetTab = "widget";

    function $(id) { return document.getElementById(id); }
    function isPlainObject(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
    function clone(v) { return JSON.parse(JSON.stringify(v)); }
    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function esc(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

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
            merged.widgetConfig = deepMerge(isPlainObject(parsed.widgetConfig) ? parsed.widgetConfig : {}, defaults.widgetConfig);
            merged.heroConfig = deepMerge(isPlainObject(parsed.heroConfig) ? parsed.heroConfig : {}, defaults.heroConfig);
            if (!Array.isArray(merged.widgetLines) || merged.widgetLines.length !== 4) merged.widgetLines = defaults.widgetLines.slice();
            if (!Array.isArray(merged.chatHistory)) merged.chatHistory = [];
            if (!Array.isArray(merged.stickers)) merged.stickers = [];
            if (!Array.isArray(merged.pats)) merged.pats = defaults.pats.slice();
            if (!Array.isArray(merged.cards)) merged.cards = [];
            if (!Array.isArray(merged.anniversaries)) merged.anniversaries = [];
            if (!Array.isArray(merged.letters)) merged.letters = [];
            if (typeof merged.activeCountdownId !== "string") merged.activeCountdownId = "";
            if (!isPlainObject(merged.cardCategories)) merged.cardCategories = clone(EMPTY_CATS);
            KINDS.forEach(function (kind) {
                if (!Array.isArray(merged.cardCategories[kind])) merged.cardCategories[kind] = [];
            });

            if (!isPlainObject(merged.settings.appearance.iconBg.icons)) merged.settings.appearance.iconBg.icons = clone(EMPTY_ICONS);
            ICON_KEYS.forEach(function (key) {
                if (typeof merged.settings.appearance.iconBg.icons[key] !== "string") merged.settings.appearance.iconBg.icons[key] = "";
            });

            var av = merged.settings.appearance.avatar;
            if (!(av.size >= 24 && av.size <= 60)) av.size = 36;
            if (!(av.offsetY >= -20 && av.offsetY <= 20)) av.offsetY = 0;
            av.radius = clamp(Number(av.radius) || 0, 0, 50);

            merged.cards = merged.cards.map(function (c) {
                if (!c || typeof c !== "object") return null;
                var kind = c.kind || (c.type === "sticker" ? "sticker" : (c.type === "pat" || c.type === "status" ? "status" : "text"));
                if (KINDS.indexOf(kind) < 0) kind = "text";
                return {
                    id: c.id || uid(),
                    kind: kind,
                    content: typeof c.content === "string" ? c.content : (c.text || ""),
                    category: typeof c.category === "string" ? c.category : "未分类",
                    createdAt: c.createdAt || Date.now()
                };
            }).filter(Boolean);

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
        closeSheet(); closeMsgMenu(); closeDrawer(); closeCardsMenu();
        navStack = [];
        showScreen("desktopView");
    }

    /* 基础渲染 */
    function isImageSource(value) { return typeof value === "string" && /^(https?:\/\/|data:image\/|blob:)/.test(value); }
    function escAttr(value) { return String(value).replace(/"/g, "&quot;"); }
    function avatarMarkup(value, fallbackText) {
        if (isImageSource(value)) return '<img src="' + escAttr(value) + '" alt="">';
        return '<span class="avatar-text">' + esc(fallbackText) + "</span>";
    }
    function widgetAvatarMarkup() {
        if (isImageSource(appData.taAvatar)) return '<img src="' + escAttr(appData.taAvatar) + '" alt="">';
        return '<span class="avatar-text">Me</span>';
    }

    /* ===== 大组件照片 ===== */
    function applyHeroImages() {
        var big = $("widgetLarge");
        if (!big) return;
        var top = big.querySelector(".widget-half-top");
        var bottom = big.querySelector(".widget-half-bottom");
        var cfg = appData.heroConfig || {};

        big.classList.remove("hero-single", "hero-split");
        big.style.backgroundImage = "";
        if (top) { top.style.backgroundImage = ""; top.style.backgroundColor = ""; }
        if (bottom) { bottom.style.backgroundImage = ""; bottom.style.backgroundColor = ""; }

        if (cfg.mode === "single" && isImageSource(cfg.img1)) {
            big.classList.add("hero-single");
            big.style.backgroundImage = 'url("' + cfg.img1 + '")';
        } else if (cfg.mode === "split") {
            big.classList.add("hero-split");
            if (top && isImageSource(cfg.img1)) top.style.backgroundImage = 'url("' + cfg.img1 + '")';
            if (bottom && isImageSource(cfg.img2)) bottom.style.backgroundImage = 'url("' + cfg.img2 + '")';
        }
        renderHeroConfig();
    }

    function renderHeroConfig() {
        var cfg = appData.heroConfig || {};
        var btns = document.querySelectorAll("[data-hero-mode]");
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle("active", btns[i].getAttribute("data-hero-mode") === (cfg.mode || ""));
        }
        var rows = document.querySelectorAll("[data-hero-row]");
        for (var j = 0; j < rows.length; j++) {
            var key = rows[j].getAttribute("data-hero-row");
            rows[j].hidden = (key === "img2" && cfg.mode !== "split");
        }
    }

    /* ===== 倒数日 ===== */
    function daysFrom(dateStr) {
        if (!dateStr) return 0;
        var start = new Date(dateStr + "T00:00:00");
        if (isNaN(start.getTime())) return 0;
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.floor((today - start) / 86400000);
    }
    function dayLabel(dateStr) {
        var d = daysFrom(dateStr);
        return d >= 0 ? "第 " + (d + 1) + " 天" : "还有 " + (-d) + " 天";
    }
    function findAnniversary(id) {
        for (var i = 0; i < appData.anniversaries.length; i++) {
            if (appData.anniversaries[i].id === id) return appData.anniversaries[i];
        }
        return null;
    }

    function renderCountdown() {
        var list = $("countdownList");
        if (!list) return;
        list.innerHTML = "";

        if (!appData.anniversaries.length) {
            var empty = document.createElement("div");
            empty.className = "cd-empty";
            empty.textContent = "还没有倒数日，点右下角 + 新建";
            list.appendChild(empty);
            return;
        }

        appData.anniversaries.forEach(function (item) {
            var row = document.createElement("div");
            row.className = "swipe-row";
            row.setAttribute("data-swipe-width", "76");
            row.setAttribute("data-cd-id", item.id);

            var actions = document.createElement("div");
            actions.className = "swipe-actions";
            var del = document.createElement("button");
            del.className = "swipe-btn danger";
            del.textContent = "删除";
            del.setAttribute("data-cd-del", item.id);
            actions.appendChild(del);

            var d = daysFrom(item.date);
            var isPast = d >= 0;
            var num = isPast ? d + 1 : -d;
            var prefix = isPast ? "第" : "还有";

            var content = document.createElement("div");
            content.className = "swipe-content cd-item" + (item.id === appData.activeCountdownId ? " active" : "");
            content.innerHTML =
                '<div class="cd-days">' +
                    '<span class="cd-prefix">' + prefix + '</span>' +
                    '<span class="cd-num">' + num + '</span>' +
                    '<span class="cd-unit">天</span>' +
                '</div>' +
                '<div class="cd-meta">' +
                    '<div class="cd-name">' + esc(item.title) + '</div>' +
                    '<div class="cd-date">' + esc(String(item.date).replace(/-/g, ".")) + '</div>' +
                '</div>' +
                (item.id === appData.activeCountdownId ? '<span class="cd-badge">显示中</span>' : '');

            row.appendChild(actions);
            row.appendChild(content);
            list.appendChild(row);
        });
    }

    function openCdSheet() {
        if ($("cdTitle")) $("cdTitle").value = "";
        if ($("cdDate")) {
            var now = new Date();
            $("cdDate").value = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        }
        var mask = $("cdMask"), sheet = $("cdSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
    }
    function closeCdSheet() {
        var mask = $("cdMask"), sheet = $("cdSheet");
        if (mask) mask.classList.remove("show");
        if (sheet) sheet.classList.remove("show");
    }
    function saveCountdown() {
        var titleEl = $("cdTitle"), dateEl = $("cdDate");
        var title = titleEl ? titleEl.value.trim() : "";
        var date = dateEl ? dateEl.value : "";
        if (!title || !date) { alert("请填写标题和日期"); return; }
        var item = { id: uid(), title: title, date: date, createdAt: Date.now() };
        appData.anniversaries.unshift(item);
        if (!appData.activeCountdownId) appData.activeCountdownId = item.id;
        saveData();
        renderCountdown();
        renderWidgetSmall();
        fillDaySourceSelect();
        closeCdSheet();
    }

    /* ===== 小组件 ===== */
    function tplImage(src) {
        return isImageSource(src) ? '<img src="' + escAttr(src) + '" alt="">' : '<span class="ws-img-empty"></span>';
    }

    function widgetDaysText() {
        var cfg = appData.widgetConfig;
        if (cfg.daysSourceId) {
            var found = findAnniversary(cfg.daysSourceId);
            if (found) return dayLabel(found.date);
        }
        return cfg.days || "";
    }

    function widgetTitleText() {
        var cfg = appData.widgetConfig;
        if (cfg.title) return cfg.title;
        if (cfg.daysSourceId) {
            var found = findAnniversary(cfg.daysSourceId);
            if (found) return found.title;
        }
        return "";
    }

    function tplAHtml(cfg) {
        return '<div class="ws-tpl ws-a">' +
            '<div class="ws-a-title">' + esc(widgetTitleText() || "我们") + '</div>' +
            '<div class="ws-a-row">' +
                '<span class="ws-a-avatar">' + tplImage(cfg.imgLeft) + '</span>' +
                '<span class="ws-a-heart"></span>' +
                '<span class="ws-a-avatar">' + tplImage(cfg.imgRight) + '</span>' +
            '</div>' +
            '<div class="ws-a-days">' + esc(widgetDaysText() || "第 1 天") + '</div>' +
        '</div>';
    }

    function tplBHtml(cfg) {
        return '<div class="ws-tpl ws-b">' +
            '<div class="ws-b-title">' + esc(cfg.title || "今日单曲") + '</div>' +
            '<div class="ws-b-card">' + tplImage(cfg.imgCard) + '</div>' +
        '</div>';
    }

    function tplCHtml(cfg) {
        return '<div class="ws-tpl ws-c">' +
            '<div class="ws-c-img">' + tplImage(cfg.imgTop) + '</div>' +
            '<div class="ws-c-body">' +
                '<div class="ws-c-title">' + esc(cfg.title || "今天也想你") + '</div>' +
                '<div class="ws-c-sub">' + esc(cfg.subtitle || "距离见面还有…") + '</div>' +
                '<div class="ws-c-bar"><span></span></div>' +
            '</div>' +
        '</div>';
    }

    function tplDHtml(cfg) {
        var img = isImageSource(cfg.imgBg)
            ? '<img class="ws-d-img" src="' + escAttr(cfg.imgBg) + '" alt="">'
            : '<span class="ws-img-empty ws-d-img"></span>';
        return '<div class="ws-tpl ws-d">' + img +
            '<div class="ws-d-text">' + esc(cfg.centerText || "今天也在想你") + '</div>' +
        '</div>';
    }

    function applyWidgetSkin(cfg) {
        var el = $("widgetSmallArea");
        if (!el) return;
        var op = typeof cfg.opacity === "number" ? cfg.opacity : 100;
        var bl = typeof cfg.blur === "number" ? cfg.blur : 20;
        el.style.setProperty("--ws-bg-alpha", (0.05 + op / 100 * 0.85).toFixed(3));
        el.style.setProperty("--ws-blur", (bl / 100 * 30) + "px");
        el.style.setProperty("--ws-content-opacity", (0.4 + op / 100 * 0.6).toFixed(2));
    }

    function renderWidgetSmall() {
        var el = $("widgetSmallArea");
        if (!el) return;
        var cfg = appData.widgetConfig || clone(DEFAULT_WIDGET);
        applyWidgetSkin(cfg);

        if (!cfg.template) {
            var item = appData.activeCountdownId ? findAnniversary(appData.activeCountdownId) : null;
            el.classList.remove("has-template");
            if (item) {
                el.innerHTML = '<div class="ws-widget"><div class="ws-widget-title">' + esc(item.title) + '</div><div class="ws-widget-days">' + esc(dayLabel(item.date)) + '</div></div>';
            } else {
                el.innerHTML = '<span class="ws-placeholder">Select Widget</span>';
            }
            return;
        }

        el.classList.add("has-template");
        var html = "";
        if (cfg.template === "A") html = tplAHtml(cfg);
        else if (cfg.template === "B") html = tplBHtml(cfg);
        else if (cfg.template === "C") html = tplCHtml(cfg);
        else if (cfg.template === "D") html = tplDHtml(cfg);
        el.innerHTML = html;
    }

    function updateWVal(key, value) {
        var labels = document.querySelectorAll('[data-wval="' + key + '"]');
        var unit = "";
        var input = document.querySelector('[data-wcfg="' + key + '"]');
        if (input && input.dataset && input.dataset.wunit) unit = input.dataset.wunit;
        for (var i = 0; i < labels.length; i++) labels[i].textContent = value + unit;
    }

    function fillDaySourceSelect() {
        var sel = $("wsDaySource");
        if (!sel) return;
        var current = appData.widgetConfig.daysSourceId || "";
        sel.innerHTML = "";
        var none = document.createElement("option");
        none.value = "";
        none.textContent = "手动输入";
        sel.appendChild(none);
        appData.anniversaries.forEach(function (a) {
            var opt = document.createElement("option");
            opt.value = a.id;
            opt.textContent = a.title;
            sel.appendChild(opt);
        });
        sel.value = current;
    }

    function renderWidgetConfig() {
        var cfg = appData.widgetConfig;
        var tpl = cfg.template || "";

        var cards = document.querySelectorAll("[data-tpl]");
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle("active", cards[i].getAttribute("data-tpl") === tpl);
        }

        var groups = document.querySelectorAll("[data-cfg]");
        for (var j = 0; j < groups.length; j++) {
            groups[j].hidden = groups[j].getAttribute("data-cfg") !== tpl;
        }

        var inputs = document.querySelectorAll("[data-wcfg]");
        for (var k = 0; k < inputs.length; k++) {
            var el = inputs[k];
            var key = el.getAttribute("data-wcfg");
            var val = cfg[key];
            if (el.type === "range") el.value = (val === undefined || val === null) ? 0 : val;
            else el.value = (val === undefined || val === null) ? "" : val;
        }

        updateWVal("opacity", cfg.opacity);
        updateWVal("blur", cfg.blur);
        fillDaySourceSelect();
        renderHeroConfig();
        renderWidgetTab();
    }

    function renderWidgetTab() {
        var tabs = document.querySelectorAll("[data-wtab]");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle("active", tabs[i].getAttribute("data-wtab") === activeWidgetTab);
        }
        var panes = document.querySelectorAll("[data-wpane]");
        for (var j = 0; j < panes.length; j++) {
            panes[j].hidden = panes[j].getAttribute("data-wpane") !== activeWidgetTab;
        }
    }

    function handleWidgetControl(el) {
        var key = el.getAttribute("data-wcfg");
        if (!key) return;
        var value;
        if (el.type === "checkbox") value = el.checked;
        else if (el.type === "range") value = Number(el.value);
        else value = el.value;
        setPath(appData.widgetConfig, key, value);

        if (key === "daysSourceId" && value) {
            var found = findAnniversary(value);
            if (found) appData.widgetConfig.title = found.title;
            saveData();
            renderWidgetSmall();
            renderWidgetConfig();
            return;
        }

        if (el.type === "range") updateWVal(key, value);
        saveData();
        renderWidgetSmall();
    }

    /* ===== 信箱 ===== */
    function fmtDate(ts) {
        var d = new Date(ts);
        return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function renderLetters() {
        var list = $("letterList");
        if (!list) return;
        list.innerHTML = "";
        if (!appData.letters.length) {
            var empty = document.createElement("div");
            empty.className = "letter-empty";
            empty.textContent = "还没有信件";
            list.appendChild(empty);
            return;
        }
        appData.letters.forEach(function (letter) {
            var card = document.createElement("div");
            card.className = "letter-card";
            var html = '<div class="letter-time">' + esc(fmtDate(letter.createdAt)) + '</div>';
            html += '<div class="letter-body">' + esc(letter.text) + '</div>';
            html += '<div class="letter-divider"></div>';
            if (letter.reply) html += '<div class="letter-body reply">' + esc(letter.reply) + '</div>';
            else html += '<div class="letter-wait">等待回信…</div>';
            card.innerHTML = html;
            list.appendChild(card);
        });
    }

    function openCompose() {
        var panel = $("letterCompose"), input = $("letterInput");
        if (!panel || !input) return;
        var name = appData.taName && appData.taName !== "他" ? appData.taName : "xx";
        var tpl = "亲爱的 " + name + "：\n  见字如晤：\n  ";
        input.value = tpl;
        panel.hidden = false;
        setTimeout(function () {
            input.focus();
            try { input.setSelectionRange(tpl.length, tpl.length); } catch (e) {}
        }, 60);
    }
    function closeCompose() { var panel = $("letterCompose"); if (panel) panel.hidden = true; }

    function sendLetter() {
        var input = $("letterInput");
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        var letter = { id: uid(), text: text, createdAt: Date.now(), reply: "" };
        appData.letters.unshift(letter);
        saveData(); renderLetters(); closeCompose();
        maybeReply(letter.id);
    }

    function maybeReply(letterId) {
        var pool = appData.cards.filter(function (c) {
            return (c.kind === "text" || c.kind === "emoji") && c.content;
        });
        if (!pool.length) return;
        var delay = 5000 + Math.random() * 10000;
        setTimeout(function () {
            var target = null;
            for (var i = 0; i < appData.letters.length; i++) {
                if (appData.letters[i].id === letterId) { target = appData.letters[i]; break; }
            }
            if (!target || target.reply) return;
            var count = 3 + Math.floor(Math.random() * 6);
            var picked = [];
            for (var k = 0; k < count; k++) {
                var item = pool[Math.floor(Math.random() * pool.length)];
                if (item && item.content) picked.push(item.content);
            }
            target.reply = picked.join("。") + "。";
            saveData(); renderLetters();
        }, delay);
    }

    /* ===== 字卡库 ===== */
    function cardsOfKind(kind) { return appData.cards.filter(function (c) { return c.kind === kind; }); }
    function catsOfKind(kind) { return appData.cardCategories[kind] || []; }
    function countInCat(kind, cat) {
        var list = cardsOfKind(kind);
        if (cat === "全部") return list.length;
        return list.filter(function (c) { return c.category === cat; }).length;
    }

    function renderKindSeg() {
        var seg = $("cardKindSeg");
        if (!seg) return;
        var btns = seg.querySelectorAll(".kind-btn");
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].getAttribute("data-kind") === activeCardKind);
    }

    function renderCats() {
        var wrap = $("cardCats");
        if (!wrap) return;
        wrap.innerHTML = "";
        var cats = ["全部", "未分类"].concat(catsOfKind(activeCardKind));
        cats.forEach(function (name) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "cat" + (name === activeCat ? " active" : "");
            btn.textContent = name + " (" + countInCat(activeCardKind, name) + ")";
            btn.setAttribute("data-cat", name);
            wrap.appendChild(btn);
        });
        var add = document.createElement("button");
        add.type = "button";
        add.className = "cat-add";
        add.id = "btnAddCat";
        add.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-plus"></use></svg>';
        wrap.appendChild(add);
    }

    function renderCardList() {
        var list = $("cardList");
        if (!list) return;
        list.innerHTML = "";
        var items = cardsOfKind(activeCardKind).filter(function (c) {
            return activeCat === "全部" ? true : c.category === activeCat;
        });
        if (!items.length) {
            var empty = document.createElement("div");
            empty.className = "card-empty";
            empty.textContent = "这个分类还没有字卡";
            list.appendChild(empty);
            return;
        }
        items.forEach(function (card) {
            var row = document.createElement("div");
            row.className = "swipe-row";
            row.setAttribute("data-swipe-width", "152");
            row.setAttribute("data-card-id", card.id);

            var actions = document.createElement("div");
            actions.className = "swipe-actions";
            actions.innerHTML =
                '<button class="swipe-btn" data-card-edit="' + card.id + '" type="button">编辑</button>' +
                '<button class="swipe-btn danger" data-card-del="' + card.id + '" type="button">删除</button>';

            var content = document.createElement("div");
            content.className = "swipe-content card-item";
            if (card.kind === "sticker" && isImageSource(card.content)) {
                content.innerHTML = '<img src="' + escAttr(card.content) + '" alt="">';
            } else {
                content.textContent = card.content;
            }

            row.appendChild(actions);
            row.appendChild(content);
            list.appendChild(row);
        });
    }

    function renderCards() { renderKindSeg(); renderCats(); renderCardList(); }

    function fillCategorySelect(select, current) {
        if (!select) return;
        select.innerHTML = "";
        var options = ["未分类"].concat(catsOfKind(activeCardKind));
        options.forEach(function (name) {
            var opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            if (name === current) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function openCardAdd() {
        if ($("cardAddText")) $("cardAddText").value = "";
        fillCategorySelect($("cardAddCategory"), "未分类");
        var mask = $("cardModalMask"), sheet = $("cardAddSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
    }
    function closeCardModals() {
        var mask = $("cardModalMask");
        if (mask) mask.classList.remove("show");
        ["cardAddSheet", "cardEditSheet", "catSheet"].forEach(function (id) {
            var el = $(id); if (el) el.classList.remove("show");
        });
        editingCardId = null;
    }

    function saveNewCards() {
        var area = $("cardAddText"), sel = $("cardAddCategory");
        if (!area) return;
        var lines = area.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!lines.length) return;
        var cat = sel && sel.value ? sel.value : "未分类";
        lines.forEach(function (text) {
            appData.cards.unshift({ id: uid(), kind: activeCardKind, content: text, category: cat, createdAt: Date.now() });
        });
        saveData(); activeCat = cat; renderCards(); closeCardModals();
    }

    function openCardEdit(id) {
        var card = null;
        for (var i = 0; i < appData.cards.length; i++) if (appData.cards[i].id === id) card = appData.cards[i];
        if (!card) return;
        editingCardId = id;
        if ($("cardEditText")) $("cardEditText").value = card.content;
        fillCategorySelect($("cardEditCategory"), card.category || "未分类");
        var mask = $("cardModalMask"), sheet = $("cardEditSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
    }

    function saveCardEdit() {
        if (!editingCardId) return;
        var text = $("cardEditText") ? $("cardEditText").value.trim() : "";
        var cat = $("cardEditCategory") && $("cardEditCategory").value ? $("cardEditCategory").value : "未分类";
        if (!text) return;
        for (var i = 0; i < appData.cards.length; i++) {
            if (appData.cards[i].id === editingCardId) {
                appData.cards[i].content = text;
                appData.cards[i].category = cat;
                break;
            }
        }
        saveData(); renderCards(); closeCardModals();
    }

    function openCatSheet() {
        if ($("catName")) $("catName").value = "";
        var mask = $("cardModalMask"), sheet = $("catSheet");
        if (mask) mask.classList.add("show");
        if (sheet) sheet.classList.add("show");
    }
    function saveCategory() {
        var input = $("catName");
        var name = input ? input.value.trim() : "";
        if (!name) return;
        if (name === "全部" || name === "未分类") { closeCardModals(); return; }
        var cats = appData.cardCategories[activeCardKind];
        if (cats.indexOf(name) < 0) cats.push(name);
        saveData(); activeCat = name; renderCards(); closeCardModals();
    }

    function exportCards() {
        try {
            var blob = new Blob([JSON.stringify({ cards: appData.cards, cardCategories: appData.cardCategories }, null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url; a.download = "philos-cards.json";
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
        } catch (e) { alert("导出失败"); }
    }

    function importCards(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var data = JSON.parse(reader.result);
                if (Array.isArray(data.cards)) {
                    data.cards.forEach(function (c) {
                        if (!c || typeof c.content !== "string") return;
                        var kind = KINDS.indexOf(c.kind) >= 0 ? c.kind : "text";
                        appData.cards.unshift({
                            id: uid(), kind: kind, content: c.content,
                            category: typeof c.category === "string" ? c.category : "未分类",
                            createdAt: c.createdAt || Date.now()
                        });
                    });
                }
                if (isPlainObject(data.cardCategories)) {
                    KINDS.forEach(function (k) {
                        if (Array.isArray(data.cardCategories[k])) {
                            data.cardCategories[k].forEach(function (name) {
                                if (typeof name === "string" && appData.cardCategories[k].indexOf(name) < 0) {
                                    appData.cardCategories[k].push(name);
                                }
                            });
                        }
                    });
                }
                saveData(); renderCards(); alert("导入成功");
            } catch (e) { alert("导入失败：文件格式不正确"); }
        };
        reader.readAsText(file);
    }

    /* ===== 左滑 ===== */
    var swipeState = null;
    function bindSwipe(container) {
        if (!container) return;

        container.addEventListener("touchstart", function (e) {
            var row = e.target.closest ? e.target.closest(".swipe-row") : null;
            if (!row) return;
            var t = e.touches[0];
            var width = Number(row.getAttribute("data-swipe-width") || 76);
            var opened = row.classList.contains("open");
            swipeState = { row: row, startX: t.clientX, startY: t.clientY, width: width, offset: opened ? -width : 0, current: opened ? -width : 0, moved: false };
        }, { passive: true });

        container.addEventListener("touchmove", function (e) {
            if (!swipeState) return;
            var t = e.touches[0];
            var dx = t.clientX - swipeState.startX;
            var dy = t.clientY - swipeState.startY;
            if (Math.abs(dx) < Math.abs(dy)) return;
            if (e.cancelable) e.preventDefault();
            swipeState.moved = true;
            var next = clamp(swipeState.offset + dx, -swipeState.width, 0);
            swipeState.current = next;
            var content = swipeState.row.querySelector(".swipe-content");
            if (content) {
                content.style.transition = "none";
                content.style.transform = "translateX(" + next + "px)";
            }
        }, { passive: false });

        container.addEventListener("touchend", function () {
            if (!swipeState) return;
            var row = swipeState.row;
            var content = row.querySelector(".swipe-content");
            var width = swipeState.width;
            var open = swipeState.current < -width / 2;
            if (content) {
                content.style.transition = "transform 0.22s ease";
                content.style.transform = open ? "translateX(-" + width + "px)" : "translateX(0px)";
            }
            row.classList.toggle("open", open);
            if (swipeState.moved) row.setAttribute("data-skip-click", "1");
            swipeState = null;
        });
    }

    function closeAllSwipe() {
        document.querySelectorAll(".swipe-row.open").forEach(function (row) {
            row.classList.remove("open");
            var c = row.querySelector(".swipe-content");
            if (c) { c.style.transition = "transform 0.2s ease"; c.style.transform = "translateX(0px)"; }
        });
    }

    /* ===== 通用渲染 ===== */
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

        renderWidgetSmall();
        applyHeroImages();
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
        ["pvAvatarTa", "pvAvatarTa2", "pvBubbleTa"].forEach(function (id) { var el = $(id); if (el) el.innerHTML = taMarkup; });
        ["pvAvatarMe", "pvBubbleMe"].forEach(function (id) { var el = $(id); if (el) el.innerHTML = myMarkup; });
    }

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
                box.style.backgroundImage = has ? 'url("' + src + '")' : "";
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
            el.style.backgroundImage = has ? 'url("' + src + '")' : "";
            el.classList.toggle("has-image", has);
        });
    }

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
            file.type = "file"; file.accept = "image/*"; file.hidden = true;
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

    /* 聊天 */
    function fmtTime(ts) {
        var d = new Date(ts);
        return pad(d.getHours()) + ":" + pad(d.getMinutes());
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
        if (!history.length) {
            var empty = document.createElement("p");
            empty.className = "empty-hint";
            empty.textContent = "还没有聊天记录";
            container.appendChild(empty);
            return;
        }
        var lastStamp = 0, lastFrom = null;
        var mode = appData.settings.appearance.avatar.mode;

        history.forEach(function (msg, index) {
            if (!msg) return;
            if (msg.time) {
                if (!lastStamp || msg.time - lastStamp > 300000) {
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
            av.innerHTML = msg.from === "me" ? avatarMarkup(appData.myAvatar, "Me") : avatarMarkup(appData.taAvatar, "他");

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
    var menuIndex = -1, quoteTarget = null;
    function openMsgMenu(bubble) {
        var menu = $("msgMenu");
        if (!menu) return;
        menuIndex = Number(bubble.getAttribute("data-index"));
        menu.hidden = false;
        menu.style.visibility = "hidden";
        menu.style.left = "0px"; menu.style.top = "0px";
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
        input.value = ""; input.style.height = "auto";
        clearQuote(); updateSendBtn(); renderChat();
    }

    /* 抽屉 */
    function openDrawer(tab) {
        var mask = $("drawerMask"), drawer = $("chatDrawer");
        if (mask) mask.classList.add("open");
        if (drawer) drawer.classList.add("open");
        switchTab(tab || "media");
        renderStickers(); renderPats();
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
        if (sync) appData.cards.push({ id: uid(), kind: "status", content: text, category: "未分类", createdAt: Date.now() });
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

    /* 拍一拍 / 通话 */
    function openPeek() { var m = $("peekMask"); if (m) m.hidden = false; }
    function closePeek() { var m = $("peekMask"); if (m) m.hidden = true; }
    function sendPeek() {
        appData.chatHistory.push({ type: "status", text: "—— 拍了拍他 ——", time: Date.now() });
        saveData(); renderChat(); closePeek();
    }

    var call = { state: "idle", seconds: 0, connectTimer: null, rejectTimer: null, taTimer: null, tickTimer: null, closeTimer: null };
    function fmtDuration(sec) {
        var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
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
        var t = $("callTimer"); if (t) t.textContent = text;
        var p = $("callPillTime"); if (p) p.textContent = text;
    }
    function setCallStateText(text) { var el = $("callState"); if (el) el.textContent = text; }
    function showCallScreen() {
        var screen = $("callScreen"), pill = $("callPill");
        if (screen) screen.hidden = false;
        if (pill) pill.hidden = true;
    }
    function hideCallScreen() { var s = $("callScreen"); if (s) s.hidden = true; }
    function startCall() {
        clearCallTimers();
        call.state = "calling"; call.seconds = 0;
        setCallStateText("正在呼叫…"); updateCallClock(); showCallScreen();
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
        call.state = "ongoing"; setCallStateText("通话中"); updateCallClock();
        call.tickTimer = setInterval(function () { call.seconds++; updateCallClock(); }, 1000);
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
        var label = "通话结束", record = "";
        if (reason === "rejected") { label = "对方已拒绝"; record = "对方已拒绝"; }
        else if (reason === "cancelled") { label = "已取消"; record = "已取消"; }
        else if (reason === "taHangup") { label = "通话结束"; record = "语音通话 时长 " + fmtDuration(call.seconds) + " · 对方已挂断"; }
        else { label = "通话结束"; record = wasOngoing ? "语音通话 时长 " + fmtDuration(call.seconds) : "已取消"; }
        setCallStateText(label);
        appData.chatHistory.push({ type: "call", text: record, time: Date.now() });
        saveData();
        var pill = $("callPill"); if (pill) pill.hidden = true;
        call.closeTimer = setTimeout(function () {
            hideCallScreen(); goDesktop(); call.state = "idle";
        }, 1400);
    }
    function endCallByMe() {
        if (call.state === "calling") { finishCall("cancelled"); return; }
        if (call.state === "ongoing") { finishCall("meHangup"); return; }
    }
    function minimizeCall() {
        if (call.state !== "calling" && call.state !== "ongoing") return;
        hideCallScreen();
        var pill = $("callPill"); if (pill) pill.hidden = false;
        updateCallClock();
    }
    function restoreCall() {
        var pill = $("callPill"); if (pill) pill.hidden = true;
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
        var cardsEls = document.querySelectorAll("[data-preset]");
        var preset = appData.settings.bubble.preset;
        for (var k = 0; k < cardsEls.length; k++) cardsEls[k].classList.toggle("selected", cardsEls[k].getAttribute("data-preset") === preset);
    }

    function applySettings() {
        var s = appData.settings, a = s.appearance;
        var root = document.documentElement, css = root.style;

        css.setProperty("--home-bg-color", hexToRgba(a.homeBg.color, a.homeBg.opacity / 100));
        css.setProperty("--home-bg-image", a.homeBg.image ? "url(" + a.homeBg.image + ")" : "none");
        css.setProperty("--home-blur", (a.homeBg.blur / 100 * 30) + "px");
        css.setProperty("--icon-bg-color", hexToRgba(a.iconBg.color, a.iconBg.opacity / 100));
        css.setProperty("--icon-blur", (a.iconBg.blur / 100 * 30) + "px");
        css.setProperty("--app-label-size", (a.iconBg.labelSize || 11) + "px");
        root.classList.toggle("hide-app-label", a.iconBg.showLabel === false);
        css.setProperty("--chat-bg-color", hexToRgba(a.chatBg.color, a.chatBg.opacity / 100));
        css.setProperty("--chat-bg-image", a.chatBg.image ? "url(" + a.chatBg.image + ")" : "none");

        var size = a.avatar.size || 36;
        var radius = (a.avatar.radius === undefined ? 50 : a.avatar.radius);
        var offsetY = a.avatar.offsetY || 0;
        css.setProperty("--msg-avatar-size", size + "px");
        css.setProperty("--msg-avatar-radius", radius + "px");
        css.setProperty("--avatar-offset-y", offsetY + "px");
        css.setProperty("--chat-avatar-size", size + "px");
        css.setProperty("--chat-avatar-radius", radius + "px");
        css.setProperty("--chat-avatar-offset-y", offsetY + "px");

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
        renderCountdown();
        renderLetters();
        renderCards();
        renderWidgetConfig();
        applySettings();
        applyHeroImages();
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
        saveData();
        applySettings();
        if (key.indexOf("appearance.avatar.") === 0) renderPreview();
    }

    function on(id, evt, fn) {
        var el = $(id);
        if (el) el.addEventListener(evt, fn);
    }
    function closeCardsMenu() { var m = $("cardsMenu"); if (m) m.hidden = true; }

    function bindEvents() {
        on("appChat", "click", function () { renderChat(); showScreen("chatView"); });
        on("appCards", "click", function () { activeCat = "全部"; renderCards(); showScreen("cardsView"); });
        on("appLetter", "click", function () { closeCompose(); renderLetters(); showScreen("letterView"); });
        on("appCountdown", "click", function () { renderCountdown(); showScreen("countdownView"); });
        on("appWidgets", "click", function () { renderWidgetConfig(); showScreen("widgetsView"); });
        on("appSettings", "click", function () { openSettings("main", "desktop"); });
        on("dockAppearance", "click", function () { openSettings("appearance", "desktop"); });
        on("dockPermission", "click", function () { openSettings("permission", "desktop"); });

        ["btnChatBack", "btnCardsBack", "btnCountdownBack", "btnLetterBack", "btnWidgetsBack"].forEach(function (id) {
            on(id, "click", goDesktop);
        });

        on("widgetSmallArea", "click", function () { renderWidgetConfig(); showScreen("widgetsView"); });

        on("btnAddCountdown", "click", openCdSheet);
        on("cdCancel", "click", closeCdSheet);
        on("cdMask", "click", closeCdSheet);
        on("cdSave", "click", saveCountdown);

        on("btnCompose", "click", openCompose);
        on("btnComposeCancel", "click", closeCompose);
        on("btnSendLetter", "click", sendLetter);

        on("btnCardsMore", "click", function (e) {
            e.stopPropagation();
            var menu = $("cardsMenu");
            if (menu) menu.hidden = !menu.hidden;
        });
        on("btnExportCards", "click", function () { exportCards(); closeCardsMenu(); });
        on("importCardsFile", "change", function () { importCards(this.files && this.files[0]); this.value = ""; closeCardsMenu(); });

        on("btnCardAdd", "click", openCardAdd);
        on("cardAddCancel", "click", closeCardModals);
        on("cardAddSave", "click", saveNewCards);
        on("cardEditCancel", "click", closeCardModals);
        on("cardEditSave", "click", saveCardEdit);
        on("catCancel", "click", closeCardModals);
        on("catSave", "click", saveCategory);

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
                if (sync) appData.cards.push({ id: uid(), kind: "sticker", content: result, category: "未分类", createdAt: Date.now() });
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

        bindSwipe($("countdownList"));
        bindSwipe($("cardList"));

        document.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;

            var insideSwipe = t.closest(".swipe-row");
            if (!insideSwipe) closeAllSwipe();

            var wtab = t.closest("[data-wtab]");
            if (wtab) {
                activeWidgetTab = wtab.getAttribute("data-wtab");
                renderWidgetTab();
                return;
            }

            var heroModeBtn = t.closest("[data-hero-mode]");
            if (heroModeBtn) {
                appData.heroConfig.mode = heroModeBtn.getAttribute("data-hero-mode");
                saveData(); applyHeroImages();
                return;
            }

            var tplBtn = t.closest("[data-tpl]");
            if (tplBtn) {
                appData.widgetConfig.template = tplBtn.getAttribute("data-tpl");
                saveData(); renderWidgetSmall(); renderWidgetConfig();
                return;
            }

            var clearBtn = t.closest("[data-icon-clear]");
            if (clearBtn) {
                var key = clearBtn.getAttribute("data-icon-clear");
                appData.settings.appearance.iconBg.icons[key] = "";
                saveData(); applySettings(); renderIconConfigs();
                return;
            }

            var cdDel = t.closest("[data-cd-del]");
            if (cdDel) {
                var cdId = cdDel.getAttribute("data-cd-del");
                appData.anniversaries = appData.anniversaries.filter(function (a) { return a.id !== cdId; });
                if (appData.activeCountdownId === cdId) appData.activeCountdownId = "";
                if (appData.widgetConfig.daysSourceId === cdId) appData.widgetConfig.daysSourceId = "";
                saveData(); renderCountdown(); renderWidgetSmall(); fillDaySourceSelect();
                return;
            }

            var cardDel = t.closest("[data-card-del]");
            if (cardDel) {
                var delId = cardDel.getAttribute("data-card-del");
                appData.cards = appData.cards.filter(function (c) { return c.id !== delId; });
                saveData(); renderCards();
                return;
            }

            var cardEdit = t.closest("[data-card-edit]");
            if (cardEdit) { openCardEdit(cardEdit.getAttribute("data-card-edit")); return; }

            var catBtn = t.closest("[data-cat]");
            if (catBtn) { activeCat = catBtn.getAttribute("data-cat"); renderCards(); return; }

            if (t.closest("#btnAddCat")) { openCatSheet(); return; }

            var kindBtn = t.closest("[data-kind]");
            if (kindBtn) {
                activeCardKind = kindBtn.getAttribute("data-kind");
                activeCat = "全部";
                renderCards();
                return;
            }

            var cdRow = t.closest("[data-cd-id]");
            if (cdRow && !cdRow.getAttribute("data-skip-click")) {
                appData.activeCountdownId = cdRow.getAttribute("data-cd-id");
                saveData(); renderCountdown(); renderWidgetSmall();
                return;
            }
            if (cdRow) cdRow.removeAttribute("data-skip-click");

            if (!t.closest("#cardsMenu") && !t.closest("#btnCardsMore")) closeCardsMenu();
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
            if (el.getAttribute("data-key")) { handleControl(el); return; }
            if (el.getAttribute("data-wcfg")) { handleWidgetControl(el); }
        });

        document.addEventListener("change", function (e) {
            var el = e.target;
            if (!el || !el.getAttribute) return;

            var hkey = el.getAttribute("data-hero-upload");
            if (hkey) {
                readImageFile(el.files && el.files[0], function (result) {
                    appData.heroConfig[hkey] = result;
                    saveData(); applyHeroImages();
                });
                el.value = "";
                return;
            }

            var wkey = el.getAttribute("data-wupload");
            if (wkey) {
                readImageFile(el.files && el.files[0], function (result) {
                    setPath(appData.widgetConfig, wkey, result);
                    saveData(); renderWidgetSmall();
                });
                el.value = "";
                return;
            }

            var iconKey = el.getAttribute("data-icon-upload");
            if (iconKey) {
                readImageFile(el.files && el.files[0], function (result) {
                    appData.settings.appearance.iconBg.icons[iconKey] = result;
                    saveData(); applySettings(); renderIconConfigs();
                });
                el.value = "";
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

        on("cardModalMask", "click", closeCardModals);

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
        renderCountdown();
        renderLetters();
        renderCards();
        renderWidgetConfig();
        applySettings();
        applyHeroImages();
        bindEvents();
        updateSendBtn();
        hideSplash();
        registerSW();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
