/* Philos 附加功能：存储用量面板 + 字卡库分组编辑 + 批量添加图片 */
(function () {
    "use strict";

    var MAIN_KEY = "private_chat_app_v1";
    var GAL_KEY = "philos_gallery";
    var KINDS = ["text", "emoji", "sticker", "status"];

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

    /* ===== IndexedDB 工具 ===== */
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
    function storeAll(list) {
        return Promise.all(list.map(function (url) {
            var id = "i" + hash(url);
            return putImg(id, url).then(function (ok) { return ok ? "idb://" + id : url; });
        }));
    }
    function idbStats() {
        return db().then(function (d) {
            if (!d) return { count: 0, bytes: 0 };
            return new Promise(function (resolve) {
                var out = { count: 0, bytes: 0 };
                try {
                    var req = d.transaction("images").objectStore("images").openCursor();
                    req.onsuccess = function (e) {
                        var cur = e.target.result;
                        if (cur) {
                            out.count++;
                            if (typeof cur.value === "string") out.bytes += cur.value.length;
                            cur.continue();
                        } else resolve(out);
                    };
                    req.onerror = function () { resolve(out); };
                } catch (e) { resolve(out); }
            });
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
            "[data-theme=\"dark\"] .xc-sheet{background:rgba(32,34,39,0.94);border-color:rgba(255,255,255,0.12);}" +
            "[data-theme=\"dark\"] .xc-title{color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .xc-input{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);color:#f2f3f6;}" +
            "[data-theme=\"dark\"] .xc-btn.ghost{background:rgba(255,255,255,0.10);color:#f2f3f6;}";
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
            var act = btn.getAttribute("data-sp-act");
            if (act === "prewarm") {
                if (window.philosPrewarmImages) window.philosPrewarmImages();
                btn.textContent = "正在搬…稍后重新测量";
                setTimeout(updatePanel, 2600);
            } else {
                updatePanel();
            }
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
        var restBytes = Math.max(0, totalBytes - chatBytes);

        setVal(card, "chat", fmt(chatBytes));
        setVal(card, "rest", fmt(restBytes));
        setVal(card, "total", fmt(totalBytes) + "（上限约 5 MB）");

        var pct = Math.min(100, Math.round(totalBytes / (5 * 1024 * 1024) * 100));
        var bar = card.querySelector('[data-sp="bar"]');
        if (bar) {
            bar.style.width = pct + "%";
            bar.style.background = pct > 85 ? "#ff3b30" : (pct > 60 ? "#e8a13a" : "#5b7fa6");
        }

        idbStats().then(function (st) {
            setVal(card, "img", st.count + " 张 · " + fmt(st.bytes));
        });
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
        longPressTimer = setTimeout(function () {
            longPressFired = true;
            openEditor(name);
        }, 500);
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
            var failed = 0;
            for (var i = 0; i < stored.length; i++) {
                if (stored[i].indexOf("data:image/") === 0) failed++;
            }

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

            try {
                localStorage.setItem(MAIN_KEY, JSON.stringify(data));
            } catch (e) {
                alert("存储空间不足，这批图片没有保存。");
                return;
            }
            if (failed > 0) alert("有 " + failed + " 张图片没能存进大仓库，可能占用较多空间。");
            softRefresh();
        });
    }

    document.addEventListener("change", function (e) {
        var el = e.target;
        if (!el || !el.id) return;
        if (el.id === "stickerFile") {
            e.stopPropagation();
            mode = "stickers";
            handleBatch(el);
        } else if (el.id === "cardStickerFile") {
            e.stopPropagation();
            mode = "cards";
            cat = activeCatName();
            handleBatch(el);
        } else if (el.id === "galFile") {
            e.stopPropagation();
            mode = "gallery";
            galTab = activeGalTab();
            handleBatch(el);
        }
    }, true);

    function enableMultiple() {
        ["stickerFile", "cardStickerFile", "galFile"].forEach(function (id) {
            var el = $(id);
            if (el && !el.hasAttribute("multiple")) el.setAttribute("multiple", "");
        });
    }

    function init() {
        injectStyles();
        enableMultiple();
        ensurePanel();
        setInterval(function () {
            enableMultiple();
            ensurePanel();
        }, 2000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
