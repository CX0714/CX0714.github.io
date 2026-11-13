/* Philos 图库 app v2：我的 / 他的 两栏、上传、设为头像或背景、他申请换头像、他的「我想要」弹窗 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var GAL_KEY = "philos_gallery";
    var ASK_KEY = "philos_gallery_ask";
    var WANT_KEY = "philos_gallery_want";

    var view = null, gridEl = null, sheetEl = null, tab = "me", pickTarget = null;
    var wantOpen = false;

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
            ".gal-empty{grid-column:1 / -1;text-align:center;font-size:13px;color:#8b909a;padding:50px 0;}" +
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

    function renderTabs() {
        var btns = view.querySelectorAll("[data-galtab]");
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].getAttribute("data-galtab") === tab);
    }

    function renderGrid() {
        if (!gridEl) return;
        var d = galData();
        var list = tab === "ta" ? d.ta : d.me;
        gridEl.innerHTML = "";
        if (!list.length) {
            var empty = document.createElement("div");
            empty.className = "gal-empty";
            empty.textContent = tab === "ta" ? "还没有他的照片，点右上角上传" : "还没有我的照片，点右上角上传";
            gridEl.appendChild(empty);
            return;
        }
        list.forEach(function (src, idx) {
            var cell = document.createElement("button");
            cell.type = "button";
            cell.className = "gal-cell";
            var img = document.createElement("img");
            img.src = src;
            img.alt = "";
            cell.appendChild(img);
            cell.addEventListener("click", function () { openSheet(src, idx); });
            gridEl.appendChild(cell);
        });
    }

    function closeSheet() {
        if (!sheetEl) return;
        sheetEl.classList.remove("show");
        var mask = $("galMask");
        if (mask) mask.classList.remove("show");
        pickTarget = null;
    }

    function openSheet(src, idx) {
        pickTarget = { src: src, idx: idx, list: tab };
        var body = $("galSheetBody");
        if (!body) return;
        body.innerHTML = "";
        var prev = document.createElement("div");
        prev.className = "gal-preview";
        prev.style.backgroundImage = 'url("' + src.replace(/"/g, "&quot;") + '")';
        body.appendChild(prev);

        var actions = [];
        if (tab === "me") {
            actions.push({ label: "设为我的头像", run: function () { setAvatar("me", src); } });
            actions.push({ label: "设为聊天背景", run: function () { setBg("chatBg", src); } });
            actions.push({ label: "设为主界面背景", run: function () { setBg("homeBg", src); } });
        } else {
            actions.push({ label: "设为他的头像", run: function () { setAvatar("ta", src); } });
            actions.push({ label: "设为聊天背景", run: function () { setBg("chatBg", src); } });
            actions.push({ label: "设为主界面背景", run: function () { setBg("homeBg", src); } });
        }
        actions.push({ label: "删除这张", danger: true, run: function () { removePhoto(idx); } });

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

    function refreshAfterChange() {
        if (window.philosRefreshChat) window.philosRefreshChat();
        setTimeout(function () { location.reload(); }, 700);
    }

    function setAvatar(who, src) {
        var d = mainData();
        if (who === "me") d.myAvatar = src;
        else d.taAvatar = src;
        saveMain(d);
        refreshAfterChange();
    }

    function setBg(which, src) {
        var d = mainData();
        if (!d.settings) d.settings = {};
        if (!d.settings.appearance) d.settings.appearance = {};
        if (!d.settings.appearance[which]) d.settings.appearance[which] = { color: "#e9edf2", image: "", opacity: 100, blur: 20 };
        d.settings.appearance[which].image = src;
        saveMain(d);
        refreshAfterChange();
    }

    function removePhoto(idx) {
        var d = galData();
        var list = tab === "ta" ? d.ta : d.me;
        list.splice(idx, 1);
        saveGal(d);
        renderGrid();
    }

    /* ===== 他申请换头像 ===== */
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
        showAsk(pickRandom(d.ta), mainData().taName || "他");
    }

    function showAsk(src, name) {
        var old = $("galAsk");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var mask = document.createElement("div");
        mask.id = "galAsk";
        mask.className = "php-mask show";
        var card = document.createElement("div");
        card.className = "php-card";
        var av = document.createElement("div");
        av.className = "php-avatar";
        av.innerHTML = '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">';
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
        yes.addEventListener("click", function () {
            mask.classList.remove("show");
            setAvatar("ta", src);
        });
        actions.appendChild(no);
        actions.appendChild(yes);
        card.appendChild(av);
        card.appendChild(text);
        card.appendChild(actions);
        mask.appendChild(card);
        document.body.appendChild(mask);
    }

    /* ===== 他的「我想要」弹窗 + 存进 iMessage ===== */
    function pickEmoji() {
        var d = mainData();
        var list = (d.cards || []).filter(function (c) { return c && c.kind === "emoji" && c.content; });
        if (!list.length) return "";
        return list[Math.floor(Math.random() * list.length)].content;
    }

    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.lineTo(x + w - r, y);
        g.quadraticCurveTo(x + w, y, x + w, y + r);
        g.lineTo(x + w, y + h - r);
        g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        g.lineTo(x + r, y + h);
        g.quadraticCurveTo(x, y + h, x, y + h - r);
        g.lineTo(x, y + r);
        g.quadraticCurveTo(x, y, x + r, y);
        g.closePath();
    }

    function composeCard(imgSrc, caption, cb) {
        var img = new Image();
        img.onload = function () {
            var W = 640, H = Math.round(W * 4 / 3);
            var c = document.createElement("canvas");
            c.width = W; c.height = H;
            var g = c.getContext("2d");

            g.fillStyle = "#ffffff";
            roundRect(g, 0, 0, W, H, 34);
            g.fill();

            g.save();
            roundRect(g, 0, 0, W, H, 34);
            g.clip();
            var iw = img.width || 1, ih = img.height || 1;
            var scale = Math.max(W / iw, H / ih);
            var dw = iw * scale, dh = ih * scale;
            g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

            var capH = Math.round(H * 0.19);
            g.fillStyle = "rgba(255,255,255,0.62)";
            g.fillRect(0, H - capH, W, capH);
            g.fillStyle = "#1b1d21";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.font = "600 46px -apple-system, BlinkMacSystemFont, PingFang SC, sans-serif";
            g.fillText(caption, W / 2, H - capH / 2 + 4, W - 60);
            g.restore();

            var out = "";
            try { out = c.toDataURL("image/webp", 0.86); } catch (e) {}
            if (!out || out.indexOf("data:image/") !== 0) out = c.toDataURL("image/png");
            cb(out);
        };
        img.onerror = function () { cb(""); };
        img.src = imgSrc;
    }

    function pushCardToChat(cardSrc) {
        if (!cardSrc) return;
        if (window.philosPushMessage) {
            window.philosPushMessage({ from: "ta", type: "sticker", text: cardSrc, status: "" });
            return;
        }
        var d = mainData();
        d.chatHistory = Array.isArray(d.chatHistory) ? d.chatHistory : [];
        d.chatHistory.push({ from: "ta", type: "sticker", text: cardSrc, time: Date.now(), status: "" });
        saveMain(d);
        if (window.philosRefreshChat) window.philosRefreshChat();
    }

    function showWant(src, caption) {
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
        img.src = src;
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
            composeCard(src, caption, function (out) { pushCardToChat(out); });
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
        showWant(pickRandom(d.ta), "我想要" + (emoji ? emoji : ""));
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
            '<input type="file" id="galFile" accept="image/*" hidden>' +
            '<div class="gal-sheet-mask" id="galMask"></div>' +
            '<div class="gal-sheet" id="galSheet"><div id="galSheetBody"></div></div>';
        document.body.appendChild(view);

        gridEl = $("galGrid");
        sheetEl = $("galSheet");

        $("galBack").addEventListener("click", function () { view.classList.remove("show"); });
        $("galAdd").addEventListener("click", function () { var f = $("galFile"); if (f) f.click(); });
        $("galMask").addEventListener("click", closeSheet);
        $("galFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0];
            var input = e.target;
            if (f) {
                compressImage(f, function (src) {
                    if (!src) return;
                    var d = galData();
                    if (tab === "ta") d.ta.unshift(src);
                    else d.me.unshift(src);
                    saveGal(d);
                    renderGrid();
                });
            }
            input.value = "";
        });

        view.addEventListener("click", function (e) {
            var btn = e.target.closest ? e.target.closest("[data-galtab]") : null;
            if (!btn) return;
            tab = btn.getAttribute("data-galtab");
            renderTabs();
            renderGrid();
        });
    }

    function open() {
        build();
        renderTabs();
        renderGrid();
        view.classList.add("show");
        setTimeout(maybeWantPopup, 800);
        setTimeout(maybeAskAvatar, 2600);
    }

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
