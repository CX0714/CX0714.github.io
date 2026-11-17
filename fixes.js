/* Philos 小修：字卡库菜单（配色/层级）、覆盖层定位、小组件图片放大、主屏第二页下移、
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
            /* 字卡库三个点菜单：浅色卡片底 + 清楚的字 + 压在最上层 */
            ".cards-menu{z-index:80 !important;background:var(--card-bg,#ffffff) !important;" +
                "border:1px solid var(--glass-border,rgba(255,255,255,.6)) !important;" +
                "box-shadow:0 12px 30px rgba(20,30,45,.18) !important;border-radius:16px !important;" +
                "padding:6px !important;display:flex;flex-direction:column;gap:4px;min-width:130px;}" +
            ".cards-menu .msg-menu-item{color:var(--text-primary,#1b1d21) !important;font-size:15px !important;" +
                "height:40px !important;line-height:40px !important;text-align:left !important;" +
                "padding:0 14px !important;border-radius:11px !important;}" +
            ".cards-menu .msg-menu-item:active{background:rgba(120,132,148,.14) !important;}" +
            ".cards-menu .msg-menu-item + .msg-menu-item{border-top:none !important;}" +
            /* 二级界面从导航栏下方开始，绝不盖住顶栏 */
            ".ck-overview,.ck-sub{top:calc(env(safe-area-inset-top) + 56px) !important;}" +
            /* 小组件 A/B 图片放大、留白收紧 */
            ".ws-a{padding:8px !important;gap:6px !important;}" +
            ".ws-a-title{font-size:10.5px !important;margin-bottom:1px;}" +
            ".ws-a-row{gap:7px !important;}" +
            ".ws-a-avatar{width:58px !important;height:58px !important;}" +
            ".ws-a-days{font-size:19px !important;}" +
            ".ws-b{padding:8px !important;gap:6px !important;}" +
            ".ws-b-title{font-size:10.5px !important;}" +
            ".ws-b-card{width:104px !important;height:104px !important;}" +
            ".ws-c-img{height:56% !important;}" +
            /* 主屏第二页整体下移一行（给新小组件留位置） */
            "#homePager > .home-page:nth-child(2) .home-app-grid{padding-top:84px !important;}";
        document.head.appendChild(st);
    }

    function fixMenu() {
        var menu = $("cardsMenu");
        if (menu && menu.style.zIndex !== "80") menu.style.zIndex = "80";
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
        fixMenu();
        setInterval(tick, 1200);
        window.addEventListener("focus", tick);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
