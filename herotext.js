/* =========================================================
   大组件文字颜色 + 主屏分页 + 微信聊天（H13）
   ========================================================= */
(function () {
    "use strict";

    var KEY = "philos_hero_text";
    var PRESETS = ["#1b1d21", "#ffffff", "#5b7fa6", "#8b909a", "#c9d3de"];
    var WX_KEY = "philos_wechat";
    var MAIN_KEY = "private_chat_app_v1";
    var wx = null;

    function load() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
    function save(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
    function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
    function defaultColor() { return isDark() ? "#f4f5f7" : "#1b1d21"; }

    function apply() {
        var big = document.getElementById("widgetLarge");
        if (!big) return;
        var color = load();
        big.classList.toggle("hero-text-custom", !!color);
        if (color) big.style.setProperty("--hero-text", color);
        else big.style.removeProperty("--hero-text");
    }

    function syncPresets(card, color) {
        if (!card) return;
        var btns = card.querySelectorAll("[data-hero-text-preset]");
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle("active", btns[i].getAttribute("data-hero-text-preset").toLowerCase() === String(color || "").toLowerCase());
        }
    }

    function buildRow() {
        var pane = document.querySelector('[data-wpane="hero"]');
        if (!pane || pane.querySelector("[data-hero-text-card]")) return;
        var anchor = pane.querySelector(".group-card");
        if (!anchor) return;

        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-hero-text-card", "");
        var swatches = PRESETS.map(function (color) {
            return '<button class="hero-swatch" type="button" data-hero-text-preset="' + color + '" style="background:' + color + '" aria-label="' + color + '"></button>';
        }).join("");

        card.innerHTML =
            '<div class="hero-group-title">文字颜色</div>' +
            '<div class="control-row"><span class="control-label">四行文字</span>' +
                '<div class="row-actions"><label class="color-dot"><input type="color" data-hero-text-color></label>' +
                '<button class="clear-text" type="button" data-hero-text-clear>恢复默认</button></div></div>' +
            '<div class="hero-color-presets">' + swatches + '</div>';

        anchor.parentNode.insertBefore(card, anchor.nextSibling);

        var input = card.querySelector("[data-hero-text-color]");
        var current = load();
        input.value = current || defaultColor();
        syncPresets(card, current);

        input.addEventListener("input", function () { save(input.value); apply(); syncPresets(card, input.value); });
        card.addEventListener("click", function (e) {
            var target = e.target;
            if (!target || !target.closest) return;
            var preset = target.closest("[data-hero-text-preset]");
            if (preset) {
                input.value = preset.getAttribute("data-hero-text-preset");
                save(input.value); apply(); syncPresets(card, input.value);
                return;
            }
            if (target.closest("[data-hero-text-clear]")) {
                save(""); input.value = defaultColor(); apply(); syncPresets(card, "");
            }
        });
    }

    function injectStyles() {
        if (document.getElementById("philos-home-style")) return;
        var st = document.createElement("style");
        st.id = "philos-home-style";
        st.textContent =
            ".desktop-content{overflow:hidden !important;}" +
            "#homePager{display:flex !important;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;flex:1 1 auto;min-height:0;width:100%;}" +
            "#homePager::-webkit-scrollbar{display:none;}" +
            "#homePager > .home-page{flex:0 0 100%;width:100%;scroll-snap-align:start;display:flex;flex-direction:column;gap:20px;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:4px;}" +
            "#homePager .home-app-grid{display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:15px !important;width:100%;grid-auto-rows:75px !important;align-content:start;}" +
            ".dock{grid-template-columns:repeat(3,1fr) !important;}" +
            ".wx-view{position:fixed;inset:0;z-index:480;display:none;flex-direction:column;background:#F7F7F7;}" +
            ".wx-view.show{display:flex;}" +
            ".wx-header{flex:0 0 auto;display:flex;align-items:center;padding:calc(env(safe-area-inset-top) + 6px) 10px 8px;background:#EEEEEE;border-bottom:1px solid #E5E5E5;}" +
            ".wx-head-btn{width:38px;height:34px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:#1a1a1a;}" +
            ".wx-head-btn .svg-icon{width:20px;height:20px;}" +
            ".wx-title{flex:1;text-align:center;font-size:17px;font-weight:500;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
            ".wx-messages{flex:1;min-height:0;overflow-y:auto;padding:8px 0 12px;background-size:cover;background-position:center;}" +
            ".wx-time{width:fit-content;margin:8px auto;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.05);color:#B2B2B2;font-size:12px;}" +
            ".wx-row{display:flex;align-items:flex-start;gap:8px;padding:6px 12px;}" +
            ".wx-row.mine{flex-direction:row-reverse;}" +
            ".wx-avatar{width:40px;height:40px;border-radius:4px;overflow:hidden;flex:0 0 auto;background:#DEDEDE;display:flex;align-items:center;justify-content:center;color:#8A8A8A;font-size:13px;}" +
            ".wx-avatar img{width:100%;height:100%;object-fit:cover;display:block;}" +
            ".wx-bubble{position:relative;max-width:72%;padding:9px 13px;border-radius:4px;background:#FFFFFF;color:#1a1a1a;line-height:1.5;font-size:15px;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.08);}" +
            ".wx-bubble::before{content:\"\";position:absolute;top:14px;left:-5px;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:6px solid #FFFFFF;}" +
            ".wx-row.mine .wx-bubble{background:#95EC69;}" +
            ".wx-row.mine .wx-bubble::before{left:auto;right:-5px;border-right:none;border-left:6px solid #95EC69;}" +
            ".wx-sticker{max-width:120px;border-radius:6px;display:block;}" +
            ".wx-inputbar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 10px calc(env(safe-area-inset-bottom) + 8px);background:#FFFFFF;border-top:1px solid #E5E5E5;}" +
            ".wx-ibar-btn{width:34px;height:34px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:none;border:none;color:#3A3A3A;}" +
            ".wx-ibar-btn .svg-icon{width:22px;height:22px;}" +
            ".wx-inputwrap{flex:1;min-width:0;height:36px;border-radius:6px;background:#F7F7F7;display:flex;align-items:center;padding:0 10px;}" +
            ".wx-inputwrap input{width:100%;border:none;background:transparent;outline:none;font-size:15px;color:#1a1a1a;text-align:center;}" +
            ".wx-inputwrap input::placeholder{color:#B2B2B2;}" +
            ".wx-send{flex:0 0 auto;height:32px;padding:0 12px;border-radius:5px;background:#07C160;color:#fff;font-size:14px;border:none;}" +
            ".wx-sheet-mask{position:fixed;inset:0;z-index:520;background:rgba(0,0,0,.35);display:none;}" +
            ".wx-sheet-mask.show{display:block;}" +
            ".wx-sheet{position:fixed;left:0;right:0;bottom:0;z-index:521;background:#fff;border-radius:16px 16px 0 0;padding:16px 16px calc(env(safe-area-inset-bottom) + 16px);transform:translateY(100%);transition:transform .25s ease;}" +
            ".wx-sheet.show{transform:translateY(0);}" +
            ".wx-sheet h3{margin:0 0 12px;font-size:16px;text-align:center;color:#1a1a1a;}" +
            ".wx-field{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:14px;color:#333;}" +
            ".wx-field input[type=text]{flex:1;height:36px;border:1px solid #E5E5E5;border-radius:8px;padding:0 10px;font-size:15px;}" +
            ".wx-mini{height:32px;padding:0 10px;border-radius:8px;border:1px solid #E5E5E5;background:#fff;font-size:13px;color:#333;}" +
            ".wx-mini.danger{color:#FF3B30;border-color:#FFD6D2;}";
        document.head.appendChild(st);
    }

    function makeApp(id, label, symbol) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "app-icon";
        btn.id = id;
        btn.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#' + symbol + '"></use></svg></span><span class="app-label">' + label + '</span>';
        return btn;
    }

    function bindOnce(btn, handler) {
        if (!btn || btn.getAttribute("data-hbind")) return;
        btn.setAttribute("data-hbind", "1");
        btn.addEventListener("click", handler);
    }

    function fillSmallWidget() {
        var el = document.getElementById("widgetSmallArea");
        if (!el || (el.textContent || "").trim()) return;
        try {
            var data = JSON.parse(localStorage.getItem(MAIN_KEY) || "{}");
            var cfg = data.widgetConfig || {};
            if (cfg.template) return;
            var item = null;
            var list = data.anniversaries || [];
            for (var i = 0; i < list.length; i++) { if (list[i].id === data.activeCountdownId) { item = list[i]; break; } }
            if (!item) { el.innerHTML = '<span class="ws-placeholder">Select Widget</span>'; return; }
            var d = new Date(item.date + "T00:00:00");
            var now = new Date();
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
        var ref = document.querySelector("#homePager .app-grid-small .app-icon-box");
        if (!ref) return;
        var w = Math.round(ref.getBoundingClientRect().width);
        if (!w || w < 20) return;
        var boxes = document.querySelectorAll("#homePager .home-app-grid .app-icon-box");
        for (var i = 0; i < boxes.length; i++) {
            boxes[i].style.width = w + "px";
            boxes[i].style.height = w + "px";
            boxes[i].style.aspectRatio = "1 / 1";
            boxes[i].style.maxWidth = "none";
        }
    }

    function applyRowGap() {
        var grid = document.querySelector("#homePager .home-app-grid");
        if (!grid) return;
        var box = grid.querySelector(".app-icon-box");
        if (!box) return;
        var w = box.getBoundingClientRect().width;
        var rh = box.parentNode.getBoundingClientRect().height;
        var W = grid.clientWidth;
        if (!w || !rh || !W) return;
        var g = 15;
        var cw = (W - g * 3) / 4;
        var hGap = (cw - w) + g;
        var labelH = Math.max(0, rh - w);
        var rowGap = Math.round(hGap - labelH);
        if (rowGap < 8) rowGap = 8;
        if (rowGap > 40) rowGap = 40;
        grid.style.rowGap = rowGap + "px";
    }

    function applyShift() {
        var small = document.getElementById("widgetSmallArea");
        if (!small) return;
        var h = small.getBoundingClientRect().height;
        if (!h || h < 40) return;
        var pad = Math.round(h / 4);
        var pages = document.querySelectorAll("#homePager > .home-page");
        for (var i = 0; i < pages.length; i++) pages[i].style.paddingTop = pad + "px";
    }

    /* ---------- 微信 ---------- */
    function wxData() {
        if (wx) return wx;
        try { wx = JSON.parse(localStorage.getItem(WX_KEY) || "null"); } catch (e) { wx = null; }
        if (!wx || typeof wx !== "object") wx = { name: "Ta", avatar: "", myAvatar: "", bg: "#F7F7F7", bgImage: "", history: [] };
        if (!Array.isArray(wx.history)) wx.history = [];
        if (typeof wx.name !== "string" || !wx.name) wx.name = "Ta";
        if (typeof wx.bg !== "string" || !wx.bg) wx.bg = "#F7F7F7";
        if (typeof wx.avatar !== "string") wx.avatar = "";
        if (typeof wx.myAvatar !== "string") wx.myAvatar = "";
        if (typeof wx.bgImage !== "string") wx.bgImage = "";
        return wx;
    }

    function wxSave() { try { localStorage.setItem(WX_KEY, JSON.stringify(wxData())); } catch (e) {} }
    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }

    function wxAvatar(src, fallback) {
        var span = document.createElement("span");
        span.className = "wx-avatar";
        if (src && /^(data:image\/|https?:\/\/)/.test(src)) {
            var img = document.createElement("img");
            img.src = src;
            span.appendChild(img);
        } else {
            span.textContent = fallback || "";
        }
        return span;
    }

    function wxRender() {
        var box = document.getElementById("wxMessages");
        var title = document.getElementById("wxTitle");
        var view = document.getElementById("wechatView");
        if (!box || !view) return;
        var d = wxData();
        var main = mainData();
        if (title) title.textContent = d.name || "Ta";
        view.style.background = d.bgImage ? 'url("' + d.bgImage + '") center/cover no-repeat' : (d.bg || "#F7F7F7");

        box.innerHTML = "";
        var last = 0;
        d.history.forEach(function (m) {
            if (!m) return;
            if (m.time && (!last || m.time - last > 300000)) {
                var t = document.createElement("div");
                t.className = "wx-time";
                var dt = new Date(m.time);
                t.textContent = (dt.getHours() < 10 ? "0" : "") + dt.getHours() + ":" + (dt.getMinutes() < 10 ? "0" : "") + dt.getMinutes();
                box.appendChild(t);
            }
            if (m.time) last = m.time;

            var row = document.createElement("div");
            row.className = "wx-row" + (m.from === "me" ? " mine" : "");
            row.appendChild(wxAvatar(m.from === "me" ? (d.myAvatar || main.myAvatar) : (d.avatar || main.taAvatar), m.from === "me" ? "我" : "Ta"));

            if (m.type === "image") {
                var img = document.createElement("img");
                img.className = "wx-sticker";
                img.src = m.text || "";
                row.appendChild(img);
            } else {
                var b = document.createElement("div");
                b.className = "wx-bubble";
                b.textContent = m.text || "";
                row.appendChild(b);
            }
            box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
    }

    function wxScheduleReply() {
        var main = mainData();
        var perm = (main.settings && main.settings.permission) || {};
        var pool = (main.cards || []).filter(function (c) { return (c.kind === "text" || c.kind === "emoji") && c.content; });
        if (!pool.length) return;
        var min = Math.max(1, Math.min(10, Number(perm.replyMin) || 1));
        var max = Math.max(min, Math.min(10, Number(perm.replyMax) || min));
        var count = min + Math.floor(Math.random() * (max - min + 1));
        var delay = Math.max(0, perm.replyDelay == null ? 3 : Number(perm.replyDelay)) * 1000;
        setTimeout(function () {
            var d = wxData();
            var now = Date.now();
            for (var i = 0; i < count; i++) {
                var card = pool[Math.floor(Math.random() * pool.length)];
                d.history.push({ from: "ta", type: "text", text: card.content, time: now + i });
            }
            wxSave();
            var view = document.getElementById("wechatView");
            if (view && view.classList.contains("show")) wxRender();
        }, delay);
    }

    function wxSend() {
        var input = document.getElementById("wxInput");
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        var d = wxData();
        d.history.push({ from: "me", type: "text", text: text, time: Date.now() });
        wxSave();
        input.value = "";
        wxToggleSend();
        wxRender();
        wxScheduleReply();
    }

    function wxToggleSend() {
        var input = document.getElementById("wxInput");
        var send = document.getElementById("wxSend");
        if (!input || !send) return;
        send.style.display = input.value.trim() ? "block" : "none";
    }

    function openSheet(show) {
        var mask = document.getElementById("wxSheetMask");
        var sheet = document.getElementById("wxSheet");
        if (!mask || !sheet) return;
        mask.classList.toggle("show", !!show);
        sheet.classList.toggle("show", !!show);
    }

    function readFile(input, cb) {
        var f = input.files && input.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () { cb(r.result); };
        r.readAsDataURL(f);
        input.value = "";
    }

    function wxBuild() {
        if (document.getElementById("wechatView")) return;
        var view = document.createElement("div");
        view.className = "wx-view";
        view.id = "wechatView";
        view.innerHTML =
            '<header class="wx-header">' +
                '<button class="wx-head-btn" id="wxBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button>' +
                '<div class="wx-title" id="wxTitle">Ta</div>' +
                '<button class="wx-head-btn" id="wxMore" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-more"></use></svg></button>' +
            '</header>' +
            '<div class="wx-messages" id="wxMessages"></div>' +
            '<div class="wx-inputbar">' +
                '<button class="wx-ibar-btn" type="button" aria-label="语音"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" fill="none"/></svg></button>' +
                '<div class="wx-inputwrap"><input id="wxInput" type="text" placeholder="可按住 转文字"></div>' +
                '<button class="wx-send" id="wxSend" type="button" style="display:none">发送</button>' +
                '<button class="wx-ibar-btn" type="button" aria-label="表情"><svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none"/><path d="M8.5 14.2c1 1.4 6 1.4 7 0" fill="none"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/></svg></button>' +
                '<button class="wx-ibar-btn" type="button" aria-label="更多"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-plus"></use></svg></button>' +
            '</div>' +
            '<div class="wx-sheet-mask" id="wxSheetMask"></div>' +
            '<div class="wx-sheet" id="wxSheet">' +
                '<h3>聊天设置</h3>' +
                '<div class="wx-field"><span>备注</span><input type="text" id="wxName" maxlength="16"></div>' +
                '<div class="wx-field"><span>他的头像</span><label class="wx-mini">上传<input type="file" id="wxFileTa" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearTa" type="button">清除</button></div>' +
                '<div class="wx-field"><span>我的头像</span><label class="wx-mini">上传<input type="file" id="wxFileMe" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearMe" type="button">清除</button></div>' +
                '<div class="wx-field"><span>背景颜色</span><input type="color" id="wxBg" style="width:48px;height:32px;border:none;background:none;"></div>' +
                '<div class="wx-field"><span>背景图</span><label class="wx-mini">上传<input type="file" id="wxFileBg" accept="image/*" hidden></label><button class="wx-mini danger" id="wxClearBg" type="button">清除</button></div>' +
                '<button class="wide-btn" id="wxSaveBtn" type="button" style="margin-top:8px;">保存并关闭</button>' +
            '</div>';
        document.body.appendChild(view);

        document.getElementById("wxBack").addEventListener("click", function () { view.classList.remove("show"); });
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
            wxSave();
            openSheet(false);
            wxRender();
        });
        document.getElementById("wxFileTa").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().avatar = src; wxSave(); wxRender(); }); });
        document.getElementById("wxFileMe").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().myAvatar = src; wxSave(); wxRender(); }); });
        document.getElementById("wxFileBg").addEventListener("change", function (e) { readFile(e.target, function (src) { wxData().bgImage = src; wxSave(); wxRender(); }); });
        document.getElementById("wxClearTa").addEventListener("click", function () { wxData().avatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearMe").addEventListener("click", function () { wxData().myAvatar = ""; wxSave(); wxRender(); });
        document.getElementById("wxClearBg").addEventListener("click", function () { wxData().bgImage = ""; wxSave(); wxRender(); });

        var input = document.getElementById("wxInput");
        input.addEventListener("input", wxToggleSend);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); wxSend(); } });
        document.getElementById("wxSend").addEventListener("click", wxSend);
    }

    function wxOpen() {
        wxBuild();
        var view = document.getElementById("wechatView");
        if (!view) return;
        wxRender();
        view.classList.add("show");
        setTimeout(function () { var box = document.getElementById("wxMessages"); if (box) box.scrollTop = box.scrollHeight; }, 60);
    }

    function takeover() {
        var content = document.querySelector(".desktop-content");
        if (!content) return;
        var dock = content.querySelector(".dock");
        var widget = document.getElementById("widgetLarge");
        if (!dock || !widget) return;

        var old = content.querySelector(".home-pager");
        if (old && old.getAttribute("data-owner") === "hero") {
            cleanStrays(content, old);
            fillSmallWidget();
            syncIconSizes();
            applyRowGap();
            applyShift();
            return;
        }

        var chat = document.getElementById("appChat");
        var settings = document.getElementById("appSettings");
        var letter = document.getElementById("appLetter");
        var countdown = document.getElementById("appCountdown");
        var widgets = document.getElementById("appWidgets");

        if (chat && !chat.querySelector(".app-label")) {
            chat.className = "app-icon";
            chat.innerHTML = '<span class="app-icon-box"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-chat"></use></svg></span><span class="app-label">iMessage</span>';
        }

        var small = document.getElementById("widgetSmallArea");
        if (!small) {
            small = document.createElement("div");
            small.className = "widget-small";
            small.id = "widgetSmallArea";
            small.setAttribute("role", "button");
            small.setAttribute("tabindex", "0");
        }

        if (old) {
            content.insertBefore(widget, old);
            if (old.parentNode) old.parentNode.removeChild(old);
        }

        var pager = document.createElement("div");
        pager.className = "home-pager";
        pager.id = "homePager";
        pager.setAttribute("data-owner", "hero");

        var page1 = document.createElement("section"); page1.className = "home-page";
        var page2 = document.createElement("section"); page2.className = "home-page";

        var iconGrid = document.createElement("div"); iconGrid.className = "icon-grid";
        var appGrid = document.createElement("div"); appGrid.className = "app-grid-small";

        var phone = document.getElementById("btnPhone") || makeApp("btnPhone", "电话", "ic-phone");
        var wechat = document.getElementById("btnWechat") || makeApp("btnWechat", "微信", "ic-chat");

        appGrid.appendChild(phone);
        if (chat) appGrid.appendChild(chat);
        appGrid.appendChild(wechat);
        if (settings) appGrid.appendChild(settings);

        iconGrid.appendChild(small);
        iconGrid.appendChild(appGrid);

        page1.appendChild(widget);
        page1.appendChild(iconGrid);

        var grid2 = document.createElement("div");
        grid2.className = "home-app-grid";
        grid2.style.display = "grid";
        grid2.style.gridTemplateColumns = "repeat(4, 1fr)";
        grid2.style.gap = "15px";
        grid2.style.gridAutoRows = "75px";

        var gallery = document.getElementById("btnGallery") || makeApp("btnGallery", "图库", "ic-image");
        var quiz = document.getElementById("btnQuiz") || makeApp("btnQuiz", "出题", "ic-card");
        var freq = document.getElementById("btnFreq") || makeApp("btnFreq", "频率", "ic-calendar");
        if (widgets) grid2.appendChild(widgets);
        if (letter) grid2.appendChild(letter);
        if (countdown) grid2.appendChild(countdown);
        grid2.appendChild(gallery);
        grid2.appendChild(quiz);
        grid2.appendChild(freq);
        page2.appendChild(grid2);

        pager.appendChild(page1);
        pager.appendChild(page2);
        content.insertBefore(pager, dock);

        cleanStrays(content, pager);

        bindOnce(phone, function () {
            var c = document.getElementById("appChat");
            if (c) c.click();
            setTimeout(function () { var call = document.getElementById("btnChatCall"); if (call) call.click(); }, 160);
        });
        bindOnce(wechat, function () { wxOpen(); });
        bindOnce(gallery, function () { alert("图库还没做。"); });
        bindOnce(quiz, function () { alert("出题还没做。"); });
        bindOnce(freq, function () { alert("频率还没拆分。"); });

        fillSmallWidget();
        syncIconSizes();
        applyRowGap();
        applyShift();
        setTimeout(function () { syncIconSizes(); applyRowGap(); applyShift(); }, 300);
        setTimeout(function () { syncIconSizes(); applyRowGap(); applyShift(); }, 900);
    }

    function markVersion() {
        try {
            var page = document.querySelector('[data-page="about"]');
            if (!page) return;
            var items = page.querySelectorAll(".settings-item");
            for (var i = 0; i < items.length; i++) {
                if ((items[i].textContent || "").indexOf("版本") >= 0) {
                    var val = items[i].querySelector(".control-value");
                    if (val) val.textContent = "3.9 · H13";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles();
        buildRow();
        apply();
        takeover();
        markVersion();
        setTimeout(takeover, 600);
        setTimeout(takeover, 1800);
        setTimeout(takeover, 3000);

        var mq = window.matchMedia("(prefers-color-scheme: dark)");
        if (mq && mq.addEventListener) {
            mq.addEventListener("change", function () {
                var input = document.querySelector("[data-hero-text-color]");
                if (input && !load()) {
                    input.value = defaultColor();
                    syncPresets(input.closest("[data-hero-text-card]"), "");
                }
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
