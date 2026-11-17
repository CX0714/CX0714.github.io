/* Philos 小修：字卡库自绘导入导出菜单、覆盖层定位、小组件图片放大、第二页下移、
   只发图片/表情包也会收到回复、点聊天顶部头像让他主动开口 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";

    function $(id) { return document.getElementById(id); }
    function getMain() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function injectStyles() {
        if (document.getElementById("philos-fixes-style")) return;
        var st = document.createElement("style");
        st.id = "philos-fixes-style";
        st.textContent =
            /* 自绘菜单：颜色写死，不跟主题变量 */
            ".phm-mask{position:fixed;inset:0;z-index:900;background:rgba(16,20,26,0.28);display:none;}" +
            ".phm-mask.show{display:block;}" +
            ".phm-menu{position:fixed;z-index:901;min-width:152px;padding:6px;border-radius:16px;" +
                "background:#ffffff;border:1px solid rgba(120,135,155,0.25);box-shadow:0 14px 34px rgba(20,30,45,0.22);" +
                "display:none;flex-direction:column;gap:4px;}" +
            ".phm-menu.show{display:flex;}" +
            ".phm-item{height:44px;line-height:44px;padding:0 16px;border-radius:12px;border:none;background:none;" +
                "font-size:15px;text-align:left;color:#1b1d21;}" +
            ".phm-item:active{background:rgba(120,132,148,0.16);}" +
            "html[data-theme=\"dark\"] .phm-menu{background:#1c1d21;border-color:rgba(255,255,255,0.14);box-shadow:0 14px 34px rgba(0,0,0,0.45);}" +
            "html[data-theme=\"dark\"] .phm-item{color:#f2f3f6;}" +
            "html[data-theme=\"dark\"] .phm-item:active{background:rgba(255,255,255,0.10);}" +
            /* 原菜单也顺手修好，万一还会露出 */
            ".cards-menu{z-index:80 !important;background:#ffffff !important;border:1px solid rgba(120,135,155,0.25) !important;" +
                "box-shadow:0 14px 34px rgba(20,30,45,0.22) !important;border-radius:16px !important;padding:6px !important;}" +
            ".cards-menu .msg-menu-item{color:#1b1d21 !important;font-size:15px !important;height:44px !important;line-height:44px !important;text-align:left !important;}" +
            "html[data-theme=\"dark\"] .cards-menu{background:#1c1d21 !important;border-color:rgba(255,255,255,0.14) !important;}" +
            "html[data-theme=\"dark\"] .cards-menu .msg-menu-item{color:#f2f3f6 !important;}" +
            /* 二级界面从导航栏下方开始 */
            ".ck-overview,.ck-sub{top:calc(env(safe-area-inset-top) + 56px) !important;}" +
            /* 小组件 A/B 图片放大 */
            ".ws-a{padding:8px !important;gap:6px !important;}" +
            ".ws-a-title{font-size:10.5px !important;margin-bottom:1px;}" +
            ".ws-a-row{gap:7px !important;}" +
            ".ws-a-avatar{width:58px !important;height:58px !important;}" +
            ".ws-a-days{font-size:19px !important;}" +
            ".ws-b{padding:8px !important;gap:6px !important;}" +
            ".ws-b-title{font-size:10.5px !important;}" +
            ".ws-b-card{width:104px !important;height:104px !important;}" +
            ".ws-c-img{height:56% !important;}" +
            /* 主屏第二页下移一行 */
            "#homePager > .home-page:nth-child(2) .home-app-grid{padding-top:84px !important;}";
        document.head.appendChild(st);
    }

    /* ===== 自绘「三个点」菜单 ===== */
    var menuEl = null, maskEl = null;

    function buildMenu() {
        if (menuEl) return;
        maskEl = document.createElement("div");
        maskEl.className = "phm-mask";
        maskEl.id = "phmMask";
        menuEl = document.createElement("div");
        menuEl.className = "phm-menu";
        menuEl.id = "phmMenu";
        menuEl.innerHTML =
            '<button class="phm-item" type="button" data-phm="export">导出字卡</button>' +
            '<button class="phm-item" type="button" data-phm="import">导入字卡</button>';
        document.body.appendChild(maskEl);
        document.body.appendChild(menuEl);

        maskEl.addEventListener("click", closeMenu);
        menuEl.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-phm]") : null;
            if (!btn) return;
            var act = btn.getAttribute("data-phm");
            closeMenu();
            if (act === "export") {
                var ex = $("btnExportCards");
                if (ex) ex.click();
                else alert("导出按钮没找到。");
            } else {
                var im = $("importCardsFile");
                if (im) im.click();
                else alert("导入按钮没找到。");
            }
        });
    }

    function openMenu(anchor) {
        buildMenu();
        var rect = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth - 60, bottom: 70, right: window.innerWidth - 16 };
        menuEl.classList.add("show");
        maskEl.classList.add("show");
        var mw = menuEl.offsetWidth || 152;
        var mh = menuEl.offsetHeight || 100;
        var left = Math.min(window.innerWidth - mw - 12, Math.max(12, rect.right - mw));
        var top = Math.min(window.innerHeight - mh - 20, rect.bottom + 8);
        menuEl.style.left = left + "px";
        menuEl.style.top = top + "px";
    }

    function closeMenu() {
        if (menuEl) menuEl.classList.remove("show");
        if (maskEl) maskEl.classList.remove("show");
    }

    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var more = t.closest("#btnCardsMore");
        if (!more) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        openMenu(more);
    }, true);

    function fixMenu() {
        /* 原菜单如果被打开，颜色也已经是浅底深字，这里只补层级 */
        var old = $("cardsMenu");
        if (old && old.style.zIndex !== "80") old.style.zIndex = "80";
        if (old && !old.hidden) old.hidden = true;
        var layer = document.querySelector("[data-card-overview]");
        if (layer) {
            var want = "calc(env(safe-area-inset-top) + 56px)";
            if (layer.style.top !== want) layer.style.top = want;
        }
        var sub = document.querySelector("[data-ck-subpage]");
        if (sub) {
            var want2 = "calc(env(safe-area-inset-top) + 56px)";
            if (sub.style.top !== want2) sub.style.top = want2;
        }
    }

    /* ===== 他说话的公共件 ===== */
    function pools() {
        var d = getMain();
        var p = { text: [], emoji: [], sticker: [] };
        (d.cards || []).forEach(function (c) {
            if (!c || typeof c.content !== "string" || !c.content) return;
            if (c.kind === "text") p.text.push(c.content);
            else if (c.kind === "emoji") p.emoji.push(c.content);
            else if (c.kind === "sticker" && /^(data:image\/|https?:\/\/|blob:|idb:\/\/)/.test(c.content)) p.sticker.push(c.content);
        });
        return p;
    }
    function perm() {
        var d = getMain();
        return (d.settings && d.settings.permission) || {};
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function say(msg) {
        if (!msg) return;
        if (!msg.time) msg.time = Date.now();
        if (window.philosPushMessage) { window.philosPushMessage(msg); return; }
        var d = getMain();
        d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        d.chatHistory.push(msg);
        try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {}
        if (window.philosRefreshChat) window.philosRefreshChat();
    }

    function composeOne() {
        var p = pools();
        var pr = perm();
        var modes = pr.replyModes || {};
        function w(k, dft) { var c = modes[k]; return c && typeof c.weight === "number" ? c.weight : dft; }
        var cand = [];
        if (p.text.length) cand.push({ k: "text", w: w("text", 40) });
        if (p.emoji.length) cand.push({ k: "emoji", w: w("emoji", 10) });
        if (p.sticker.length) cand.push({ k: "sticker", w: w("sticker", 10) });
        if (p.text.length) cand.push({ k: "textEmoji", w: w("textEmoji", 20) });
        if (p.text.length >= 2) cand.push({ k: "combo", w: w("combo", 20) });
        var total = 0;
        cand.forEach(function (c) { if (c.w > 0) total += c.w; });
        if (!total) {
            if (p.text.length) return { from: "ta", type: "text", text: pick(p.text), status: "" };
            if (p.emoji.length) return { from: "ta", type: "text", text: pick(p.emoji), status: "" };
            if (p.sticker.length) return { from: "ta", type: "sticker", text: pick(p.sticker), status: "" };
            return null;
        }
        var r = Math.random() * total, mode = "text";
        for (var i = 0; i < cand.length; i++) {
            if (cand[i].w <= 0) continue;
            r -= cand[i].w;
            if (r <= 0) { mode = cand[i].k; break; }
        }
        if (mode === "text") return { from: "ta", type: "text", text: pick(p.text), status: "" };
        if (mode === "emoji") return { from: "ta", type: "text", text: pick(p.emoji), status: "" };
        if (mode === "sticker") return { from: "ta", type: "sticker", text: pick(p.sticker), status: "" };
        if (mode === "textEmoji") {
            var t = pick(p.text);
            var n = 1 + Math.floor(Math.random() * 2);
            if (p.emoji.length) for (var j = 0; j < n; j++) t += pick(p.emoji);
            return { from: "ta", type: "text", text: t, status: "" };
        }
        var rest = p.text.slice(), out = [];
        var max = Math.max(2, Math.min(6, Number(pr.comboMax) || 3));
        var cnt = 2 + Math.floor(Math.random() * (max - 1));
        while (rest.length && out.length < cnt) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
        return { from: "ta", type: "text", text: out.join("，"), status: "" };
    }

    var replying = false;
    function replyOnce(minCount, maxCount) {
        if (replying) return;
        replying = true;
        var pr = perm();
        var delay = Math.max(0, Number(pr.replyDelay) || 3) * 1000;
        var lo = Math.max(1, Math.min(minCount || Number(pr.replyMin) || 1, 5));
        var hi = Math.max(lo, Math.min(maxCount || Number(pr.replyMax) || lo, 5));
        var count = lo + Math.floor(Math.random() * (hi - lo + 1));
        setTimeout(function () {
            var sent = 0;
            function step() {
                var msg = composeOne();
                if (!msg || sent >= count) { replying = false; return; }
                say(msg);
                sent++;
                if (sent >= count) { replying = false; return; }
                setTimeout(step, 900 + Math.random() * 700);
            }
            step();
        }, delay + 300);
    }

    var lastLen = -1;
    function watchMyMedia() {
        var d = getMain();
        var h = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        if (lastLen < 0) { lastLen = h.length; return; }
        if (h.length === lastLen) return;
        var prev = lastLen;
        lastLen = h.length;
        if (h.length < prev) return;
        var last = h[h.length - 1];
        if (!last || last.from !== "me") return;
        if (last.type === "sticker" || last.type === "image") {
            replyOnce(Number(perm().replyMin) || 1, Number(perm().replyMax) || 3);
        }
    }

    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.closest(".chat-center") && !t.closest("#headerAvatar") && !t.closest("#headerName")) return;
        var chat = $("chatView");
        if (!chat || !chat.classList.contains("active")) return;
        e.stopPropagation();
        if (replying) return;
        replying = true;
        setTimeout(function () {
            var n = 1 + Math.floor(Math.random() * 3);
            var sent = 0;
            function step() {
                var msg = composeOne();
                if (!msg || sent >= n) { replying = false; return; }
                say(msg);
                sent++;
                if (sent >= n) { replying = false; return; }
                setTimeout(step, 1000 + Math.random() * 800);
            }
            step();
        }, 900);
    }, true);

    function tick() {
        if (document.hidden) return;
        injectStyles();
        fixMenu();
        watchMyMedia();
    }

    function init() {
        injectStyles();
        buildMenu();
        fixMenu();
        setInterval(tick, 1200);
        window.addEventListener("focus", tick);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
