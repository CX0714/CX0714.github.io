/* Philos 附加功能：存储用量 / 图标背景 / 字卡库二级界面（情绪·造句为整页）/ 频率·造句 / 批量加图 / 分组编辑 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var GAL_KEY = "philos_gallery";
    var ICON_KEY = "philos_icon_extra";
    var MOOD_KEY = "philos_moods";
    var WORD_KEY = "philos_words";
    var SENT_KEY = "philos_sentence";
    var KINDS = ["text", "emoji", "sticker", "status"];
    var KIND_LABEL = { text: "文字", emoji: "emoji", sticker: "表情包", status: "拍一拍" };

    function $(id) { return document.getElementById(id); }
    function getMain() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function getGal() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(GAL_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        if (!Array.isArray(d.me)) d.me = [];
        if (!Array.isArray(d.ta)) d.ta = [];
        return d;
    }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    /* ===== 图标补充（空心爱心） ===== */
    var SVG_NS = "http://www.w3.org/2000/svg";
    function injectSprite() {
        var sprite = document.querySelector("svg.svg-sprite");
        if (!sprite || document.getElementById("ic-heart-outline")) return;
        var sym = document.createElementNS(SVG_NS, "symbol");
        sym.setAttribute("id", "ic-heart-outline");
        sym.setAttribute("viewBox", "0 0 24 24");
        sym.innerHTML = '<path d="M12 20.6C12 20.6 4 15.4 4 10.2 4 7.5 6.1 5.4 8.6 5.4c1.4 0 2.7.7 3.4 1.9.7-1.2 2-1.9 3.4-1.9C17.9 5.4 20 7.5 20 10.2c0 5.2-8 10.4-8 10.4z"/>';
        sprite.appendChild(sym);
    }

    /* ===== IndexedDB ===== */
    var dbPromise = null;
    function db() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve) {
            try {
                var req = indexedDB.open("philos_images", 1);
                req.onupgradeneeded = function () { try { req.result.createObjectStore("images"); } catch (e) {} };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { resolve(null); };
            } catch (e) { resolve(null); }
        });
        return dbPromise;
    }
    function hash(str) {
        var h1 = 5381, h2 = 52711;
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            h1 = (h1 * 33 ^ c) >>> 0;
            h2 = (h2 * 31 + c) >>> 0;
        }
        return h1.toString(36) + h2.toString(36) + str.length.toString(36);
    }
    function putImg(id, url) {
        return db().then(function (d) {
            if (!d) return false;
            return new Promise(function (resolve) {
                try {
                    var tx = d.transaction("images", "readwrite");
                    tx.objectStore("images").put(url, id);
                    tx.oncomplete = function () { resolve(true); };
                    tx.onerror = function () { resolve(false); };
                    tx.onabort = function () { resolve(false); };
                } catch (e) { resolve(false); }
            });
        });
    }
    function getImg(id) {
        return db().then(function (d) {
            if (!d) return null;
            return new Promise(function (resolve) {
                try {
                    var req = d.transaction("images").objectStore("images").get(id);
                    req.onsuccess = function () { resolve(req.result || null); };
                    req.onerror = function () { resolve(null); };
                } catch (e) { resolve(null); }
            });
        });
    }
    function getAll() {
        return db().then(function (d) {
            if (!d) return {};
            return new Promise(function (resolve) {
                var out = {};
                try {
                    var req = d.transaction("images").objectStore("images").openCursor();
                    req.onsuccess = function (e) {
                        var cur = e.target.result;
                        if (cur) { out[String(cur.key)] = cur.value; cur.continue(); }
                        else resolve(out);
                    };
                    req.onerror = function () { resolve(out); };
                } catch (e) { resolve({}); }
            });
        });
    }
    function storeAll(list) {
        return Promise.all(list.map(function (url) {
            var id = "i" + hash(url);
            return putImg(id, url).then(function (ok) { return ok ? "idb://" + id : url; });
        }));
    }
    var cache = {};
    function resolveSrc(src, cb) {
        if (!src) { cb(""); return; }
        if (src.indexOf("idb://") !== 0) { cb(src); return; }
        if (cache[src]) { cb(cache[src]); return; }
        var id = src.slice(6);
        getImg(id).then(function (url) {
            if (url) { cache[src] = url; cb(url); return; }
            getAll().then(function (all) {
                var found = "";
                if (all[id]) found = all[id];
                if (!found) {
                    for (var key in all) {
                        var val = all[key];
                        if (typeof val === "string" && id.indexOf(hash(val)) >= 0) { found = val; break; }
                    }
                }
                if (found) { cache[src] = found; cb(found); }
                else cb("");
            });
        });
    }
    function idbStats() {
        return getAll().then(function (all) {
            var count = 0, bytes = 0;
            for (var k in all) { count++; if (typeof all[k] === "string") bytes += all[k].length; }
            return { count: count, bytes: bytes };
        });
    }

    function softRefresh() {
        if (window.philosReload) { setTimeout(function () { window.philosReload(); }, 80); return; }
        setTimeout(function () { location.reload(); }, 200);
    }
    function fmt(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1024 / 1024).toFixed(2) + " MB";
    }
    function compress(file, max, cb) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            var out = "";
            try { out = c.toDataURL("image/webp", 0.68); } catch (e) {}
            if (!out || out.indexOf("data:image/") !== 0) out = c.toDataURL("image/png");
            URL.revokeObjectURL(url);
            cb(out);
        };
        img.onerror = function () { URL.revokeObjectURL(url); cb(""); };
        img.src = url;
    }

    function injectStyles() {
        if (document.getElementById("philos-extras-style")) return;
        var st = document.createElement("style");
        st.id = "philos-extras-style";
        st.textContent =
            ".xc-mask{position:fixed;inset:0;z-index:640;background:rgba(16,20,26,0.32);display:none;}" +
            ".xc-mask.show{display:block;}" +
            ".xc-sheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.94);opacity:0;pointer-events:none;z-index:641;width:84%;max-width:330px;padding:18px;border-radius:20px;background:rgba(255,255,255,0.94);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 22px 50px rgba(20,30,45,0.24);transition:transform .18s ease,opacity .18s ease;}" +
            ".xc-sheet.show{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto;}" +
            ".xc-title{font-size:16px;font-weight:600;color:#1b1d21;text-align:center;margin-bottom:14px;}" +
            ".xc-input{width:100%;height:44px;border-radius:12px;border:1px solid rgba(120,135,155,0.30);background:#fff;padding:0 12px;font-size:16px;color:#1b1d21;outline:none;box-sizing:border-box;}" +
            ".xc-row{display:flex;gap:10px;margin-top:14px;}" +
            ".xc-btn{flex:1;height:44px;border-radius:13px;font-size:15px;border:none;}" +
            ".xc-btn.ghost{background:rgba(120,132,148,0.14);color:#1b1d21;}" +
            ".xc-btn.primary{background:#5b7fa6;color:#fff;}" +
            ".xc-btn.danger{background:rgba(255,59,48,0.12);color:#ff3b30;}" +
            ".sp-bar{height:7px;border-radius:4px;background:rgba(120,132,148,0.22);overflow:hidden;margin:2px 16px 14px;}" +
            ".sp-bar span{display:block;height:100%;border-radius:4px;background:#5b7fa6;transition:width .25s ease;}" +
            "#cardKindSeg{display:none !important;}" +
            ".ck-overview{position:absolute;left:0;right:0;bottom:0;z-index:6;background:#EEEEEE;padding:16px 16px calc(env(safe-area-inset-bottom) + 24px);display:none;overflow-y:auto;}" +
            ".ck-overview.show{display:block;}" +
            ".ck-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}" +
            ".ck-block{position:relative;aspect-ratio:1.15 / 1;border-radius:22px;background:#ffffff;border:1px solid rgba(120,135,155,0.10);box-shadow:0 2px 12px rgba(60,80,105,0.10);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:0;}" +
            ".ck-block:active{transform:scale(0.98);}" +
            ".ck-block-title{font-size:16px;font-weight:600;color:#1b1d21;letter-spacing:0.3px;}" +
            ".ck-block-count{font-size:12px;color:#8b909a;}" +
            ".ck-block-icon{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(91,127,166,0.10);color:#5b7fa6;}" +
            ".ck-block-icon .svg-icon{width:20px;height:20px;aspect-ratio:1/1;}" +
            ".ck-sub{position:absolute;left:0;right:0;bottom:0;z-index:7;background:#EEEEEE;display:none;flex-direction:column;}" +
            ".ck-sub.show{display:flex;}" +
            ".ck-sub-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:10px 16px 4px;font-size:12.5px;color:#8b909a;}" +
            ".ck-sub-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px 16px 10px;}" +
            ".ck-sub-item{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#ffffff;border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 2px 10px rgba(60,80,105,0.10);font-size:15px;color:#1b1d21;word-break:break-word;}" +
            ".ck-sub-del{flex:0 0 auto;font-size:13px;color:#ff3b30;background:none;border:none;padding:2px 0;}" +
            ".ck-sub-empty{text-align:center;font-size:13px;color:#8b909a;padding:44px 0;}" +
            ".ck-sub-add{flex:0 0 auto;display:flex;gap:10px;padding:10px 16px calc(env(safe-area-inset-bottom) + 16px);}" +
            ".ck-sub-add input{flex:1 1 auto;min-width:0;height:46px;border-radius:14px;border:1px solid rgba(120,135,155,0.28);background:#ffffff;padding:0 13px;font-size:16px;color:#1b1d21;outline:none;}" +
            ".ck-sub-add button{flex:0 0 auto;width:86px;height:46px;border-radius:14px;background:#5b7fa6;color:#fff;font-size:15px;border:none;}" +
            "[data-theme=\"dark\"] .ck-overview,[data-theme=\"dark\"] .ck-sub{background:#000000;}" +
            "[data-theme=\"dark\"] .ck-block,[data-theme=\"dark\"] .ck-sub-item{background:#1c1d21;border-color:rgba(255,255,255,0.08);}" +
            "[data-theme=\"dark\"] .ck-block-title,[data-theme=\"dark\"] .ck-sub-item{color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .ck-sub-add input{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .xc-sheet{background:rgba(32,34,39,0.96);border-color:rgba(255,255,255,0.12);}" +
            "[data-theme=\"dark\"] .xc-title{color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .xc-input{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .xc-btn.ghost{background:rgba(255,255,255,0.10);color:#f2f3f6;}" +
            "#chatMessages .msg-bubble img.msg-gallery-img{max-width:210px !important;border-radius:12px;}";
        document.head.appendChild(st);
    }

    /* ================= 存储用量面板 ================= */
    function dataPage() { return document.querySelector('[data-page="data"]'); }
    function buildPanel() {
        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-storage-panel", "1");
        card.innerHTML =
            '<div class="card-title">存储用量</div>' +
            '<div class="control-row"><span class="control-label">聊天记录</span><span class="control-value" data-sp="chat">—</span></div>' +
            '<div class="control-row"><span class="control-label">设置 / 字卡等</span><span class="control-value" data-sp="rest">—</span></div>' +
            '<div class="control-row"><span class="control-label">图片（大仓库）</span><span class="control-value" data-sp="img">—</span></div>' +
            '<div class="control-block"><div class="control-head"><span class="control-label">localStorage 总占用</span><span class="control-value" data-sp="total">—</span></div></div>' +
            '<div class="sp-bar"><span data-sp="bar" style="width:0%"></span></div>' +
            '<div class="control-block"><button class="wide-btn" data-sp-act="prewarm" type="button">把残留图片搬进大仓库</button></div>' +
            '<div class="control-block"><button class="wide-btn" data-sp-act="measure" type="button">重新测量</button></div>';
        card.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-sp-act]") : null;
            if (!btn) return;
            if (btn.getAttribute("data-sp-act") === "prewarm") {
                if (window.philosPrewarmImages) window.philosPrewarmImages();
                btn.textContent = "正在搬…稍后重新测量";
                setTimeout(updatePanel, 2600);
            } else updatePanel();
        });
        return card;
    }
    function setVal(card, key, text) {
        var el = card.querySelector('[data-sp="' + key + '"]');
        if (el) el.textContent = text;
    }
    function updatePanel() {
        var card = document.querySelector("[data-storage-panel]");
        if (!card) return;
        var raw = "";
        try { raw = localStorage.getItem(MAIN_KEY) || ""; } catch (e) {}
        var totalBytes = raw.length;
        var data = {};
        try { data = JSON.parse(raw || "{}"); } catch (e) { data = {}; }
        var chatBytes = 0;
        try { chatBytes = JSON.stringify(data.chatHistory || []).length; } catch (e) {}
        setVal(card, "chat", fmt(chatBytes));
        setVal(card, "rest", fmt(Math.max(0, totalBytes - chatBytes)));
        setVal(card, "total", fmt(totalBytes) + "（上限约 5 MB）");
        var pct = Math.min(100, Math.round(totalBytes / (5 * 1024 * 1024) * 100));
        var bar = card.querySelector('[data-sp="bar"]');
        if (bar) {
            bar.style.width = pct + "%";
            bar.style.background = pct > 85 ? "#ff3b30" : (pct > 60 ? "#e8a13a" : "#5b7fa6");
        }
        idbStats().then(function (st) { setVal(card, "img", st.count + " 张 · " + fmt(st.bytes)); });
    }
    function ensurePanel() {
        var page = dataPage();
        if (!page) return;
        if (page.querySelector("[data-storage-panel]")) return;
        var anchor = page.querySelector(".about-note");
        var card = buildPanel();
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);
        else page.appendChild(card);
        setTimeout(updatePanel, 120);
    }

    /* ================= 图标背景（新增 5 个） ================= */
    var ICON_DEFS = [
        { key: "phone", label: "电话", el: "btnPhone", sym: "ic-phone" },
        { key: "wechat", label: "微信", el: "btnWechat", sym: "ic-chat" },
        { key: "gallery", label: "图库", el: "btnGallery", sym: "ic-image" },
        { key: "quiz", label: "出题", el: "btnQuiz", sym: "ic-card" },
        { key: "freq", label: "频率", el: "btnFreq", sym: "ic-ecg" }
    ];
    function getIcons() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(ICON_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        return d;
    }
    function saveIcons(d) { try { localStorage.setItem(ICON_KEY, JSON.stringify(d)); } catch (e) { alert("存储空间已满。"); } }

    function applyIcons() {
        var d = getIcons();
        ICON_DEFS.forEach(function (def) {
            var el = $(def.el);
            if (!el) return;
            var box = el.querySelector(".app-icon-box") || el;
            var ref = d[def.key] || "";
            if (!ref) {
                box.style.backgroundImage = "";
                box.classList.remove("has-image");
                el.classList.remove("has-image");
                return;
            }
            resolveSrc(ref, function (url) {
                if (!url) return;
                box.style.backgroundImage = 'url("' + url.replace(/"/g, "&quot;") + '")';
                box.classList.add("has-image");
                el.classList.add("has-image");
            });
        });
    }

    function ensureIconRows() {
        var grid = $("iconCfgGrid");
        if (!grid) return;
        if (grid.querySelector("[data-iconx]")) return;
        var d = getIcons();
        ICON_DEFS.forEach(function (def) {
            var row = document.createElement("div");
            row.className = "icon-cfg";
            row.setAttribute("data-iconx", def.key);
            var prev = document.createElement("span");
            prev.className = "icon-cfg-preview";
            prev.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + def.sym + '"></use></svg>';
            var ref = d[def.key] || "";
            if (ref) resolveSrc(ref, function (url) {
                if (!url) return;
                prev.classList.add("has-image");
                prev.style.backgroundImage = 'url("' + url.replace(/"/g, "&quot;") + '")';
            });
            var name = document.createElement("span");
            name.className = "icon-cfg-name";
            name.textContent = def.label;
            var actions = document.createElement("div");
            actions.className = "icon-cfg-actions";
            var up = document.createElement("label");
            up.className = "mini-btn";
            up.textContent = "上传";
            var file = document.createElement("input");
            file.type = "file";
            file.accept = "image/*";
            file.hidden = true;
            file.setAttribute("data-iconx-upload", def.key);
            up.appendChild(file);
            var clr = document.createElement("button");
            clr.type = "button";
            clr.className = "mini-btn danger";
            clr.textContent = "清除";
            clr.setAttribute("data-iconx-clear", def.key);
            actions.appendChild(up);
            actions.appendChild(clr);
            row.appendChild(prev);
            row.appendChild(name);
            row.appendChild(actions);
            grid.appendChild(row);
        });
    }

    document.addEventListener("change", function (e) {
        var el = e.target;
        if (!el || !el.getAttribute) return;
        var key = el.getAttribute("data-iconx-upload");
        if (!key) return;
        var f = el.files && el.files[0];
        el.value = "";
        if (!f) return;
        compress(f, 480, function (dataUrl) {
            if (!dataUrl) return;
            var id = "i" + hash(dataUrl);
            putImg(id, dataUrl).then(function (ok) {
                var d = getIcons();
                d[key] = ok ? "idb://" + id : dataUrl;
                saveIcons(d);
                applyIcons();
                var prev = document.querySelector('[data-iconx="' + key + '"] .icon-cfg-preview');
                if (prev && ok) {
                    prev.classList.add("has-image");
                    prev.style.backgroundImage = 'url("' + dataUrl + '")';
                }
            });
        });
    }, true);

    document.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("[data-iconx-clear]") : null;
        if (!btn) return;
        var key = btn.getAttribute("data-iconx-clear");
        var d = getIcons();
        delete d[key];
        saveIcons(d);
        applyIcons();
        var prev = document.querySelector('[data-iconx="' + key + '"] .icon-cfg-preview');
        if (prev) { prev.classList.remove("has-image"); prev.style.backgroundImage = ""; }
    }, true);

    /* ================= 情绪 / 造句 数据 ================= */
    function moodStore() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(MOOD_KEY) || "null"); } catch (e) { v = null; }
        if (!v || typeof v !== "object") v = {};
        if (!Array.isArray(v.moods)) v.moods = [];
        if (!v.state || typeof v.state !== "object") v.state = { text: "", until: 0 };
        if (!v.range || typeof v.range !== "object") v.range = { min: 20, max: 120 };
        return v;
    }
    function saveMoodStore(v) { try { localStorage.setItem(MOOD_KEY, JSON.stringify(v)); } catch (e) { alert("保存失败。"); } }

    function words() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(WORD_KEY) || "null"); } catch (e) { v = null; }
        if (!Array.isArray(v)) v = [];
        return v.filter(function (w) { return typeof w === "string" && w.trim(); });
    }
    function saveWords(list) { try { localStorage.setItem(WORD_KEY, JSON.stringify(list)); } catch (e) { alert("保存失败。"); } }

    function sentCfg() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(SENT_KEY) || "null"); } catch (e) { v = null; }
        if (!v || typeof v !== "object") v = {};
        if (typeof v.on !== "boolean") v.on = false;
        if (typeof v.min !== "number") v.min = 3;
        if (typeof v.max !== "number") v.max = 5;
        if (typeof v.ivMin !== "number") v.ivMin = 30;
        if (typeof v.ivMax !== "number") v.ivMax = 90;
        if (v.min < 2) v.min = 2;
        if (v.max < v.min) v.max = v.min;
        return v;
    }
    function saveSentCfg(v) { try { localStorage.setItem(SENT_KEY, JSON.stringify(v)); } catch (e) {} }

    function shufflePick(list, n) {
        var copy = list.slice();
        var out = [];
        while (copy.length && out.length < n) {
            out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
        }
        return out;
    }

    function buildSentence(force) {
        var cfg = sentCfg();
        var list = words();
        if (!list.length) { if (force) alert("「造句」里还没有词。"); return ""; }
        var min = Math.max(2, cfg.min);
        var max = Math.max(min, cfg.max);
        if (list.length < min) {
            if (force) alert("词不够：至少要有 " + min + " 个词。");
            return "";
        }
        var n = min + Math.floor(Math.random() * (max - min + 1));
        if (n > list.length) n = list.length;
        return shufflePick(list, n).join("");
    }

    function sendSentence(force) {
        var cfg = sentCfg();
        if (!cfg.on && !force) return false;
        var text = buildSentence(force);
        if (!text) return false;
        if (window.philosPushMessage) {
            window.philosPushMessage({ from: "ta", type: "text", text: text, status: "" });
        } else {
            var d = getMain();
            d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
            d.chatHistory.push({ from: "ta", type: "text", text: text, time: Date.now(), status: "" });
            try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {}
            if (window.philosRefreshChat) window.philosRefreshChat();
        }
        return true;
    }

    var sentTimer = null;
    function scheduleSentence() {
        if (sentTimer) clearTimeout(sentTimer);
        var cfg = sentCfg();
        if (!cfg.on) return;
        var a = Math.max(1, cfg.ivMin);
        var b = Math.max(a, cfg.ivMax);
        var mins = a + Math.random() * (b - a);
        sentTimer = setTimeout(function () {
            sendSentence(false);
            scheduleSentence();
        }, mins * 60000);
    }

    /* ================= 频率页：造句卡 ================= */
    function ensureSentenceCard() {
        var body = $("freqBody");
        if (!body || body.querySelector("[data-philos-sentcard]")) return;
        var cfg = sentCfg();

        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-philos-sentcard", "1");
        card.innerHTML =
            '<div class="card-title">造句</div>' +
            '<div class="control-row"><span class="control-label">他自己造句</span><label class="switch"><input type="checkbox" data-sent="on"><span class="switch-track"></span></label></div>' +
            '<div class="control-block"><div class="control-head"><span class="control-label">最少用几个词</span><span class="control-value" data-sent-val="min">' + cfg.min + '个</span></div><input class="slider" type="range" data-sent="min" min="2" max="10" step="1"></div>' +
            '<div class="control-block"><div class="control-head"><span class="control-label">最多用几个词</span><span class="control-value" data-sent-val="max">' + cfg.max + '个</span></div><input class="slider" type="range" data-sent="max" min="2" max="12" step="1"></div>' +
            '<div class="control-block"><div class="control-head"><span class="control-label">最短间隔</span><span class="control-value" data-sent-val="ivMin">' + cfg.ivMin + 'min</span></div><input class="slider" type="range" data-sent="ivMin" min="1" max="240" step="1"></div>' +
            '<div class="control-block"><div class="control-head"><span class="control-label">最长间隔</span><span class="control-value" data-sent-val="ivMax">' + cfg.ivMax + 'min</span></div><input class="slider" type="range" data-sent="ivMax" min="1" max="480" step="1"></div>' +
            '<div class="control-block"><button class="wide-btn" data-sent-act="test" type="button">让他造一句试试</button></div>';

        var onEl = card.querySelector('[data-sent="on"]');
        if (onEl) onEl.checked = !!cfg.on;
        ["min", "max", "ivMin", "ivMax"].forEach(function (k) {
            var el = card.querySelector('[data-sent="' + k + '"]');
            if (el) el.value = cfg[k];
        });

        card.addEventListener("input", function (e) {
            var key = e.target.getAttribute && e.target.getAttribute("data-sent");
            if (!key || key === "on") return;
            var cur = sentCfg();
            cur[key] = Number(e.target.value) || cur[key];
            if (cur.max < cur.min) cur.max = cur.min;
            if (cur.ivMax < cur.ivMin) cur.ivMax = cur.ivMin;
            saveSentCfg(cur);
            ["min", "max", "ivMin", "ivMax"].forEach(function (k) {
                var el = card.querySelector('[data-sent="' + k + '"]');
                if (el && Number(el.value) !== cur[k]) el.value = cur[k];
                var lb = card.querySelector('[data-sent-val="' + k + '"]');
                if (lb) lb.textContent = cur[k] + (k.indexOf("iv") === 0 ? "min" : "个");
            });
            scheduleSentence();
        });

        card.addEventListener("change", function (e) {
            if (e.target.getAttribute && e.target.getAttribute("data-sent") === "on") {
                var cur = sentCfg();
                cur.on = !!e.target.checked;
                saveSentCfg(cur);
                scheduleSentence();
            }
        });

        card.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-sent-act]") : null;
            if (!btn) return;
            sendSentence(true);
        });

        body.appendChild(card);
    }

    /* ================= 字卡库：方块页 + 整页子页 ================= */
    var ckState = "overview";
    var subKind = "";

    function kindCounts() {
        var data = getMain();
        var out = { text: 0, emoji: 0, sticker: 0, status: 0 };
        (data.cards || []).forEach(function (c) { if (c && out[c.kind] != null) out[c.kind]++; });
        return out;
    }

    function navHeight(view) {
        var nav = view.querySelector(".app-nav");
        return nav ? Math.round(nav.getBoundingClientRect().height) : 0;
    }

    function renderOverview() {
        var view = $("cardsView");
        if (!view) return;
        var layer = view.querySelector("[data-card-overview]");
        if (!layer) {
            layer = document.createElement("div");
            layer.className = "ck-overview";
            layer.setAttribute("data-card-overview", "1");
            view.appendChild(layer);
        }

        var counts = kindCounts();
        var icons = { text: "ic-mail", emoji: "ic-chat", sticker: "ic-image", status: "ic-pin" };

        layer.innerHTML = '<div class="ck-grid"></div>';
        var grid = layer.querySelector(".ck-grid");

        KINDS.forEach(function (kind) {
            var block = document.createElement("button");
            block.type = "button";
            block.className = "ck-block";
            block.setAttribute("data-ck-kind", kind);
            block.innerHTML =
                '<span class="ck-block-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + icons[kind] + '"></use></svg></span>' +
                '<span class="ck-block-title">' + KIND_LABEL[kind] + '</span>' +
                '<span class="ck-block-count">' + counts[kind] + ' 条</span>';
            grid.appendChild(block);
        });

        [
            { attr: "data-ck-mood", title: "情绪", count: moodStore().moods.length, sym: "ic-heart-outline" },
            { attr: "data-ck-word", title: "造句", count: words().length, sym: "ic-card" }
        ].forEach(function (item) {
            var block = document.createElement("button");
            block.type = "button";
            block.className = "ck-block";
            block.setAttribute(item.attr, "1");
            block.innerHTML =
                '<span class="ck-block-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + item.sym + '"></use></svg></span>' +
                '<span class="ck-block-title">' + item.title + '</span>' +
                '<span class="ck-block-count">' + item.count + ' 条</span>';
            grid.appendChild(block);
        });

        layer.style.top = Math.max(0, navHeight(view)) + "px";
    }

    function buildSubPage() {
        var view = $("cardsView");
        if (!view) return null;
        var sub = view.querySelector("[data-ck-subpage]");
        if (sub) return sub;

        sub = document.createElement("div");
        sub.className = "ck-sub";
        sub.setAttribute("data-ck-subpage", "1");
        sub.innerHTML =
            '<div class="ck-sub-head"><span data-sub-tip>—</span><span data-sub-count>0 条</span></div>' +
            '<div class="ck-sub-list" data-sub-list></div>' +
            '<div class="ck-sub-add"><input type="text" maxlength="20" data-sub-input placeholder="输入内容" autocomplete="off"><button type="button" data-sub-add>添加</button></div>';
        view.appendChild(sub);

        sub.querySelector("[data-sub-add]").addEventListener("click", function () { addSubItem(); });
        sub.querySelector("[data-sub-input]").addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); addSubItem(); }
        });

        return sub;
    }

    function addSubItem() {
        var sub = document.querySelector("[data-ck-subpage]");
        if (!sub || !subKind) return;
        var input = sub.querySelector("[data-sub-input]");
        var text = input ? input.value.trim() : "";
        if (!text) return;

        if (subKind === "mood") {
            var s = moodStore();
            if (s.moods.indexOf(text) < 0) s.moods.push(text);
            s.state = { text: "", until: 0 };
            saveMoodStore(s);
        } else {
            var list = words();
            if (list.indexOf(text) < 0) list.push(text);
            saveWords(list);
        }
        if (input) input.value = "";
        renderSubPage();
        renderOverviewCountsOnly();
    }

    function renderOverviewCountsOnly() {
        var view = $("cardsView");
        if (!view) return;
        var layer = view.querySelector("[data-card-overview]");
        if (layer && layer.classList.contains("show")) renderOverview();
    }

    function renderSubPage() {
        var view = $("cardsView");
        if (!view) return;
        var sub = view.querySelector("[data-ck-subpage]");
        if (!sub) return;

        var isMood = subKind === "mood";
        var arr = isMood ? moodStore().moods : words();

        sub.style.top = Math.max(0, navHeight(view)) + "px";
        var tip = sub.querySelector("[data-sub-tip]");
        if (tip) tip.textContent = isMood ? "这些会显示在他气泡下方，轮换出现" : "他每次随机取几个词拼成一句话";
        var countEl = sub.querySelector("[data-sub-count]");
        if (countEl) countEl.textContent = arr.length + " 条";
        var input = sub.querySelector("[data-sub-input]");
        if (input) input.placeholder = isMood ? "输入一条情绪" : "输入一个词或短语";

        var list = sub.querySelector("[data-sub-list]");
        if (!list) return;
        list.innerHTML = "";
        if (!arr.length) {
            var empty = document.createElement("div");
            empty.className = "ck-sub-empty";
            empty.textContent = isMood ? "还没有情绪，下面加一条试试" : "还没有词，下面加一个试试";
            list.appendChild(empty);
            return;
        }
        arr.forEach(function (text, idx) {
            var row = document.createElement("div");
            row.className = "ck-sub-item";
            var label = document.createElement("span");
            label.textContent = text;
            var del = document.createElement("button");
            del.type = "button";
            del.className = "ck-sub-del";
            del.textContent = "删除";
            del.addEventListener("click", function () {
                if (isMood) {
                    var s = moodStore();
                    s.moods.splice(idx, 1);
                    s.state = { text: "", until: 0 };
                    saveMoodStore(s);
                } else {
                    var w = words();
                    w.splice(idx, 1);
                    saveWords(w);
                }
                renderSubPage();
                renderOverviewCountsOnly();
            });
            row.appendChild(label);
            row.appendChild(del);
            list.appendChild(row);
        });
    }

    function showSubPage(kind) {
        var view = $("cardsView");
        if (!view) return;
        subKind = kind;
        ckState = "sub";
        buildSubPage();
        renderSubPage();
        var layer = view.querySelector("[data-card-overview]");
        if (layer) layer.classList.remove("show");
        var sub = view.querySelector("[data-ck-subpage]");
        if (sub) sub.classList.add("show");
    }

    function hideSubPage() {
        var view = $("cardsView");
        if (!view) return;
        var sub = view.querySelector("[data-ck-subpage]");
        if (sub) sub.classList.remove("show");
        subKind = "";
    }

    function showOverview() {
        var view = $("cardsView");
        if (!view) return;
        ckState = "overview";
        hideSubPage();
        renderOverview();
        var layer = view.querySelector("[data-card-overview]");
        if (layer) layer.classList.add("show");
    }

    function hideOverview() {
        var view = $("cardsView");
        if (!view) return;
        var layer = view.querySelector("[data-card-overview]");
        if (layer) layer.classList.remove("show");
    }

    function enterKind(kind) {
        ckState = "list";
        hideOverview();
        hideSubPage();
        var btn = document.querySelector('#cardKindSeg .kind-btn[data-kind="' + kind + '"]');
        if (btn) btn.click();
    }

    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        if (t.closest("[data-ck-mood]")) { e.stopPropagation(); showSubPage("mood"); return; }
        if (t.closest("[data-ck-word]")) { e.stopPropagation(); showSubPage("word"); return; }

        var block = t.closest("[data-ck-kind]");
        if (block) {
            e.stopPropagation();
            enterKind(block.getAttribute("data-ck-kind"));
            return;
        }

        if (t.closest("#btnCardsBack")) {
            if (ckState === "sub") {
                e.stopPropagation();
                e.preventDefault();
                showOverview();
                return;
            }
            if (ckState === "list") {
                e.stopPropagation();
                e.preventDefault();
                showOverview();
                return;
            }
        }

        if (t.closest("#appCards")) {
            ckState = "overview";
            setTimeout(showOverview, 60);
        }
    }, true);

    function syncCardsView() {
        var view = $("cardsView");
        if (!view) return;
        var active = view.classList.contains("active");
        var layer = view.querySelector("[data-card-overview]");
        var sub = view.querySelector("[data-ck-subpage]");

        if (!active) {
            ckState = "overview";
            subKind = "";
            if (layer) layer.classList.remove("show");
            if (sub) sub.classList.remove("show");
            return;
        }

        if (ckState === "sub" && sub) {
            if (!sub.classList.contains("show")) { renderSubPage(); sub.classList.add("show"); }
            return;
        }
        if (ckState === "overview" && layer && !layer.classList.contains("show")) {
            renderOverview();
            layer.classList.add("show");
        }
    }

    /* ================= 聊天里图库消息放大 ================= */
    function decorateGalleryMsgs() {
        var box = $("chatMessages");
        if (!box) return;
        var data = getMain();
        var hist = data.chatHistory || [];
        var bubbles = box.querySelectorAll(".msg-bubble[data-index]");
        for (var i = 0; i < bubbles.length; i++) {
            var idx = Number(bubbles[i].getAttribute("data-index"));
            var m = hist[idx];
            if (!m || !m.gallery) continue;
            var img = bubbles[i].querySelector("img");
            if (img) img.classList.add("msg-gallery-img");
        }
    }

    /* ================= 字卡库分组编辑 ================= */
    var editKind = "", editName = "";

    function currentKind() {
        var btn = document.querySelector("#cardKindSeg .kind-btn.active");
        var k = btn ? btn.getAttribute("data-kind") : "text";
        return KINDS.indexOf(k) >= 0 ? k : "text";
    }

    function buildEditor() {
        if ($("xcSheet")) return;
        injectStyles();
        var mask = document.createElement("div");
        mask.className = "xc-mask";
        mask.id = "xcMask";
        var sheet = document.createElement("div");
        sheet.className = "xc-sheet";
        sheet.id = "xcSheet";
        sheet.innerHTML =
            '<div class="xc-title" id="xcTitle">编辑分组</div>' +
            '<input class="xc-input" id="xcName" type="text" maxlength="12" placeholder="分组名称" autocomplete="off">' +
            '<div class="xc-row"><button class="xc-btn ghost" id="xcCancel" type="button">取消</button><button class="xc-btn primary" id="xcSave" type="button">保存</button></div>' +
            '<div class="xc-row"><button class="xc-btn danger" id="xcDel" type="button">删除这个分组</button></div>';
        document.body.appendChild(mask);
        document.body.appendChild(sheet);
        mask.addEventListener("click", closeEditor);
        $("xcCancel").addEventListener("click", closeEditor);
        $("xcSave").addEventListener("click", saveRename);
        $("xcDel").addEventListener("click", deleteGroup);
    }

    function openEditor(name) {
        if (!name || name === "全部" || name === "未分类") return;
        buildEditor();
        editKind = currentKind();
        editName = name;
        $("xcTitle").textContent = "编辑分组「" + name + "」";
        $("xcName").value = name;
        $("xcMask").classList.add("show");
        $("xcSheet").classList.add("show");
        setTimeout(function () { try { $("xcName").focus(); $("xcName").select(); } catch (e) {} }, 60);
    }

    function closeEditor() {
        var mask = $("xcMask"), sheet = $("xcSheet");
        if (mask) mask.classList.remove("show");
        if (sheet) sheet.classList.remove("show");
        editName = "";
    }

    function saveRename() {
        var next = ($("xcName") ? $("xcName").value : "").trim();
        if (!next || !editName) { closeEditor(); return; }
        if (next === editName) { closeEditor(); return; }
        if (next === "全部" || next === "未分类") { alert("这个名字不能用。"); return; }
        var data = getMain();
        if (!data.cardCategories || typeof data.cardCategories !== "object") data.cardCategories = {};
        if (!Array.isArray(data.cardCategories[editKind])) data.cardCategories[editKind] = [];
        var cats = data.cardCategories[editKind];
        var i = cats.indexOf(editName);
        if (i >= 0) cats[i] = next;
        else cats.push(next);
        (data.cards || []).forEach(function (c) {
            if (c && c.kind === editKind && c.category === editName) c.category = next;
        });
        try { localStorage.setItem(MAIN_KEY, JSON.stringify(data)); } catch (e) { alert("保存失败：存储空间可能满了。"); return; }
        closeEditor();
        softRefresh();
    }

    function deleteGroup() {
        if (!editName) return;
        if (!confirm("删除分组「" + editName + "」？里面的字卡会移到「未分类」。")) return;
        var data = getMain();
        if (data.cardCategories && Array.isArray(data.cardCategories[editKind])) {
            data.cardCategories[editKind] = data.cardCategories[editKind].filter(function (n) { return n !== editName; });
        }
        (data.cards || []).forEach(function (c) {
            if (c && c.kind === editKind && c.category === editName) c.category = "未分类";
        });
        try { localStorage.setItem(MAIN_KEY, JSON.stringify(data)); } catch (e) { alert("删除失败。"); return; }
        closeEditor();
        softRefresh();
    }

    var longPressTimer = null, longPressFired = false, pressStart = 0;

    document.addEventListener("touchstart", function (e) {
        var chip = e.target && e.target.closest ? e.target.closest("#cardCats [data-cat]") : null;
        if (!chip) return;
        longPressFired = false;
        pressStart = Date.now();
        var name = chip.getAttribute("data-cat");
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(function () { longPressFired = true; openEditor(name); }, 500);
    }, true);

    ["touchend", "touchmove", "touchcancel"].forEach(function (evt) {
        document.addEventListener(evt, function () {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        }, true);
    });

    document.addEventListener("click", function (e) {
        var chip = e.target && e.target.closest ? e.target.closest("#cardCats [data-cat]") : null;
        if (!chip) return;
        if (longPressFired && Date.now() - pressStart < 1500) {
            longPressFired = false;
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        var name = chip.getAttribute("data-cat");
        if (chip.classList.contains("active")) {
            e.stopPropagation();
            if (name === "全部" || name === "未分类") return;
            openEditor(name);
        }
    }, true);

    /* ================= 批量添加图片 ================= */
    function activeCatName() {
        var chip = document.querySelector("#cardCats .cat.active");
        var name = chip ? chip.getAttribute("data-cat") : "未分类";
        if (!name || name === "全部") return "未分类";
        return name;
    }
    function activeGalTab() {
        var btn = document.querySelector(".gal-seg-btn.active");
        var t = btn ? btn.getAttribute("data-galtab") : "me";
        return t === "ta" ? "ta" : "me";
    }

    var mode = "", cat = "未分类", galTab = "me";

    function handleBatch(input) {
        var files = Array.prototype.slice.call(input.files || []);
        input.value = "";
        if (!files.length) return;
        var results = [];
        var idx = 0;
        var limit = mode === "gallery" ? 900 : 480;
        function next() {
            if (idx >= files.length) { apply(results); return; }
            compress(files[idx++], limit, function (src) {
                if (src) results.push(src);
                next();
            });
        }
        next();
    }

    function apply(results) {
        if (!results.length) return;
        storeAll(results).then(function (stored) {
            if (mode === "gallery") {
                var g = getGal();
                var list = galTab === "ta" ? g.ta : g.me;
                stored.slice().reverse().forEach(function (src) { list.unshift(src); });
                try { localStorage.setItem(GAL_KEY, JSON.stringify(g)); }
                catch (e) { alert("存储空间不足，这批图片没有保存。"); return; }
                if (window.PhilosGalleryRefresh) window.PhilosGalleryRefresh();
                softRefresh();
                return;
            }
            var data = getMain();
            var sync = $("stickerSync") && $("stickerSync").checked;
            if (mode === "stickers") {
                data.stickers = Array.isArray(data.stickers) ? data.stickers : [];
                stored.forEach(function (src) {
                    data.stickers.push(src);
                    if (sync) {
                        data.cards = Array.isArray(data.cards) ? data.cards : [];
                        data.cards.unshift({ id: uid(), kind: "sticker", content: src, category: "未分类", createdAt: Date.now() });
                    }
                });
            } else {
                data.cards = Array.isArray(data.cards) ? data.cards : [];
                var c = cat || "未分类";
                stored.forEach(function (src) {
                    data.cards.unshift({ id: uid(), kind: "sticker", content: src, category: c, createdAt: Date.now() });
                });
                if (!data.cardCategories || typeof data.cardCategories !== "object") data.cardCategories = {};
                if (!Array.isArray(data.cardCategories.sticker)) data.cardCategories.sticker = [];
                if (c !== "未分类" && data.cardCategories.sticker.indexOf(c) < 0) data.cardCategories.sticker.push(c);
            }
            try { localStorage.setItem(MAIN_KEY, JSON.stringify(data)); }
            catch (e) { alert("存储空间不足，这批图片没有保存。"); return; }
            softRefresh();
        });
    }

    document.addEventListener("change", function (e) {
        var el = e.target;
        if (!el || !el.id) return;
        if (el.id === "stickerFile") { e.stopPropagation(); mode = "stickers"; handleBatch(el); }
        else if (el.id === "cardStickerFile") { e.stopPropagation(); mode = "cards"; cat = activeCatName(); handleBatch(el); }
        else if (el.id === "galFile") { e.stopPropagation(); mode = "gallery"; galTab = activeGalTab(); handleBatch(el); }
    }, true);

    function enableMultiple() {
        ["stickerFile", "cardStickerFile", "galFile"].forEach(function (id) {
            var el = $(id);
            if (el && !el.hasAttribute("multiple")) el.setAttribute("multiple", "");
        });
    }

    function tick() {
        if (document.hidden) return;
        injectSprite();
        enableMultiple();
        ensurePanel();
        ensureIconRows();
        applyIcons();
        syncCardsView();
        decorateGalleryMsgs();
        ensureSentenceCard();
    }

    function init() {
        injectStyles();
        injectSprite();
        tick();
        scheduleSentence();
        setInterval(tick, 1500);
        window.addEventListener("focus", tick);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
