/* =========================================================
   大组件文字颜色 + 主屏分页（独立脚本，网络优先加载）
   ========================================================= */
(function () {
    "use strict";

    /* ---------- 一、大组件文字颜色 ---------- */
    var KEY = "philos_hero_text";
    var PRESETS = ["#1b1d21", "#ffffff", "#5b7fa6", "#8b909a", "#c9d3de"];

    function load() {
        try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
    }

    function save(value) {
        try {
            if (value) localStorage.setItem(KEY, value);
            else localStorage.removeItem(KEY);
        } catch (e) {}
    }

    function isDark() {
        return document.documentElement.getAttribute("data-theme") === "dark";
    }

    function defaultColor() {
        return isDark() ? "#f4f5f7" : "#1b1d21";
    }

    function applyHeroColor() {
        var big = document.getElementById("widgetLarge");
        if (!big) return;
        var color = load();
        big.classList.toggle("hero-text-custom", !!color);
        if (color) big.style.setProperty("--hero-text", color);
        else big.style.removeProperty("--hero-text");
    }

    function syncPresets(card, color) {
        if (!card) return;
        var btns = card.querySelectorAll("[data-hero-text-preset]");
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle(
                "active",
                btns[i].getAttribute("data-hero-text-preset").toLowerCase() === String(color || "").toLowerCase()
            );
        }
    }

    function buildHeroRow() {
        var pane = document.querySelector('[data-wpane="hero"]');
        if (!pane || pane.querySelector("[data-hero-text-card]")) return;
        var anchor = pane.querySelector(".group-card");
        if (!anchor) return;

        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-hero-text-card", "");

        var swatches = PRESETS.map(function (color) {
            return '<button class="hero-swatch" type="button" data-hero-text-preset="' + color +
                '" style="background:' + color + '" aria-label="' + color + '"></button>';
        }).join("");

        card.innerHTML =
            '<div class="hero-group-title">文字颜色</div>' +
            '<div class="control-row">' +
                '<span class="control-label">四行文字</span>' +
                '<div class="row-actions">' +
                    '<label class="color-dot"><input type="color" data-hero-text-color></label>' +
                    '<button class="clear-text" type="button" data-hero-text-clear>恢复默认</button>' +
                '</div>' +
            '</div>' +
            '<div class="hero-color-presets">' + swatches + '</div>';

        anchor.parentNode.insertBefore(card, anchor.nextSibling);

        var input = card.querySelector("[data-hero-text-color]");
        var current = load();
        input.value = current || defaultColor();
        syncPresets(card, current);

        input.addEventListener("input", function () {
            save(input.value);
            applyHeroColor();
            syncPresets(card, input.value);
        });

        card.addEventListener("click", function (e) {
            var target = e.target;
            if (!target || !target.closest) return;

            var preset = target.closest("[data-hero-text-preset]");
            if (preset) {
                input.value = preset.getAttribute("data-hero-text-preset");
                save(input.value);
                applyHeroColor();
                syncPresets(card, input.value);
                return;
            }

            if (target.closest("[data-hero-text-clear]")) {
                save("");
                input.value = defaultColor();
                applyHeroColor();
                syncPresets(card, "");
            }
        });
    }

    /* ---------- 二、主屏分页 ---------- */
    function injectHomeStyles() {
        if (document.getElementById("philos-home-style")) return;
        var st = document.createElement("style");
        st.id = "philos-home-style";
        st.textContent =
            ".desktop-content{overflow:hidden !important;}" +
            ".home-pager{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;width:100%;}" +
            ".home-pager::-webkit-scrollbar{display:none;}" +
            ".home-page{flex:0 0 100%;width:100%;scroll-snap-align:start;display:flex;flex-direction:column;gap:20px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:4px;}" +
            ".home-app-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;width:100%;}" +
            ".home-page .app-icon{grid-template-rows:auto auto;}" +
            ".home-page .app-icon-box{width:100%;height:auto;aspect-ratio:1 / 1;max-width:100%;}" +
            ".dock{grid-template-columns:repeat(3,1fr) !important;}";
        document.head.appendChild(st);
    }

    function makeApp(id, label, symbol) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "app-icon";
        btn.id = id;
        btn.innerHTML =
            '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + symbol + '"></use></svg></span>' +
            '<span class="app-label">' + label + '</span>';
        return btn;
    }

    function bindOnce(btn, handler) {
        if (!btn || btn.getAttribute("data-hbind")) return;
        btn.setAttribute("data-hbind", "1");
        btn.addEventListener("click", handler);
    }

    function fillSmallWidget() {
        var el = document.getElementById("widgetSmallArea");
        if (!el || (el.textContent || "").trim()) return;
        try {
            var data = JSON.parse(localStorage.getItem("private_chat_app_v1") || "{}");
            var cfg = data.widgetConfig || {};
            if (cfg.template) return;
            var item = null;
            var list = data.anniversaries || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === data.activeCountdownId) { item = list[i]; break; }
            }
            if (!item) {
                el.innerHTML = '<span class="ws-placeholder">Select Widget</span>';
                return;
            }
            var d = new Date(item.date + "T00:00:00");
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var days = Math.floor((today - d) / 86400000);
            var label = days >= 0 ? "第 " + (days + 1) + " 天" : "还有 " + (-days) + " 天";
            el.innerHTML = '<div class="ws-widget"><div class="ws-widget-title">' + item.title + '</div><div class="ws-widget-days">' + label + '</div></div>';
        } catch (e) {}
    }

    function grab(id, label, symbol) {
        var el = document.getElementById(id);
        if (el) return el;
        return makeApp(id, label, symbol);
    }

    function buildHomePages() {
        var content = document.querySelector(".desktop-content");
        if (!content) return;
        var dock = content.querySelector(".dock");
        var widget = document.getElementById("widgetLarge");
        if (!dock || !widget) return;

        var pager = content.querySelector(".home-pager");
        if (!pager) {
            pager = document.createElement("div");
            pager.className = "home-pager";
            pager.id = "homePager";
            pager.innerHTML = '<section class="home-page"></section><section class="home-page"></section>';
            content.insertBefore(pager, dock);
        }
        var page1 = pager.children[0];
        var page2 = pager.children[1];
        if (!page2) {
            page2 = document.createElement("section");
            page2.className = "home-page";
            pager.appendChild(page2);
        }

        if (widget.parentNode !== page1) page1.insertBefore(widget, page1.firstChild);

        var small = document.getElementById("widgetSmallArea");
        if (!small) {
            small = document.createElement("div");
            small.className = "widget-small";
            small.id = "widgetSmallArea";
            small.setAttribute("role", "button");
            small.setAttribute("tabindex", "0");
        }

        var chatBtn = grab("appChat", "iMessage", "ic-chat");
        var setBtn = grab("appSettings", "设置", "ic-gear");
        var widgetsBtn = grab("appWidgets", "小组件", "ic-grid");
        var letterBtn = grab("appLetter", "信箱", "ic-mail");
        var cdBtn = grab("appCountdown", "倒数日", "ic-calendar");
        var phoneBtn = grab("btnPhone", "电话", "ic-phone");
        var wechatBtn = grab("btnWechat", "微信", "ic-chat");
        var galleryBtn = grab("btnGallery", "图库", "ic-image");
        var quizBtn = grab("btnQuiz", "出题", "ic-card");
        var freqBtn = grab("btnFreq", "频率", "ic-calendar");

        /* 第一页：清掉旧网格后重建 */
        var olds = page1.querySelectorAll(".icon-grid, .home-app-grid, .app-grid-small");
        for (var i = 0; i < olds.length; i++) {
            if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
        }

        var iconGrid = document.createElement("div");
        iconGrid.className = "icon-grid";
        var appGrid = document.createElement("div");
        appGrid.className = "app-grid-small";
        appGrid.appendChild(phoneBtn);
        appGrid.appendChild(chatBtn);
        appGrid.appendChild(wechatBtn);
        appGrid.appendChild(setBtn);
        iconGrid.appendChild(small);
        iconGrid.appendChild(appGrid);
        page1.appendChild(iconGrid);

        /* 第二页：四列，图标与 app 同尺寸 */
        var oldGrid = page2.querySelector(".home-app-grid");
        if (oldGrid && oldGrid.parentNode) oldGrid.parentNode.removeChild(oldGrid);
        var grid2 = document.createElement("div");
        grid2.className = "home-app-grid";
        grid2.appendChild(widgetsBtn);
        grid2.appendChild(letterBtn);
        grid2.appendChild(cdBtn);
        grid2.appendChild(galleryBtn);
        grid2.appendChild(quizBtn);
        grid2.appendChild(freqBtn);
        page2.appendChild(grid2);

        bindOnce(phoneBtn, function () {
            var chat = document.getElementById("appChat");
            if (chat) chat.click();
            setTimeout(function () {
                var call = document.getElementById("btnChatCall");
                if (call) call.click();
            }, 150);
        });
        bindOnce(wechatBtn, function () { alert("微信聊天还在搭，等气泡 CSS。"); });
        bindOnce(galleryBtn, function () { alert("图库还没做。"); });
        bindOnce(quizBtn, function () { alert("出题还没做。"); });
        bindOnce(freqBtn, function () { alert("频率还没拆分。"); });

        fillSmallWidget();
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]');
            if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H3";
                }
            }
        } catch (e) {}
    }

    function init() {
        buildHeroRow();
        applyHeroColor();
        injectHomeStyles();
        buildHomePages();
        markVersion();
        setTimeout(buildHomePages, 400);
        setTimeout(buildHomePages, 1200);

        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq && mq.addEventListener) {
            mq.addEventListener("change", function () {
                var input = document.querySelector("[data-hero-text-color]");
                if (input && !load()) {
                    input.value = defaultColor();
                    syncPresets(input.closest("[data-hero-text-card]"), "");
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.addEventListener("load", function () {
        buildHomePages();
        setTimeout(buildHomePages, 600);
    });
})();
