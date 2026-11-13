/* Philos 电话 app v1：他的头像 / 可编辑联系人名 / 通话记录（白磨砂卡 + 顶部渐隐）/ 可换背景 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var PHONE_KEY = "philos_phone";
    var CALLS_KEY = "philos_calls";
    var UNREAD_KEY = "philos_unread";

    var view = null, listEl = null, nameEl = null, avatarEl = null, bgEl = null, unreadTimer = null;

    function $(id) { return document.getElementById(id); }
    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function phoneData() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(PHONE_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        if (typeof d.name !== "string") d.name = "";
        if (typeof d.bgImage !== "string") d.bgImage = "";
        return d;
    }
    function savePhone(d) { try { localStorage.setItem(PHONE_KEY, JSON.stringify(d)); } catch (e) {} }

    function getCalls() {
        try { var v = JSON.parse(localStorage.getItem(CALLS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }

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

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtTime(ts) {
        var d = new Date(Number(ts) || Date.now());
        return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function injectStyles() {
        if (document.getElementById("philos-phone-style")) return;
        var st = document.createElement("style");
        st.id = "philos-phone-style";
        st.textContent =
            ".ph-view{position:fixed;inset:0;z-index:486;display:none;flex-direction:column;overflow:hidden;}" +
            ".ph-view.show{display:flex;}" +
            ".ph-bg{position:absolute;inset:0;background-color:#D9DEE4;background-size:cover;background-position:center;}" +
            ".ph-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0) 34%,rgba(30,40,55,0.14) 100%);pointer-events:none;}" +
            ".ph-content{position:relative;z-index:2;display:flex;flex-direction:column;height:100%;min-height:0;}" +
            ".ph-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top) + 10px) 14px 0;}" +
            ".ph-btn{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#2b323b;background:rgba(255,255,255,0.52);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.62);box-shadow:0 2px 10px rgba(50,70,95,0.10);}" +
            ".ph-btn .svg-icon{width:22px;height:22px;stroke-width:1.6;}" +
            ".ph-avatar{flex:0 0 auto;width:106px;height:106px;margin:30px auto 0;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,0.55);background:rgba(255,255,255,0.40);box-shadow:0 14px 34px rgba(35,50,70,0.22);display:flex;align-items:center;justify-content:center;color:#7d8ea2;font-size:32px;font-weight:600;padding:0;}" +
            ".ph-avatar img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;border:none;box-shadow:none;}" +
            ".ph-name{flex:0 0 auto;width:72%;margin:16px auto 0;height:38px;border:none;background:transparent;outline:none;text-align:center;font-size:21px;font-weight:600;letter-spacing:0.3px;color:#ffffff;text-shadow:0 2px 10px rgba(30,40,55,0.35);padding:0;}" +
            ".ph-name::placeholder{color:rgba(255,255,255,0.72);text-shadow:0 2px 10px rgba(30,40,55,0.30);}" +
            ".ph-calls{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;margin-top:24px;}" +
            ".ph-call-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 16px calc(env(safe-area-inset-bottom) + 26px);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 30px,#000 100%);mask-image:linear-gradient(180deg,transparent 0,#000 30px,#000 100%);}" +
            ".ph-call{background:rgba(255,255,255,0.52);-webkit-backdrop-filter:blur(18px) saturate(115%);backdrop-filter:blur(18px) saturate(115%);border:1px solid rgba(255,255,255,0.58);border-radius:16px;padding:12px 14px;margin-bottom:10px;box-shadow:0 4px 14px rgba(45,65,90,0.10);}" +
            ".ph-call-text{font-size:14px;line-height:1.5;color:#252b33;word-break:break-word;}" +
            ".ph-call-time{font-size:11.5px;color:rgba(45,55,70,0.55);margin-top:4px;letter-spacing:0.2px;}" +
            ".ph-empty{text-align:center;font-size:13px;color:rgba(45,55,70,0.55);padding:40px 0;}" +
            ".philos-dot{position:absolute;top:-3px;right:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#ff3b30;color:#fff;font-size:10px;line-height:17px;text-align:center;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.28);z-index:8;pointer-events:none;box-sizing:border-box;}";
        document.head.appendChild(st);
    }

    function renderBackground() {
        if (!bgEl) return;
        var d = phoneData();
        if (d.bgImage && /^(data:image\/|https?:\/\/|blob:)/.test(d.bgImage)) {
            bgEl.style.backgroundImage = 'url("' + d.bgImage.replace(/"/g, "&quot;") + '")';
            bgEl.style.backgroundColor = "#D9DEE4";
        } else {
            bgEl.style.backgroundImage = "none";
            bgEl.style.backgroundColor = "#D9DEE4";
        }
    }

    function renderAvatar() {
        if (!avatarEl) return;
        var d = mainData();
        var src = d.taAvatar || "";
        if (/^(data:image\/|https?:\/\/|blob:)/.test(src)) avatarEl.innerHTML = '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">';
        else avatarEl.textContent = "Ta";
    }

    function renderName() {
        if (!nameEl) return;
        var d = phoneData();
        if (document.activeElement !== nameEl) nameEl.value = d.name;
    }

    function renderCalls() {
        if (!listEl) return;
        var calls = getCalls();
        listEl.innerHTML = "";
        if (!calls.length) {
            var empty = document.createElement("div");
            empty.className = "ph-empty";
            empty.textContent = "还没有通话记录";
            listEl.appendChild(empty);
            return;
        }
        calls.forEach(function (c) {
            var card = document.createElement("div");
            card.className = "ph-call";
            var text = document.createElement("div");
            text.className = "ph-call-text";
            text.textContent = (c && c.text) || "语音通话";
            var time = document.createElement("div");
            time.className = "ph-call-time";
            time.textContent = fmtTime(c && c.time);
            card.appendChild(text);
            card.appendChild(time);
            listEl.appendChild(card);
        });
    }

    function paintBadge(n) {
        var el = $("btnPhone");
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

    function refreshBadge() {
        var s = getUnread();
        var calls = getCalls();
        var n = 0;
        for (var i = 0; i < calls.length; i++) {
            if ((Number(calls[i] && calls[i].time) || 0) > s.call) n++;
        }
        paintBadge(n);
    }

    function markRead() {
        var s = getUnread();
        s.call = Date.now();
        saveUnread(s);
        setTimeout(refreshBadge, 40);
    }

    function compressImage(file, cb) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            var max = 900;
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            var out = "";
            try { out = c.toDataURL("image/webp", 0.8); } catch (e) {}
            if (!out || out.indexOf("data:image/") !== 0) out = c.toDataURL("image/png");
            URL.revokeObjectURL(url);
            cb(out);
        };
        img.onerror = function () { URL.revokeObjectURL(url); cb(""); };
        img.src = url;
    }

    function build() {
        if (view) return;
        injectStyles();
        view = document.createElement("div");
        view.className = "ph-view";
        view.id = "philosPhone";
        view.innerHTML =
            '<div class="ph-bg" id="phBg"></div>' +
            '<div class="ph-scrim"></div>' +
            '<div class="ph-content">' +
                '<div class="ph-top">' +
                    '<button class="ph-btn" id="phBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button>' +
                    '<button class="ph-btn" id="phBgBtn" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-image"></use></svg></button>' +
                '</div>' +
                '<button class="ph-avatar" id="phAvatar" type="button">Ta</button>' +
                '<input class="ph-name" id="phName" type="text" maxlength="16" placeholder="联系人" autocomplete="off" autocapitalize="off" spellcheck="false">' +
                '<div class="ph-calls"><div class="ph-call-list" id="phCallList"></div></div>' +
            '</div>' +
            '<input type="file" id="phBgFile" accept="image/*" hidden>';
        document.body.appendChild(view);

        bgEl = $("phBg");
        listEl = $("phCallList");
        nameEl = $("phName");
        avatarEl = $("phAvatar");

        $("phBack").addEventListener("click", function () { close(); });
        $("phBgBtn").addEventListener("click", function () { var f = $("phBgFile"); if (f) f.click(); });
        $("phBgFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0];
            var input = e.target;
            if (f) {
                compressImage(f, function (src) {
                    if (!src) return;
                    var d = phoneData();
                    d.bgImage = src;
                    savePhone(d);
                    renderBackground();
                });
            }
            input.value = "";
        });

        nameEl.addEventListener("input", function () {
            var d = phoneData();
            d.name = nameEl.value;
            savePhone(d);
        });

        avatarEl.addEventListener("click", function () {
            close();
            var chat = $("appChat");
            if (chat) chat.click();
            setTimeout(function () {
                var call = $("btnChatCall");
                if (call) call.click();
            }, 420);
        });
    }

    function open() {
        build();
        renderAvatar();
        renderName();
        renderCalls();
        renderBackground();
        view.classList.add("show");
        markRead();
        setTimeout(function () { if (listEl) listEl.scrollTop = 0; }, 30);
    }

    function close() {
        if (view) view.classList.remove("show");
    }

    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.closest("#btnPhone")) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        open();
    }, true);

    function init() {
        injectStyles();
        refreshBadge();
        if (unreadTimer) clearInterval(unreadTimer);
        unreadTimer = setInterval(refreshBadge, 2500);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshBadge(); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);

    window.PhilosOpenPhone = open;
})();
