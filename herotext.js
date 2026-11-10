/* =========================================================
   大组件文字颜色 + 主屏分页（独立脚本，不依赖 SW 注入）
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
            ".home-app-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;width:100%;align-content:start;}" +
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

    function buildHomePages() {
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

        var page1 = document.createElement("section");
        page1.className = "home-page";
        var page2 = document.createElement("section");
        page2.className = "home-page";

        var grid1 = document.createElement("div");
        grid1.className = "home-app-grid";
        var grid2 = document.createElement("div");
        grid2.className = "home-app-grid";

        page1.appendChild(widget);
        page1.appendChild(grid1);
        page2.appendChild(grid2);

        var chatBtn = document.getElementById("appChat");
        var setBtn = document.getElementById("appSettings");
        var letterBtn = document.getElementById("appLetter");
        var cdBtn = document.getElementById("appCountdown");
        var widgetsBtn = document.getElementById("appWidgets");

        var phoneBtn = makeApp("btnPhone", "电话", "ic-phone");
        var wechatBtn = makeApp("btnWechat", "微信", "ic-chat");
        var galleryBtn = makeApp("btnGallery", "图库", "ic-image");
        var quizBtn = makeApp("btnQuiz", "出题", "ic-card");
        var freqBtn = makeApp("btnFreq", "频率", "ic-calendar");

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

        phoneBtn.addEventListener("click", function () {
            var chat = document.getElementById("appChat");
            if (chat) chat.click();
            setTimeout(function () {
                var call = document.getElementById("btnChatCall");
                if (call) call.click();
            }, 140);
        });
        wechatBtn.addEventListener("click", function () { alert("微信聊天还在搭，等气泡 CSS。"); });
        galleryBtn.addEventListener("click", function () { alert("图库还没做。"); });
        quizBtn.addEventListener("click", function () { alert("出题还没做。"); });
        freqBtn.addEventListener("click", function () { alert("频率还没拆分。"); });
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]');
            if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H1";
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
