/* Philos 微信模块 v10：微信图片搬进 IndexedDB + 清理工具 + 按百分比回复 + 来电界面美化 */
(function () {
    "use strict";

    var WX_KEY = "philos_wechat";
    var MAIN_KEY = "private_chat_app_v1";
    var WORDS_KEY = "philos_words";
    var GAL_KEY = "philos_gallery";

    var wx = null, wxTyping = false, wxPanelOpen = "", wxQuoteText = null;
    var wxRound = 0, wxReplyTimer = null, wxRaw = "";
    var imgCache = {};

    var FACES = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕"];

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
    function storeImg(url) {
        var id = "i" + hash(url);
        return putImg(id, url).then(function (ok) { return ok ? "idb://" + id : url; });
    }
    function resolveImg(src, cb) {
        if (!src || typeof src !== "string") { cb(""); return; }
        if (src.indexOf("idb://") !== 0) { cb(src); return; }
        if (imgCache[src]) { cb(imgCache[src]); return; }
        getImg(src.slice(6)).then(function (url) {
            if (url) { imgCache[src] = url; cb(url); }
            else cb("");
        });
    }

    function injectStyles() {
        if (document.getElementById("philos-wx-style")) return;
        var st = document.createElement("style");
        st.id = "philos-wx-style";
        st.textContent =
            "#btnChatCall{display:none !important;}" +
            ".chat-center{position:absolute !important;left:50% !important;transform:translateX(-50%) !important;top:calc(env(safe-area-inset-top) + 6px) !important;}" +
            ".wx-view{position:fixed;inset:0;z-index:480;display:none;flex-direction:column;background:#F7F7F7;}" +
            ".wx-view.show{display:flex;}" +
            ".wx-header{flex:0 0 auto;display:flex;align-items:center;padding:calc(env(safe-area-inset-top) + 6px) 10px 8px;background:#EEEEEE;border-bottom:1px solid #E5E5E5;}" +
            ".wx-head-btn{width:44px;height:40px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:#1a1a1a;}" +
            ".wx-head-btn .svg-icon{width:27px;height:27px;stroke-width:1.5;}" +
            ".wx-title{flex:1;text-align:center;font-size:17px;font-weight:500;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-messages{flex:1;min-height:0;overflow-y:auto;padding:8px 0 12px;background-size:cover;background-position:center;}" +
            ".wx-time{display:flex;width:fit-content;height:auto;margin:8px auto;padding:2px 5px;border-radius:3px;background:rgba(255,255,255,0.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:0.5px solid rgba(0,0,0,0.10);color:#9A9A9A;font-size:14px;line-height:1.2;}" +
            ".wx-row{display:flex;align-items:flex-start;gap:8px;padding:6px 12px;}" +
            ".wx-row.mine{flex-direction:row-reverse;}" +
            ".wx-col{display:flex;flex-direction:column;max-width:72%;min-width:0;}" +
            ".wx-row.mine .wx-col{align-items:flex-end;}" +
            ".wx-avatar{width:40px;height:40px;border-radius:4px;overflow:hidden;flex:0 0 auto;background:#DEDEDE;display:flex;align-items:center;justify-content:center;color:#8A8A8A;font-size:13px;}" +
            ".wx-avatar img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".wx-bubble{position:relative;max-width:100%;padding:9px 13px;border-radius:4px;background:#FFFFFF;color:#1a1a1a;line-height:1.5;font-size:15px;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.08);}" +
            ".wx-bubble::before{content:\"\";position:absolute;top:14px;left:-5px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:6px solid #FFFFFF;}" +
            ".wx-row.mine .wx-bubble{background:#95EC69;}" +
            ".wx-row.mine .wx-bubble::before{left:auto;right:-5px;border-right:none;border-left:6px solid #95EC69;}" +
            ".wx-quote{margin-top:6px;max-width:100%;font-size:12px;line-height:1.4;color:#8A8A8A;background:rgba(0,0,0,0.05);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-radius:4px;padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-menubar{position:fixed;z-index:600;display:none;gap:2px;padding:4px;border-radius:10px;background:rgba(28,28,30,.95);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 8px 24px rgba(0,0,0,.3);}" +
            ".wx-menubar button{height:34px;padding:0 12px;border:none;background:none;color:#fff;font-size:14px;border-radius:7px;}" +
            ".wx-menubar button.danger{color:#FF453A;}" +
            ".wx-quotebar{display:none;align-items:center;gap:8px;margin:0 8px 6px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.06);font-size:12px;color:#666;}" +
            ".wx-quotebar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-quotebar button{border:none;background:none;color:#999;font-size:14px;}" +
            ".wx-sticker{max-width:120px;border-radius:6px;display:block;}" +
            ".wx-stk{position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:#fff;border:none;padding:0;}" +
            ".wx-stk img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".wx-stk.add{border:1px dashed #BBB;color:#888;font-size:24px;}" +
            ".wx-stk-del{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font-size:12px;line-height:18px;text-align:center;z-index:3;}" +
            ".wx-loc{width:210px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#fff;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(0,0,0,.08);}" +
            ".wx-loc-top{height:33.333%;display:flex;align-items:center;justify-content:center;background:#FFFFFF;color:#1a1a1a;font-size:12px;}" +
            ".wx-loc-map{flex:1;background:#E9F1EA;position:relative;overflow:hidden;}" +
            ".wx-loc-map svg{width:100%;height:100%;display:block;}" +
            ".wx-inputbar{flex:0 0 auto;display:flex;align-items:center;gap:4px;padding:8px 8px calc(env(safe-area-inset-bottom) + 8px);background:#F7F7F7;border-top:1px solid #E5E5E5;}" +
            ".wx-ibar-btn{width:34px;height:34px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:none;border:none;color:#1a1a1a;}" +
            ".wx-ibar-btn .svg-icon{width:28px;height:28px;stroke-width:1.5;}" +
            ".wx-inputwrap{flex:1;min-width:0;height:36px;border-radius:6px;background:#FFFFFF;display:flex;align-items:center;padding:0 8px;}" +
            ".wx-inputwrap input{width:100%;border:none;background:transparent;outline:none;font-size:15px;color:#1a1a1a;text-align:center;}" +
            ".wx-inputwrap input::placeholder{color:#C7C7C7;font-size:13px;}" +
            ".wx-send{flex:0 0 auto;height:32px;padding:0 10px;border-radius:5px;background:#07C160;color:#fff;font-size:14px;border:none;}" +
            ".wx-panel{display:none;flex:0 0 auto;background:#F7F7F7;border-top:1px solid #E5E5E5;padding:10px 10px calc(env(safe-area-inset-bottom) + 10px);max-height:250px;overflow-y:auto;}" +
            ".wx-panel.show{display:block;}" +
            ".wx-panel-tabs{display:flex;gap:8px;margin-bottom:8px;}" +
            ".wx-ptab{height:28px;padding:0 12px;border-radius:14px;background:#fff;border:1px solid #E5E5E5;font-size:13px;color:#555;}" +
            ".wx-ptab.active{background:#07C160;color:#fff;border-color:#07C160;}" +
            ".wx-emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;}" +
            ".wx-emoji{height:34px;font-size:22px;line-height:1;background:#fff;border:none;border-radius:8px;}" +
            ".wx-emoji.add{font-size:20px;color:#888;}" +
            ".wx-stk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}" +
            ".wx-plus-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}" +
            ".wx-plus-item{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;font-size:12px;color:#333;}" +
            ".wx-plus-icon{width:56px;height:56px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;color:#1a1a1a;}" +
            ".wx-plus-icon .svg-icon{width:26px;height:26px;stroke-width:1.5;}" +
            ".wx-sheet-mask{position:fixed;inset:0;z-index:520;background:rgba(0,0,0,.35);display:none;}" +
            ".wx-sheet-mask.show{display:block;}" +
            ".wx-sheet{position:fixed;left:50%;top:50%;right:auto;bottom:auto;width:86%;max-width:340px;z-index:521;background:#fff;border-radius:18px;padding:20px 18px;transform:translate(-50%,-50%) scale(.94);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease;box-shadow:0 20px 50px rgba(0,0,0,.25);}" +
            ".wx-sheet.show{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto;}" +
            ".wx-sheet h3{margin:0 0 16px;font-size:16px;text-align:center;color:#1a1a1a;}" +
            ".wx-field{display:flex;align-items:center;gap:12px;margin-bottom:14px;font-size:14px;color:#333;}" +
            ".wx-field input[type=text]{flex:1;height:38px;border:1px solid #E5E5E5;border-radius:10px;padding:0 12px;font-size:15px;}" +
            ".wx-mini{height:32px;padding:0 10px;border-radius:8px;border:1px solid #E5E5E5;background:#fff;font-size:13px;color:#333;}" +
            ".wx-mini.danger{color:#FF3B30;border-color:#FFD6D2;}" +
            ".call-in-body{margin-top:16vh !important;gap:0 !important;}" +
            ".call-in-actions{display:flex !important;grid-template-columns:none !important;align-items:flex-start;justify-content:center;gap:58px !important;width:100%;max-width:330px;margin:0 auto;}" +
            ".call-in-act{display:flex;flex-direction:column;align-items:center;gap:10px;}" +
            ".call-in-btn.round{width:76px !important;height:76px !important;border-radius:50% !important;padding:0 !important;display:flex;align-items:center;justify-content:center;font-size:0 !important;line-height:0;}" +
            ".call-in-btn.round .svg-icon{width:30px;height:30px;stroke-width:1.7;}" +
            ".call-in-act-label{font-size:13px;color:rgba(255,255,255,0.86);letter-spacing:0.4px;}";
        document.head.appendChild(st);
    }

    function wxData() {
        var raw = "";
        try { raw = localStorage.getItem(WX_KEY) || ""; } catch (e) { raw = ""; }
        if (raw !== wxRaw) {
            wxRaw = raw;
            var parsed = null;
            if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
            wx = parsed && typeof parsed === "object" ? parsed : null;
        }
        if (!wx || typeof wx !== "object") wx = { name: "Ta", avatar: "", myAvatar: "", bg: "#F7F7F7", bgImage: "", history: [], emojis: [], stickers: [] };
        if (!Array.isArray(wx.history)) wx.history = [];
        if (!Array.isArray(wx.emojis)) wx.emojis = [];
        if (!Array.isArray(wx.stickers)) wx.stickers = [];
        if (typeof wx.name !== "string" || !wx.name) wx.name = "Ta";
        if (typeof wx.bg !== "string" || !wx.bg) wx.bg = "#F7F7F7";
        if (typeof wx.avatar !== "string") wx.avatar = "";
        if (typeof wx.myAvatar !== "string") wx.myAvatar = "";
        if (typeof wx.bgImage !== "string") wx.bgImage = "";
        return wx;
    }

    function wxSave() {
        try {
            var json = JSON.stringify(wxData());
            wxRaw = json;
            localStorage.setItem(WX_KEY, json);
        } catch (e) {
            alert("网页整体存储已满（localStorage 只有 5MB）。可以去 设置 → 数据管理 里用「清理图片」腾出空间。");
        }
    }

    /* ===== 把微信里的图片搬进 IndexedDB ===== */
    var migrating = false;
    function migrateWx() {
        if (migrating) return;
        var d = wxData();
        var targets = [];
        d.history.forEach(function (m) {
            if (m && m.type === "image" && typeof m.text === "string" && m.text.indexOf("data:image/") === 0) targets.push(m);
        });
        d.stickers.forEach(function (s, i) {
            if (typeof s === "string" && s.indexOf("data:image/") === 0) targets.push({ _sticker: i });
        });
        ["avatar", "myAvatar", "bgImage"].forEach(function (k) {
            if (typeof d[k] === "string" && d[k].indexOf("data:image/") === 0) targets.push({ _field: k });
        });
        if (!targets.length) return;

        migrating = true;
        var jobs = targets.map(function (t) {
            var url = t._field ? d[t._field] : (t._sticker != null ? d.stickers[t._sticker] : t.text);
            return storeImg(url).then(function (ref) {
                if (!ref || ref === url) return;
                if (t._field) d[t._field] = ref;
                else if (t._sticker != null) d.stickers[t._sticker] = ref;
                else t.text = ref;
            });
        });
        Promise.all(jobs).then(function () {
            try {
                var json = JSON.stringify(d);
                wxRaw = json;
                localStorage.setItem(WX_KEY, json);
            } catch (e) {}
            migrating = false;
            var v = document.getElementById("wechatView");
            if (v && v.classList.contains("show")) wxRender();
        }).catch(function () { migrating = false; });
    }

    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function wxAvatar(src, fallback) {
        var span = document.createElement("span");
        span.className = "wx-avatar";
        if (src && typeof src === "string" && (src.indexOf("idb://") === 0 || /^(data:image\/|https?:\/\/|blob:)/.test(src))) {
            var img = document.createElement("img");
            span.appendChild(img);
            resolveImg(src, function (url) { if (url) img.src = url; });
        } else span.textContent = fallback || "";
        return span;
    }

    function wxLocCard(distance) {
        var wrap = document.createElement("div");
        wrap.className = "wx-loc";
        var top = document.createElement("div");
        top.className = "wx-loc-top";
        top.textContent = distance > 100 ? "不在你周围" : ("距离你 " + distance + " 米");
        var map = document.createElement("div");
        map.className = "wx-loc-map";
        map.innerHTML = '<svg viewBox="0 0 210 80" preserveAspectRatio="none"><rect width="210" height="80" fill="#E9F1EA"/><path d="M-10 26 H220" stroke="#FFFFFF" stroke-width="9"/><path d="M-10 58 H220" stroke="#FFFFFF" stroke-width="7"/><path d="M52 -10 V90" stroke="#FFFFFF" stroke-width="8"/><path d="M150 -10 V90" stroke="#FFFFFF" stroke-width="6"/><circle cx="105" cy="42" r="11" fill="#07C160" opacity=".16"/><circle cx="105" cy="42" r="5" fill="#07C160"/></svg>';
        wrap.appendChild(top); wrap.appendChild(map);
        return wrap;
    }

    function wxNotify(text) {
        try {
            if (!("Notification" in window) || Notification.permission !== "granted") return;
            var title = wxData().name || "Ta";
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, { body: text, icon: "icon-192.png", badge: "icon-192.png", tag: "philos-wx" }); }).catch(function () {});
            } else {
                new Notification(title, { body: text, icon: "icon-192.png" });
            }
        } catch (e) {}
    }

    function wxRender() {
        var box = document.getElementById("wxMessages");
        var title = document.getElementById("wxTitle");
        var view = document.getElementById("wechatView");
        if (!box || !view) return;
        var d = wxData(); var main = mainData();
        if (title) title.textContent = wxTyping ? "对方正在输入…" : (d.name || "Ta");
        if (d.bgImage) resolveImg(d.bgImage, function (url) { view.style.background = url ? 'url("' + url + '") center/cover no-repeat' : (d.bg || "#F7F7F7"); });
        else view.style.background = d.bg || "#F7F7F7";

        box.innerHTML = "";
        var last = 0;
        d.history.forEach(function (m, idx) {
            if (!m) return;
            if (m.time && (!last || m.time - last > 300000)) {
                var t = document.createElement("div"); t.className = "wx-time";
                var dt = new Date(m.time);
                t.textContent = (dt.getHours() < 10 ? "0" : "") + dt.getHours() + ":" + (dt.getMinutes() < 10 ? "0" : "") + dt.getMinutes();
                box.appendChild(t);
            }
            if (m.time) last = m.time;
            var row = document.createElement("div");
            row.className = "wx-row" + (m.from === "me" ? " mine" : "");
            row.setAttribute("data-wi", String(idx));
            row.appendChild(wxAvatar(m.from === "me" ? (d.myAvatar || main.myAvatar) : (d.avatar || main.taAvatar), m.from === "me" ? "我" : "Ta"));
            var col = document.createElement("div");
            col.className = "wx-col";
            if (m.type === "image") {
                var img = document.createElement("img");
                img.className = "wx-sticker";
                col.appendChild(img);
                resolveImg(m.text, function (url) { if (url) img.src = url; });
            } else if (m.type === "location") {
                col.appendChild(wxLocCard(Number(m.distance) || 0));
            } else {
                var b = document.createElement("div");
                b.className = "wx-bubble";
                b.textContent = m.text || "";
                col.appendChild(b);
            }
            if (m.quote) { var q = document.createElement("div"); q.className = "wx-quote"; q.textContent = m.quote; col.appendChild(q); }
            row.appendChild(col);
            box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
    }

    function wxPush(msg) { var d = wxData(); msg.time = Date.now(); d.history.push(msg); wxSave(); wxRender(); }

    function wxSetTyping(on) {
        wxTyping = !!on;
        var t = document.getElementById("wxTitle");
        if (t) t.textContent = on ? "对方正在输入…" : (wxData().name || "Ta");
    }

    function quoteLabel(m) {
        var main = mainData();
        var who;
        if (m && m.from === "me") who = (main.myName && main.myName !== "your账户名") ? main.myName : "我";
        else who = (wxData().name || "Ta");
        var t = m && m.type === "image" ? "[图片]" : ((m && m.text) || "");
        return who + "：" + t;
    }

    function wxPools(main) {
        var pools = { text: [], emoji: [], sticker: [] };
        (main.cards || []).forEach(function (c) {
            if (!c || typeof c.content !== "string" || !c.content) return;
            if (c.kind === "text") pools.text.push(c.content);
            else if (c.kind === "emoji") pools.emoji.push(c.content);
            else if (c.kind === "sticker" && /^(data:image\/|https?:\/\/|blob:|idb:\/\/)/.test(c.content)) pools.sticker.push(c.content);
        });
        return pools;
    }
    function wxWeights(main) {
        var perm = (main.settings && main.settings.permission) || {};
        var m = perm.replyModes || {};
        function w(key, dft) { var c = m[key]; return c && typeof c.weight === "number" ? Math.max(0, c.weight) : dft; }
        return { text: w("text", 40), emoji: w("emoji", 10), sticker: w("sticker", 10), textEmoji: w("textEmoji", 20), combo: w("combo", 20), sentence: w("sentence", 10) };
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function wordList() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(WORDS_KEY) || "null"); } catch (e) { v = null; }
        var out = [];
        if (Array.isArray(v)) {
            for (var i = 0; i < v.length; i++) if (typeof v[i] === "string" && v[i].trim()) out.push(v[i].trim());
        } else if (v && Array.isArray(v.items)) {
            for (var j = 0; j < v.items.length; j++) {
                var it = v.items[j];
                if (it && typeof it.text === "string" && it.text.trim()) out.push(it.text.trim());
            }
        }
        return out;
    }

    function pickMode(weights, pools) {
        var perm = (mainData().settings && mainData().settings.permission) || {};
        var avail = {
            text: pools.text.length > 0,
            emoji: pools.emoji.length > 0,
            sticker: pools.sticker.length > 0,
            textEmoji: pools.text.length > 0,
            combo: pools.text.length >= 2,
            sentence: wordList().length >= 2
        };
        var list = [], total = 0;
        for (var k in weights) {
            if (!weights[k] || weights[k] <= 0) continue;
            if (!avail[k]) continue;
            list.push({ key: k, w: weights[k] });
            total += weights[k];
        }
        if (!total) {
            if (pools.text.length) return "text";
            if (pools.emoji.length) return "emoji";
            if (pools.sticker.length) return "sticker";
            return "";
        }
        var r = Math.random() * total;
        for (var i = 0; i < list.length; i++) {
            r -= list[i].w;
            if (r <= 0) return list[i].key;
        }
        return list[list.length - 1].key;
    }

    function buildWxMessage(mode, pools, main) {
        var perm = (main.settings && main.settings.permission) || {};
        if (mode === "text") return { from: "ta", type: "text", text: pick(pools.text) };
        if (mode === "emoji") return { from: "ta", type: "text", text: pick(pools.emoji) };
        if (mode === "sticker") return { from: "ta", type: "image", text: pick(pools.sticker) };
        if (mode === "textEmoji") {
            var t = pick(pools.text);
            var n = 1 + Math.floor(Math.random() * 2);
            if (pools.emoji.length) { for (var i = 0; i < n; i++) t += pick(pools.emoji); }
            return { from: "ta", type: "text", text: t };
        }
        if (mode === "combo") {
            var max = Math.max(2, Math.min(6, Number(perm.comboMax) || 3));
            var cnt = 2 + Math.floor(Math.random() * (max - 1));
            var rest = pools.text.slice(), out = [];
            while (rest.length && out.length < cnt) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
            return { from: "ta", type: "text", text: out.join("，") };
        }
        if (mode === "sentence") {
            var words = wordList();
            if (words.length < 2) return { from: "ta", type: "text", text: pick(pools.text) };
            var min = Math.max(2, Number(perm.sentMin) || 3);
            var maxW = Math.max(min, Number(perm.sentMax) || min);
            var n2 = min + Math.floor(Math.random() * (maxW - min + 1));
            if (n2 > words.length) n2 = words.length;
            var r2 = words.slice(), picked = [];
            while (r2.length && picked.length < n2) picked.push(r2.splice(Math.floor(Math.random() * r2.length), 1)[0]);
            return { from: "ta", type: "text", text: picked.join("") };
        }
        return null;
    }

    function wxScheduleReply() {
        var main = mainData();
        var perm = (main.settings && main.settings.permission) || {};
        var pools = wxPools(main);
        if (!pools.text.length && !pools.emoji.length && !pools.sticker.length) return;
        var weights = wxWeights(main);

        var min = Math.max(1, Math.min(10, Number(perm.replyMin) || 1));
        var max = Math.max(min, Math.min(10, Number(perm.replyMax) || min));
        var count = min + Math.floor(Math.random() * (max - min + 1));
        var delay = Math.max(0, perm.replyDelay == null ? 3 : Number(perm.replyDelay)) * 1000;

        wxRound++;
        var round = wxRound;
        if (wxReplyTimer) clearTimeout(wxReplyTimer);
        wxSetTyping(true);

        wxReplyTimer = setTimeout(function () {
            if (round !== wxRound) return;

            var mine = [];
            wxData().history.forEach(function (mm) { if (mm && mm.from === "me" && mm.type === "text" && mm.text) mine.push(mm); });
            var quoteText = null;
            if (mine.length && Math.random() < 0.15) quoteText = quoteLabel(mine[Math.floor(Math.random() * mine.length)]);

            var viewOpen = function () {
                var v = document.getElementById("wechatView");
                return !!(v && v.classList.contains("show"));
            };

            var first = "";
            var step = 0;

            function deliver() {
                if (round !== wxRound) return;
                var m2 = mainData();
                var p2 = wxPools(m2);
                var mode = pickMode(weights, p2);
                var msg = mode ? buildWxMessage(mode, p2, m2) : null;
                if (!msg) { wxSetTyping(false); return; }

                if (!first) first = msg.type === "image" ? "给你发了一个表情包" : (msg.text || "");
                if (step === 0 && quoteText) msg.quote = quoteText;

                var d = wxData();
                d.history.push(msg);
                wxSave();

                if (viewOpen()) wxRender();
                else if (step === 0 && first) wxNotify(first);

                step++;
                if (step >= count) {
                    if (Math.random() < 0.12) {
                        var d2 = wxData();
                        d2.history.push({ from: "ta", type: "location", distance: 1 + Math.floor(Math.random() * 110), time: Date.now() });
                        wxSave();
                        if (viewOpen()) wxRender();
                    }
                    wxSetTyping(false);
                    migrateWx();
                    return;
                }
                wxReplyTimer = setTimeout(deliver, 900 + Math.floor(Math.random() * 800));
            }

            deliver();
        }, delay);
    }

    function wxSend() {
        var input = document.getElementById("wxInput"); if (!input) return;
        var text = input.value.trim(); if (!text) return;
        var msg = { from: "me", type: "text", text: text };
        if (wxQuoteText) msg.quote = wxQuoteText;
        input.value = ""; wxToggleSend(); setQuote(null);
        wxPush(msg); wxScheduleReply();
    }

    function wxToggleSend() {
        var input = document.getElementById("wxInput"), send = document.getElementById("wxSend");
        if (input && send) send.style.display = input.value.trim() ? "block" : "none";
    }

    function compressImage(file, cb) {
        var url = URL.createObjectURL(file); var img = new Image();
        img.onload = function () {
            var max = 260, scale = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
            var c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            var out = ""; try { out = c.toDataURL("image/webp", 0.7); } catch (e) {}
            if (!out || out.indexOf("data:image/") !== 0) out = c.toDataURL("image/png");
            URL.revokeObjectURL(url); cb(out);
        };
        img.onerror = function () { URL.revokeObjectURL(url); cb(""); };
        img.src = url;
    }

    function togglePanel(name) {
        var panels = document.querySelectorAll(".wx-panel");
        var target = document.getElementById("wxPanel-" + name);
        if (!target) return;
        var isOpen = wxPanelOpen === name;
        for (var i = 0; i < panels.length; i++) panels[i].classList.remove("show");
        wxPanelOpen = isOpen ? "" : name;
        if (!isOpen) target.classList.add("show");
    }

    function switchFaceTab(tab) {
        var eg = document.getElementById("wxEmojiGrid"), sg = document.getElementById("wxStkGrid");
        if (eg) eg.style.display = tab === "emoji" ? "grid" : "none";
        if (sg) sg.style.display = tab === "stk" ? "grid" : "none";
        var btns = document.querySelectorAll("[data-wxtab]");
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].getAttribute("data-wxtab") === tab);
    }

    function renderEmojiPanel() {
        var grid = document.getElementById("wxEmojiGrid"); if (!grid) return;
        var d = wxData();
        grid.innerHTML = "";
        FACES.concat(d.emojis || []).forEach(function (ch) {
            var b = document.createElement("button"); b.type = "button"; b.className = "wx-emoji"; b.textContent = ch;
            b.addEventListener("click", function () { wxPush({ from: "me", type: "text", text: ch }); wxScheduleReply(); });
            grid.appendChild(b);
        });
        var add = document.createElement("button"); add.type = "button"; add.className = "wx-emoji add"; add.textContent = "+";
        add.addEventListener("click", function () {
            var v = prompt("输入或粘贴一个 emoji"); if (!v) return;
            v = v.trim().slice(0, 8); if (!v) return;
            var d2 = wxData(); if (d2.emojis.indexOf(v) < 0) d2.emojis.push(v);
            wxSave(); renderEmojiPanel();
        });
        grid.appendChild(add);
    }

    function renderStickerPanel() {
        var grid = document.getElementById("wxStkGrid"); if (!grid) return;
        var d = wxData(); grid.innerHTML = "";
        (d.stickers || []).forEach(function (src, idx) {
            var b = document.createElement("button"); b.type = "button"; b.className = "wx-stk";
            var img = document.createElement("img"); b.appendChild(img);
            resolveImg(src, function (url) { if (url) img.src = url; });
            var del = document.createElement("span"); del.className = "wx-stk-del"; del.textContent = "×";
            del.addEventListener("click", function (e) {
                e.stopPropagation();
                if (!confirm("删除这个表情包？")) return;
                var d2 = wxData(); d2.stickers.splice(idx, 1); wxSave(); renderStickerPanel();
            });
            b.appendChild(del);
            b.addEventListener("click", function () { wxPush({ from: "me", type: "image", text: src }); wxScheduleReply(); });
            grid.appendChild(b);
        });
        var add = document.createElement("button"); add.type = "button"; add.className = "wx-stk add"; add.textContent = "+";
        add.addEventListener("click", function () { var f = document.getElementById("wxStkFile"); if (f) f.click(); });
        grid.appendChild(add);
    }

    function setQuote(text) {
        wxQuoteText = text || null;
        var bar = document.getElementById("wxQuoteBar");
        if (!bar) return;
        if (wxQuoteText) { bar.style.display = "flex"; bar.querySelector("span").textContent = wxQuoteText; }
        else bar.style.display = "none";
    }

    function hideMenu() { var m = document.getElementById("wxMenuBar"); if (m) m.style.display = "none"; }

    function openMenu(target, x, y) {
        var menu = document.getElementById("wxMenuBar");
        if (!menu) return;
        menu.style.display = "flex";
        menu.style.visibility = "hidden";
        menu.style.left = "0px"; menu.style.top = "0px";
        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        var top = y - mh - 10;
        if (top < 70) top = y + 10;
        menu.style.left = Math.max(8, Math.min(x - mw / 2, window.innerWidth - mw - 8)) + "px";
        menu.style.top = top + "px";
        menu.style.visibility = "";
        var row = target.closest(".wx-row");
        menu.setAttribute("data-wi", row ? row.getAttribute("data-wi") : "-1");
    }

    function openSheet(show) {
        var mask = document.getElementById("wxSheetMask"), sheet = document.getElementById("wxSheet");
        if (!mask || !sheet) return;
        mask.classList.toggle("show", !!show);
        sheet.classList.toggle("show", !!show);
    }
    function readFile(input, cb) {
        var f = input.files && input.files[0]; if (!f) return;
        var r = new FileReader(); r.onload = function () { cb(r.result); }; r.readAsDataURL(f); input.value = "";
    }

    function wxBuild() {
        if (document.getElementById("wechatView")) return;
        var view = document.createElement("div");
        view.className = "wx-view"; view.id = "wechatView";
        view.innerHTML =
            '<header class="wx-header"><button class="wx-head-btn" id="wxBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><div class="wx-title" id="wxTitle">Ta</div><button class="wx-head-btn" id="wxMore" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-more"></use></svg></button></header>' +
            '<div class="wx-messages" id="wxMessages"></div>' +
            '<div class="wx-panel" id="wxPanel-face"><div class="wx-panel-tabs"><button class="wx-ptab active" data-wxtab="emoji" type="button">小黄脸</button><button class="wx-ptab" data-wxtab="stk" type="button">表情包</button></div><div class="wx-emoji-grid" id="wxEmojiGrid"></div><div class="wx-stk-grid" id="wxStkGrid" style="display:none"></div></div>' +
            '<div class="wx-panel" id="wxPanel-plus"><div class="wx-plus-grid"><button class="wx-plus-item" id="wxPickPhoto" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-image"></use></svg></span><span>照片</span></button><button class="wx-plus-item" id="wxPickLoc" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-pin"></use></svg></span><span>位置</span></button><button class="wx-plus-item" id="wxPickFile" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-card"></use></svg></span><span>文件</span></button></div></div>' +
            '<div class="wx-quotebar" id="wxQuoteBar"><span></span><button type="button" id="wxQuoteClose">✕</button></div>' +
            '<div class="wx-inputbar"><button class="wx-ibar-btn" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none"/></svg></button><div class="wx-inputwrap"><input id="wxInput" type="text" placeholder="可按住 转文字"></div><button class="wx-send" id="wxSend" type="button" style="display:none">发送</button><button class="wx-ibar-btn" id="wxBtnFace" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M8.5 14.2c1 1.4 6 1.4 7 0" fill="none"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/></svg></button><button class="wx-ibar-btn" id="wxBtnPlus" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M12 8.2v7.6M8.2 12h7.6" fill="none"/></svg></button></div>' +
            '<input type="file" id="wxPhotoFile" accept="image/*" hidden><input type="file" id="wxStkFile" accept="image/*" hidden>' +
            '<div class="wx-sheet-mask" id="wxSheetMask"></div>' +
            '<div class="wx-sheet" id="wxSheet"><h3>聊天设置</h3><div class="wx-field"><span>备注</span><input type="text" id="wxName" maxlength="16"></div><div class="wx-field"><span>他的头像</span><label class="wx-mini">上传<input type="file" id="wxFileTa" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearTa" type="button">清除</button></div><div class="wx-field"><span>我的头像</span><label class="wx-mini">上传<input type="file" id="wxFileMe" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearMe" type="button">清除</button></div><div class="wx-field"><span>背景颜色</span><input type="color" id="wxBg" style="width:48px;height:32px;border:none;background:none;"></div><div class="wx-field"><span>背景图</span><label class="wx-mini">上传<input type="file" id="wxFileBg" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearBg" type="button">清除</button></div><button class="wide-btn" id="wxSaveBtn" type="button" style="margin-top:8px;">保存并关闭</button></div>';
        document.body.appendChild(view);

        var menu = document.createElement("div");
        menu.className = "wx-menubar"; menu.id = "wxMenuBar";
        menu.innerHTML = '<button type="button" data-wxact="quote">引用</button><button type="button" class="danger" data-wxact="del">删除</button>';
        document.body.appendChild(menu);

        document.getElementById("wxBack").addEventListener("click", function () { view.classList.remove("show"); hideMenu(); });
        document.getElementById("wxMore").addEventListener("click", function () {
            var d = wxData();
            document.getElementById("wxName").value = d.name || "";
            document.getElementById("wxBg").value = d.bg || "#F7F7F7";
            openSheet(true);
        });
        document.getElementById("wxSheetMask").addEventListener("click", function () { openSheet(false); });
        document.getElementById("wxSaveBtn").addEventListener("click", function () {
            var d = wxData();
            var name = document.getElementById("wxName").value.trim();
            d.name = name || "Ta";
            d.bg = document.getElementById("wxBg").value || "#F7F7F7";
            wxSave(); openSheet(false); wxRender();
        });
        document.getElementById("wxFileTa").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().avatar = src; wxSave(); wxRender(); migrateWx(); }); });
        document.getElementById("wxFileMe").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().myAvatar = src; wxSave(); wxRender(); migrateWx(); }); });
        document.getElementById("wxFileBg").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().bgImage = src; wxSave(); wxRender(); migrateWx(); }); });
        document.getElementById("wxClearTa").addEventListener("click", function () { wxData().avatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearMe").addEventListener("click", function () { wxData().myAvatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearBg").addEventListener("click", function () { wxData().bgImage = ""; wxSave(); wxRender(); });

        var input = document.getElementById("wxInput");
        input.addEventListener("input", wxToggleSend);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); wxSend(); } });
        document.getElementById("wxSend").addEventListener("click", wxSend);
        document.getElementById("wxBtnFace").addEventListener("click", function () { switchFaceTab("emoji"); togglePanel("face"); });
        document.getElementById("wxBtnPlus").addEventListener("click", function () { togglePanel("plus"); });
        document.getElementById("wxQuoteClose").addEventListener("click", function () { setQuote(null); });
        var tabs = document.querySelectorAll("[data-wxtab]");
        for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener("click", function () { switchFaceTab(this.getAttribute("data-wxtab")); });

        document.getElementById("wxMessages").addEventListener("click", function (e) {
            hideMenu();
            var target = e.target.closest ? e.target.closest(".wx-bubble, .wx-sticker, .wx-loc") : null;
            if (!target) return;
            var r = target.getBoundingClientRect();
            openMenu(target, r.left + r.width / 2, r.top);
        });
        menu.addEventListener("click", function (e) {
            var act = e.target.getAttribute ? e.target.getAttribute("data-wxact") : null;
            if (!act) return;
            var idx = Number(menu.getAttribute("data-wi"));
            var d = wxData();
            if (act === "del") { d.history.splice(idx, 1); wxSave(); wxRender(); }
            else if (act === "quote") { var mm = d.history[idx]; if (mm) setQuote(quoteLabel(mm)); }
            hideMenu();
        });
        document.addEventListener("click", function (e) {
            var mb = document.getElementById("wxMenuBar");
            if (!mb || mb.style.display !== "flex") return;
            if (!e.target.closest(".wx-menubar") && !e.target.closest(".wx-bubble") && !e.target.closest(".wx-sticker") && !e.target.closest(".wx-loc")) hideMenu();
        });

        document.getElementById("wxPickLoc").addEventListener("click", function () {
            wxPush({ from: "me", type: "location", distance: 1 + Math.floor(Math.random() * 110) });
            wxScheduleReply(); togglePanel("plus");
        });
        document.getElementById("wxPickPhoto").addEventListener("click", function () { document.getElementById("wxPhotoFile").click(); });
        document.getElementById("wxPhotoFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0]; if (!f) return;
            compressImage(f, function (src) {
                if (!src) return;
                storeImg(src).then(function (ref) { wxPush({ from: "me", type: "image", text: ref }); wxScheduleReply(); });
            });
            e.target.value = ""; togglePanel("plus");
        });
        document.getElementById("wxStkFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0]; if (!f) return;
            compressImage(f, function (src) {
                if (!src) return;
                storeImg(src).then(function (ref) { wxData().stickers.push(ref); wxSave(); renderStickerPanel(); });
            });
            e.target.value = "";
        });
        renderEmojiPanel(); renderStickerPanel();
    }

    function wxOpen() {
        injectStyles();
        wxBuild();
        migrateWx();
        var view = document.getElementById("wechatView"); if (!view) return;
        wxRender(); renderEmojiPanel(); renderStickerPanel();
        view.classList.add("show");
        setTimeout(function () { var b = document.getElementById("wxMessages"); if (b) b.scrollTop = b.scrollHeight; }, 60);
    }

    /* ===== 清理工具（数据管理页） ===== */
    function countImages() {
        var out = { wx: 0, chat: 0, gal: 0 };
        var d = wxData();
        d.history.forEach(function (m) { if (m && m.type === "image") out.wx++; });
        out.wx += (d.stickers || []).length;
        var main = mainData();
        (main.chatHistory || []).forEach(function (m) {
            if (m && (m.type === "image" || m.type === "sticker")) out.chat++;
        });
        var g = null;
        try { g = JSON.parse(localStorage.getItem(GAL_KEY) || "null"); } catch (e) { g = null; }
        if (g && typeof g === "object") {
            out.gal += Array.isArray(g.me) ? g.me.length : 0;
            out.gal += Array.isArray(g.ta) ? g.ta.length : 0;
        }
        return out;
    }

    function pruneWxImages() {
        if (!confirm("清理微信里的图片（保留文字记录），确定吗？")) return;
        var d = wxData();
        d.history = d.history.filter(function (m) { return !(m && m.type === "image"); });
        d.stickers = [];
        try { wxRaw = JSON.stringify(d); localStorage.setItem(WX_KEY, wxRaw); } catch (e) {}
        alert("已清理微信图片。");
        var v = document.getElementById("wechatView");
        if (v && v.classList.contains("show")) wxRender();
        refreshCleanupCard();
    }

    function pruneChatImages() {
        if (!confirm("清理 iMessage 里的图片（保留文字记录），确定吗？")) return;
        var d = mainData();
        d.chatHistory = (d.chatHistory || []).filter(function (m) { return !(m && (m.type === "image" || m.type === "sticker")); });
        try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {}
        alert("已清理聊天图片。");
        if (window.philosReload) window.philosReload();
        refreshCleanupCard();
    }

    function pruneGallery() {
        if (!confirm("清空图库照片？大仓库里的图片文件不会被自动删。")) return;
        try { localStorage.setItem(GAL_KEY, JSON.stringify({ me: [], ta: [] })); } catch (e) {}
        if (window.PhilosGalleryRefresh) window.PhilosGalleryRefresh();
        refreshCleanupCard();
    }

    function refreshCleanupCard() {
        var card = document.querySelector("[data-cleanup-card]");
        if (!card) return;
        var c = countImages();
        var w = card.querySelector('[data-cl="wx"]');
        var ch = card.querySelector('[data-cl="chat"]');
        var g = card.querySelector('[data-cl="gal"]');
        if (w) w.textContent = c.wx + " 张";
        if (ch) ch.textContent = c.chat + " 张";
        if (g) g.textContent = c.gal + " 张";
    }

    function ensureCleanupCard() {
        var page = document.querySelector('[data-page="data"]');
        if (!page || page.querySelector("[data-cleanup-card]")) return;
        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-cleanup-card", "1");
        card.innerHTML =
            '<div class="card-title">清理图片（腾空间）</div>' +
            '<div class="control-row"><span class="control-label">微信里的图片</span><span class="control-value" data-cl="wx">—</span></div>' +
            '<div class="control-row"><span class="control-label">iMessage 里的图片</span><span class="control-value" data-cl="chat">—</span></div>' +
            '<div class="control-row"><span class="control-label">图库照片</span><span class="control-value" data-cl="gal">—</span></div>' +
            '<div class="control-block"><button class="wide-btn" data-cl-act="wx" type="button">清理微信图片（保留文字）</button></div>' +
            '<div class="control-block"><button class="wide-btn" data-cl-act="chat" type="button">清理聊天图片（保留文字）</button></div>' +
            '<div class="control-block"><button class="wide-btn" data-cl-act="gal" type="button">清空图库照片</button></div>';
        card.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-cl-act]") : null;
            if (!btn) return;
            var act = btn.getAttribute("data-cl-act");
            if (act === "wx") pruneWxImages();
            else if (act === "chat") pruneChatImages();
            else if (act === "gal") pruneGallery();
        });
        var anchor = page.querySelector(".about-note");
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor);
        else page.appendChild(card);
        refreshCleanupCard();
    }

    function tuneRanges() {
        var d = document.querySelector('[data-key="permission.replyDelay"]');
        if (d) { d.setAttribute("max", "300"); d.max = "300"; }
        ["permission.activeMin", "permission.activeMax", "permission.callMin", "permission.callMax"].forEach(function (k) {
            var el = document.querySelector('[data-key="' + k + '"]');
            if (el) { el.setAttribute("min", "0"); el.min = "0"; }
        });
    }

    function fixAvatarLabels() {
        ["headerAvatar", "callAvatar", "peekAvatar"].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var t = el.querySelector(".avatar-text");
            if (t && t.textContent === "Me") t.textContent = "Ta";
        });
    }

    function decorateCall() {
        var overlay = document.getElementById("philosCallIn");
        if (!overlay) return;
        var actions = overlay.querySelector(".call-in-actions");
        if (!actions) return;
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
            btn.parentNode.insertBefore(wrap, btn);
            wrap.appendChild(btn);
            var lb = document.createElement("span");
            lb.className = "call-in-act-label";
            lb.textContent = label;
            wrap.appendChild(lb);
        });
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H53";
                }
            }
        } catch (e) {}
    }

    function loadModule(src) {
        if (document.querySelector('script[data-philos="' + src + '"]')) return;
        var s = document.createElement("script");
        s.src = src;
        s.setAttribute("data-philos", src);
        document.body.appendChild(s);
    }

    function tick() {
        if (document.hidden) return;
        migrateWx();
        ensureCleanupCard();
        refreshCleanupCard();
        decorateCall();
    }

    function init() {
        injectStyles();
        tuneRanges();
        fixAvatarLabels();
        markVersion();
        loadModule("quiz.js");
        loadModule("gallery.js");
        migrateWx();
        ensureCleanupCard();
        setTimeout(function () { tuneRanges(); fixAvatarLabels(); markVersion(); decorateCall(); migrateWx(); ensureCleanupCard(); }, 900);
        setTimeout(function () { tuneRanges(); fixAvatarLabels(); markVersion(); decorateCall(); migrateWx(); }, 2200);
        setInterval(tick, 2000);
        if (window.MutationObserver) {
            var hd = document.getElementById("chatHeader");
            if (hd) new MutationObserver(fixAvatarLabels).observe(hd, { childList: true, subtree: true });
            var cs = document.getElementById("callScreen");
            if (cs) new MutationObserver(fixAvatarLabels).observe(cs, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);

    window.PhilosOpenWeChat = wxOpen;
    window.PhilosRefreshWeChat = function () {
        var v = document.getElementById("wechatView");
        if (v && v.classList.contains("show")) wxRender();
    };
})();
