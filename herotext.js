/* H37 主屏 / 大组件 / 频率；微信 wx.js；拍一拍 pat.js */
(function () {
    "use strict";

    var KEY = "philos_hero_text";
    var HERO_AV = "philos_hero_avatar";
    var MAIN_KEY = "private_chat_app_v1";

    function load() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
    function save(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
    function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
    function defaultColor() { return isDark() ? "#f4f5f7" : "#1b1d21"; }

    function applyHeroColor() {
        var big = document.getElementById("widgetLarge");
        if (!big) return;
        var color = load();
        big.classList.toggle("hero-text-custom", !!color);
        if (color) big.style.setProperty("--hero-text", color);
        else big.style.removeProperty("--hero-text");
    }

    function applyHeroAvatar() {
        var box = document.getElementById("widgetAvatar");
        if (!box) return;
        var src = "";
        try { src = localStorage.getItem(HERO_AV) || ""; } catch (e) {}
        if (src && /^(data:image\/|https?:\/\/)/.test(src)) {
            if (!box.querySelector("img") || box.querySelector("img").getAttribute("src") !== src) {
                box.innerHTML = '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">';
            }
        }
    }

    function syncPresets(card, color) {
        if (!card) return;
        var btns = card.querySelectorAll("[data-hero-text-preset]");
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("active", btns[i].getAttribute("data-hero-text-preset").toLowerCase() === String(color || "").toLowerCase());
    }

    function buildRow() {
        var pane = document.querySelector('[data-wpane="hero"]');
        if (!pane || pane.querySelector("[data-hero-text-card]")) return;
        var anchor = pane.querySelector(".group-card");
        if (!anchor) return;
        var card = document.createElement("div");
        card.className = "group-card control-card";
        card.setAttribute("data-hero-text-card", "");
        var swatches = ["#1b1d21","#ffffff","#5b7fa6","#8b909a","#c9d3de"].map(function (color) {
            return '<button class="hero-swatch" type="button" data-hero-text-preset="' + color + '" style="background:' + color + '"></button>';
        }).join("");
        card.innerHTML = '<div class="hero-group-title">文字颜色</div><div class="control-row"><span class="control-label">四行文字</span><div class="row-actions"><label class="color-dot"><input type="color" data-hero-text-color></label><button class="clear-text" type="button" data-hero-text-clear>恢复默认</button></div></div><div class="hero-color-presets">' + swatches + '</div>';
        anchor.parentNode.insertBefore(card, anchor.nextSibling);
        var input = card.querySelector("[data-hero-text-color]");
        var current = load();
        input.value = current || defaultColor();
        syncPresets(card, current);
        input.addEventListener("input", function () { save(input.value); applyHeroColor(); syncPresets(card, input.value); });
        card.addEventListener("click", function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var p = t.closest("[data-hero-text-preset]");
            if (p) { input.value = p.getAttribute("data-hero-text-preset"); save(input.value); applyHeroColor(); syncPresets(card, input.value); return; }
            if (t.closest("[data-hero-text-clear]")) { save(""); input.value = defaultColor(); applyHeroColor(); syncPresets(card, ""); }
        });
    }

    function buildHeroAvatarRow() {
        var sheet = document.getElementById("editSheet");
        if (!sheet || sheet.querySelector("[data-hero-av-row]")) return;
        var fields = sheet.querySelector(".sheet-fields");
        if (!fields) return;
        var row = document.createElement("div");
        row.setAttribute("data-hero-av-row", "");
        row.className = "sheet-field";
        row.innerHTML = '<span>大组件头像</span><div class="row-actions"><label class="text-btn">上传<input type="file" accept="image/*" data-hero-av-file hidden></label><button class="clear-text" type="button" data-hero-av-clear>清除</button></div>';
        fields.appendChild(row);
        row.querySelector("[data-hero-av-file]").addEventListener("change", function (e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            var r = new FileReader();
            r.onload = function () { try { localStorage.setItem(HERO_AV, r.result); } catch (err) {} applyHeroAvatar(); };
            r.readAsDataURL(f);
            e.target.value = "";
        });
        row.querySelector("[data-hero-av-clear]").addEventListener("click", function () {
            try { localStorage.removeItem(HERO_AV); } catch (e) {}
            var box = document.getElementById("widgetAvatar");
            if (box) { box.innerHTML = "Me"; }
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
            "#homePager .home-app-grid{display:grid !important;grid-template-columns:repeat(4,1fr) !important;column-gap:15px !important;width:100%;grid-auto-rows:75px !important;align-content:start;}" +
            ".dock{grid-template-columns:repeat(3,1fr) !important;}" +
            "#editSheet{left:50% !important;right:auto !important;top:50% !important;bottom:auto !important;width:86% !important;max-width:340px !important;border-radius:22px !important;transform:translate(-50%,-50%) scale(.94) !important;opacity:0;}" +
            "#editSheet.show{transform:translate(-50%,-50%) scale(1) !important;opacity:1;}" +
            ".freq-view{position:fixed;inset:0;z-index:470;display:none;flex-direction:column;background:#EEEEEE;}" +
            ".freq-view.show{display:flex;}" +
            ".freq-header{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 16px 8px;}" +
            ".freq-title{font-size:20px;font-weight:600;color:var(--text-primary,#1b1d21);}" +
            ".freq-body{flex:1;min-height:0;overflow-y:auto;padding:8px 16px calc(env(safe-area-inset-bottom) + 24px);}";
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
            if ((data.widgetConfig || {}).template) return;
            var item = null;
            (data.anniversaries || []).forEach(function (a) { if (a.id === data.activeCountdownId) item = a; });
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
        var cw = (W - 15 * 3) / 4;
        var hGap = (cw - w) + 15;
        var labelH = Math.max(0, rh - w);
        var rowGap = Math.round(hGap) + Math.round(labelH);
        if (rowGap < 10) rowGap = 10;
        if (rowGap > 44) rowGap = 44;
        grid.style.setProperty("row-gap", rowGap + "px", "important");
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

    function buildFreqView() {
        if (document.getElementById("freqView")) return;
        var v = document.createElement("div");
        v.className = "freq-view";
        v.id = "freqView";
        v.innerHTML = '<div class="freq-header"><button class="nav-back" id="freqBack" type="button"><svg class="svg-icon" viewBox="0 0 24 24"><use href="#ic-back"></use></svg></button><span class="freq-title">频率</span></div><div class="freq-body" id="freqBody"></div>';
        document.body.appendChild(v);
        document.getElementById("freqBack").addEventListener("click", function () { v.classList.remove("show"); });
    }

    function openFreq() {
        buildFreqView();
        var v = document.getElementById("freqView");
        var body = document.getElementById("freqBody");
        var page = document.querySelector('[data-page="permission"]');
        if (!v || !body || !page) return;
        var keys = ["permission.replyDelay", "permission.replyMin", "permission.activeMin", "permission.activeMax", "permission.callMin", "permission.callMax"];
        for (var i = 0; i < keys.length; i++) {
            var el = page.querySelector('[data-key="' + keys[i] + '"]');
            if (!el) continue;
            var card = el.closest(".group-card");
            if (card && card.parentNode !== body) body.appendChild(card);
        }
        var extra = page.querySelector("[data-rm-combo]");
        if (extra) {
            var c2 = extra.closest(".group-card");
            if (c2 && c2.parentNode !== body) body.appendChild(c2);
        }
        v.classList.add("show");
    }

    function loadModule(src) {
        if (document.querySelector('script[data-philos="' + src + '"]')) return;
        var s = document.createElement("script");
        s.src = src;
        s.setAttribute("data-philos", src);
        document.body.appendChild(s);
    }

    function takeover() {
        var content = document.querySelector(".desktop-content"); if (!content) return;
        var dock = content.querySelector(".dock"), widget = document.getElementById("widgetLarge");
        if (!dock || !widget) return;
        var old = content.querySelector(".home-pager");
        if (old && old.getAttribute("data-owner") === "hero") {
            cleanStrays(content, old); fillSmallWidget(); syncIconSizes(); applyRowGap(); applyShift(); applyHeroAvatar(); return;
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
        bindOnce(wechat, function () {
            if (window.PhilosOpenWeChat) window.PhilosOpenWeChat();
            else alert("微信加载中，稍后再试。");
        });
        bindOnce(gallery, function () { alert("图库还没做。"); });
        bindOnce(quiz, function () { alert("出题加载中。"); });
        bindOnce(freq, function () { openFreq(); });

        fillSmallWidget(); syncIconSizes(); applyRowGap(); applyShift(); applyHeroAvatar(); buildHeroAvatarRow();
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
                    if (val) val.textContent = "3.9 · H37";
                }
            }
        } catch (e) {}
    }

    function init() {
        injectStyles();
        loadModule("wx.js");
        loadModule("pat.js");
        buildRow(); applyHeroColor(); applyHeroAvatar(); buildHeroAvatarRow(); takeover(); markVersion();
        setTimeout(takeover, 600); setTimeout(takeover, 1800); setTimeout(takeover, 3000);
        if (window.MutationObserver) {
            var box = document.getElementById("widgetAvatar");
            if (box) {
                var mo = new MutationObserver(function () { applyHeroAvatar(); });
                mo.observe(box, { childList: true, subtree: true });
            }
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
