/* =========================================================
   大组件文字颜色（独立存储，不干扰主数据）
   ========================================================= */
(function () {
    "use strict";

    var KEY = "philos_hero_text";
    var PANE = null;

    function load() {
        try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
    }

    function save(v) {
        try { localStorage.setItem(KEY, v); } catch (e) {}
    }

    function apply() {
        var big = document.getElementById("widgetLarge");
        if (!big) return;
        var color = load();
        if (color) {
            big.classList.add("hero-text-custom");
            big.style.setProperty("--hero-text", color);
        } else {
            big.classList.remove("hero-text-custom");
            big.style.removeProperty("--hero-text");
        }
    }

    function buildRow() {
        var pane = document.querySelector('[data-wpane="hero"]');
        if (!pane || pane.querySelector("[data-hero-text-color]")) return;
        var card = pane.querySelector(".group-card");
        if (!card) return;

        var row = document.createElement("div");
        row.className = "control-row";
        row.innerHTML = '<span class="control-label">文字颜色</span>' +
            '<label class="color-dot"><input type="color" data-hero-text-color></label>';
        card.appendChild(row);

        var input = row.querySelector("[data-hero-text-color]");
        input.value = load() || (document.documentElement.getAttribute("data-theme") === "dark" ? "#f2f3f6" : "#1b1d21");
        input.addEventListener("input", function () {
            save(input.value);
            apply();
        });
    }

    function init() {
        buildRow();
        apply();
        /* 主题切换时回填一次 */
        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq && mq.addEventListener) {
            mq.addEventListener("change", function () {
                var input = document.querySelector("[data-hero-text-color]");
                if (input && !load()) {
                    input.value = mq.matches ? "#f2f3f6" : "#1b1d21";
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
