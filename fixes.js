/* Philos 小修：每日拍立得、统计(排行+词云)/日历经期/天气、自动去重、自绘菜单、只发图也回复
   注意：.dw / .wxw / 来电 的样式统一在 widgets.css，这里不要重复定义 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var WORD_KEY = "philos_words";
    var WEA_KEY = "philos_weather";
    var PERIOD_KEY = "philos_period";
    var GAL_KEY = "philos_gallery";

    function $(id) { return document.getElementById(id); }
    function getMain() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

    /* ===== IndexedDB 读图 ===== */
    var dbP = null;
    function db() {
        if (dbP) return dbP;
        dbP = new Promise(function (res) {
            try {
                var r = indexedDB.open("philos_images", 1);
                r.onupgradeneeded = function () { try { r.result.createObjectStore("images"); } catch (e) {} };
                r.onsuccess = function () { res(r.result); };
                r.onerror = function () { res(null); };
            } catch (e) { res(null); }
        });
        return dbP;
    }
    function idbGet(id) {
        return db().then(function (d) {
            if (!d) return null;
            return new Promise(function (res) {
                try {
                    var req = d.transaction("images").objectStore("images").get(id);
                    req.onsuccess = function () { res(req.result || null); };
                    req.onerror = function () { res(null); };
                } catch (e) { res(null); }
            });
        });
    }
    function resolveRef(src, cb) {
        if (!src || typeof src !== "string") { cb(""); return; }
        if (src.indexOf("idb://") !== 0) { cb(src); return; }
        idbGet(src.slice(6)).then(function (url) { cb(url || ""); });
    }

    function daySeed() {
        var s = ymd(new Date());
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rndMaker(seed) {
        var x = seed || 1;
        return function () {
            x ^= x << 13; x >>>= 0;
            x ^= x >> 17;
            x ^= x << 5; x >>>= 0;
            return x / 4294967296;
        };
    }

    function injectStyles() {
        if (document.getElementById("philos-fixes-style")) return;
        var st = document.createElement("style");
        st.id = "philos-fixes-style";
        st.textContent =
            ".st-view{position:fixed;inset:0;z-index:487;display:none;flex-direction:column;background:#EEEEEE;}" +
            ".st-view.show{display:flex;}" +
            ".st-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 14px 6px;}" +
            ".st-btn{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#2b323b;background:rgba(255,255,255,0.78);border:1px solid rgba(255,255,255,0.9);box-shadow:0 2px 10px rgba(50,70,95,0.10);}" +
            ".st-btn .svg-icon{width:22px;height:22px;stroke-width:1.6;}" +
            ".st-title{flex:1;text-align:center;font-size:17px;font-weight:600;color:#20242a;}" +
            ".st-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px 16px calc(env(safe-area-inset-bottom) + 24px);}" +
            ".st-card{background:#ffffff;border-radius:18px;padding:14px 16px;margin-bottom:12px;box-shadow:0 2px 12px rgba(60,80,105,0.10);}" +
            ".st-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;font-size:14px;color:#4a5563;}" +
            ".st-row + .st-row{border-top:1px solid rgba(120,135,155,0.12);}" +
            ".st-row b{font-size:16px;font-weight:700;color:#1b1d21;}" +
            ".st-big{text-align:center;padding:6px 0 2px;}" +
            ".st-big .num{font-size:42px;font-weight:800;letter-spacing:-1.5px;color:#1b1d21;line-height:1;}" +
            ".st-big .lab{font-size:12px;color:#8b909a;margin-top:6px;}" +
            ".st-note{font-size:12px;color:#8b909a;line-height:1.5;padding:0 4px;}" +
            ".st-card-title{font-size:12.5px;font-weight:700;color:#8b909a;letter-spacing:0.4px;margin-bottom:8px;}" +
            ".rk{display:flex;align-items:center;gap:12px;padding:10px 0;}" +
            ".rk + .rk{border-top:1px solid rgba(120,135,155,0.12);}" +
            ".rk-no{flex:0 0 auto;width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:#b9c4d1;}" +
            ".rk-1 .rk-no{background:#5b7fa6;}" +
            ".rk-2 .rk-no{background:#7f9cbb;}" +
            ".rk-3 .rk-no{background:#a3b6ca;}" +
            ".rk-text{flex:1 1 auto;min-width:0;font-size:15px;color:#1b1d21;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".rk-num{flex:0 0 auto;font-size:13px;font-weight:700;color:#5b7fa6;}" +
            ".cloud{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px;padding:6px 2px;line-height:1.15;}" +
            ".cloud span{white-space:nowrap;opacity:.92;}" +
            ".cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}" +
            ".cal-wd{text-align:center;font-size:11px;color:#8b909a;padding:4px 0 2px;}" +
            ".cal-cell{position:relative;aspect-ratio:1/1;border-radius:12px;background:#ffffff;border:1px solid rgba(120,135,155,0.10);display:flex;align-items:center;justify-content:center;font-size:14px;color:#1b1d21;padding:0;}" +
            ".cal-cell.empty{background:none;border:none;}" +
            ".cal-cell.period{background:rgba(231,163,171,0.35);border-color:rgba(231,163,171,0.55);color:#8a4a52;font-weight:600;}" +
            ".cal-cell.today{outline:2px solid #5b7fa6;outline-offset:-2px;}" +
            ".cal-cell.pred{background:rgba(231,163,171,0.14);border-style:dashed;border-color:rgba(231,163,171,0.6);color:#a8737a;}" +
            ".cal-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 10px;font-size:15px;font-weight:600;color:#1b1d21;}" +
            ".cal-nav button{width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.9);color:#2b323b;font-size:16px;}" +
            "[data-theme=\"dark\"] .st-view{background:#000000;}" +
            "[data-theme=\"dark\"] .st-card,[data-theme=\"dark\"] .cal-cell{background:#1c1d21;border-color:rgba(255,255,255,0.08);}" +
            "[data-theme=\"dark\"] .st-row{color:#c7cbd3;}" +
            "[data-theme=\"dark\"] .st-row b,[data-theme=\"dark\"] .st-big .num,[data-theme=\"dark\"] .cal-nav,[data-theme=\"dark\"] .cal-cell,[data-theme=\"dark\"] .rk-text{color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .st-title{color:#f2f3f6;}" +
            ".phm-mask{position:fixed;inset:0;z-index:900;background:rgba(16,20,26,0.28);display:none;}" +
            ".phm-mask.show{display:block;}" +
            ".phm-menu{position:fixed;z-index:901;min-width:152px;padding:6px;border-radius:16px;" +
                "background:#ffffff;border:1px solid rgba(120,135,155,0.25);box-shadow:0 14px 34px rgba(20,30,45,0.22);" +
                "display:none;flex-direction:column;gap:4px;}" +
            ".phm-menu.show{display:flex;}" +
            ".phm-item{height:44px;line-height:44px;padding:0 16px;border-radius:12px;border:none;background:none;font-size:15px;text-align:left;color:#1b1d21;}" +
            ".phm-item:active{background:rgba(120,132,148,0.16);}" +
            "html[data-theme=\"dark\"] .phm-menu{background:#1c1d21;border-color:rgba(255,255,255,0.14);}" +
            "html[data-theme=\"dark\"] .phm-item{color:#f2f3f6;}" +
            ".cards-menu{z-index:80 !important;background:#ffffff !important;border:1px solid rgba(120,135,155,0.25) !important;" +
                "box-shadow:0 14px 34px rgba(20,30,45,0.22) !important;border-radius:16px !important;padding:6px !important;}" +
            ".cards-menu .msg-menu-item{color:#1b1d21 !important;font-size:15px !important;height:44px !important;line-height:44px !important;text-align:left !important;}" +
            "html[data-theme=\"dark\"] .cards-menu{background:#1c1d21 !important;border-color:rgba(255,255,255,0.14) !important;}" +
            "html[data-theme=\"dark\"] .cards-menu .msg-menu-item{color:#f2f3f6 !important;}" +
            ".ck-overview,.ck-sub{top:calc(env(safe-area-inset-top) + 56px) !important;}";
        document.head.appendChild(st);
    }

    var SVG_NS = "http://www.w3.org/2000/svg";
    function injectSprite() {
        var sprite = document.querySelector("svg.svg-sprite");
        if (!sprite) return;
        if (!document.getElementById("ic-stats")) {
            var s1 = document.createElementNS(SVG_NS, "symbol");
            s1.setAttribute("id", "ic-stats");
            s1.setAttribute("viewBox", "0 0 24 24");
            s1.innerHTML = '<path d="M4.5 20.2V13M12 20.2V5.4M19.5 20.2v-5"/>';
            sprite.appendChild(s1);
        }
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
            ts: now, city: d.city || "他的城市", code: code, temp: temp,
            hi: temp + 1 + Math.floor(Math.random() * 3),
            lo: temp - 2 - Math.floor(Math.random() * 4),
            hum: 38 + Math.floor(Math.random() * 55),
            wind: 1 + Math.floor(Math.random() * 5)
        };
        saveWeather(d);
        return d;
    }

    var CLOUD_PATH = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z";
    function cloud(scale, tx, ty, sw) {
        return '<g transform="translate(' + tx + ',' + ty + ') scale(' + scale + ')"><path stroke-width="' + sw + '" d="' + CLOUD_PATH + '"/></g>';
    }
    function iconSvg(code) {
        if (code === "sunny") {
            return '<circle cx="12" cy="12" r="4.1"/>' +
                '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>';
        }
        if (code === "partly") return cloud(0.46, 0.2, 0.4, 2.9) + cloud(0.60, 6.4, 9.2, 2.25);
        if (code === "cloudy") return cloud(0.86, 1.6, 3.4, 1.57);
        if (code === "rain") return cloud(0.86, 1.6, 2.4, 1.57) + '<path d="M9 21v1.4M13 21v1.4M17 21v1.4"/>';
        if (code === "thunder") return cloud(0.86, 1.6, 2.0, 1.57) + '<path d="M12.8 19.6l-2.1 3.1h2.8l-1.3 2.3"/>';
        if (code === "snow") return cloud(0.86, 1.6, 2.4, 1.57) + '<path d="M9 21v1.6M13 21v1.6M17 21v1.6"/>';
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
                '<div><div class="wxw-temp">' + d.temp + '<span>°</span></div>' +
                '<div class="wxw-sub">' + info.label + ' · ' + d.lo + '° / ' + d.hi + '°</div></div>' +
            '</div>' +
            '<div class="wxw-right"><div class="wxw-city">' + d.city + '</div>' +
                '<div>湿度 ' + d.hum + '%　' + d.wind + ' 级风</div></div>';
    }

    function buildWeather() {
        var page2 = document.querySelector("#homePager > .home-page:nth-child(2)");
        if (!page2 || page2.querySelector(".wxw")) return;
        var el = document.createElement("div");
        el.className = "wxw";
        el.title = "点一下换一次天气";
        el.addEventListener("click", function () { rollWeather(true); renderWeather(); });
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

    /* ================= 每日拍立得（结构 only，样式在 widgets.css） ================= */
    function hisAvatarSrc() {
        var live = document.querySelector("#headerAvatar img, #taProfileAvatar img, #callAvatar img, #peekAvatar img");
        if (live) {
            var s = live.getAttribute("src") || "";
            if (s) return s;
        }
        var raw = getMain().taAvatar || "";
        return /^(idb:\/\/|data:image\/|https?:\/\/|blob:)/.test(raw) ? raw : "";
    }
    function hisName() {
        var d = getMain();
        if (d.taName && d.taName !== "他") return d.taName;
        var el = document.getElementById("headerName");
        var t = el ? (el.textContent || "").trim() : "";
        return t || "他";
    }
    function textCards() {
        var d = getMain();
        return (d.cards || []).filter(function (c) { return c && c.kind === "text" && typeof c.content === "string" && c.content.trim(); })
            .map(function (c) { return c.content.trim(); });
    }
    function emojiCards() {
        var d = getMain();
        return (d.cards || []).filter(function (c) { return c && c.kind === "emoji" && typeof c.content === "string" && c.content.trim(); })
            .map(function (c) { return c.content.trim(); });
    }
    function hisPhotos() {
        var g = null;
        try { g = JSON.parse(localStorage.getItem(GAL_KEY) || "null"); } catch (e) { g = null; }
        if (!g || typeof g !== "object" || !Array.isArray(g.ta)) return [];
        return g.ta.filter(function (s) { return typeof s === "string" && s; });
    }

    function renderDaily(force) {
        var el = document.querySelector(".dw");
        if (!el) return;
        var stamp = ymd(new Date());
        if (!force && el.getAttribute("data-day") === stamp && el.innerHTML.trim()) return;
        el.setAttribute("data-day", stamp);

        var seed = daySeed();
        var rnd = rndMaker(seed);

        var texts = textCards();
        var emojis = emojiCards();
        var photos = hisPhotos();

        var bubbles = [];
        if (texts.length) {
            var n = 1 + (rnd() < 0.5 ? 1 : 0);
            var pool = texts.slice();
            for (var i = 0; i < n && pool.length; i++) {
                bubbles.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
            }
        }

        var mood = "";
        if (emojis.length) {
            var mn = 1 + Math.floor(rnd() * 3);
            var e2 = emojis.slice(), out = [];
            for (var k = 0; k < mn && e2.length; k++) out.push(e2.splice(Math.floor(rnd() * e2.length), 1)[0]);
            mood = out.join(" ");
        }

        el.innerHTML =
            '<div class="dw-left">' +
                '<div class="dw-head"><span class="dw-ava" id="dwAva">' + hisName().slice(0, 2) + '</span>' +
                    '<span class="dw-name">' + hisName().replace(/</g, "&lt;") + '</span></div>' +
                '<div class="dw-msgs">' +
                    (bubbles.length
                        ? bubbles.map(function (t) { return '<div class="dw-bub">' + t.replace(/</g, "&lt;") + '</div>'; }).join("")
                        : '<div class="dw-bub">…</div>') +
                '</div>' +
                (mood ? '<div class="dw-mood">' + mood + '</div>' : '') +
            '</div>' +
            '<div class="dw-right"><div class="dw-polar"><img id="dwPhoto" alt=""></div></div>';

        var avBox = $("dwAva");
        if (avBox) {
            resolveRef(hisAvatarSrc(), function (url) {
                if (url) avBox.innerHTML = '<img src="' + url.replace(/"/g, "&quot;") + '" alt="">';
            });
        }

        var photoEl = $("dwPhoto");
        if (photoEl) {
            if (photos.length) {
                var one = photos[Math.floor(rnd() * photos.length) % photos.length];
                resolveRef(one, function (url) { if (url) photoEl.src = url; });
            }
        }
    }

    function buildDaily() {
        var page2 = document.querySelector("#homePager > .home-page:nth-child(2)");
        if (!page2) return;
        if (!page2.querySelector(".dw")) {
            var el = document.createElement("div");
            el.className = "dw";
            el.title = "点一下换一张";
            el.addEventListener("click", function () {
                el.innerHTML = "";
                renderDaily(true);
            });
            page2.appendChild(el);
        }
        renderDaily(false);
    }

    /* ================= 新 app + 尺寸对齐 ================= */
    function makeApp(id, label, symbol) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "app-icon";
        btn.id = id;
        btn.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + symbol + '"></use></svg></span><span class="app-label">' + label + '</span>';
        return btn;
    }

    function syncIconSize() {
        var grid = document.querySelector("#homePager > .home-page:nth-child(2) .home-app-grid");
        if (!grid) return;
        var boxes = grid.querySelectorAll(".app-icon-box");
        if (!boxes.length) return;
        var ref = null;
        for (var i = 0; i < boxes.length; i++) { if (boxes[i].style.width) { ref = boxes[i]; break; } }
        if (!ref) {
            var p1 = document.querySelector("#homePager .app-grid-small .app-icon-box");
            if (p1) ref = p1;
        }
        if (!ref) return;
        var w = Math.round(ref.getBoundingClientRect().width);
        if (!w || w < 18) return;
        for (var j = 0; j < boxes.length; j++) {
            var b = boxes[j];
            if (b === ref) continue;
            if (b.style.width === w + "px" && b.style.height === w + "px") continue;
            b.style.width = w + "px";
            b.style.height = w + "px";
            b.style.aspectRatio = "1 / 1";
            b.style.maxWidth = "none";
        }
    }

    function buildApps() {
        var grid = document.querySelector("#homePager > .home-page:nth-child(2) .home-app-grid");
        if (!grid) return;
        if (!document.getElementById("appStats")) {
            var st = makeApp("appStats", "统计", "ic-stats");
            st.addEventListener("click", openStats);
            grid.appendChild(st);
        }
        if (!document.getElementById("appCalendar")) {
            var ca = makeApp("appCalendar", "日历", "ic-calendar");
            ca.addEventListener("click", openCalendar);
            grid.appendChild(ca);
        }
        syncIconSize();
    }

    /* ================= 来电界面（只补结构和图标，样式在 widgets.css） ================= */
    function decorateCall() {
        var overlay = $("philosCallIn");
        if (!overlay) return;
        var card = overlay.querySelector(".call-in-card");
        if (!card) return;
        var av = card.querySelector(".call-in-avatar");
        var nm = card.querySelector(".call-in-name");
        var stt = card.querySelector(".call-in-state");
        var body = card.querySelector(".call-in-body");
        if (!body && av && nm && stt) {
            body = document.createElement("div");
            body.className = "call-in-body";
            card.insertBefore(body, av);
            body.appendChild(av); body.appendChild(nm); body.appendChild(stt);
        }
        var actions = card.querySelector(".call-in-actions");
        if (!actions) return;
        if (!card.querySelector("[data-call-min]")) {
            var minBtn = document.createElement("button");
            minBtn.type = "button";
            minBtn.className = "call-min";
            minBtn.setAttribute("data-call-min", "1");
            minBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-down-double"></use></svg>';
            minBtn.addEventListener("click", function () {
                overlay.classList.remove("show");
                var pill = $("philosCallPill");
                if (!pill) {
                    pill = document.createElement("button");
                    pill.type = "button";
                    pill.id = "philosCallPill";
                    pill.className = "call-mini-pill";
                    pill.innerHTML = '<span>通话中</span>';
                    pill.addEventListener("click", function () {
                        pill.classList.remove("show");
                        overlay.classList.add("show");
                    });
                    document.body.appendChild(pill);
                }
                pill.classList.add("show");
            });
            card.appendChild(minBtn);
        }
        Array.prototype.forEach.call(actions.querySelectorAll(".call-in-btn"), function (btn) {
            if (btn.getAttribute("data-round") === "1") return;
            var isAnswer = btn.classList.contains("answer");
            var label = isAnswer ? "接通" : "挂断";
            btn.setAttribute("data-round", "1");
            btn.setAttribute("aria-label", label);
            btn.classList.add("round");
            btn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" style="transform:rotate(' + (isAnswer ? "0" : "135") + 'deg)"><use href="#ic-phone"></use></svg>';
            var wrap = document.createElement("div");
            wrap.className = "call-in-act";
            if (btn.parentNode) {
                btn.parentNode.insertBefore(wrap, btn);
                wrap.appendChild(btn);
                var lb = document.createElement("span");
                lb.className = "call-in-act-label";
                lb.textContent = label;
                wrap.appendChild(lb);
            }
        });
    }

    /* ================= 统计 ================= */
    function statsView() {
        var v = $("stStatsView");
        if (v) return v;
        v = document.createElement("div");
        v.className = "st-view";
        v.id = "stStatsView";
        v.innerHTML =
            '<div class="st-head"><button class="st-btn" id="stStatsBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><div class="st-title">统计</div><span style="width:40px"></span></div>' +
            '<div class="st-body" id="stStatsBody"></div>';
        document.body.appendChild(v);
        $("stStatsBack").addEventListener("click", function () { v.classList.remove("show"); });
        return v;
    }

    function hisCardCounts() {
        var d = getMain();
        var h = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        var cards = Array.isArray(d.cards) ? d.cards : [];
        var byText = {};
        cards.forEach(function (c) {
            if (!c || c.kind !== "text" || typeof c.content !== "string") return;
            var t = c.content.trim();
            if (t) byText[t] = 0;
        });
        var list = Object.keys(byText);
        if (!list.length) return [];
        h.forEach(function (m) {
            if (!m || m.from !== "ta" || typeof m.text !== "string" || !m.text) return;
            for (var i = 0; i < list.length; i++) {
                if (m.text.indexOf(list[i]) >= 0) byText[list[i]] = byText[list[i]] + 1;
            }
        });
        return list.map(function (t) { return { text: t, n: byText[t] }; })
            .filter(function (x) { return x.n > 0; })
            .sort(function (a, b) { return b.n - a.n; });
    }

    var CLOUD_COLORS = ["#5b7fa6", "#7f9cbb", "#8b909a", "#a3b6ca", "#6b8bab", "#9aa8b8"];

    function openStats() {
        var v = statsView();
        var d = getMain();
        var h = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        var mine = 0, his = 0, myChars = 0, hisChars = 0, media = 0, firstTs = 0;
        h.forEach(function (m) {
            if (!m) return;
            if (m.time && (!firstTs || m.time < firstTs)) firstTs = m.time;
            if (m.type === "image" || m.type === "sticker") { media++; return; }
            if (m.type === "status" || m.type === "call") return;
            var len = String(m.text || "").length;
            if (m.from === "me") { mine++; myChars += len; }
            else { his++; hisChars += len; }
        });
        var letters = Array.isArray(d.letters) ? d.letters.length : 0;
        var cards = Array.isArray(d.cards) ? d.cards : [];
        var byKind = { text: 0, emoji: 0, sticker: 0, status: 0 };
        cards.forEach(function (c) { if (c && byKind[c.kind] != null) byKind[c.kind]++; });
        var anns = Array.isArray(d.anniversaries) ? d.anniversaries : [];
        var knownDays = firstTs ? (Math.floor((Date.now() - firstTs) / 86400000) + 1) : 0;

        var counts = hisCardCounts();
        var top3 = counts.slice(0, 3);
        var cloudItems = counts.slice(0, 24);

        var html = "";
        html += '<div class="st-card"><div class="st-card-title">他最常用的字卡</div>';
        if (!top3.length) {
            html += '<div class="st-note">他还没用过字卡里的句子（这里统计的是他在 iMessage 里说过、且能对上字卡的话）。</div>';
        } else {
            top3.forEach(function (item, i) {
                html += '<div class="rk rk-' + (i + 1) + '">' +
                    '<span class="rk-no">' + (i + 1) + '</span>' +
                    '<span class="rk-text">' + item.text.replace(/</g, "&lt;") + '</span>' +
                    '<span class="rk-num">' + item.n + ' 次</span>' +
                    '</div>';
            });
        }
        html += '</div>';

        if (cloudItems.length) {
            var maxN = cloudItems[0].n, minN = cloudItems[cloudItems.length - 1].n;
            html += '<div class="st-card"><div class="st-card-title">他的词云</div><div class="cloud">';
            cloudItems.forEach(function (item, idx) {
                var ratio = maxN === minN ? 1 : (item.n - minN) / (maxN - minN);
                var size = Math.round(13 + ratio * 12);
                var color = CLOUD_COLORS[idx % CLOUD_COLORS.length];
                var weight = ratio > 0.66 ? 700 : (ratio > 0.33 ? 600 : 500);
                html += '<span style="font-size:' + size + 'px;color:' + color + ';font-weight:' + weight + '">' +
                    item.text.replace(/</g, "&lt;") + '</span>';
            });
            html += '</div></div>';
        }

        if (knownDays) {
            html += '<div class="st-card"><div class="st-big"><div class="num">' + knownDays + '</div><div class="lab">从第一句话到现在（天）</div></div></div>';
        }
        html += '<div class="st-card">' +
            '<div class="st-row"><span>消息总数</span><b>' + h.length + '</b></div>' +
            '<div class="st-row"><span>我说的</span><b>' + mine + ' 条 · ' + myChars + ' 字</b></div>' +
            '<div class="st-row"><span>他说的</span><b>' + his + ' 条 · ' + hisChars + ' 字</b></div>' +
            '<div class="st-row"><span>图片 / 表情包</span><b>' + media + ' 条</b></div>' +
            '</div>';
        html += '<div class="st-card">' +
            '<div class="st-row"><span>字卡</span><b>' + cards.length + ' 条</b></div>' +
            '<div class="st-row"><span>文字 / emoji / 表情包 / 拍一拍</span><b>' + byKind.text + ' / ' + byKind.emoji + ' / ' + byKind.sticker + ' / ' + byKind.status + '</b></div>' +
            '<div class="st-row"><span>信件</span><b>' + letters + ' 封</b></div>' +
            '<div class="st-row"><span>倒数日</span><b>' + anns.length + ' 个</b></div>' +
            '</div>' +
            '<div class="st-note">排行与词云统计的是「他在 iMessage 说过、并能对上某条文字字卡」的次数。</div>';

        $("stStatsBody").innerHTML = html;
        v.classList.add("show");
    }

    /* ================= 日历 + 经期 ================= */
    var calCursor = new Date();

    function periodData() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(PERIOD_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        if (!Array.isArray(d.days)) d.days = [];
        return d;
    }
    function savePeriod(d) { try { localStorage.setItem(PERIOD_KEY, JSON.stringify(d)); } catch (e) {} }

    function periodSets() {
        var d = periodData();
        var days = d.days.filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }).sort();
        var set = {};
        days.forEach(function (s) { set[s] = 1; });
        var starts = [], prev = "";
        days.forEach(function (s) {
            if (!prev) { starts.push(s); prev = s; return; }
            var a = new Date(prev + "T00:00:00").getTime();
            var b = new Date(s + "T00:00:00").getTime();
            if (b - a > 2 * 86400000) starts.push(s);
            prev = s;
        });
        var cycle = 28;
        if (starts.length >= 2) {
            var recent = starts.slice(-4), gaps = [];
            for (var i = 1; i < recent.length; i++) {
                gaps.push(Math.round((new Date(recent[i] + "T00:00:00") - new Date(recent[i - 1] + "T00:00:00")) / 86400000));
            }
            if (gaps.length) {
                var sum = 0;
                gaps.forEach(function (g) { sum += g; });
                cycle = Math.max(18, Math.min(45, Math.round(sum / gaps.length)));
            }
        }
        var lastStart = starts.length ? starts[starts.length - 1] : "";
        var next = "", untilNext = -1;
        if (lastStart) {
            var nd = new Date(lastStart + "T00:00:00");
            nd.setDate(nd.getDate() + cycle);
            next = ymd(nd);
            var today = new Date(); today.setHours(0, 0, 0, 0);
            untilNext = Math.round((nd - today) / 86400000);
        }
        return { set: set, starts: starts, cycle: cycle, next: next, untilNext: untilNext, lastStart: lastStart };
    }

    function calendarView() {
        var v = $("stCalView");
        if (v) return v;
        v = document.createElement("div");
        v.className = "st-view";
        v.id = "stCalView";
        v.innerHTML =
            '<div class="st-head"><button class="st-btn" id="stCalBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><div class="st-title">日历 · 经期</div><span style="width:40px"></span></div>' +
            '<div class="st-body" id="stCalBody"></div>';
        document.body.appendChild(v);
        $("stCalBack").addEventListener("click", function () { v.classList.remove("show"); });
        return v;
    }

    function renderCalendar() {
        var body = $("stCalBody");
        if (!body) return;
        var p = periodSets();
        var year = calCursor.getFullYear(), month = calCursor.getMonth();
        var startWeekday = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var todayStr = ymd(new Date());

        var cellsHtml = "";
        for (var i = 0; i < startWeekday; i++) cellsHtml += '<div class="cal-cell empty"></div>';
        for (var d = 1; d <= daysInMonth; d++) {
            var ds = year + "-" + pad(month + 1) + "-" + pad(d);
            var cls = "cal-cell";
            if (p.set[ds]) cls += " period";
            else if (p.next && ds === p.next) cls += " pred";
            if (ds === todayStr) cls += " today";
            cellsHtml += '<button type="button" class="' + cls + '" data-cal="' + ds + '">' + d + '</button>';
        }

        var info = p.lastStart
            ? '<div class="st-card">' +
                '<div class="st-row"><span>最近一次开始</span><b>' + p.lastStart + '</b></div>' +
                '<div class="st-row"><span>平均周期</span><b>' + p.cycle + ' 天</b></div>' +
                '<div class="st-row"><span>预计下次</span><b>' + (p.next || "—") + '</b></div>' +
                '<div class="st-row"><span>距离下次</span><b>' + (p.untilNext >= 0 ? ("还有 " + p.untilNext + " 天") : ("已过 " + (-p.untilNext) + " 天")) + '</b></div>' +
                '</div>'
            : '<div class="st-card"><div class="st-note">还没有记录。点日期就能标记为经期；连续几天都点一下。</div></div>';

        body.innerHTML =
            '<div class="st-card">' +
                '<div class="cal-nav"><button type="button" id="calPrev">‹</button><span>' + year + ' 年 ' + (month + 1) + ' 月</span><button type="button" id="calNext">›</button></div>' +
                '<div class="cal-grid">' +
                    '<div class="cal-wd">日</div><div class="cal-wd">一</div><div class="cal-wd">二</div><div class="cal-wd">三</div><div class="cal-wd">四</div><div class="cal-wd">五</div><div class="cal-wd">六</div>' +
                    cellsHtml +
                '</div>' +
            '</div>' + info +
            '<div class="st-note">点日期 = 标记 / 取消经期日；虚线圈出的是按平均周期预测的下次。数据只存本机。</div>';

        var prev = $("calPrev"), next = $("calNext");
        if (prev) prev.addEventListener("click", function () { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
        if (next) next.addEventListener("click", function () { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });

        Array.prototype.forEach.call(body.querySelectorAll("[data-cal]"), function (btn) {
            btn.addEventListener("click", function () {
                var ds = btn.getAttribute("data-cal");
                var dd = periodData();
                var i = dd.days.indexOf(ds);
                if (i >= 0) dd.days.splice(i, 1);
                else dd.days.push(ds);
                savePeriod(dd);
                renderCalendar();
            });
        });
    }

    function openCalendar() {
        var v = calendarView();
        calCursor = new Date();
        renderCalendar();
        v.classList.add("show");
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

    /* ================= 调度 ================= */
    var schedTimer = null;
    function scheduleBuild() {
        if (schedTimer) return;
        schedTimer = setTimeout(function () {
            schedTimer = null;
            try {
                injectSprite();
                buildWeather();
                buildApps();
                buildDaily();
                syncIconSize();
                decorateCall();
            } catch (e) {}
        }, 30);
    }

    var lastDedupe = 0, lastWeather = 0, lastDay = "";
    function tick() {
        if (document.hidden) return;
        injectStyles();
        injectSprite();
        fixMenu();
        watchMyMedia();
        buildWeather();
        buildApps();
        buildDaily();
        syncIconSize();
        decorateCall();
        var now = Date.now();
        var today = ymd(new Date());
        if (today !== lastDay) { lastDay = today; renderDaily(true); }
        if (now - lastWeather > 60000) { lastWeather = now; renderWeather(); }
        if (now - lastDedupe > 20000) { lastDedupe = now; dedupeNow(true); }
    }

    function init() {
        injectStyles();
        injectSprite();
        buildMenu();
        fixMenu();
        scheduleBuild();
        setTimeout(function () { dedupeNow(true); }, 1500);
        if (window.MutationObserver) {
            var mo = new MutationObserver(function () { scheduleBuild(); });
            mo.observe(document.body, { childList: true, subtree: true });
            var watchCall = function () {
                var ov = $("philosCallIn");
                if (ov && !ov.__philosObs) {
                    ov.__philosObs = 1;
                    new MutationObserver(function () { decorateCall(); }).observe(ov, { attributes: true, childList: true, subtree: true });
                }
            };
            watchCall();
            setInterval(watchCall, 800);
        }
        setInterval(tick, 1200);
        window.addEventListener("focus", tick);
        window.addEventListener("resize", function () { syncIconSize(); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);

    window.philosDedupe = function () { return dedupeNow(false); };
    window.philosRefreshDaily = function () {
        var el = document.querySelector(".dw");
        if (!el) return;
        el.innerHTML = "";
        renderDaily(true);
    };
})();
