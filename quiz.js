/* Philos 出题 app + iMessage 表情包修正 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var mask = null, card = null, qInput = null, optWrap = null, resultEl = null, askBtn = null;
    var asking = false;

    function injectStyles() {
        if (document.getElementById("philos-quiz-style")) return;
        var st = document.createElement("style");
        st.id = "philos-quiz-style";
        st.textContent =
            ".qz-mask{position:fixed;inset:0;z-index:610;background:rgba(18,24,32,.34);display:none;align-items:center;justify-content:center;padding:20px;}" +
            ".qz-mask.show{display:flex;}" +
            ".qz-card{width:100%;max-width:360px;max-height:78vh;overflow-y:auto;border-radius:24px;padding:22px 20px;background:rgba(255,255,255,0.82);-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);border:2px solid #E5E5E5;box-shadow:0 24px 60px rgba(20,30,45,0.22);}" +
            "[data-theme=\"dark\"] .qz-card{background:rgba(30,32,37,0.82);border-color:#333;}" +
            ".qz-title{font-size:17px;font-weight:600;color:var(--text-primary,#1b1d21);margin-bottom:14px;}" +
            ".qz-q{width:100%;border:none;background:rgba(0,0,0,0.045);border-radius:14px;padding:12px 14px;font-size:16px;line-height:1.5;color:var(--text-primary,#1b1d21);outline:none;resize:none;min-height:62px;}" +
            ".qz-opt{display:flex;align-items:center;gap:8px;margin-top:10px;}" +
            ".qz-opt input{flex:1;min-width:0;border:none;background:rgba(0,0,0,0.045);border-radius:12px;padding:10px 12px;font-size:15px;color:var(--text-primary,#1b1d21);outline:none;}" +
            ".qz-opt input.chosen{background:rgba(91,127,166,0.22);font-weight:600;}" +
            ".qz-opt .qz-del{width:28px;height:28px;flex:0 0 auto;border:none;background:none;color:#ff3b30;font-size:16px;}" +
            ".qz-add{margin-top:10px;height:36px;width:100%;border:1px dashed #C9CFD6;border-radius:12px;background:none;color:#6b7683;font-size:13px;}" +
            ".qz-result{margin-top:14px;font-size:14px;line-height:1.6;color:var(--text-primary,#1b1d21);min-height:22px;}" +
            ".qz-actions{display:flex;gap:10px;margin-top:16px;}" +
            ".qz-btn{flex:1;height:44px;border-radius:14px;border:none;font-size:15px;font-weight:500;}" +
            ".qz-btn.ghost{background:rgba(125,140,160,0.14);color:var(--text-primary,#1b1d21);}" +
            ".qz-btn.primary{background:#5b7fa6;color:#fff;}" +
            ".qz-btn:disabled{opacity:.5;}" +
            ".sticker-del{display:none !important;}" +
            ".philos-im-del{position:absolute !important;top:3px !important;left:3px !important;width:20px !important;height:20px !important;border-radius:50% !important;background:rgba(0,0,0,.55) !important;color:#fff !important;font-size:13px !important;line-height:20px !important;text-align:center !important;z-index:6 !important;}";
        document.head.appendChild(st);
    }

    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function addOption(value) {
        var row = document.createElement("div");
        row.className = "qz-opt";
        var input = document.createElement("input");
        input.type = "text";
        input.placeholder = "选项";
        input.value = value || "";
        var del = document.createElement("button");
        del.type = "button";
        del.className = "qz-del";
        del.textContent = "×";
        del.addEventListener("click", function () {
            if (optWrap.querySelectorAll(".qz-opt").length <= 2) return;
            optWrap.removeChild(row);
        });
        row.appendChild(input);
        row.appendChild(del);
        optWrap.appendChild(row);
    }

    function build() {
        if (mask) return;
        injectStyles();
        mask = document.createElement("div");
        mask.className = "qz-mask";
        mask.id = "qzMask";
        card = document.createElement("div");
        card.className = "qz-card";
        card.innerHTML =
            '<div class="qz-title">出题</div>' +
            '<textarea class="qz-q" id="qzQuestion" placeholder="想问他的问题…"></textarea>' +
            '<div id="qzOptions"></div>' +
            '<button type="button" class="qz-add" id="qzAdd">+ 添加选项</button>' +
            '<div class="qz-result" id="qzResult"></div>' +
            '<div class="qz-actions"><button type="button" class="qz-btn ghost" id="qzClose">关闭</button><button type="button" class="qz-btn primary" id="qzAsk">让他答</button></div>';
        mask.appendChild(card);
        document.body.appendChild(mask);

        qInput = document.getElementById("qzQuestion");
        optWrap = document.getElementById("qzOptions");
        resultEl = document.getElementById("qzResult");
        askBtn = document.getElementById("qzAsk");

        document.getElementById("qzAdd").addEventListener("click", function () {
            if (optWrap.querySelectorAll(".qz-opt").length >= 4) return;
            addOption("");
        });
        document.getElementById("qzClose").addEventListener("click", close);
        mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
        askBtn.addEventListener("click", ask);
    }

    function reset() {
        qInput.value = "";
        optWrap.innerHTML = "";
        addOption("");
        addOption("");
        resultEl.textContent = "";
        asking = false;
        askBtn.disabled = false;
        askBtn.textContent = "让他答";
    }

    function open() {
        build();
        if (!optWrap.querySelector(".qz-opt")) reset();
        mask.classList.add("show");
    }

    function close() {
        if (mask) mask.classList.remove("show");
    }

    function ask() {
        if (asking) return;
        var q = qInput.value.trim();
        var opts = [];
        var inputs = optWrap.querySelectorAll(".qz-opt input");
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].classList.remove("chosen");
            var v = inputs[i].value.trim();
            if (v) opts.push({ el: inputs[i], text: v });
        }
        if (!q) { resultEl.textContent = "先写个问题。"; return; }
        if (opts.length < 2) { resultEl.textContent = "至少两个选项。"; return; }

        asking = true;
        askBtn.disabled = true;
        askBtn.textContent = "等他回答…";
        resultEl.textContent = "他在想…";

        var main = mainData();
        var perm = (main.settings && main.settings.permission) || {};
        var delay = Math.max(0.6, Number(perm.replyDelay) || 3) * 1000;

        setTimeout(function () {
            var pick = opts[Math.floor(Math.random() * opts.length)];
            pick.el.classList.add("chosen");
            resultEl.textContent = "他选了：" + pick.text;
            asking = false;
            askBtn.disabled = false;
            askBtn.textContent = "再答一次";
        }, delay);
    }

    function decorateIMStickers() {
        injectStyles();
        var grid = document.getElementById("stickerGrid");
        if (!grid) return;
        var cells = grid.querySelectorAll(".sticker-cell");
        for (var i = 0; i < cells.length; i++) {
            if (cells[i].querySelector(".philos-im-del")) continue;
            (function (cell) {
                var btn = document.createElement("span");
                btn.className = "philos-im-del";
                btn.textContent = "×";
                btn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var idx = Number(cell.getAttribute("data-sticker"));
                    if (!confirm("删除这个表情包？")) return;
                    try {
                        var data = JSON.parse(localStorage.getItem(MAIN_KEY) || "{}");
                        if (Array.isArray(data.stickers) && data.stickers[idx] != null) {
                            data.stickers.splice(idx, 1);
                            localStorage.setItem(MAIN_KEY, JSON.stringify(data));
                        }
                    } catch (err) {}
                    location.reload();
                });
                cell.appendChild(btn);
            })(cells[i]);
        }
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H32";
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { injectStyles(); decorateIMStickers(); markVersion(); });
    } else {
        setTimeout(function () { injectStyles(); decorateIMStickers(); markVersion(); }, 0);
    }

    setTimeout(function () { decorateIMStickers(); markVersion(); }, 1200);
    setTimeout(function () { decorateIMStickers(); markVersion(); }, 2600);
    if (window.MutationObserver) {
        var sg = document.getElementById("stickerGrid");
        if (sg) new MutationObserver(decorateIMStickers).observe(sg, { childList: true, subtree: true });
    }
})();
