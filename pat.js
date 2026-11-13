/* Philos 他主动拍一拍（仅 iMessage） */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var timer = null;

    function getData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function setData(d) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {} }

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
        if (d.taAvatar && /^(data:image\/|https?:\/\/)/.test(d.taAvatar)) {
            av.innerHTML = '<img src="' + String(d.taAvatar).replace(/"/g, "&quot;") + '" alt="">';
        } else {
            av.textContent = d.taName || "Ta";
        }

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

    function firePat() {
        var d = getData();
        var perm = (d.settings && d.settings.permission) || {};
        var chance = perm.patChance == null ? 30 : Number(perm.patChance);
        var cards = (d.cards || []).filter(function (c) { return c.kind === "status" && c.content; });
        if (!cards.length || chance <= 0) { schedule(); return; }
        if (Math.random() * 100 >= chance) { schedule(); return; }

        var pick = cards[Math.floor(Math.random() * cards.length)];
        var text = pick.content;

        d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        d.chatHistory.push({ type: "status", text: "—— " + text + " ——", time: Date.now() });
        setData(d);

        if (inChat()) appendToChat("—— " + text + " ——");
        else showPopup(text);

        schedule();
    }

    function schedule() {
        if (timer) clearTimeout(timer);
        var minutes = 25 + Math.random() * 65;
        timer = setTimeout(firePat, minutes * 60000);
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H37";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles();
        markVersion();
        schedule();
        setTimeout(markVersion, 1500);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
