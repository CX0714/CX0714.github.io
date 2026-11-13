/* Philos 他的主动行为：拍一拍 / 主动发消息 / 主动打电话 / 主屏未读红点 / 背景分层 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var WX_KEY = "philos_wechat";
    var UNREAD_KEY = "philos_unread";
    var patTimer = null, msgTimer = null, callTimer = null, unreadTimer = null;

    function $(id) { return document.getElementById(id); }
    function getData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function setData(d) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {} }
    function getWx() { try { return JSON.parse(localStorage.getItem(WX_KEY) || "{}"); } catch (e) { return {}; } }
    function setWx(d) { try { localStorage.setItem(WX_KEY, JSON.stringify(d)); } catch (e) {} }

    function loadModule(src) {
        if (document.querySelector('script[data-philos="' + src + '"]')) return;
        var s = document.createElement("script");
        s.src = src;
        s.setAttribute("data-philos", src);
        document.body.appendChild(s);
    }

    function injectStyles() {
        if (document.getElementById("philos-pat-style")) return;
        var st = document.createElement("style");
        st.id = "philos-pat-style";
        st.textContent =
            ".php-mask{position:fixed;inset:0;z-index:620;background:rgba(16,20,26,.34);display:none;align-items:center;justify-content:center;padding:24px;}" +
            ".php-mask.show{display:flex;}" +
            ".php-card{width:80%;max-width:320px;padding:28px 20px 18px;border-radius:30px;text-align:center;background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(21px) saturate(120%);backdrop-filter:blur(21px) saturate(120%);border:1px solid rgba(255,255,255,.55);box-shadow:0 24px 60px rgba(20,30,45,.28);}" +
            "[data-theme=\"dark\"] .php-card{background:rgba(32,34,39,.56);border-color:rgba(255,255,255,.12);box-shadow:0 24px 60px rgba(0,0,0,.55);}" +
            ".php-avatar{width:92px;height:92px;border-radius:50%;margin:0 auto 16px;overflow:hidden;background:rgba(255,255,255,.6);border:3px solid #fff;box-shadow:0 8px 22px rgba(50,70,95,.18);display:flex;align-items:center;justify-content:center;color:#7d8ea2;font-size:28px;font-weight:600;}" +
            ".php-avatar img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".php-text{font-size:15px;line-height:1.6;color:var(--text-primary,#1b1d21);margin-bottom:20px;word-break:break-word;}" +
            ".php-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
            ".php-btn{height:44px;border-radius:14px;font-size:14px;font-weight:500;border:none;color:var(--text-primary,#1b1d21);background:rgba(140,155,175,.20);}" +
            ".php-btn.primary{background:#5b7fa6;color:#fff;}" +
            /* 红点不能被图标裁掉 */
            ".app-icon,.app-icon-box,.dock-btn{overflow:visible !important;}" +
            ".philos-dot{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#ff3b30;color:#fff;font-size:10px;line-height:17px;text-align:center;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.28);z-index:8;pointer-events:none;box-sizing:border-box;}" +
            /* 浅色底统一 #EEEEEE */
            "html[data-theme=\"light\"] body{background:#EEEEEE !important;}" +
            "html[data-theme=\"light\"] .splash{background:#EEEEEE !important;}" +
            "html[data-theme=\"light\"] .settings-view,html[data-theme=\"light\"] .app-view{background-color:#EEEEEE !important;background-image:none !important;}" +
            "html[data-theme=\"light\"] .settings-shell,html[data-theme=\"light\"] .set-page,html[data-theme=\"light\"] .app-scroll{background-color:transparent !important;background-image:none !important;}" +
            /* 背景分层：颜色在最底、图片在其上（和原来一样图片盖色），都不动子元素定位 */
            ".desktop-view{overflow:hidden;background-color:transparent !important;background-image:none !important;}" +
            ".desktop-view::before{content:\"\";position:absolute;inset:0;background-color:var(--home-bg-color,transparent);z-index:-1;pointer-events:none;}" +
            ".desktop-view::after{content:\"\";position:absolute;inset:-6%;background-image:var(--home-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;filter:blur(var(--home-blur,20px));z-index:-1;pointer-events:none;}" +
            ".chat-view{overflow:hidden;background-color:transparent !important;background-image:none !important;}" +
            ".chat-view::before{content:\"\";position:absolute;inset:0;background-color:var(--chat-bg-color,transparent);z-index:-1;pointer-events:none;}" +
            ".chat-view::after{content:\"\";position:absolute;inset:-6%;background-image:var(--chat-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;filter:blur(20px);z-index:-1;pointer-events:none;}";
        document.head.appendChild(st);
    }

    function inChat() {
        var v = $("chatView");
        return !!(v && v.classList.contains("active"));
    }

    function notify(title, body) {
        try {
            if (!("Notification" in window) || Notification.permission !== "granted") return;
            var d = getData();
            if (d.settings && d.settings.permission && d.settings.permission.notify === false) return;
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, { body: body, icon: "icon-192.png", badge: "icon-192.png", tag: "philos-proactive" }); }).catch(function () {});
            } else {
                new Notification(title, { body: body, icon: "icon-192.png" });
            }
        } catch (e) {}
    }

    function appendToChat(text) {
        var box = $("chatMessages");
        if (!box) return;
        var el = document.createElement("div");
        el.className = "msg-status";
        el.textContent = text;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
    }

    function showPopup(text) {
        injectStyles();
        var old = $("phpMask");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var d = getData();
        var mask = document.createElement("div");
        mask.className = "php-mask show";
        mask.id = "phpMask";
        var card = document.createElement("div");
        card.className = "php-card";
        var av = document.createElement("div");
        av.className = "php-avatar";
        if (d.taAvatar && /^(data:image\/|https?:\/\/)/.test(d.taAvatar)) av.innerHTML = '<img src="' + String(d.taAvatar).replace(/"/g, "&quot;") + '" alt="">';
        else av.textContent = d.taName || "Ta";
        var body = document.createElement("div");
        body.className = "php-text";
        body.textContent = text;
        var actions = document.createElement("div");
        actions.className = "php-actions";
        var later = document.createElement("button");
        later.type = "button";
        later.className = "php-btn";
        later.textContent = "等下哦";
        later.addEventListener("click", function () { mask.classList.remove("show"); });
        var go = document.createElement("button");
        go.type = "button";
        go.className = "php-btn primary";
        go.textContent = "闪去";
        go.addEventListener("click", function () {
            mask.classList.remove("show");
            var chat = $("appChat");
            if (chat) chat.click();
        });
        actions.appendChild(later);
        actions.appendChild(go);
        card.appendChild(av);
        card.appendChild(body);
        card.appendChild(actions);
        mask.appendChild(card);
        document.body.appendChild(mask);
    }

    function patPool(d) { return (d.cards || []).filter(function (c) { return c.kind === "status" && c.content; }); }
    function textPool(d) { return (d.cards || []).filter(function (c) { return (c.kind === "text" || c.kind === "emoji") && c.content; }); }

    function firePat() {
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        var chance = perm.patChance == null ? 30 : Number(perm.patChance);
        var cards = patPool(d);
        if (cards.length && chance > 0 && Math.random() * 100 < chance) {
            var text = cards[Math.floor(Math.random() * cards.length)].content;
            d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
            d.chatHistory.push({ type: "status", text: "—— " + text + " ——", time: Date.now() });
            setData(d);
            if (inChat()) appendToChat("—— " + text + " ——");
            else showPopup(text);
        }
        schedulePat();
    }

    function schedulePat() {
        if (patTimer) clearTimeout(patTimer);
        patTimer = setTimeout(firePat, (25 + Math.random() * 65) * 60000);
    }

    function randBetween(min, max) {
        if (max < min) max = min;
        return min + Math.random() * (max - min);
    }

    function delayMs(perm, minKey, maxKey, fallbackMin) {
        var a = Math.max(0, Number(perm[minKey]) || 0);
        var b = Math.max(0, Number(perm[maxKey]) || 0);
        if (a === 0 && b === 0) return (fallbackMin || 1) * 60000;
        return randBetween(a, b) * 60000;
    }

    function pushChatMessage(text) {
        var d = getData();
        d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        d.chatHistory.push({ from: "ta", type: "text", text: text, time: Date.now(), status: "" });
        setData(d);
    }

    function refreshChatView() {
        if (window.philosRefreshChat) { window.philosRefreshChat(); return; }
        var chat = $("appChat");
        if (chat) chat.click();
    }

    function fireProactiveMessage() {
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        var pool = textPool(d);
        if (!perm.activeEnabled || !pool.length) { scheduleMessage(); return; }

        var useWx = Math.random() < 0.5;
        var count = 1 + Math.floor(Math.random() * 3);

        if (useWx) {
            var w = getWx();
            w.history = Array.isArray(w.history) ? w.history : [];
            var first = "";
            for (var i = 0; i < count; i++) {
                var c = pool[Math.floor(Math.random() * pool.length)].content;
                if (!first) first = c;
                w.history.push({ from: "ta", type: "text", text: c, time: Date.now() + i * 1500 });
            }
            setWx(w);
            var wxView = document.getElementById("wechatView");
            var wxOpen = !!(wxView && wxView.classList.contains("show"));
            if (wxOpen) {
                if (window.PhilosRefreshWeChat) window.PhilosRefreshWeChat();
            } else {
                notify(w.name || "Ta", first);
            }
        } else {
            var texts = [];
            for (var j = 0; j < count; j++) {
                texts.push(pool[Math.floor(Math.random() * pool.length)].content);
            }
            var firstText = texts[0] || "";

            if (inChat()) {
                texts.forEach(function (txt, idx) {
                    setTimeout(function () {
                        pushChatMessage(txt);
                        refreshChatView();
                    }, idx * 1400);
                });
            } else {
                var dd = getData();
                dd.chatHistory = Array.isArray(dd.chatHistory) ? dd.chatHistory : [];
                for (var k = 0; k < count; k++) {
                    dd.chatHistory.push({ from: "ta", type: "text", text: texts[k], time: Date.now() + k * 1500, status: "" });
                }
                setData(dd);
                notify(dd.taName || "Ta", firstText);
            }
        }

        scheduleMessage();
    }

    function scheduleMessage() {
        if (msgTimer) clearTimeout(msgTimer);
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        if (!perm.activeEnabled) { msgTimer = setTimeout(scheduleMessage, 30000); return; }
        msgTimer = setTimeout(fireProactiveMessage, delayMs(perm, "activeMin", "activeMax", 1));
    }

    function fireProactiveCall() {
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        if (!perm.callEnabled) { scheduleCall(); return; }
        if ($("callScreen") && !$("callScreen").hidden) { scheduleCall(); return; }
        var chat = $("appChat");
        if (chat) chat.click();
        setTimeout(function () {
            var call = $("btnChatCall");
            if (call) call.click();
        }, 400);
        scheduleCall();
    }

    function scheduleCall() {
        if (callTimer) clearTimeout(callTimer);
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        if (!perm.callEnabled) { callTimer = setTimeout(scheduleCall, 30000); return; }
        callTimer = setTimeout(fireProactiveCall, delayMs(perm, "callMin", "callMax", 1));
    }

    /* ===== 主屏未读红点（电话由 phone.js 自己管） ===== */
    function getUnread() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(UNREAD_KEY) || "null"); } catch (e) { s = null; }
        if (!s || typeof s !== "object") s = {};
        if (typeof s.chat !== "number") s.chat = 0;
        if (typeof s.wx !== "number") s.wx = 0;
        if (typeof s.call !== "number") s.call = 0;
        return s;
    }
    function saveUnread(s) { try { localStorage.setItem(UNREAD_KEY, JSON.stringify(s)); } catch (e) {} }

    function countChatUnread(after) {
        var d = getData();
        var list = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (!m || m.from !== "ta") continue;
            if (m.type === "status" || m.type === "call") continue;
            if ((Number(m.time) || 0) > after) n++;
        }
        return n;
    }

    function countWxUnread(after) {
        var w = getWx();
        var list = Array.isArray(w.history) ? w.history : [];
        var n = 0;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (!m || m.from !== "ta") continue;
            if ((Number(m.time) || 0) > after) n++;
        }
        return n;
    }

    function paintBadge(id, n) {
        var el = $(id);
        if (!el) return;
        var box = el.querySelector(".app-icon-box") || el;
        var dot = box.querySelector(".philos-dot");
        if (!n) {
            if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
            return;
        }
        if (!dot) {
            dot = document.createElement("span");
            dot.className = "philos-dot";
            try { if (getComputedStyle(box).position === "static") box.style.position = "relative"; } catch (e) { box.style.position = "relative"; }
            box.appendChild(dot);
        }
        dot.textContent = n > 99 ? "99+" : String(n);
    }

    function refreshUnread() {
        var st = getUnread();
        var now = Date.now();
        var chatView = $("chatView");
        var wxView = document.getElementById("wechatView");
        var chatOpen = !!(chatView && chatView.classList.contains("active"));
        var wxOpen = !!(wxView && wxView.classList.contains("show"));
        var changed = false;

        if (chatOpen) { st.chat = now; changed = true; }
        if (wxOpen) { st.wx = now; changed = true; }
        if (changed) saveUnread(st);

        paintBadge("appChat", countChatUnread(st.chat));
        paintBadge("btnWechat", countWxUnread(st.wx));
    }

    function markRead(which) {
        var st = getUnread();
        st[which] = Date.now();
        saveUnread(st);
        setTimeout(refreshUnread, 60);
    }

    function startUnreadWatch() {
        refreshUnread();
        if (unreadTimer) clearInterval(unreadTimer);
        unreadTimer = setInterval(function () { if (!document.hidden) refreshUnread(); }, 3000);
        document.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            if (t.closest("#appChat")) markRead("chat");
            else if (t.closest("#btnWechat")) markRead("wx");
        }, true);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshUnread(); });
        window.addEventListener("focus", refreshUnread);
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H44";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles();
        markVersion();
        loadModule("phone.js");
        schedulePat();
        scheduleMessage();
        scheduleCall();
        startUnreadWatch();
        setTimeout(markVersion, 1500);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
