/* Philos 小修：他的天气小组件、字卡/造句自动去重、自绘导入导出菜单、小组件图片放大、
   只发图片/表情包也会回复、点聊天顶部头像让他开口 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var WORD_KEY = "philos_words";
    var WEA_KEY = "philos_weather";

    function $(id) { return document.getElementById(id); }
    function getMain() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function injectStyles() {
        if (document.getElementById("philos-fixes-style")) return;
        var st = document.createElement("style");
        st.id = "philos-fixes-style";
        st.textContent =
            /* ===== 他的天气（无底色无边框，4×1） ===== */
            ".wxw{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;" +
                "padding:2px 2px;background:none;border:none;box-shadow:none;box-sizing:border-box;}" +
            ".wxw-left{display:flex;align-items:center;gap:11px;min-width:0;}" +
            ".wxw-icon{width:48px;height:48px;flex:0 0 auto;color:var(--text-primary,#1b1d21);opacity:.92;}" +
            ".wxw-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;display:block;}" +
            ".wxw-temp{font-size:31px;font-weight:700;letter-spacing:-1.2px;line-height:1;color:var(--text-primary,#1b1d21);}" +
            ".wxw-temp span{font-size:15px;font-weight:600;letter-spacing:0;margin-left:1px;}" +
            ".wxw-sub{font-size:11.5px;color:var(--text-secondary,#8b909a);margin-top:5px;white-space:nowrap;}" +
            ".wxw-right{text-align:right;font-size:11.5px;line-height:1.6;color:var(--text-secondary,#8b909a);flex:0 0 auto;}" +
            ".wxw-city{font-size:12px;font-weight:600;color:var(--text-primary,#1b1d21);letter-spacing:0.2px;}" +
            /* ===== 自绘菜单 ===== */
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
            ".cards-menu{z-index:80 !important;background:#ffffff !important;border:1px solid rgba(120,135,155,0.25) !important;" +
                "box-shadow:0 14px 34px rgba(20,30,45,0.22) !important;border-radius:16px !important;padding:6px !important;}" +
            ".cards-menu .msg-menu-item{color:#1b1d21 !important;font-size:15px !important;height:44px !important;line-height:44px !important;text-align:left !important;}" +
            "html[data-theme=\"dark\"] .cards-menu{background:#1c1d21 !important;border-color:rgba(255,255,255,0.14) !important;}" +
            "html[data-theme=\"dark\"] .cards-menu .msg-menu-item{color:#f2f3f6 !important;}" +
            ".ck-overview,.ck-sub{top:calc(env(safe-area-inset-top) + 56px) !important;}" +
            /* 小组件模板图片放大 */
            ".ws-a{padding:8px !important;gap:6px !important;}" +
            ".ws-a-title{font-size:10.5px !important;margin-bottom:1px;}" +
            ".ws-a-row{gap:7px !important;}" +
            ".ws-a-avatar{width:58px !important;height:58px !important;}" +
            ".ws-a-days{font-size:19px !important;}" +
            ".ws-b{padding:8px !important;gap:6px !important;}" +
            ".ws-b-title{font-size:10.5px !important;}" +
            ".ws-b-card{width:104px !important;height:104px !important;}" +
            ".ws-c-img{height:56% !important;}";
        document.head.appendChild(st);
    }

    /* ================= 他的天气 ================= */
    var CODES = {
        sunny: { label: "晴", base: [25, 32] },
        partly: { label: "多云", base: [21, 28] },
        cloudy: { label: "阴", base: [17, 24] },
        rain: { label: "小雨", base: [15, 21] },
        thunder: { label: "雷阵雨", base: [20, 27] },
        snow: { label: "小雪", base: [-4, 2] },
        fog: { label: "有雾", base: [13, 19] }
    };
    var ORDER = ["sunny", "partly", "cloudy", "rain", "thunder", "snow", "fog"];

    function weatherData() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(WEA_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        if (typeof d.city !== "string" || !d.city) d.city = "他的城市";
        return d;
    }
    function saveWeather(d) { try { localStorage.setItem(WEA_KEY, JSON.stringify(d)); } catch (e) {} }

    function rollWeather(force) {
        var d = weatherData();
        var now = Date.now();
        if (!force && d.ts && now - d.ts < 45 * 60000 && d.code) return d;

        var weights = [0.40, 0.24, 0.12, 0.12, 0.06, 0.03, 0.03];
        var r = Math.random(), acc = 0, code = "sunny";
        for (var i = 0; i < ORDER.length; i++) {
            acc += weights[i];
            if (r <= acc) { code = ORDER[i]; break; }
        }
        var base = CODES[code].base;
        var temp = Math.round(base[0] + Math.random() * (base[1] - base[0]));
        d = {
            ts: now,
            city: d.city || "他的城市",
            code: code,
            temp: temp,
            hi: temp + 1 + Math.floor(Math.random() * 3),
            lo: temp - 2 - Math.floor(Math.random() * 4),
            hum: 38 + Math.floor(Math.random() * 55),
            wind: 1 + Math.floor(Math.random() * 5)
        };
        saveWeather(d);
        return d;
    }

    function iconSvg(code) {
        var sun = '<circle cx="12" cy="12" r="4.1"/>' +
            '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>';
        var cloud = '<path d="M7.2 18.2h9.1a3.6 3.6 0 0 0 .3-7.2 5.1 5.1 0 0 0-9.7-1.2 3.2 3.2 0 0 0 .3 8.4z"/>';
        if (code === "sunny") return sun;
        if (code === "partly") {
            return '<circle cx="9" cy="9.2" r="2.9"/>' +
                '<path d="M9 2.9v1.7M2.9 9.2h1.7M4.7 4.9l1.2 1.2M13.3 4.9l-1.2 1.2"/>' +
                '<path d="M9.6 19h8.2a3.3 3.3 0 0 0 .3-6.6 4.7 4.7 0 0 0-8.9-1.1 3 3 0 0 0 .4 7.7z"/>';
        }
        if (code === "cloudy") return cloud;
        if (code === "rain") {
            return cloud + '<path d="M8.4 20.4l-.9 1.8M12 20.4l-.9 1.8M15.6 20.4l-.9 1.8"/>';
        }
        if (code === "thunder") {
            return cloud + '<path d="M12.6 19.4l-2.1 3.2h2.9l-1.4 2.4" transform="translate(0,-1.2)"/>';
        }
        if (code === "snow") {
            return cloud + '<path d="M8.4 20.6v2M12 20.6v2M15.6 20.6v2"/>';
        }
        return '<path d="M4.4 9h15.2M3.4 13h15.2M5.4 17h15.2"/>';
    }

    function renderWeather() {
        var el = document.querySelector(".wxw");
        if (!el) return;
        var d = rollWeather(false);
        var info = CODES[d.code] || CODES.sunny;
        el.innerHTML =
            '<div class="wxw-left">' +
                '<div class="wxw-icon"><svg viewBox="0 0 24 24">' + iconSvg(d.code) + '</svg></div>' +
                '<div>' +
                    '<div class="wxw-temp">' + d.temp + '<span>°</span></div>' +
                    '<div class="wxw-sub">' + info.label + ' · ' + d.lo + '° / ' + d.hi + '°</div>' +
                '</div>' +
            '</div>' +
            '<div class="wxw-right">' +
                '<div class="wxw-city">' + d.city + '</div>' +
                '<div>湿度 ' + d.hum + '%</div>' +
                '<div>' + d.wind + ' 级风</div>' +
            '</div>';
    }

    function buildWeather() {
        var page2 = document.querySelector("#homePager > .home-page:nth-child(2)");
        if (!page2) return;
        if (page2.querySelector(".wxw")) { return; }
        var el = document.createElement("div");
        el.className = "wxw";
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.title = "点一下换一次天气";
        el.addEventListener("click", function () {
            rollWeather(true);
            renderWeather();
        });
        el.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            var d = weatherData();
            var name = prompt("这个城市的名字", d.city || "他的城市");
            if (!name) return;
            d.city = name.trim().slice(0, 10) || "他的城市";
            saveWeather(d);
            renderWeather();
        });
        page2.insertBefore(el, page2.firstChild);
        renderWeather();
    }

    /* ================= 自动去重 ================= */
    var dedupeLock = false;
    function dedupeNow(silent) {
        if (dedupeLock) return 0;
        dedupeLock = true;
        var removed = 0;
        try {
            var d = getMain();
            var changed = false;

            if (Array.isArray(d.cards)) {
                var seen = {}, keep = [];
                for (var i = 0; i < d.cards.length; i++) {
                    var c = d.cards[i];
                    if (!c || typeof c.content !== "string") { changed = true; continue; }
                    var text = c.content.trim();
                    if (!text) { changed = true; continue; }
                    var key = (c.kind || "text") + "|" + (c.category || "未分类") + "|" + text;
                    if (seen[key]) { changed = true; removed++; continue; }
                    seen[key] = 1;
                    if (c.content !== text) { c.content = text; changed = true; }
                    keep.push(c);
                }
                if (keep.length !== d.cards.length) { d.cards = keep; changed = true; }
            }
            if (changed) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {} }

            var w = null;
            try { w = JSON.parse(localStorage.getItem(WORD_KEY) || "null"); } catch (e) { w = null; }
            if (w && Array.isArray(w.items)) {
                var seen2 = {}, keep2 = [], wChanged = false;
                for (var j = 0; j < w.items.length; j++) {
                    var it = w.items[j];
                    var t = it && typeof it.text === "string" ? it.text.trim() : "";
                    if (!t) { wChanged = true; continue; }
                    if (seen2[t]) { wChanged = true; removed++; continue; }
                    seen2[t] = 1;
                    if (it.text !== t) { it.text = t; wChanged = true; }
                    keep2.push(it);
                }
                var cats = Array.isArray(w.categories) ? w.categories.filter(function (n, idx, arr) { return n && arr.indexOf(n) === idx; }) : [];
                if (cats.length !== (w.categories || []).length) wChanged = true;
                if (keep2.length !== w.items.length) wChanged = true;
                if (wChanged) {
                    w.items = keep2;
                    w.categories = cats;
                    try { localStorage.setItem(WORD_KEY, JSON.stringify(w)); } catch (e) {}
                }
            }

            if (changed && window.philosReload) setTimeout(function () { window.philosReload(); }, 300);
            if (!silent && removed > 0) alert("已自动合并 " + removed + " 条重复内容。");
        } catch (e) {}
        dedupeLock = false;
        return removed;
    }

    /* ================= 自绘菜单 ================= */
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
            '<button class="phm-item" type="button" data-phm="import">导入字卡</button>' +
            '<button class="phm-item" type="button" data-phm="dedupe">去掉重复</button>';
        document.body.appendChild(maskEl);
        document.body.appendChild(menuEl);
        maskEl.addEventListener("click", closeMenu);
        menuEl.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-phm]") : null;
            if (!btn) return;
            var act = btn.getAttribute("data-phm");
            closeMenu();
            if (act === "export") { var ex = $("btnExportCards"); if (ex) ex.click(); }
            else if (act === "import") { var im = $("importCardsFile"); if (im) im.click(); }
            else { var n = dedupeNow(false); if (!n) alert("没有发现重复内容。"); }
        });
    }
    function openMenu(anchor) {
        buildMenu();
        var rect = anchor ? anchor.getBoundingClientRect() : { right: window.innerWidth - 16, bottom: 70 };
        menuEl.classList.add("show");
        maskEl.classList.add("show");
        var mw = menuEl.offsetWidth || 152;
        var mh = menuEl.offsetHeight || 140;
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

    /* ================= 他说话的公共件 ================= */
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

    var lastDedupe = 0, lastWeather = 0;
    function tick() {
        if (document.hidden) return;
        injectStyles();
        fixMenu();
        watchMyMedia();
        buildWeather();
        var now = Date.now();
        if (now - lastWeather > 60000) { lastWeather = now; renderWeather(); }
        if (now - lastDedupe > 20000) { lastDedupe = now; dedupeNow(true); }
    }

    function init() {
        injectStyles();
        buildMenu();
        fixMenu();
        setTimeout(function () { buildWeather(); }, 800);
        setTimeout(function () { dedupeNow(true); }, 1500);
        setInterval(tick, 1200);
        window.addEventListener("focus", tick);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);

    window.philosDedupe = function () { return dedupeNow(false); };
})();
