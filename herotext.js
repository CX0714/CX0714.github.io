/* =========================================================
   大组件四行文字颜色（独立存储，不干扰主数据）
   ========================================================= */
(function () {
    "use strict";

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

    function apply() {
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

    function buildRow() {
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
            apply();
            syncPresets(card, input.value);
        });

        card.addEventListener("click", function (e) {
            var target = e.target;
            if (!target || !target.closest) return;

            var preset = target.closest("[data-hero-text-preset]");
            if (preset) {
                input.value = preset.getAttribute("data-hero-text-preset");
                save(input.value);
                apply();
                syncPresets(card, input.value);
                return;
            }

            if (target.closest("[data-hero-text-clear]")) {
                save("");
                input.value = defaultColor();
                apply();
                syncPresets(card, "");
            }
        });
    }

    function init() {
        buildRow();
        apply();
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
})();
