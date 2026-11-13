/* Philos 图库 app v5：照片存 IndexedDB（只记地址）、地址失效按哈希找回、空列表可救援、弹窗记录拆成两消息 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var GAL_KEY = "philos_gallery";
    var ASK_KEY = "philos_gallery_ask";
    var WANT_KEY = "philos_gallery_want";

    var view = null, gridEl = null, sheetEl = null, tab = "me";
    var wantOpen = false, imgCache = {}, recovering = false;

    function $(id) { return document.getElementById(id); }
    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function saveMain(d) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) { alert("存储空间已满，可能没有保存。"); } }

    function galData() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(GAL_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
        if (!Array.isArray(d.me)) d.me = [];
        if (!Array.isArray(d.ta)) d.ta = [];
        return d;
    }
    function saveGal(d) { try { localStorage.setItem(GAL_KEY, JSON.stringify(d)); } catch (e) { alert("存储空间已满，图片没有保存。"); } }

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
    function storeOne(url, cb) {
        var id = "i" + hash(url);
        putImg(id, url).then(function (ok) { cb(ok ? "idb://" + id : url); });
    }

    function resolveSrc(src, cb) {
        if (!src) { cb(""); return; }
        if (src.indexOf("idb://") !== 0) { cb(src); return; }
        if (imgCache[src]) { cb(imgCache[src]); return; }
        var id = src.slice(6);
        getImg(id).then(function (url) {
            if (url) { imgCache[src] = url; cb(url); return; }
            getAll().then(function (all) {
                var found = "";
                if (all[id]) found = all[id];
                if (!found) {
                    for (var key in all) {
                        var val = all[key];
                        if (typeof val === "string" && id.indexOf(hash(val)) >= 0) { found = val; break; }
                    }
                }
                if (found) { imgCache[src] = found; cb(found); }
                else cb("");
            });
        });
    }

    function softRefresh() {
        if (window.philosReload) { setTimeout(function () { window.philosReload(); }, 80); return; }
        setTimeout(function () { location.reload(); }, 200);
    }

    function injectStyles() {
        if (document.getElementById("philos-gal-style")) return;
        var st = document.createElement("style");
        st.id = "philos-gal-style";
        st.textContent =
            ".gal-view{position:fixed;inset:0;z-index:487;display:none;flex-direction:column;background:#EEEEEE;}" +
            ".gal-view.show{display:flex;}" +
            ".gal-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 14px 6px;}" +
            ".gal-btn{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#2b323b;background:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.9);box-shadow:0 2px 10px rgba(50,70,95,0.10);}" +
            ".gal-btn .svg-icon{width:22px;height:22px;stroke-width:1.6;}" +
            ".gal-title{flex:1;text-align:center;font-size:17px;font-weight:600;color:#20242a;}" +
            ".gal-seg{flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 14px 10px;padding:4px;border-radius:14px;background:rgba(120,132,148,0.14);}" +
            ".gal-seg-btn{height:34px;border-radius:11px;font-size:14px;color:#4a5563;}" +
            ".gal-seg-btn.active{background:#ffffff;color:#1b1d21;font-weight:600;box-shadow:0 2px 8px rgba(60,80,105,0.12);}" +
            ".gal-grid{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 12px calc(env(safe-area-inset-bottom) + 26px);display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start;}" +
            ".gal-cell{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.7);box-shadow:0 2px 10px rgba(60,80,105,0.10);padding:0;}" +
            ".gal-cell img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".gal-cell.broken::after{content:\"找不到\";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8b909a;}" +
            ".gal-empty{grid-column:1 / -1;text-align:center;font-size:13px;color:#8b909a;padding:40px 0 10px;}" +
            ".gal-rescue{grid-column:1 / -1;display:flex;flex-direction:column;gap:10px;padding:6px 0 10px;}" +
            ".gal-rescue-btn{height:46px;border-radius:14px;background:#5b7fa6;color:#fff;font-size:15px;border:none;}" +
            ".gal-rescue-tip{font-size:12px;color:#8b909a;text-align:center;line-height:1.5;}" +
            ".gal-sheet-mask{position:fixed;inset:0;z-index:489;background:rgba(16,20,26,0.30);display:none;}" +
            ".gal-sheet-mask.show{display:block;}" +
            ".gal-sheet{position:fixed;left:50%;bottom:auto;top:50%;transform:translate(-50%,-50%) scale(.94);opacity:0;pointer-events:none;z-index:490;width:78%;max-width:300px;padding:8px;border-radius:18px;background:rgba(255,255,255,0.92);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 22px 50px rgba(20,30,45,0.24);transition:transform .18s ease,opacity .18s ease;}" +
            ".gal-sheet.show{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto;}" +
            ".gal-item{display:block;width:100%;height:44px;border-radius:12px;font-size:15px;color:#1b1d21;text-align:center;}" +
            ".gal-item.danger{color:#ff3b30;}" +
            ".gal-item:active{background:rgba(120,132,148,0.14);}" +
            ".gal-preview{width:100%;height:112px;border-radius:12px;background-size:cover;background-position:center;margin-bottom:6px;}" +
            ".want-mask{position:fixed;inset:0;z-index:630;background:rgba(16,20,26,0.34);display:flex;align-items:center;justify-content:center;padding:26px;}" +
            ".want-card{position:relative;width:82%;max-width:330px;aspect-ratio:3/4;border-radius:28px;overflow:hidden;background:#ffffff;box-shadow:0 26px 60px rgba(20,30,45,0.30);}" +
            ".want-card img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".want-cap{position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,0.58);-webkit-backdrop-filter:blur(16px) saturate(120%);backdrop-filter:blur(16px) saturate(120%);color:#1b1d21;font-size:16px;font-weight:600;letter-spacing:0.3px;text-align:center;word-break:break-word;}";
        document.head.appendChild(st);
    }

    function renderTabs() {
        var btns = view.querySelectorAll("[data-galtab]");
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].getAttribute("data-galtab") === tab);
    }

    function cellFor(src, onTap) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "gal-cell";
        var img = document.createElement("img");
        img.alt = "";
        cell.appendChild(img);
        resolveSrc(src, function (url) {
            if (url) img.src = url;
            else cell.classList.add("broken");
        });
        cell.addEventListener("click", onTap);
        return cell;
    }

    function renderRecover() {
        recovering = true;
        gridEl.innerHTML = "";
        getAll().then(function (all) {
            var keys = Object.keys(all);
            if (!keys.length) {
                var none = document.createElement("div");
                none.className = "gal-empty";
                none.textContent = "大仓库里也没有图片了。";
                gridEl.appendChild(none);
                return;
            }
            var tip = document.createElement("div");
            tip.className = "gal-rescue-tip";
            tip.textContent = "大仓库里还有 " + keys.length + " 张图，点一张可以放回「我的」或「他的」。";
            gridEl.appendChild(tip);
            keys.forEach(function (key) {
                var val = all[key];
                if (typeof val !== "string") return;
                gridEl.appendChild(cellFor(val, function () { openRecoverSheet(val); }));
            });
        });
    }

    function renderGrid() {
        if (!gridEl) return;
        if (recovering) { renderRecover(); return; }
        var d = galData();
        var list = tab === "ta" ? d.ta : d.me;
        gridEl.innerHTML = "";
        if (!list.length) {
            var empty = document.createElement("div");
            empty.className = "gal-empty";
            empty.textContent = tab === "ta" ? "还没有他的照片" : "还没有我的照片";
            gridEl.appendChild(empty);
            var box = document.createElement("div");
            box.className = "gal-rescue";
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "gal-rescue-btn";
            btn.textContent = "从大仓库找回图片";
            btn.addEventListener("click", function () { renderRecover(); });
            var tip = document.createElement("div");
            tip.className = "gal-rescue-tip";
            tip.textContent = "如果之前加过图片但列表空了，点上面按钮看看大仓库里还剩什么。";
            box.appendChild(btn);
            box.appendChild(tip);
            gridEl.appendChild(box);
            return;
        }
        list.forEach(function (src, idx) {
            gridEl.appendChild(cellFor(src, function () { openSheet(src, idx); }));
        });
    }

    function closeSheet() {
        if (!sheetEl) return;
        sheetEl.classList.remove("show");
        var mask = $("galMask");
        if (mask) mask.classList.remove("show");
    }

    function sheetBody(prevUrl, actions) {
        var body = $("galSheetBody");
        if (!body) return;
        body.innerHTML = "";
        if (prevUrl) {
            var prev = document.createElement("div");
            prev.className = "gal-preview";
            prev.style.backgroundImage = 'url("' + prevUrl.replace(/"/g, "&quot;") + '")';
            body.appendChild(prev);
        }
        actions.forEach(function (act) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "gal-item" + (act.danger ? " danger" : "");
            btn.textContent = act.label;
            btn.addEventListener("click", function () { closeSheet(); act.run(); });
            body.appendChild(btn);
        });
        sheetEl.classList.add("show");
        var mask = $("galMask");
        if (mask) mask.classList.add("show");
    }

    function openRecoverSheet(url) {
        sheetBody(url, [
            { label: "放回「我的」", run: function () { addPhoto("me", url); } },
            { label: "放回「他的」", run: function () { addPhoto("ta", url); } },
            { label: "取消", run: function () {} }
        ]);
    }

    function addPhoto(which, url) {
        var d = galData();
        var list = which === "ta" ? d.ta : d.me;
        list.unshift(url);
        saveGal(d);
        recovering = false;
        renderGrid();
    }

    function openSheet(src, idx) {
        resolveSrc(src, function (url) {
            var actions = [];
            if (tab === "me") actions.push({ label: "设为我的头像", run: function () { if (url) setAvatar("me", url); } });
            else actions.push({ label: "设为他的头像", run: function () { if (url) setAvatar("ta", url); } });
            actions.push({ label: "设为聊天背景", run: function () { if (url) setBg("chatBg", url); } });
            actions.push({ label: "设为主界面背景", run: function () { if (url) setBg("homeBg", url); } });
            actions.push({ label: "删除这张", danger: true, run: function () { removePhoto(idx); } });
            sheetBody(url || "", actions);
        });
    }

    function setAvatar(who, url) {
        var d = mainData();
        if (who === "me") d.myAvatar = url;
        else d.taAvatar = url;
        saveMain(d);
        softRefresh();
    }

    function setBg(which, url) {
        var d = mainData();
        if (!d.settings) d.settings = {};
        if (!d.settings.appearance) d.settings.appearance = {};
        if (!d.settings.appearance[which]) d.settings.appearance[which] = { color: "#e9edf2", image: "", opacity: 100, blur: 20 };
        d.settings.appearance[which].image = url;
        saveMain(d);
        softRefresh();
    }

    function removePhoto(idx) {
        var d = galData();
        var list = tab === "ta" ? d.ta : d.me;
        list.splice(idx, 1);
        saveGal(d);
        renderGrid();
    }

    function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

    function maybeAskAvatar() {
        var d = galData();
        if (!d.ta.length) return;
        var last = 0;
        try { last = Number(localStorage.getItem(ASK_KEY)) || 0; } catch (e) {}
        var now = Date.now();
        if (now - last < 3 * 3600 * 1000) return;
        if (Math.random() > 0.35) return;
        try { localStorage.setItem(ASK_KEY, String(now)); } catch (e) {}
        resolveSrc(pickRandom(d.ta), function (url) { if (url) showAsk(url, mainData().taName || "他"); });
    }

    function showAsk(url, name) {
        var old = $("galAsk");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var mask = document.createElement("div");
        mask.id = "galAsk";
        mask.className = "php-mask show";
        var card = document.createElement("div");
        card.className = "php-card";
        var av = document.createElement("div");
        av.className = "php-avatar";
        av.innerHTML = '<img src="' + url.replace(/"/g, "&quot;") + '" alt="">';
        var text = document.createElement("div");
        text.className = "php-text";
        text.textContent = name + "：我想换个头像，可以吗？";
        var actions = document.createElement("div");
        actions.className = "php-actions";
        var no = document.createElement("button");
        no.type = "button";
        no.className = "php-btn";
        no.textContent = "下次吧";
        no.addEventListener("click", function () { mask.classList.remove("show"); });
        var yes = document.createElement("button");
        yes.type = "button";
        yes.className = "php-btn primary";
        yes.textContent = "换吧";
        yes.addEventListener("click", function () { mask.classList.remove("show"); setAvatar("ta", url); });
        actions.appendChild(no);
        actions.appendChild(yes);
        card.appendChild(av);
        card.appendChild(text);
        card.appendChild(actions);
        mask.appendChild(card);
        document.body.appendChild(mask);
    }

    function pickEmoji() {
        var d = mainData();
        var list = (d.cards || []).filter(function (c) { return c && c.kind === "emoji" && c.content; });
        if (!list.length) return "";
        return list[Math.floor(Math.random() * list.length)].content;
    }

    /* 关掉弹窗后：先发那张图，再发一条「我想要」+emoji 的普通消息 */
    function pushWantMessages(photoUrl, caption) {
        if (!photoUrl) return;
        storeOne(photoUrl, function (ref) {
            if (window.philosPushMessage) {
                window.philosPushMessage({ from: "ta", type: "image", text: ref, status: "", gallery: true });
                setTimeout(function () {
                    window.philosPushMessage({ from: "ta", type: "text", text: caption, status: "" });
                }, 900);
                return;
            }
            var d = mainData();
            d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
            d.chatHistory.push({ from: "ta", type: "image", text: ref, time: Date.now(), status: "", gallery: true });
            d.chatHistory.push({ from: "ta", type: "text", text: caption, time: Date.now() + 900, status: "" });
            saveMain(d);
            if (window.philosRefreshChat) window.philosRefreshChat();
        });
    }

    function showWant(url, caption) {
        if (wantOpen) return;
        wantOpen = true;
        injectStyles();
        var old = $("wantPop");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var mask = document.createElement("div");
        mask.className = "want-mask";
        mask.id = "wantPop";
        var card = document.createElement("div");
        card.className = "want-card";
        var img = document.createElement("img");
        img.src = url;
        img.alt = "";
        var cap = document.createElement("div");
        cap.className = "want-cap";
        cap.textContent = caption;
        card.appendChild(img);
        card.appendChild(cap);
        mask.appendChild(card);
        document.body.appendChild(mask);
        var done = false;
        mask.addEventListener("click", function () {
            if (done) return;
            done = true;
            mask.parentNode.removeChild(mask);
            wantOpen = false;
            pushWantMessages(url, caption);
        });
    }

    function maybeWantPopup() {
        var d = galData();
        if (!d.ta.length) return;
        var last = 0;
        try { last = Number(localStorage.getItem(WANT_KEY)) || 0; } catch (e) {}
        var now = Date.now();
        if (now - last < 3600 * 1000) return;
        if (Math.random() > 0.45) return;
        try { localStorage.setItem(WANT_KEY, String(now)); } catch (e) {}
        var emoji = pickEmoji();
        var caption = "我想要" + (emoji ? emoji : "");
        resolveSrc(pickRandom(d.ta), function (url) { if (url) showWant(url, caption); });
    }

    function build() {
        if (view) return;
        injectStyles();
        view = document.createElement("div");
        view.className = "gal-view";
        view.id = "philosGallery";
        view.innerHTML =
            '<div class="gal-head">' +
                '<button class="gal-btn" id="galBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button>' +
                '<div class="gal-title">图库</div>' +
                '<button class="gal-btn" id="galAdd" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-plus"></use></svg></button>' +
            '</div>' +
            '<div class="gal-seg">' +
                '<button class="gal-seg-btn active" data-galtab="me" type="button">我的</button>' +
                '<button class="gal-seg-btn" data-galtab="ta" type="button">他的</button>' +
            '</div>' +
            '<div class="gal-grid" id="galGrid"></div>' +
            '<input type="file" id="galFile" accept="image/*" multiple hidden>' +
            '<div class="gal-sheet-mask" id="galMask"></div>' +
            '<div class="gal-sheet" id="galSheet"><div id="galSheetBody"></div></div>';
        document.body.appendChild(view);

        gridEl = $("galGrid");
        sheetEl = $("galSheet");

        $("galBack").addEventListener("click", function () {
            if (recovering) { recovering = false; renderGrid(); return; }
            view.classList.remove("show");
        });
        $("galAdd").addEventListener("click", function () { var f = $("galFile"); if (f) f.click(); });
        $("galMask").addEventListener("click", closeSheet);

        view.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-galtab]") : null;
            if (!btn) return;
            recovering = false;
            tab = btn.getAttribute("data-galtab");
            renderTabs();
            renderGrid();
        });
    }

    function open() {
        build();
        recovering = false;
        renderTabs();
        renderGrid();
        view.classList.add("show");
        setTimeout(maybeWantPopup, 800);
        setTimeout(maybeAskAvatar, 2600);
    }

    window.PhilosGalleryRefresh = function () { if (view) renderGrid(); };

    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.closest("#btnGallery")) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        open();
    }, true);

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectStyles);
    else setTimeout(injectStyles, 0);

    window.PhilosOpenGallery = open;
})();
