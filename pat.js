/* Philos 他的主动行为：拍一拍 / 主动发消息 / 主动打电话 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var WX_KEY = "philos_wechat";
    var patTimer = null, msgTimer = null, callTimer = null;

    function getData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function setData(d) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {} }
    function getWx() { try { return JSON.parse(localStorage.getItem(WX_KEY) || "{}"); } catch (e) { return {}; } }
    function setWx(d) { try { localStorage.setItem(WX_KEY, JSON.stringify(d)); } catch (e) {} }

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
            ".php-btn.primary{background:#5b7fa6;color:#fff;}";
        document.head.appendChild(st);
    }

    function inChat() {
        var v = document.getElementById("chatView");
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
        var box = document.getElementById("chatMessages");
        if (!box) return;
        var el = document.createElement("div");
        el.className = "msg-status";
        el.textContent = text;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
    }

    function showPopup(text) {
        injectStyles();
        var old = document.getElementById("phpMask");
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
            var chat = document.getElementById("appChat");
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
            if (!document.getElementById("wechatView") || !document.getElementById("wechatView").classList.contains("show")) {
                notify(w.name || "Ta", first);
            }
        } else {
            var dd = getData();
            dd.chatHistory = Array.isArray(dd.chatHistory) ? dd.chatHistory : [];
            var firstText = "";
            for (var j = 0; j < count; j++) {
                var t = pool[Math.floor(Math.random() * pool.length)].content;
                if (!firstText) firstText = t;
                dd.chatHistory.push({ from: "ta", type: "text", text: t, time: Date.now() + j * 1500, status: "" });
            }
            setData(dd);
            if (inChat()) {
                for (var k = 0; k < count; k++) {
                    (function (txt, delay) {
                        setTimeout(function () { appendToChat(txt); }, delay);
                    })(dd.chatHistory[dd.chatHistory.length - count + k].text, k * 1400);
                }
            } else {
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
        if (document.getElementById("callScreen") && !document.getElementById("callScreen").hidden) { scheduleCall(); return; }
        var chat = document.getElementById("appChat");
        if (chat) chat.click();
        setTimeout(function () {
            var call = document.getElementById("btnChatCall");
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

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H38";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles();
        markVersion();
        schedulePat();
        scheduleMessage();
        scheduleCall();
        setTimeout(markVersion, 1500);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
