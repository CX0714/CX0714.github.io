/* Philos 电话 app v7：头像名字统一 / 深色模式开关 / 大组件配色纠正 / 字卡库分组换行 / 造句分类可改名删除 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var PHONE_KEY = "philos_phone";
    var CALLS_KEY = "philos_calls";
    var UNREAD_KEY = "philos_unread";
    var WORD_KEY = "philos_words";

    var view = null, listEl = null, nameEl = null, avatarEl = null, bgEl = null, unreadTimer = null, syncTimer = null;

    function $(id) { return document.getElementById(id); }
    function mainData() { try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}"); } catch (e) { return {}; } }
    function saveMain(d) { try { localStorage.setItem(MAIN_KEY, JSON.stringify(d)); } catch (e) {} }

    function phoneData() {
        var d = null;
        try { d = JSON.parse(localStorage.getItem(PHONE_KEY) || "null"); } catch (e) { d = null; }
        if (!d || typeof d !== "object") d = {};
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

    function loadModule(src) {
        if (document.querySelector('script[data-philos="' + src + '"]')) return;
        var s = document.createElement("script");
        s.src = src;
        s.setAttribute("data-philos", src);
        document.body.appendChild(s);
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtTime(ts) {
        var d = new Date(Number(ts) || Date.now());
        return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function systemName() {
        var d = mainData();
        var n = typeof d.taName === "string" ? d.taName.trim() : "";
        if (n && n !== "他") return n;
        var h = $("headerName");
        var t = h ? (h.textContent || "").trim() : "";
        if (t && t !== "Typing...") return t;
        return "他";
    }

    /* ================= 主题 ================= */
    function isDarkNow() {
        var d = mainData();
        var mode = d.themeMode || "auto";
        if (mode === "dark") return true;
        if (mode === "light") return false;
        try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
    }

    function applyThemeNow(dark) {
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", dark ? "#000000" : "#eef1f5");
    }

    var LIGHT_TOP = ["#eef1f5", "#eef1f5ff"];
    var LIGHT_BOTTOM = ["#ffffff", "#ffffffff"];
    var DARK_TOP = ["#1e2024"];
    var DARK_BOTTOM = ["#202226"];

    var normalizing = false;
    function normalizeHeroColors() {
        if (normalizing) return;
        var dark = isDarkNow();
        var d = mainData();
        var hc = d.heroConfig;
        if (!hc || typeof hc !== "object") return;
        var top = hc.top && typeof hc.top === "object" ? hc.top : null;
        var bottom = hc.bottom && typeof hc.bottom === "object" ? hc.bottom : null;
        var changed = false;

        function check(el, list) {
            if (!el) return;
            var c = String(el.color || "").toLowerCase();
            if (!c) return;
            if (list.indexOf(c) >= 0) { el.color = ""; changed = true; }
        }
        if (dark) { check(top, LIGHT_TOP); check(bottom, LIGHT_BOTTOM); }
        else { check(top, DARK_TOP); check(bottom, DARK_BOTTOM); }

        if (!changed) return;
        normalizing = true;
        saveMain(d);
        if (window.philosReload) setTimeout(function () { normalizing = false; window.philosReload(); }, 80);
        else setTimeout(function () { normalizing = false; }, 400);
    }

    function ensureThemeRow() {
        var page = document.querySelector('[data-page="main"]');
        if (!page || page.querySelector("[data-philos-theme-row]")) return;
        var appearanceBtn = page.querySelector('[data-goto="appearance"]');
        var row = document.createElement("div");
        row.className = "settings-item";
        row.setAttribute("data-philos-theme-row", "1");
        row.innerHTML = '<span>深色模式</span><label class="switch"><input type="checkbox" data-philos-theme><span class="switch-track"></span></label>';
        var input = row.querySelector("[data-philos-theme]");
        if (input) {
            input.checked = isDarkNow();
            input.addEventListener("change", function (e) {
                var dark = !!e.target.checked;
                var d = mainData();
                d.themeMode = dark ? "dark" : "light";
                saveMain(d);
                applyThemeNow(dark);
                if (window.philosReload) setTimeout(function () { window.philosReload(); }, 120);
                setTimeout(normalizeHeroColors, 260);
            });
        }
        if (appearanceBtn && appearanceBtn.parentNode) appearanceBtn.parentNode.insertBefore(row, appearanceBtn);
        else page.appendChild(row);
    }

    /* ================= 造句分类：改名 / 删除 ================= */
    function wordStore() {
        var v = null;
        try { v = JSON.parse(localStorage.getItem(WORD_KEY) || "null"); } catch (e) { v = null; }
        if (Array.isArray(v)) {
            v = { items: v.filter(function (s) { return typeof s === "string" && s.trim(); })
                .map(function (t) { return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t, category: "未分类" }; }), categories: [] };
        }
        if (!v || typeof v !== "object") v = {};
        if (!Array.isArray(v.items)) v.items = [];
        if (!Array.isArray(v.categories)) v.categories = [];
        return v;
    }
    function saveWordStore(v) { try { localStorage.setItem(WORD_KEY, JSON.stringify(v)); } catch (e) { alert("保存失败。"); } }

    var wcatEditing = "";

    function buildCatSheet() {
        if ($("wceSheet")) return;
        var mask = document.createElement("div");
        mask.className = "wce-mask";
        mask.id = "wceMask";
        var sheet = document.createElement("div");
        sheet.className = "wce-sheet";
        sheet.id = "wceSheet";
        sheet.innerHTML =
            '<div class="wce-title" id="wceTitle">编辑分类</div>' +
            '<input class="wce-input" id="wceInput" type="text" maxlength="12" placeholder="分类名称" autocomplete="off">' +
            '<div class="wce-row"><button class="wce-btn ghost" id="wceCancel" type="button">取消</button><button class="wce-btn primary" id="wceSave" type="button">保存</button></div>' +
            '<div class="wce-row"><button class="wce-btn danger" id="wceDel" type="button">删除这个分类</button></div>';
        document.body.appendChild(mask);
        document.body.appendChild(sheet);

        mask.addEventListener("click", closeCatSheet);
        $("wceCancel").addEventListener("click", closeCatSheet);
        $("wceSave").addEventListener("click", saveCatRename);
        $("wceDel").addEventListener("click", deleteCat);
    }

    function openCatSheet(name) {
        buildCatSheet();
        wcatEditing = name;
        $("wceTitle").textContent = "编辑分类「" + name + "」";
        $("wceInput").value = name;
        $("wceMask").classList.add("show");
        $("wceSheet").classList.add("show");
        setTimeout(function () { try { $("wceInput").focus(); $("wceInput").select(); } catch (e) {} }, 60);
    }

    function closeCatSheet() {
        var mask = $("wceMask"), sheet = $("wceSheet");
        if (mask) mask.classList.remove("show");
        if (sheet) sheet.classList.remove("show");
        wcatEditing = "";
    }

    function refreshWordUI() {
        var chip = document.querySelector("[data-sub-chips] .ck-chip");
        if (chip) chip.click();
    }

    function saveCatRename() {
        var next = ($("wceInput") ? $("wceInput").value : "").trim();
        if (!wcatEditing) { closeCatSheet(); return; }
        if (!next || next === wcatEditing) { closeCatSheet(); return; }
        if (next === "全部" || next === "未分类") { alert("这个名字不能用。"); return; }

        var st = wordStore();
        var i = st.categories.indexOf(wcatEditing);
        if (i >= 0) st.categories[i] = next;
        else st.categories.push(next);
        st.categories = st.categories.filter(function (n, idx, arr) { return n && arr.indexOf(n) === idx; });
        st.items.forEach(function (it) {
            if (it && (it.category || "未分类") === wcatEditing) it.category = next;
        });
        saveWordStore(st);
        closeCatSheet();
        refreshWordUI();
    }

    function deleteCat() {
        if (!wcatEditing) return;
        if (!confirm("删除分类「" + wcatEditing + "」？里面的词会移到「未分类」。")) return;
        var st = wordStore();
        st.categories = st.categories.filter(function (n) { return n !== wcatEditing; });
        st.items.forEach(function (it) {
            if (it && (it.category || "未分类") === wcatEditing) it.category = "未分类";
        });
        saveWordStore(st);
        closeCatSheet();
        refreshWordUI();
    }

    /* 点“已选中”的分类 = 编辑（和字卡库一致） */
    document.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var chip = t.closest("[data-sub-chips] .ck-chip");
        if (!chip) return;
        if (!chip.classList.contains("active")) return;
        var name = (chip.textContent || "").trim();
        if (!name || name === "全部" || name === "未分类" || name.indexOf("分类") === 0) return;
        e.stopPropagation();
        e.preventDefault();
        openCatSheet(name);
    }, true);

    /* ================= 样式 ================= */
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
            ".ph-name::placeholder{color:rgba(255,255,255,0.72);}" +
            ".ph-calls{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;margin-top:24px;}" +
            ".ph-call-list{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 16px calc(env(safe-area-inset-bottom) + 26px);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 30px,#000 100%);mask-image:linear-gradient(180deg,transparent 0,#000 30px,#000 100%);}" +
            ".ph-call{background:rgba(255,255,255,0.52);-webkit-backdrop-filter:blur(18px) saturate(115%);backdrop-filter:blur(18px) saturate(115%);border:1px solid rgba(255,255,255,0.58);border-radius:16px;padding:12px 14px;margin-bottom:10px;box-shadow:0 4px 14px rgba(45,65,90,0.10);}" +
            ".ph-call-text{font-size:14px;line-height:1.5;color:#252b33;word-break:break-word;}" +
            ".ph-call-time{font-size:11.5px;color:rgba(45,55,70,0.55);margin-top:4px;}" +
            ".ph-empty{text-align:center;font-size:13px;color:rgba(45,55,70,0.55);padding:40px 0;}" +
            ".philos-dot{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#ff3b30;color:#fff;font-size:10px;line-height:17px;text-align:center;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.28);z-index:8;pointer-events:none;box-sizing:border-box;}" +
            "[data-philos-theme-row]{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;min-height:52px;}" +
            "[data-philos-theme-row] > span{font-size:16px;color:var(--text-primary);}" +
            "[data-philos-theme-row] .switch{flex:0 0 auto;margin:0;}" +
            /* 字卡库 / 造句 的分类：换行排布，不再横向滑动 */
            "#cardCats,#cardCats.cat-scroll,[data-sub-chips].ck-chips{display:flex !important;flex-wrap:wrap !important;align-items:center !important;" +
                "gap:8px !important;overflow:visible !important;overflow-x:visible !important;white-space:normal !important;" +
                "padding:4px 16px 10px !important;height:auto !important;max-height:none !important;}" +
            "#cardCats > *,[data-sub-chips] > *{flex:0 0 auto !important;}" +
            /* 造句分类编辑弹层 */
            ".wce-mask{position:fixed;inset:0;z-index:940;background:rgba(16,20,26,0.32);display:none;}" +
            ".wce-mask.show{display:block;}" +
            ".wce-sheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.94);opacity:0;pointer-events:none;z-index:941;" +
                "width:86%;max-width:330px;padding:18px;border-radius:20px;background:#ffffff;border:1px solid rgba(255,255,255,0.9);" +
                "box-shadow:0 22px 50px rgba(20,30,45,0.24);transition:transform .18s ease,opacity .18s ease;}" +
            ".wce-sheet.show{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto;}" +
            ".wce-title{font-size:16px;font-weight:600;color:#1b1d21;text-align:center;margin-bottom:14px;}" +
            ".wce-input{width:100%;height:44px;border-radius:12px;border:1px solid rgba(120,135,155,0.30);background:#fff;padding:0 12px;font-size:16px;color:#1b1d21;outline:none;box-sizing:border-box;}" +
            ".wce-row{display:flex;gap:10px;margin-top:12px;}" +
            ".wce-btn{flex:1;height:44px;border-radius:13px;font-size:15px;border:none;}" +
            ".wce-btn.ghost{background:rgba(120,132,148,0.14);color:#1b1d21;}" +
            ".wce-btn.primary{background:#5b7fa6;color:#fff;}" +
            ".wce-btn.danger{background:rgba(255,59,48,0.12);color:#ff3b30;}" +
            "[data-theme=\"dark\"] .wce-sheet{background:#1c1d21;border-color:rgba(255,255,255,0.12);}" +
            "[data-theme=\"dark\"] .wce-title{color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .wce-input{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .wce-btn.ghost{background:rgba(255,255,255,0.10);color:#f2f3f6;}";
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
        var src = "";
        var live = document.querySelector("#headerAvatar img, #taProfileAvatar img, #callAvatar img, #peekAvatar img");
        if (live) src = live.getAttribute("src") || "";
        if (!src) {
            var raw = mainData().taAvatar || "";
            if (/^(data:image\/|https?:\/\/|blob:)/.test(raw)) src = raw;
        }
        if (src) avatarEl.innerHTML = '<img src="' + src.replace(/"/g, "&quot;") + '" alt="">';
        else avatarEl.textContent = (systemName() || "他").slice(0, 2);
    }

    function renderName() {
        if (!nameEl) return;
        if (document.activeElement === nameEl) return;
        var n = systemName();
        nameEl.value = n === "他" ? "" : n;
        nameEl.placeholder = "他的称呼（在设置里改）";
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
        if (!n) { if (dot && dot.parentNode) dot.parentNode.removeChild(dot); return; }
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
                '<input class="ph-name" id="phName" type="text" maxlength="16" placeholder="他的称呼（在设置里改）" autocomplete="off" autocapitalize="off" spellcheck="false">' +
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
            var val = nameEl.value.trim();
            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(function () {
                var d = mainData();
                d.taName = val || "他";
                saveMain(d);
                var h = $("headerName");
                if (h) h.textContent = d.taName;
                if (window.philosReload) setTimeout(function () { window.philosReload(); }, 120);
                renderAvatar();
            }, 500);
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

    function close() { if (view) view.classList.remove("show"); }

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
        loadModule("fixes.js");
        buildCatSheet();
        ensureThemeRow();
        normalizeHeroColors();
        refreshBadge();
        if (unreadTimer) clearInterval(unreadTimer);
        unreadTimer = setInterval(function () {
            if (document.hidden) return;
            ensureThemeRow();
            refreshBadge();
            if (view && view.classList.contains("show")) { renderAvatar(); renderName(); }
        }, 2500);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshBadge(); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);

    window.PhilosOpenPhone = open;
})();
