/* H25 */
(function () {
    "use strict";

    var KEY = "philos_hero_text";
    var HERO_AV = "philos_hero_avatar";
    var WX_KEY = "philos_wechat";
    var MAIN_KEY = "private_chat_app_v1";
    var wx = null, wxTyping = false, wxPanelOpen = "";

    var FACES = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕"];

    function load() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
    function save(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
    function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
    function defaultColor() { return isDark() ? "#f4f5f7" : "#1b1d21"; }

    function applyHeroColor() {
        var big = document.getElementById("widgetLarge"); if (!big) return;
        var color = load();
        big.classList.toggle("hero-text-custom", !!color);
        if (color) big.style.setProperty("--hero-text", color); else big.style.removeProperty("--hero-text");
    }

    function applyHeroAvatar() {
        var box = document.getElementById("widgetAvatar"); if (!box) return;
        var src = "";
        try { src = localStorage.getItem(HERO_AV) || ""; } catch (e) {}
        if (src && /^(data:image\/|https?:\/\/)/.test(src)) {
            var img = box.querySelector("img");
            if (!img || img.getAttribute("src") !== src) box.innerHTML = '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">';
        }
    }

    function fixAvatarLabels() {
        ["headerAvatar", "callAvatar", "peekAvatar"].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var t = el.querySelector(".avatar-text");
            if (t && t.textContent === "Me") t.textContent = "Ta";
        });
    }

    function buildHeroAvatarRow() {
        var sheet = document.getElementById("editSheet");
        if (!sheet || sheet.querySelector("[data-hero-av-row]")) return;
        var fields = sheet.querySelector(".sheet-fields"); if (!fields) return;
        var row = document.createElement("div");
        row.className = "sheet-field"; row.setAttribute("data-hero-av-row", "");
        row.innerHTML = '<span>大组件头像</span><div class="row-actions"><label class="text-btn">上传<input type="file" accept="image/*" data-hero-av-file hidden></label><button class="clear-text" type="button" data-hero-av-clear>清除</button></div>';
        fields.appendChild(row);
        row.querySelector("[data-hero-av-file]").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0]; if (!f) return;
            var r = new FileReader();
            r.onload = function () { try { localStorage.setItem(HERO_AV, r.result); } catch (err) {} applyHeroAvatar(); };
            r.readAsDataURL(f); e.target.value = "";
        });
        row.querySelector("[data-hero-av-clear]").addEventListener("click", function () {
            try { localStorage.removeItem(HERO_AV); } catch (e) {}
            var box = document.getElementById("widgetAvatar"); if (box) box.innerHTML = "Me";
        });
    }

    function injectStyles() {
        if (document.getElementById("philos-home-style")) return;
        var st = document.createElement("style");
        st.id = "philos-home-style";
        st.textContent =
            ".desktop-content{overflow:hidden !important;}" +
            "#btnChatCall{display:none !important;}" +
            "#homePager{display:flex !important;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;width:100%;}" +
            "#homePager::-webkit-scrollbar{display:none;}" +
            "#homePager > .home-page{flex:0 0 100%;width:100%;scroll-snap-align:start;display:flex;flex-direction:column;gap:20px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:4px;}" +
            "#homePager .home-app-grid{display:grid !important;grid-template-columns:repeat(4,1fr) !important;column-gap:15px !important;width:100%;grid-auto-rows:75px !important;align-content:start;}" +
            ".dock{grid-template-columns:repeat(3,1fr) !important;}" +
            "#editSheet{left:50% !important;right:auto !important;top:50% !important;bottom:auto !important;width:86% !important;max-width:340px !important;border-radius:22px !important;transform:translate(-50%,-50%) scale(.94) !important;opacity:0;}" +
            "#editSheet.show{transform:translate(-50%,-50%) scale(1) !important;opacity:1;}" +
            ".freq-view{position:fixed;inset:0;z-index:470;display:none;flex-direction:column;background:#EEEEEE;}" +
            ".freq-view.show{display:flex;}" +
            ".freq-header{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 16px 8px;}" +
            ".freq-title{font-size:20px;font-weight:600;color:var(--text-primary,#1b1d21);}" +
            ".freq-body{flex:1;min-height:0;overflow-y:auto;padding:8px 16px calc(env(safe-area-inset-bottom) + 24px);}" +
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
            ".wx-avatar{width:40px;height:40px;border-radius:4px;overflow:hidden;flex:0 0 auto;background:#DEDEDE;display:flex;align-items:center;justify-content:center;color:#8A8A8A;font-size:13px;}" +
            ".wx-avatar img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".wx-bubble{position:relative;max-width:72%;padding:9px 13px;border-radius:4px;background:#FFFFFF;color:#1a1a1a;line-height:1.5;font-size:15px;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.08);}" +
            ".wx-bubble::before{content:\"\";position:absolute;top:14px;left:-5px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:6px solid #FFFFFF;}" +
            ".wx-row.mine .wx-bubble{background:#95EC69;}" +
            ".wx-row.mine .wx-bubble::before{left:auto;right:-5px;border-right:none;border-left:6px solid #95EC69;}" +
            ".wx-quote{font-size:12px;line-height:1.4;color:#8A8A8A;background:rgba(0,0,0,.05);border-radius:4px;padding:4px 6px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-menubar{position:fixed;z-index:600;display:flex;gap:2px;padding:4px;border-radius:10px;background:rgba(28,28,30,.95);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 8px 24px rgba(0,0,0,.3);}" +
            ".wx-menubar button{height:34px;padding:0 12px;border:none;background:none;color:#fff;font-size:14px;border-radius:7px;}" +
            ".wx-menubar button.danger{color:#FF453A;}" +
            ".wx-quotebar{display:flex;align-items:center;gap:8px;margin:0 8px 6px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.06);font-size:12px;color:#666;}" +
            ".wx-quotebar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-quotebar button{border:none;background:none;color:#999;font-size:14px;}" +
            ".wx-sticker{max-width:120px;border-radius:6px;display:block;}" +
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
            ".wx-stk{aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:#fff;border:none;padding:0;}" +
            ".wx-stk img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".wx-stk.add{border:1px dashed #BBB;color:#888;font-size:24px;}" +
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
            ".wx-mini.danger{color:#FF3B30;border-color:#FFD6D2;}";
        document.head.appendChild(st);
    }

    function makeApp(id, label, symbol) {
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "app-icon"; btn.id = id;
        btn.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + symbol + '"></use></svg></span><span class="app-label">' + label + '</span>';
        return btn;
    }
    function bindOnce(btn, handler) {
        if (!btn || btn.getAttribute("data-hbind")) return;
        btn.setAttribute("data-hbind", "1"); btn.addEventListener("click", handler);
    }

    function fillSmallWidget() {
        var el = document.getElementById("widgetSmallArea");
        if (!el || (el.textContent || "").trim()) return;
        try {
            var data = JSON.parse(localStorage.getItem(MAIN_KEY) || "{}");
            if ((data.widgetConfig || {}).template) return;
            var item = null;
            (data.anniversaries || []).forEach(function (a) { if (a.id === data.activeCountdownId) item = a; });
            if (!item) { el.innerHTML = '<span class="ws-placeholder">Select Widget</span>'; return; }
            var d = new Date(item.date + "T00:00:00"), now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var days = Math.floor((today - d) / 86400000);
            var label = days >= 0 ? "第 " + (days + 1) + " 天" : "还有 " + (-days) + " 天";
            el.innerHTML = '<div class="ws-widget"><div class="ws-widget-title">' + item.title + '</div><div class="ws-widget-days">' + label + '</div></div>';
        } catch (e) {}
    }

    function cleanStrays(content, pager) {
        var kids = Array.prototype.slice.call(content.children);
        for (var i = 0; i < kids.length; i++) {
            var el = kids[i];
            if (el === pager) continue;
            if (el.classList && (el.classList.contains("icon-grid") || el.classList.contains("home-app-grid") || el.classList.contains("home-page"))) content.removeChild(el);
        }
    }

    function syncIconSizes() {
        var ref = document.querySelector("#homePager .app-grid-small .app-icon-box"); if (!ref) return;
        var w = Math.round(ref.getBoundingClientRect().width); if (!w || w < 20) return;
        var boxes = document.querySelectorAll("#homePager .home-app-grid .app-icon-box");
        for (var i = 0; i < boxes.length; i++) { boxes[i].style.width = w + "px"; boxes[i].style.height = w + "px"; boxes[i].style.aspectRatio = "1 / 1"; boxes[i].style.maxWidth = "none"; }
    }

    function applyRowGap() {
        var grid = document.querySelector("#homePager .home-app-grid"); if (!grid) return;
        var box = grid.querySelector(".app-icon-box"); if (!box) return;
        var w = box.getBoundingClientRect().width, rh = box.parentNode.getBoundingClientRect().height, W = grid.clientWidth;
        if (!w || !rh || !W) return;
        var hGap = ((W - 45) / 4 - w) + 15;
        var labelH = Math.max(0, rh - w);
        var rowGap = Math.round(hGap) + Math.round(labelH);
        if (rowGap < 10) rowGap = 10;
        if (rowGap > 44) rowGap = 44;
        grid.style.setProperty("row-gap", rowGap + "px", "important");
    }

    function applyShift() {
        var small = document.getElementById("widgetSmallArea"); if (!small) return;
        var h = small.getBoundingClientRect().height; if (!h || h < 40) return;
        var pad = Math.round(h / 4);
        var pages = document.querySelectorAll("#homePager > .home-page");
        for (var i = 0; i < pages.length; i++) pages[i].style.paddingTop = pad + "px";
    }

    function buildFreqView() {
        if (document.getElementById("freqView")) return;
        var v = document.createElement("div");
        v.className = "freq-view"; v.id = "freqView";
        v.innerHTML = '<div class="freq-header"><button class="nav-back" id="freqBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><span class="freq-title">频率</span></div><div class="freq-body" id="freqBody"></div>';
        document.body.appendChild(v);
        document.getElementById("freqBack").addEventListener("click", function () { v.classList.remove("show"); });
    }

    function openFreq() {
        buildFreqView();
        var v = document.getElementById("freqView"), body = document.getElementById("freqBody");
        var page = document.querySelector('[data-page="permission"]');
        if (!v || !body || !page) return;
        var keys = ["permission.replyDelay", "permission.replyMin", "permission.activeMin", "permission.callMin"];
        for (var i = 0; i < keys.length; i++) {
            var el = page.querySelector('[data-key="' + keys[i] + '"]'); if (!el) continue;
            var card = el.closest(".group-card"); if (card && card.parentNode !== body) body.appendChild(card);
        }
        var extra = page.querySelector("[data-rm-combo]");
        if (extra) { var c2 = extra.closest(".group-card"); if (c2 && c2.parentNode !== body) body.appendChild(c2); }
        v.classList.add("show");
    }

    /* 微信 */
    function wxData() {
        if (wx) return wx;
        try { wx = JSON.parse(localStorage.getItem(WX_KEY) || "null"); } catch (e) { wx = null; }
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
    function wxSave() { try { localStorage.setItem(WX_KEY, JSON.stringify(wxData())); } catch (e) { alert("微信数据空间已满。"); } }
    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function wxAvatar(src, fallback) {
        var s = document.createElement("span"); s.className = "wx-avatar";
        if (src && /^(data:image\/|https?:\/\/)/.test(src)) { var i = document.createElement("img"); i.src = src; s.appendChild(i); }
        else s.textContent = fallback || "";
        return s;
    }

    function wxLocCard(distance) {
        var w = document.createElement("div"); w.className = "wx-loc";
        var t = document.createElement("div"); t.className = "wx-loc-top";
        t.textContent = distance > 100 ? "不在你周围" : ("距离你 " + distance + " 米");
        var m = document.createElement("div"); m.className = "wx-loc-map";
        m.innerHTML = '<svg viewBox="0 0 210 80" preserveAspectRatio="none"><rect width="210" height="80" fill="#E9F1EA"/><path d="M-10 26 H220" stroke="#FFFFFF" stroke-width="9"/><path d="M-10 58 H220" stroke="#FFFFFF" stroke-width="7"/><path d="M52 -10 V90" stroke="#FFFFFF" stroke-width="8"/><path d="M150 -10 V90" stroke="#FFFFFF" stroke-width="6"/><circle cx="105" cy="42" r="11" fill="#07C160" opacity=".16"/><circle cx="105" cy="42" r="5" fill="#07C160"/></svg>';
        w.appendChild(t); w.appendChild(m); return w;
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
        var box = document.getElementById("wxMessages"), title = document.getElementById("wxTitle"), view = document.getElementById("wechatView");
        if (!box || !view) return;
        var d = wxData(), main = mainData();
        if (title) title.textContent = wxTyping ? "对方正在输入…" : (d.name || "Ta");
        view.style.background = d.bgImage ? 'url("' + d.bgImage + '") center/cover no-repeat' : (d.bg || "#F7F7F7");
        box.innerHTML = ""; var last = 0;
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
            if (m.type === "image") { var im = document.createElement("img"); im.className = "wx-sticker"; im.src = m.text || ""; row.appendChild(im); }
            else if (m.type === "location") row.appendChild(wxLocCard(Number(m.distance) || 0));
            else {
                var b = document.createElement("div"); b.className = "wx-bubble";
                if (m.quote) { var q = document.createElement("div"); q.className = "wx-quote"; q.textContent = m.quote; b.appendChild(q); }
                var sp = document.createElement("span"); sp.textContent = m.text || ""; b.appendChild(sp);
                row.appendChild(b);
            }
            box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
    }

    function wxPush(msg) { var d = wxData(); msg.time = Date.now(); d.history.push(msg); wxSave(); wxRender(); }

    function wxScheduleReply() {
        var main = mainData(), perm = (main.settings && main.settings.permission) || {};
        var pool = (main.cards || []).filter(function (c) { return (c.kind === "text" || c.kind === "emoji") && c.content; });
        if (!pool.length) return;
        var min = Math.max(1, Math.min(10, Number(perm.replyMin) || 1));
        var max = Math.max(min, Math.min(10, Number(perm.replyMax) || min));
        var count = min + Math.floor(Math.random() * (max - min + 1));
        var delay = Math.max(0, perm.replyDelay == null ? 3 : Number(perm.replyDelay)) * 1000;
        wxSetTyping(true);
        setTimeout(function () {
            var d = wxData(), now = Date.now();
            var mine = [];
            d.history.forEach(function (mm) { if (mm && mm.from === "me" && mm.type === "text" && mm.text) mine.push(mm.text); });
            var quoteText = null;
            if (mine.length && Math.random() < 0.15) quoteText = mine[Math.floor(Math.random() * mine.length)];
            var first = "";
            for (var i = 0; i < count; i++) {
                var content = pool[Math.floor(Math.random() * pool.length)].content;
                if (!first) first = content;
                d.history.push({ from: "ta", type: "text", text: content, time: now + i, quote: i === 0 && quoteText ? quoteText : "" });
            }
            if (Math.random() < 0.12) d.history.push({ from: "ta", type: "location", distance: 1 + Math.floor(Math.random() * 110), time: now + count });
            wxSave(); wxSetTyping(false);
            var v = document.getElementById("wechatView");
            if (v && v.classList.contains("show")) wxRender();
            else if (first) wxNotify(first);
        }, delay);
    }

    function wxSetTyping(on) {
        wxTyping = !!on;
        var t = document.getElementById("wxTitle");
        if (t) t.textContent = on ? "对方正在输入…" : (wxData().name || "Ta");
    }

    var wxQuoteText = null;

    function setWxQuote(text) {
        wxQuoteText = text || null;
        var bar = document.getElementById("wxQuoteBar");
        if (!bar) return;
        if (wxQuoteText) { bar.style.display = "flex"; bar.querySelector("span").textContent = wxQuoteText; }
        else bar.style.display = "none";
    }

    function wxSend() {
        var input = document.getElementById("wxInput"); if (!input) return;
        var text = input.value.trim(); if (!text) return;
        var msg = { from: "me", type: "text", text: text };
        if (wxQuoteText) msg.quote = wxQuoteText;
        input.value = ""; wxToggleSend(); setWxQuote(null);
        wxPush(msg); wxScheduleReply();
    }

    function wxToggleSend() {
        var input = document.getElementById("wxInput"), send = document.getElementById("wxSend");
        if (input && send) send.style.display = input.value.trim() ? "block" : "none";
    }

    function compressImage(file, cb) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
            var max = 260, sc = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
            var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
            var out = ""; try { out = c.toDataURL("image/webp", 0.7); } catch (e) {}
            if (!out || out.indexOf("data:image/") !== 0) out = c.toDataURL("image/png");
            URL.revokeObjectURL(url); cb(out);
        };
        img.onerror = function () { URL.revokeObjectURL(url); cb(""); };
        img.src = url;
    }

    function togglePanel(name) {
        var panels = document.querySelectorAll(".wx-panel"), target = document.getElementById("wxPanel-" + name);
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
        var b = document.querySelectorAll("[data-wxtab]");
        for (var i = 0; i < b.length; i++) b[i].classList.toggle("active", b[i].getAttribute("data-wxtab") === tab);
    }

    function renderEmojiPanel() {
        var grid = document.getElementById("wxEmojiGrid"); if (!grid) return;
        var d = wxData(); grid.innerHTML = "";
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
        (d.stickers || []).forEach(function (src) {
            var b = document.createElement("button"); b.type = "button"; b.className = "wx-stk";
            var im = document.createElement("img"); im.src = src; b.appendChild(im);
            b.addEventListener("click", function () { wxPush({ from: "me", type: "image", text: src }); wxScheduleReply(); });
            grid.appendChild(b);
        });
        var add = document.createElement("button"); add.type = "button"; add.className = "wx-stk add"; add.textContent = "+";
        add.addEventListener("click", function () { var f = document.getElementById("wxStkFile"); if (f) f.click(); });
        grid.appendChild(add);
    }

    function openWxMenu(row, x, y) {
        var menu = document.getElementById("wxMenuBar");
        if (!menu) {
            menu = document.createElement("div"); menu.className = "wx-menubar"; menu.id = "wxMenuBar";
            menu.innerHTML = '<button type="button" data-wxact="quote">引用</button><button type="button" class="danger" data-wxact="del">删除</button>';
            document.body.appendChild(menu);
        }
        menu.style.display = "flex";
        menu.style.visibility = "hidden";
        menu.style.left = "0px"; menu.style.top = "0px";
        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        menu.style.left = Math.max(8, Math.min(x - mw / 2, window.innerWidth - mw - 8)) + "px";
        menu.style.top = Math.max(8, y - mh - 10) + "px";
        menu.style.visibility = "";
        menu.setAttribute("data-wi", row.getAttribute("data-wi"));
    }

    function hideWxMenu() { var m = document.getElementById("wxMenuBar"); if (m) m.style.display = "none"; }

    function wxBuild() {
        if (document.getElementById("wechatView")) return;
        var v = document.createElement("div"); v.className = "wx-view"; v.id = "wechatView";
        v.innerHTML =
            '<header class="wx-header"><button class="wx-head-btn" id="wxBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><div class="wx-title" id="wxTitle">Ta</div><button class="wx-head-btn" id="wxMore" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-more"></use></svg></button></header>' +
            '<div class="wx-messages" id="wxMessages"></div>' +
            '<div class="wx-panel" id="wxPanel-face"><div class="wx-panel-tabs"><button class="wx-ptab active" data-wxtab="emoji" type="button">小黄脸</button><button class="wx-ptab" data-wxtab="stk" type="button">表情包</button></div><div class="wx-emoji-grid" id="wxEmojiGrid"></div><div class="wx-stk-grid" id="wxStkGrid" style="display:none"></div></div>' +
            '<div class="wx-panel" id="wxPanel-plus"><div class="wx-plus-grid"><button class="wx-plus-item" id="wxPickPhoto" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-image"></use></svg></span><span>照片</span></button><button class="wx-plus-item" id="wxPickLoc" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-pin"></use></svg></span><span>位置</span></button><button class="wx-plus-item" id="wxPickFile" type="button"><span class="wx-plus-icon"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-card"></use></svg></span><span>文件</span></button></div></div>' +
            '<div class="wx-quotebar" id="wxQuoteBar" style="display:none;"><span></span><button type="button" id="wxQuoteClose">✕</button></div>' +
            '<div class="wx-inputbar"><button class="wx-ibar-btn" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none"/></svg></button><div class="wx-inputwrap"><input id="wxInput" type="text" placeholder="可按住 转文字"></div><button class="wx-send" id="wxSend" type="button" style="display:none">发送</button><button class="wx-ibar-btn" id="wxBtnFace" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M8.5 14.2c1 1.4 6 1.4 7 0" fill="none"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/></svg></button><button class="wx-ibar-btn" id="wxBtnPlus" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M12 8.2v7.6M8.2 12h7.6" fill="none"/></svg></button></div>' +
            '<input type="file" id="wxPhotoFile" accept="image/*" hidden><input type="file" id="wxStkFile" accept="image/*" hidden>' +
            '<div class="wx-sheet-mask" id="wxSheetMask"></div>' +
            '<div class="wx-sheet" id="wxSheet"><h3>聊天设置</h3><div class="wx-field"><span>备注</span><input type="text" id="wxName" maxlength="16"></div><div class="wx-field"><span>他的头像</span><label class="wx-mini">上传<input type="file" id="wxFileTa" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearTa" type="button">清除</button></div><div class="wx-field"><span>我的头像</span><label class="wx-mini">上传<input type="file" id="wxFileMe" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearMe" type="button">清除</button></div><div class="wx-field"><span>背景颜色</span><input type="color" id="wxBg" style="width:48px;height:32px;border:none;background:none;"></div><div class="wx-field"><span>背景图</span><label class="wx-mini">上传<input type="file" id="wxFileBg" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearBg" type="button">清除</button></div><button class="wide-btn" id="wxSaveBtn" type="button" style="margin-top:8px;">保存并关闭</button></div>';
        document.body.appendChild(v);

        document.getElementById("wxBack").addEventListener("click", function () { v.classList.remove("show"); });
        document.getElementById("wxMore").addEventListener("click", function () {
            var d = wxData(); document.getElementById("wxName").value = d.name || ""; document.getElementById("wxBg").value = d.bg || "#F7F7F7"; openSheet(true);
        });
        document.getElementById("wxSheetMask").addEventListener("click", function () { openSheet(false); });
        document.getElementById("wxSaveBtn").addEventListener("click", function () {
            var d = wxData(), n = document.getElementById("wxName").value.trim();
            d.name = n || "Ta"; d.bg = document.getElementById("wxBg").value || "#F7F7F7";
            wxSave(); openSheet(false); wxRender();
        });
        document.getElementById("wxFileTa").addEventListener("change", function (e) { readFile(e.target, function (s) { wxData().avatar = s; wxSave(); wxRender(); }); });
        document.getElementById("wxFileMe").addEventListener("change", function (e) { readFile(e.target, function (s) { wxData().myAvatar = s; wxSave(); wxRender(); }); });
        document.getElementById("wxFileBg").addEventListener("change", function (e) { readFile(e.target, function (s) { wxData().bgImage = s; wxSave(); wxRender(); }); });
        document.getElementById("wxClearTa").addEventListener("click", function () { wxData().avatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearMe").addEventListener("click", function () { wxData().myAvatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearBg").addEventListener("click", function () { wxData().bgImage = ""; wxSave(); wxRender(); });

        var input = document.getElementById("wxInput");
        input.addEventListener("input", wxToggleSend);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); wxSend(); } });
        document.getElementById("wxSend").addEventListener("click", wxSend);
        document.getElementById("wxBtnFace").addEventListener("click", function () { switchFaceTab("emoji"); togglePanel("face"); });
        document.getElementById("wxBtnPlus").addEventListener("click", function () { togglePanel("plus"); });
        document.getElementById("wxQuoteClose").addEventListener("click", function () { setWxQuote(null); });
        var tabs = document.querySelectorAll("[data-wxtab]");
        for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener("click", function () { switchFaceTab(this.getAttribute("data-wxtab")); });

        document.getElementById("wxMessages").addEventListener("click", function (e) {
            var row = e.target.closest ? e.target.closest(".wx-row") : null;
            if (!row) { hideWxMenu(); return; }
            var r = row.getBoundingClientRect();
            openWxMenu(row, r.left + r.width / 2, r.top);
        });
        document.addEventListener("click", function (e) {
            var menu = document.getElementById("wxMenuBar");
            if (!menu || menu.style.display === "none") return;
            var act = e.target.getAttribute ? e.target.getAttribute("data-wxact") : null;
            if (act) {
                var idx = Number(menu.getAttribute("data-wi"));
                var d = wxData();
                if (act === "del") { d.history.splice(idx, 1); wxSave(); wxRender(); }
                else if (act === "quote") { var mm = d.history[idx]; if (mm) setWxQuote(mm.text || ""); }
                hideWxMenu();
                return;
            }
            if (!e.target.closest(".wx-menubar")) hideWxMenu();
        });

        document.getElementById("wxPickLoc").addEventListener("click", function () {
            wxPush({ from: "me", type: "location", distance: 1 + Math.floor(Math.random() * 110) });
            wxScheduleReply(); togglePanel("plus");
        });
        document.getElementById("wxPickPhoto").addEventListener("click", function () { document.getElementById("wxPhotoFile").click(); });
        document.getElementById("wxPhotoFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0]; if (!f) return;
            compressImage(f, function (s) { if (s) { wxPush({ from: "me", type: "image", text: s }); wxScheduleReply(); } });
            e.target.value = ""; togglePanel("plus");
        });
        document.getElementById("wxStkFile").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0]; if (!f) return;
            compressImage(f, function (s) { if (s) { wxData().stickers.push(s); wxSave(); renderStickerPanel(); } });
            e.target.value = "";
        });
        renderEmojiPanel(); renderStickerPanel();
    }

    function openSheet(show) {
        var m = document.getElementById("wxSheetMask"), s = document.getElementById("wxSheet");
        if (!m || !s) return;
        m.classList.toggle("show", !!show); s.classList.toggle("show", !!show);
    }
    function readFile(input, cb) {
        var f = input.files && input.files[0]; if (!f) return;
        var r = new FileReader(); r.onload = function () { cb(r.result); }; r.readAsDataURL(f); input.value = "";
    }
    function wxOpen() {
        wxBuild();
        var v = document.getElementById("wechatView"); if (!v) return;
        wxRender(); renderEmojiPanel(); renderStickerPanel(); v.classList.add("show");
        setTimeout(function () { var b = document.getElementById("wxMessages"); if (b) b.scrollTop = b.scrollHeight; }, 60);
    }

    function takeover() {
        var content = document.querySelector(".desktop-content"); if (!content) return;
        var dock = content.querySelector(".dock"), widget = document.getElementById("widgetLarge");
        if (!dock || !widget) return;
        var old = content.querySelector(".home-pager");
        if (old && old.getAttribute("data-owner") === "hero") {
            cleanStrays(content, old); fillSmallWidget(); syncIconSizes(); applyRowGap(); applyShift(); applyHeroAvatar(); fixAvatarLabels(); return;
        }
        var chat = document.getElementById("appChat"), settings = document.getElementById("appSettings");
        var letter = document.getElementById("appLetter"), countdown = document.getElementById("appCountdown"), widgets = document.getElementById("appWidgets");
        if (chat && !chat.querySelector(".app-label")) {
            chat.className = "app-icon";
            chat.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-chat"></use></svg></span><span class="app-label">iMessage</span>';
        }
        var small = document.getElementById("widgetSmallArea");
        if (!small) { small = document.createElement("div"); small.className = "widget-small"; small.id = "widgetSmallArea"; small.setAttribute("role", "button"); small.setAttribute("tabindex", "0"); }
        if (old) { content.insertBefore(widget, old); if (old.parentNode) old.parentNode.removeChild(old); }
        var pager = document.createElement("div"); pager.className = "home-pager"; pager.id = "homePager"; pager.setAttribute("data-owner", "hero");
        var page1 = document.createElement("section"); page1.className = "home-page";
        var page2 = document.createElement("section"); page2.className = "home-page";
        var iconGrid = document.createElement("div"); iconGrid.className = "icon-grid";
        var appGrid = document.createElement("div"); appGrid.className = "app-grid-small";
        var phone = document.getElementById("btnPhone") || makeApp("btnPhone", "电话", "ic-phone");
        var wechat = document.getElementById("btnWechat") || makeApp("btnWechat", "微信", "ic-chat");
        appGrid.appendChild(phone); if (chat) appGrid.appendChild(chat); appGrid.appendChild(wechat); if (settings) appGrid.appendChild(settings);
        iconGrid.appendChild(small); iconGrid.appendChild(appGrid);
        page1.appendChild(widget); page1.appendChild(iconGrid);
        var grid2 = document.createElement("div"); grid2.className = "home-app-grid";
        grid2.style.display = "grid"; grid2.style.gridTemplateColumns = "repeat(4, 1fr)"; grid2.style.columnGap = "15px"; grid2.style.gridAutoRows = "75px";
        var gallery = document.getElementById("btnGallery") || makeApp("btnGallery", "图库", "ic-image");
        var quiz = document.getElementById("btnQuiz") || makeApp("btnQuiz", "出题", "ic-card");
        var freq = document.getElementById("btnFreq") || makeApp("btnFreq", "频率", "ic-calendar");
        if (widgets) grid2.appendChild(widgets); if (letter) grid2.appendChild(letter); if (countdown) grid2.appendChild(countdown);
        grid2.appendChild(gallery); grid2.appendChild(quiz); grid2.appendChild(freq);
        page2.appendChild(grid2);
        pager.appendChild(page1); pager.appendChild(page2); content.insertBefore(pager, dock);
        cleanStrays(content, pager);
        bindOnce(phone, function () { var c = document.getElementById("appChat"); if (c) c.click(); setTimeout(function () { var call = document.getElementById("btnChatCall"); if (call) call.click(); }, 160); });
        bindOnce(wechat, function () { wxOpen(); });
        bindOnce(gallery, function () { alert("图库还没做。"); });
        bindOnce(quiz, function () { alert("出题还没做。"); });
        bindOnce(freq, function () { openFreq(); });
        fillSmallWidget(); syncIconSizes(); applyRowGap(); applyShift(); applyHeroAvatar(); buildHeroAvatarRow(); fixAvatarLabels();
        setTimeout(function () { syncIconSizes(); applyRowGap(); applyShift(); }, 300);
        setTimeout(function () { syncIconSizes(); applyRowGap(); applyShift(); }, 900);
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]'); if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H25";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles(); buildRow(); applyHeroColor(); applyHeroAvatar(); buildHeroAvatarRow(); takeover(); markVersion(); fixAvatarLabels();
        setTimeout(takeover, 600); setTimeout(takeover, 1800); setTimeout(takeover, 3000);
        setTimeout(fixAvatarLabels, 800); setTimeout(fixAvatarLabels, 2000);
        if (window.MutationObserver) {
            var box = document.getElementById("widgetAvatar");
            if (box) new MutationObserver(function () { applyHeroAvatar(); }).observe(box, { childList: true, subtree: true });
            var hd = document.getElementById("chatHeader");
            if (hd) new MutationObserver(function () { fixAvatarLabels(); }).observe(hd, { childList: true, subtree: true });
            var cs = document.getElementById("callScreen");
            if (cs) new MutationObserver(function () { fixAvatarLabels(); }).observe(cs, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
