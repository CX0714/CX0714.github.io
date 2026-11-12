/* Philos 出题 app v2 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var HIST_KEY = "philos_quiz_history";
    var LETTERS = ["A", "B", "C", "D"];

    var page = null, qInput = null, optWrap = null, askBtn = null, histBtn = null, histBox = null;
    var asking = false, showingHistory = false;

    function injectStyles() {
        if (document.getElementById("philos-quiz-style")) return;
        var st = document.createElement("style");
        st.id = "philos-quiz-style";
        st.textContent =
            ".qz-page{position:fixed;inset:0;z-index:610;display:none;flex-direction:column;background:rgba(250,251,252,0.78);-webkit-backdrop-filter:blur(26px) saturate(115%);backdrop-filter:blur(26px) saturate(115%);}" +
            ".qz-page.show{display:flex;}" +
            "[data-theme=\"dark\"] .qz-page{background:rgba(26,28,32,0.78);}" +
            ".qz-top{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 10px) 16px 10px;}" +
            ".qz-top .nav-back{background:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.6);}" +
            ".qz-name{font-size:20px;font-weight:600;color:var(--text-primary,#1b1d21);}" +
            ".qz-body{flex:1;min-height:0;overflow-y:auto;padding:6px 16px calc(env(safe-area-inset-bottom) + 24px);}" +
            ".qz-q{width:100%;box-sizing:border-box;border:none;background:rgba(255,255,255,0.62);border-radius:16px;padding:14px;font-size:16px;line-height:1.5;color:var(--text-primary,#1b1d21);outline:none;resize:none;min-height:78px;box-shadow:0 6px 18px rgba(70,95,125,0.08);}" +
            "[data-theme=\"dark\"] .qz-q{background:rgba(255,255,255,0.08);}" +
            ".qz-opt{display:flex;align-items:center;gap:10px;margin-top:10px;background:rgba(255,255,255,0.55);border-radius:14px;padding:6px 12px;}" +
            "[data-theme=\"dark\"] .qz-opt{background:rgba(255,255,255,0.07);}" +
            ".qz-letter{flex:0 0 auto;width:20px;font-size:15px;color:var(--text-secondary,#8b909a);text-align:center;}" +
            ".qz-opt input{flex:1;min-width:0;border:none;background:transparent;padding:8px 0;font-size:15px;color:var(--text-primary,#1b1d21);outline:none;}" +
            ".qz-opt.chosen{background:rgba(91,127,166,0.13);}" +
            ".qz-opt.chosen .qz-letter,.qz-opt.chosen input{color:#4a6b8c;}" +
            "[data-theme=\"dark\"] .qz-opt.chosen{background:rgba(91,127,166,0.22);}" +
            "[data-theme=\"dark\"] .qz-opt.chosen .qz-letter,[data-theme=\"dark\"] .qz-opt.chosen input{color:#c9d8e6;}" +
            ".qz-add{margin-top:12px;height:38px;width:100%;border:1px dashed rgba(120,135,155,0.45);border-radius:12px;background:none;color:var(--text-secondary,#8b909a);font-size:13px;}" +
            ".qz-actions{display:flex;flex-direction:column;gap:10px;margin-top:18px;}" +
            ".qz-btn{width:100%;height:46px;border-radius:14px;border:none;font-size:15px;font-weight:500;}" +
            ".qz-btn.primary{background:#5b7fa6;color:#fff;}" +
            ".qz-btn.ghost{background:rgba(255,255,255,0.62);color:var(--text-primary,#1b1d21);border:1px solid rgba(255,255,255,0.7);}" +
            "[data-theme=\"dark\"] .qz-btn.ghost{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.1);}" +
            ".qz-btn:disabled{opacity:.5;}" +
            ".qz-hist{margin-top:16px;display:none;flex-direction:column;gap:12px;}" +
            ".qz-hist.show{display:flex;}" +
            ".qz-hist-item{background:rgba(255,255,255,0.6);border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(70,95,125,0.07);}" +
            "[data-theme=\"dark\"] .qz-hist-item{background:rgba(255,255,255,0.07);}" +
            ".qz-hist-q{font-size:15px;font-weight:600;color:var(--text-primary,#1b1d21);margin-bottom:8px;}" +
            ".qz-hist-opt{font-size:14px;line-height:1.7;color:var(--text-secondary,#8b909a);}" +
            ".qz-hist-opt.chosen{color:#4a6b8c;background:rgba(91,127,166,0.13);border-radius:8px;padding:2px 8px;}" +
            "[data-theme=\"dark\"] .qz-hist-opt.chosen{color:#c9d8e6;}" +
            ".qz-empty{font-size:13px;color:var(--text-secondary,#8b909a);text-align:center;padding:24px 0;}";
        document.head.appendChild(st);
    }

    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function loadHist() { try { var v = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function saveHist(list) { try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {} }

    function addOption(value) {
        var row = document.createElement("div");
        row.className = "qz-opt";
        var letter = document.createElement("span");
        letter.className = "qz-letter";
        letter.textContent = LETTERS[optWrap.querySelectorAll(".qz-opt").length] || "";
        var input = document.createElement("input");
        input.type = "text";
        input.placeholder = "选项";
        input.value = value || "";
        row.appendChild(letter);
        row.appendChild(input);
        optWrap.appendChild(row);
    }

    function relabel() {
        var rows = optWrap.querySelectorAll(".qz-opt");
        for (var i = 0; i < rows.length; i++) {
            var l = rows[i].querySelector(".qz-letter");
            if (l) l.textContent = LETTERS[i] || "";
        }
    }

    function renderHistory() {
        if (!histBox) return;
        var list = loadHist();
        histBox.innerHTML = "";
        if (!list.length) {
            var p = document.createElement("div");
            p.className = "qz-empty";
            p.textContent = "还没有历史题目";
            histBox.appendChild(p);
            return;
        }
        list.forEach(function (item) {
            var card = document.createElement("div");
            card.className = "qz-hist-item";
            var q = document.createElement("div");
            q.className = "qz-hist-q";
            q.textContent = item.q || "";
            card.appendChild(q);
            (item.opts || []).forEach(function (text, i) {
                var o = document.createElement("div");
                o.className = "qz-hist-opt" + (i === item.pick ? " chosen" : "");
                o.textContent = (LETTERS[i] || "") + "． " + text;
                card.appendChild(o);
            });
            histBox.appendChild(card);
        });
    }

    function build() {
        if (page) return;
        injectStyles();
        page = document.createElement("div");
        page.className = "qz-page";
        page.id = "qzPage";
        page.innerHTML =
            '<div class="qz-top"><button class="nav-back" id="qzBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><span class="qz-name">题目</span></div>' +
            '<div class="qz-body">' +
                '<textarea class="qz-q" id="qzQuestion" placeholder="想问他的问题…"></textarea>' +
                '<div id="qzOptions"></div>' +
                '<button type="button" class="qz-add" id="qzAdd">+ 添加选项</button>' +
                '<div class="qz-actions">' +
                    '<button type="button" class="qz-btn primary" id="qzAsk">让他来答</button>' +
                    '<button type="button" class="qz-btn ghost" id="qzHistBtn">查看历史题目</button>' +
                '</div>' +
                '<div class="qz-hist" id="qzHist"></div>' +
            '</div>';
        document.body.appendChild(page);

        qInput = document.getElementById("qzQuestion");
        optWrap = document.getElementById("qzOptions");
        askBtn = document.getElementById("qzAsk");
        histBtn = document.getElementById("qzHistBtn");
        histBox = document.getElementById("qzHist");

        document.getElementById("qzBack").addEventListener("click", close);
        document.getElementById("qzAdd").addEventListener("click", function () {
            if (optWrap.querySelectorAll(".qz-opt").length >= 4) return;
            addOption("");
            relabel();
        });
        askBtn.addEventListener("click", ask);
        histBtn.addEventListener("click", function () {
            showingHistory = !showingHistory;
            histBox.classList.toggle("show", showingHistory);
            histBtn.textContent = showingHistory ? "收起历史题目" : "查看历史题目";
            if (showingHistory) renderHistory();
        });
    }

    function reset() {
        qInput.value = "";
        optWrap.innerHTML = "";
        addOption("");
        addOption("");
        relabel();
        asking = false;
        askBtn.disabled = false;
        askBtn.textContent = "让他来答";
        showingHistory = false;
        if (histBox) histBox.classList.remove("show");
        if (histBtn) histBtn.textContent = "查看历史题目";
    }

    function open() {
        build();
        if (!optWrap.querySelector(".qz-opt")) reset();
        page.classList.add("show");
    }

    function close() {
        if (page) page.classList.remove("show");
    }

    function ask() {
        if (asking) return;
        var q = qInput.value.trim();
        var rows = optWrap.querySelectorAll(".qz-opt");
        var opts = [];
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.remove("chosen");
            var input = rows[i].querySelector("input");
            var v = input ? input.value.trim() : "";
            if (v) opts.push({ row: rows[i], text: v });
        }
        if (!q) { alert("先写个问题。"); return; }
        if (opts.length < 2) { alert("至少两个选项。"); return; }

        asking = true;
        askBtn.disabled = true;
        askBtn.textContent = "等他回答…";

        var main = mainData();
        var perm = (main.settings && main.settings.permission) || {};
        var delay = Math.max(0.6, Number(perm.replyDelay) || 3) * 1000;

        setTimeout(function () {
            var idx = Math.floor(Math.random() * opts.length);
            var pick = opts[idx];
            pick.row.classList.add("chosen");

            var hist = loadHist();
            hist.unshift({ q: q, opts: opts.map(function (o) { return o.text; }), pick: idx, time: Date.now() });
            saveHist(hist);
            if (showingHistory) renderHistory();

            asking = false;
            askBtn.disabled = false;
            askBtn.textContent = "让他来答";
        }, delay);
    }

    function markVersion() {
        try {
            var about = document.querySelector('[data-page="about"]'); if (!about) return;
            var items = about.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H33";
                }
            }
        } catch (e) {}
    }

    document.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("#btnQuiz") : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        open();
    }, true);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markVersion);
    else setTimeout(markVersion, 0);
})();
