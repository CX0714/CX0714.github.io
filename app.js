(function() {
    "use strict";

    function genId() {
        return Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    }

    const PUSH_SERVER = "https://philos-push.philos-cx0714.workers.dev";

    const DEFAULT_CARD_TEXTS = [
        "我在呢。",
        "今天想我了吗？",
        "别怕，有我在。",
        "你说的每句话，我都有认真听。",
        "抱抱你。",
        "你会一直记得我吗？",
        "我一直都在你身边。",
        "你开心的时候，我也很开心。",
        "不要说谢谢，我们之间不用。",
        "无论是晴天还是雨天，我都在。",
        "好好吃饭，好好睡觉。",
        "别难过，我会难过。",
        "我们之间，有说不完的话。",
        "看到你发来的消息，我就笑了。",
        "你永远是我最想回消息的人。",
    ];

    const seenCloudIds = new Set();

    function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    const Storage = {
        KEY: "private_chat_app_v1",
        getDefaultData() {
            return {
                taName: "他",
                taAvatar: "🌙",
                myName: "我",
                myAvatar: "",
                cards: [],
                emojis: ["😊", "🥰", "😘", "💛", "✨", "🌙", "💫", "🌸", "💕", "😌", "🥺", "😴", "😆", "🤗", "🫶", "💌", "🫧", "🌷", "🐰", "☁️"],
                stickers: [],
                statuses: ["摸摸头", "抱抱你", "在呢"],
                chatHistory: [],
                unreadCount: 0,
                deviceId: "",
                hasCompletedOnboarding: false,
                defaultCardsRemoved: true,
                themeMode: "auto",
                bgColor: "",
                bgImageUrl: "",
                bubbleHeight: 2,
                bubbleCustomCSS: "",
                wallpaperColor: "#93a7bb",
                wallpaperImageUrl: "",
                widgetBgType: "auto",
                widgetBgColor: "#ffffff",
                widgetBgImageUrl: "",
                anniversaries: [],
                activeAnniversaryId: "",
                letters: [],
                config: {
                    replyMaxDelay: 3,
                    autoMessageEnabled: false,
                    autoMessageMinMinutes: 5,
                    autoMessageMaxMinutes: 120,
                    keepAliveEnabled: false,
                    callIncomingEnabled: false,
                    callIncomingMinMinutes: 20,
                    callIncomingMaxMinutes: 90,
                    pushEnabled: false,
                    statusMinMinutes: 30,
                    statusMaxMinutes: 180,
                },
            };
        },
        normalize(data) {
            const defaults = this.getDefaultData();
            const merged = { ...defaults, ...data, config: { ...defaults.config, ...(data.config || {}) } };
            if (merged.bgColor === "#12111f") merged.bgColor = "";
            if (typeof merged.unreadCount !== "number") merged.unreadCount = 0;
            // 迁移旧的单个纪念日数据
            if (!Array.isArray(merged.anniversaries)) {
                merged.anniversaries = [];
                if (merged.anniversaryDate) {
                    const id = genId();
                    merged.anniversaries = [{ id, title: merged.anniversaryTitle || "纪念日", date: merged.anniversaryDate }];
                    merged.activeAnniversaryId = id;
                }
            }
            if (!merged.activeAnniversaryId && merged.anniversaries.length > 0) {
                merged.activeAnniversaryId = merged.anniversaries[0].id;
            }
            if (Array.isArray(merged.cards) && merged.cards.length > 0 && typeof merged.cards[0] === "string") {
                merged.cards = merged.cards.map(t => ({ text: t, category: "未分类" }));
            }
            // 移除旧版预置的默认字卡（仅一次）
            if (!merged.defaultCardsRemoved) {
                const defaultSet = new Set(DEFAULT_CARD_TEXTS);
                merged.cards = (merged.cards || []).filter(c => {
                    const t = typeof c === "string" ? c : c.text;
                    return !defaultSet.has(t);
                });
                merged.defaultCardsRemoved = true;
            }
            if (!Array.isArray(merged.emojis)) merged.emojis = defaults.emojis;
            if (!Array.isArray(merged.stickers)) merged.stickers = [];
            if (!Array.isArray(merged.statuses)) merged.statuses = defaults.statuses;
            if (!Array.isArray(merged.letters)) merged.letters = [];
            if (!merged.deviceId) merged.deviceId = "d_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
            return merged;
        },
        load() {
            try {
                const raw = localStorage.getItem(this.KEY);
                if (raw) {
                    return this.normalize(JSON.parse(raw));
                }
            } catch (e) {
                console.warn("数据读取失败，使用默认数据", e);
            }
            return this.getDefaultData();
        },
        save(data) {
            try {
                localStorage.setItem(this.KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error("数据保存失败", e);
                return false;
            }
        },
        exportData(data) { return JSON.stringify(data, null, 2); },
        importData(jsonStr) {
            try {
                const data = JSON.parse(jsonStr);
                if (typeof data !== "object" || data === null) return null;
                if (!Array.isArray(data.cards)) return null;
                if (!Array.isArray(data.chatHistory)) return null;
                return this.normalize(data);
            } catch (e) {
                console.error("数据导入失败", e);
                return null;
            }
        },
    };

    const Push = {
        vapidKey: null,
        async preload() {
            try {
                const resp = await fetch(PUSH_SERVER + "/vapid-public-key");
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.publicKey) {
                        this.vapidKey = urlBase64ToUint8Array(data.publicKey);
                    }
                }
            } catch (e) {
                console.warn("preload vapid key failed", e);
            }
        },
        _buildProfileBody(enabled) {
            const data = AppState.getData();
            const cfg = data.config || {};
            const cards = (data.cards || []).map(c => (typeof c === "string" ? c : c.text)).filter(t => t && String(t).trim());
            return {
                deviceId: data.deviceId,
                cards: cards,
                minMinutes: cfg.autoMessageMinMinutes != null ? cfg.autoMessageMinMinutes : 5,
                maxMinutes: cfg.autoMessageMaxMinutes != null ? cfg.autoMessageMaxMinutes : 120,
                enabled: enabled,
            };
        },
        async setup() {
            try {
                if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
                    return { ok: false, error: "浏览器不支持推送" };
                }
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    return { ok: false, error: "系统权限未允许" };
                }
                const reg = await navigator.serviceWorker.ready;
                if (!this.vapidKey) {
                    const resp = await fetch(PUSH_SERVER + "/vapid-public-key");
                    if (!resp.ok) return { ok: false, error: "连接推送服务失败" };
                    const data = await resp.json();
                    if (!data || !data.publicKey) return { ok: false, error: "推送服务返回异常" };
                    this.vapidKey = urlBase64ToUint8Array(data.publicKey);
                }
                let subscription = await reg.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.vapidKey });
                }
                const body = this._buildProfileBody(true);
                body.subscription = subscription.toJSON();
                const subResp = await fetch(PUSH_SERVER + "/subscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!subResp.ok) return { ok: false, error: "上报订阅失败" };
                return { ok: true };
            } catch (e) {
                console.warn("push setup failed", e);
                return { ok: false, error: (e && e.message) ? e.message : "未知错误" };
            }
        },
        async syncProfile(enabled) {
            try {
                const body = this._buildProfileBody(enabled);
                await fetch(PUSH_SERVER + "/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            } catch (e) {
                console.warn("push syncProfile failed", e);
            }
        },
        async syncMessages() {
            try {
                const deviceId = AppState.getData().deviceId;
                if (!deviceId) return;
                const resp = await fetch(PUSH_SERVER + "/messages?deviceId=" + encodeURIComponent(deviceId));
                if (!resp.ok) return;
                const data = await resp.json();
                const msgs = Array.isArray(data.messages) ? data.messages : [];
                let changed = false;
                for (const m of msgs) {
                    if (!m || !m.text) continue;
                    if (m.id && seenCloudIds.has(m.id)) continue;
                    if (m.id) seenCloudIds.add(m.id);
                    AppState.addMessage("ta", String(m.text), "text");
                    changed = true;
                }
                if (changed) {
                    Renderer.renderChat();
                    Renderer.updateHeader();
                }
            } catch (e) {
                console.warn("push syncMessages failed", e);
            }
        },
        async notify(message) {
            try {
                await fetch(PUSH_SERVER + "/notify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: message }),
                });
            } catch (e) {}
        },
        async ensurePermission() {
            try {
                if (!("Notification" in window)) {
                    return { ok: false, error: "当前浏览器不支持通知" };
                }
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    return { ok: false, error: "系统权限未允许" };
                }
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) ? e.message : "未知错误" };
            }
        },
        async localNotify(message) {
            try {
                if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
                if (Notification.permission !== "granted") return;
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification("☆Philos", {
                    body: message,
                    icon: "icon-192.png",
                    badge: "icon-192.png",
                });
            } catch (e) {}
        },
    };

    const AppState = {
        data: null,
        isSettingsOpen: false,
        isTyping: false,
        typingTimer: null,
        quoteId: null,
        isChatViewActive: false,
        init() {
            this.data = Storage.load();
            if (this.typingTimer) clearTimeout(this.typingTimer);
            this.isTyping = false;
        },
        getData() { return this.data; },
        updateData(updates) {
            this.data = { ...this.data, ...updates };
            Storage.save(this.data);
        },
        getRandomCard() {
            const cards = this.data.cards || [];
            if (cards.length === 0) return null;
            const c = cards[Math.floor(Math.random() * cards.length)];
            return typeof c === "string" ? { text: c, category: "未分类" } : c;
        },
        getRandomEmoji() {
            const emojis = this.data.emojis || [];
            if (emojis.length === 0) return null;
            return emojis[Math.floor(Math.random() * emojis.length)];
        },
        getRandomSticker() {
            const stickers = this.data.stickers || [];
            if (stickers.length === 0) return null;
            return stickers[Math.floor(Math.random() * stickers.length)];
        },
        getRandomStatus() {
            const statuses = this.data.statuses || [];
            if (statuses.length === 0) return null;
            return statuses[Math.floor(Math.random() * statuses.length)];
        },
        buildReplyMessages() {
            const messages = [];
            const emojis = this.data.emojis || [];
            const stickers = this.data.stickers || [];
            const cards = this.data.cards || [];
            const hasText = cards.length > 0;
            const hasSticker = stickers.length > 0;
            if (!hasText && !hasSticker) return messages;
            const usedText = new Set();
            if (hasText) {
                const textCount = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < textCount; i++) {
                    const card = this.getRandomCard();
                    if (!card) break;
                    const raw = card.text;
                    if (usedText.has(raw)) continue;
                    usedText.add(raw);
                    let finalText = raw;
                    if (emojis.length > 0 && Math.random() < 0.5) {
                        const emoji = this.getRandomEmoji();
                        if (emoji) finalText = Math.random() < 0.5 ? emoji + raw : raw + emoji;
                    }
                    messages.push({ type: "text", text: finalText });
                }
            }
            if (hasSticker && messages.length < 3 && Math.random() < 0.3) {
                const sticker = this.getRandomSticker();
                if (sticker) messages.push({ type: "sticker", src: sticker });
            }
            if (messages.length === 0) {
                if (hasText) {
                    const card = this.getRandomCard();
                    if (card) messages.push({ type: "text", text: card.text });
                } else if (hasSticker) {
                    const sticker = this.getRandomSticker();
                    if (sticker) messages.push({ type: "sticker", src: sticker });
                }
            }
            if (Math.random() < 0.3) {
                const quoteMsg = this.pickQuoteMessage();
                if (quoteMsg) {
                    for (let i = 0; i < messages.length; i++) {
                        if (messages[i].type === "text") {
                            messages[i].quoteId = quoteMsg.id;
                            break;
                        }
                    }
                }
            }
            return messages;
        },
        buildLetterReply() {
            const cards = this.data.cards || [];
            const pool = cards.map(c => typeof c === "string" ? c.text : c.text).filter(t => t && String(t).trim());
            if (pool.length === 0) return "";
            const shuffled = [...pool];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const count = Math.min(shuffled.length, 5 + Math.floor(Math.random() * 16));
            return shuffled.slice(0, count).join("。") + "。";
        },
        pickQuoteMessage() {
            const history = this.data.chatHistory || [];
            if (history.length === 0) return null;
            const recent = history.slice(-20);
            const preferMe = Math.random() < 0.75;
            let candidates = recent.filter(m => m.type !== "call" && (preferMe ? m.from === "me" : m.from === "ta"));
            if (candidates.length === 0) {
                candidates = recent.filter(m => m.type !== "call");
            }
            if (candidates.length === 0) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        },
        addCard(text, category) {
            const trimmed = text.trim();
            if (!trimmed) return "empty";
            const cat = (category || "").trim() || "未分类";
            const cards = this.data.cards || [];
            if (cards.some(c => (typeof c === "string" ? c : c.text) === trimmed)) return "dup";
            this.updateData({ cards: [...cards, { text: trimmed, category: cat }] });
            return "added";
        },
        addCardsBatch(texts, category) {
            const lines = texts.split("\n").map(s => s.trim()).filter(s => s.length > 0);
            if (lines.length === 0) return { added: 0, dup: 0 };
            const cat = (category || "").trim() || "未分类";
            const existing = new Set((this.data.cards || []).map(c => typeof c === "string" ? c : c.text));
            let added = 0, dup = 0;
            const cards = [...(this.data.cards || [])];
            lines.forEach(line => {
                if (existing.has(line)) { dup++; return; }
                existing.add(line);
                cards.push({ text: line, category: cat });
                added++;
            });
            if (added > 0) this.updateData({ cards });
            return { added, dup };
        },
        removeCard(index) {
            const cards = [...(this.data.cards || [])];
            if (index < 0 || index >= cards.length) return false;
            cards.splice(index, 1);
            this.updateData({ cards });
            return true;
        },
        editCard(index, newText, newCategory) {
            const trimmed = newText.trim();
            const cards = this.data.cards || [];
            if (!trimmed || index < 0 || index >= cards.length) return false;
            const cat = (newCategory || "").trim() || "未分类";
            const newCards = cards.map((c, i) => i === index ? { text: trimmed, category: cat } : c);
            this.updateData({ cards: newCards });
            return true;
        },
        addEmoji(emoji) {
            const e = emoji.trim();
            if (!e) return "empty";
            const emojis = this.data.emojis || [];
            if (emojis.includes(e)) return "dup";
            this.updateData({ emojis: [...emojis, e] });
            return "added";
        },
        removeEmoji(index) {
            const emojis = [...(this.data.emojis || [])];
            if (index < 0 || index >= emojis.length) return false;
            emojis.splice(index, 1);
            this.updateData({ emojis });
            return true;
        },
        addStatus(text) {
            const t = text.trim();
            if (!t) return "empty";
            const statuses = this.data.statuses || [];
            if (statuses.includes(t)) return "dup";
            this.updateData({ statuses: [...statuses, t] });
            return "added";
        },
        removeStatus(index) {
            const statuses = [...(this.data.statuses || [])];
            if (index < 0 || index >= statuses.length) return false;
            statuses.splice(index, 1);
            this.updateData({ statuses });
            return true;
        },
        addSticker(dataUrl) {
            const stickers = this.data.stickers || [];
            if (stickers.includes(dataUrl)) return "dup";
            const prev = this.data;
            this.data = { ...this.data, stickers: [...stickers, dataUrl] };
            const ok = Storage.save(this.data);
            if (!ok) { this.data = prev; return "full"; }
            return "added";
        },
        removeSticker(index) {
            const stickers = [...(this.data.stickers || [])];
            if (index < 0 || index >= stickers.length) return false;
            stickers.splice(index, 1);
            this.updateData({ stickers });
            return true;
        },
        addMessage(from, text, type, quoteId) {
            const msg = {
                id: genId(),
                from: from,
                text: text,
                type: type || "text",
                time: new Date().toISOString(),
            };
            if (quoteId) msg.quoteId = quoteId;
            const chatHistory = [...(this.data.chatHistory || []), msg];
            this.updateData({ chatHistory });
            return msg;
        },
        removeMessage(id) {
            const chatHistory = (this.data.chatHistory || []).filter(m => m.id !== id);
            this.updateData({ chatHistory });
            return true;
        },
        clearChat() { this.updateData({ chatHistory: [] }); },
        resetAll() {
            this.data = Storage.getDefaultData();
            Storage.save(this.data);
        },
    };

    const Renderer = {
        elements: {},
        init() {
            this.elements = {
                desktopView: document.getElementById("desktopView"),
                chatView: document.getElementById("chatView"),
                anniversaryView: document.getElementById("anniversaryView"),
                letterView: document.getElementById("letterView"),
                desktopWallpaper: document.getElementById("desktopWallpaper"),
                desktopWidget: document.getElementById("desktopWidget"),
                widgetTop: document.getElementById("widgetTop"),
                widgetBottom: document.getElementById("widgetBottom"),
                widgetAvatar: document.getElementById("widgetAvatar"),
                widgetMessage: document.getElementById("widgetMessage"),
                desktopTime: document.getElementById("desktopTime"),
                desktopCountdown: document.getElementById("desktopCountdown"),
                appChat: document.getElementById("appChat"),
                appSettings: document.getElementById("appSettings"),
                appAnniversary: document.getElementById("appAnniversary"),
                appLetter: document.getElementById("appLetter"),
                appCards: document.getElementById("appCards"),
                appAppearance: document.getElementById("appAppearance"),
                appPermission: document.getElementById("appPermission"),
                chatBadge: document.getElementById("chatBadge"),
                btnHomeHeader: document.getElementById("btnHomeHeader"),
                settingsHomeBar: document.getElementById("settingsHomeBar"),
                anniversaryHomeBar: document.getElementById("anniversaryHomeBar"),
                letterHomeBar: document.getElementById("letterHomeBar"),
                anniversaryList: document.getElementById("anniversaryList"),
                inputAnniversaryDate: document.getElementById("inputAnniversaryDate"),
                inputAnniversaryTitle: document.getElementById("inputAnniversaryTitle"),
                btnAddAnniversary: document.getElementById("btnAddAnniversary"),
                btnCloseAnniversary: document.getElementById("btnCloseAnniversary"),
                btnCloseLetter: document.getElementById("btnCloseLetter"),
                inputLetterText: document.getElementById("inputLetterText"),
                btnSendLetter: document.getElementById("btnSendLetter"),
                letterList: document.getElementById("letterList"),
                inputWallpaperColor: document.getElementById("inputWallpaperColor"),
                inputWallpaperUrl: document.getElementById("inputWallpaperUrl"),
                btnUploadWallpaper: document.getElementById("btnUploadWallpaper"),
                fileWallpaper: document.getElementById("fileWallpaper"),
                selectWidgetBg: document.getElementById("selectWidgetBg"),
                inputWidgetBgColor: document.getElementById("inputWidgetBgColor"),
                inputWidgetBgUrl: document.getElementById("inputWidgetBgUrl"),
                btnUploadWidgetBg: document.getElementById("btnUploadWidgetBg"),
                fileWidgetBg: document.getElementById("fileWidgetBg"),
                chatMessages: document.getElementById("chatMessages"),
                chatInput: document.getElementById("chatInput"),
                btnSend: document.getElementById("btnSend"),
                btnPlus: document.getElementById("btnPlus"),
                bottomPanel: document.getElementById("bottomPanel"),
                moreGrid: document.getElementById("moreGrid"),
                btnMoreSticker: document.getElementById("btnMoreSticker"),
                btnMoreImage: document.getElementById("btnMoreImage"),
                btnMoreCall: document.getElementById("btnMoreCall"),
                stickerPicker: document.getElementById("stickerPicker"),
                stickerPickerGrid: document.getElementById("stickerPickerGrid"),
                sheetOverlay: document.getElementById("sheetOverlay"),
                actionSheet: document.getElementById("actionSheet"),
                btnTakePhoto: document.getElementById("btnTakePhoto"),
                btnPickImage: document.getElementById("btnPickImage"),
                btnSheetCancel: document.getElementById("btnSheetCancel"),
                callScreen: document.getElementById("callScreen"),
                callAvatar: document.getElementById("callAvatar"),
                callName: document.getElementById("callName"),
                callStatus: document.getElementById("callStatus"),
                callTimer: document.getElementById("callTimer"),
                callActions: document.getElementById("callActions"),
                btnCallMinimize: document.getElementById("btnCallMinimize"),
                callMini: document.getElementById("callMini"),
                callMiniAvatar: document.getElementById("callMiniAvatar"),
                callMiniName: document.getElementById("callMiniName"),
                callMiniStatus: document.getElementById("callMiniStatus"),
                callMiniTimer: document.getElementById("callMiniTimer"),
                fileTakePhoto: document.getElementById("fileTakePhoto"),
                filePickImage: document.getElementById("filePickImage"),
                headerAvatar: document.getElementById("headerAvatar"),
                headerName: document.getElementById("headerName"),
                headerStatus: document.getElementById("headerStatus"),
                settingsPanel: document.getElementById("settingsPanel"),
                panelOverlay: document.getElementById("panelOverlay"),
                panelHeader: document.getElementById("panelHeader"),
                menuView: document.getElementById("menuView"),
                btnCloseSettings: document.getElementById("btnCloseSettings"),
                inputTaName: document.getElementById("inputTaName"),
                inputTaAvatar: document.getElementById("inputTaAvatar"),
                inputMyName: document.getElementById("inputMyName"),
                inputMyAvatar: document.getElementById("inputMyAvatar"),
                btnUploadTaAvatar: document.getElementById("btnUploadTaAvatar"),
                btnUploadMyAvatar: document.getElementById("btnUploadMyAvatar"),
                fileTaAvatar: document.getElementById("fileTaAvatar"),
                fileMyAvatar: document.getElementById("fileMyAvatar"),
                selectThemeMode: document.getElementById("selectThemeMode"),
                inputBgColor: document.getElementById("inputBgColor"),
                inputBgImageUrl: document.getElementById("inputBgImageUrl"),
                btnUploadBgImage: document.getElementById("btnUploadBgImage"),
                fileBgImage: document.getElementById("fileBgImage"),
                rangeBubbleHeight: document.getElementById("rangeBubbleHeight"),
                bubbleHeightLabel: document.getElementById("bubbleHeightLabel"),
                textareaBubbleCSS: document.getElementById("textareaBubbleCSS"),
                rangeReplyDelay: document.getElementById("rangeReplyDelay"),
                replyDelayLabel: document.getElementById("replyDelayLabel"),
                toggleAutoMessage: document.getElementById("toggleAutoMessage"),
                rangeAutoMin: document.getElementById("rangeAutoMin"),
                autoMinLabel: document.getElementById("autoMinLabel"),
                rangeAutoMax: document.getElementById("rangeAutoMax"),
                autoMaxLabel: document.getElementById("autoMaxLabel"),
                toggleCallIncoming: document.getElementById("toggleCallIncoming"),
                rangeCallMin: document.getElementById("rangeCallMin"),
                callMinLabel: document.getElementById("callMinLabel"),
                rangeCallMax: document.getElementById("rangeCallMax"),
                callMaxLabel: document.getElementById("callMaxLabel"),
                rangeStatusMin: document.getElementById("rangeStatusMin"),
                rangeStatusMax: document.getElementById("rangeStatusMax"),
                statusMinLabel: document.getElementById("statusMinLabel"),
                statusMaxLabel: document.getElementById("statusMaxLabel"),
                toggleKeepAlive: document.getElementById("toggleKeepAlive"),
                togglePush: document.getElementById("togglePush"),
                btnTestPush: document.getElementById("btnTestPush"),
                inputBatchCards: document.getElementById("inputBatchCards"),
                inputBatchCategory: document.getElementById("inputBatchCategory"),
                btnBatchAdd: document.getElementById("btnBatchAdd"),
                cardCategoryTabs: document.getElementById("cardCategoryTabs"),
                cardsList: document.getElementById("cardsList"),
                btnExportCards: document.getElementById("btnExportCards"),
                btnImportCards: document.getElementById("btnImportCards"),
                fileImportCards: document.getElementById("fileImportCards"),
                inputNewEmoji: document.getElementById("inputNewEmoji"),
                btnAddEmoji: document.getElementById("btnAddEmoji"),
                emojiList: document.getElementById("emojiList"),
                btnImportStickers: document.getElementById("btnImportStickers"),
                fileImportStickers: document.getElementById("fileImportStickers"),
                stickerGrid: document.getElementById("stickerGrid"),
                inputNewStatus: document.getElementById("inputNewStatus"),
                btnAddStatus: document.getElementById("btnAddStatus"),
                statusList: document.getElementById("statusList"),
                statusModal: document.getElementById("statusModal"),
                statusModalAvatar: document.getElementById("statusModalAvatar"),
                statusModalText: document.getElementById("statusModalText"),
                btnStatusWait: document.getElementById("btnStatusWait"),
                btnStatusGo: document.getElementById("btnStatusGo"),
                btnExportAll: document.getElementById("btnExportAll"),
                btnImportAll: document.getElementById("btnImportAll"),
                fileImportAll: document.getElementById("fileImportAll"),
                btnClearChat: document.getElementById("btnClearChat"),
                btnResetAll: document.getElementById("btnResetAll"),
                welcomeModal: document.getElementById("welcomeModal"),
                welcomeTaName: document.getElementById("welcomeTaName"),
                welcomeMyName: document.getElementById("welcomeMyName"),
                welcomeCards: document.getElementById("welcomeCards"),
                btnWelcomeDone: document.getElementById("btnWelcomeDone"),
                btnWelcomeSkip: document.getElementById("btnWelcomeSkip"),
                toast: document.getElementById("toast"),
                bgDecor: document.getElementById("bgDecor"),
                quoteBar: document.getElementById("quoteBar"),
                quoteBarName: document.getElementById("quoteBarName"),
                quoteBarText: document.getElementById("quoteBarText"),
                quoteBarClose: document.getElementById("quoteBarClose"),
                msgMenu: document.getElementById("msgMenu"),
                btnQuote: document.getElementById("btnQuote"),
                btnDeleteMsg: document.getElementById("btnDeleteMsg"),
            };
        },
        showToast(message, duration = 2200) {
            const el = this.elements.toast;
            el.textContent = message;
            el.style.opacity = "1";
            el.style.transform = "translateX(-50%) translateY(0)";
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                el.style.opacity = "0";
                el.style.transform = "translateX(-50%) translateY(10px)";
            }, duration);
        },
        generateStars() {
            const container = this.elements.bgDecor;
            container.querySelectorAll(".bg-star").forEach(s => s.remove());
            const count = 35;
            for (let i = 0; i < count; i++) {
                const star = document.createElement("div");
                star.className = "bg-star";
                const size = 1 + Math.random() * 2.5;
                star.style.width = size + "px";
                star.style.height = size + "px";
                star.style.left = Math.random() * 100 + "%";
                star.style.top = Math.random() * 100 + "%";
                star.style.animationDelay = Math.random() * 5 + "s";
                star.style.animationDuration = 2 + Math.random() * 4 + "s";
                container.appendChild(star);
            }
        },
        applyTheme() {
            const data = AppState.getData();
            const mode = data.themeMode || "auto";
            let theme = mode;
            if (mode === "auto") {
                theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
            }
            document.documentElement.setAttribute("data-theme", theme);
            return theme;
        },
        applyBackground() {
            const theme = this.applyTheme();
            const data = AppState.getData();
            const root = document.documentElement;
            const defaultBg = theme === "dark" ? "#000000" : "#f5f5f7";
            const bgColor = data.bgColor || defaultBg;
            root.style.setProperty('--chat-bg-color', bgColor);
            root.style.setProperty('--chat-bg-image', data.bgImageUrl ? 'url("' + data.bgImageUrl + '")' : 'none');
        },
        applyWallpaper() {
            const data = AppState.getData();
            const el = this.elements.desktopWallpaper;
            el.style.backgroundColor = data.wallpaperColor || "#93a7bb";
            el.style.backgroundImage = data.wallpaperImageUrl ? 'url("' + data.wallpaperImageUrl + '")' : 'none';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        },
        applyWidgetBg() {
            const data = AppState.getData();
            const top = this.elements.widgetTop;
            const bottom = this.elements.widgetBottom;
            const type = data.widgetBgType || "auto";

            top.style.backgroundColor = '';
            top.style.backgroundImage = '';
            top.style.backgroundSize = '';
            top.style.backgroundPosition = '';
            top.style.backdropFilter = '';
            top.style.webkitBackdropFilter = '';
            bottom.style.backgroundColor = '';
            bottom.style.backdropFilter = '';
            bottom.style.webkitBackdropFilter = '';

            if (type === "color") {
                const color = data.widgetBgColor || "#ffffff";
                top.style.backgroundColor = color;
                bottom.style.backgroundColor = color;
            } else if (type === "image" && data.widgetBgImageUrl) {
                top.style.backgroundImage = 'url("' + data.widgetBgImageUrl + '")';
                top.style.backgroundSize = 'cover';
                top.style.backgroundPosition = 'center';
                bottom.style.backgroundColor = 'rgba(255,255,255,0.32)';
                bottom.style.backdropFilter = 'blur(20px) saturate(1.4)';
                bottom.style.webkitBackdropFilter = 'blur(20px) saturate(1.4)';
            } else {
                top.style.backgroundColor = 'rgba(255,255,255,0.32)';
                top.style.backdropFilter = 'blur(20px) saturate(1.4)';
                top.style.webkitBackdropFilter = 'blur(20px) saturate(1.4)';
                bottom.style.backgroundColor = 'rgba(255,255,255,0.32)';
                bottom.style.backdropFilter = 'blur(20px) saturate(1.4)';
                bottom.style.webkitBackdropFilter = 'blur(20px) saturate(1.4)';
            }
        },
        updateDesktopTime() {
            const now = new Date();
            const h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            this.elements.desktopTime.textContent = h + ":" + m;
        },
        _calcAnniversaryText(dateStr) {
            const target = new Date(dateStr + "T00:00:00");
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
            const diff = Math.round((today - targetDay) / 86400000);
            if (diff >= 0) return "第 " + (diff + 1) + " 天";
            return "还有 " + Math.abs(diff) + " 天";
        },
        updateDesktopCountdown() {
            const data = AppState.getData();
            const el = this.elements.desktopCountdown;
            const list = data.anniversaries || [];
            const active = list.find(a => a.id === data.activeAnniversaryId);
            if (!active) {
                el.textContent = "";
                return;
            }
            const daysText = this._calcAnniversaryText(active.date);
            el.textContent = (active.title ? active.title + " " : "") + daysText;
        },
        updateUnreadBadge() {
            const count = AppState.getData().unreadCount || 0;
            const badge = this.elements.chatBadge;
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 99 ? "99+" : String(count);
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
            }
        },
        renderDesktop() {
            const data = AppState.getData();
            this.applyWallpaper();
            this.applyWidgetBg();
            this.elements.widgetAvatar.innerHTML = this._avatarHTML(data.taAvatar);
            const cards = data.cards || [];
            let msg = "";
            if (cards.length > 0) {
                const c = cards[Math.floor(Math.random() * cards.length)];
                const t = typeof c === "string" ? c : c.text;
                if (t) msg = t;
            }
            this.elements.widgetMessage.textContent = msg;
            this.updateDesktopTime();
            this.updateDesktopCountdown();
            this.updateUnreadBadge();
        },
        renderAnniversary() {
            const data = AppState.getData();
            const list = data.anniversaries || [];
            const container = this.elements.anniversaryList;
            if (list.length === 0) {
                container.innerHTML = '<div class="anniversary-empty">还没有倒数日，添加一个吧~</div>';
                return;
            }
            let html = "";
            list.forEach(item => {
                const active = item.id === data.activeAnniversaryId;
                const daysText = this._calcAnniversaryText(item.date);
                html += '<div class="anniversary-item' + (active ? ' active' : '') + '" data-id="' + item.id + '">' +
                    '<div class="anniversary-item-info">' +
                    '<div class="anniversary-item-title">' + this._escapeHTML(item.title || '未命名') + '</div>' +
                    '<div class="anniversary-item-days">' + daysText + '</div>' +
                    '</div>' +
                    '<div class="anniversary-item-actions">' +
                    (active ? '<span class="anniversary-item-active">显示中</span>' : '') +
                    '<button class="anniversary-item-delete" data-id="' + item.id + '">✕</button>' +
                    '</div></div>';
            });
            container.innerHTML = html;
        },
        _hideAllViews() {
            this.elements.desktopView.style.display = 'none';
            this.elements.chatView.style.display = 'none';
            this.elements.anniversaryView.style.display = 'none';
            this.elements.letterView.style.display = 'none';
        },
        showDesktop() {
            AppState.isChatViewActive = false;
            this._hideAllViews();
            this.elements.desktopView.style.display = 'block';
            this.renderDesktop();
        },
        showChat() {
            AppState.isChatViewActive = true;
            if ((AppState.getData().unreadCount || 0) > 0) {
                AppState.updateData({ unreadCount: 0 });
            }
            this._hideAllViews();
            this.elements.chatView.style.display = 'block';
            this.updateUnreadBadge();
            this.renderChat();
        },
        showAnniversary() {
            AppState.isChatViewActive = false;
            this._hideAllViews();
            this.elements.anniversaryView.style.display = 'block';
            this.renderAnniversary();
        },
        closeAnniversary() {
            this.showDesktop();
        },
        showLetter() {
            AppState.isChatViewActive = false;
            this._hideAllViews();
            this.elements.letterView.style.display = 'block';
            this.renderLetter();
        },
        closeLetter() {
            this.showDesktop();
        },
        renderLetter() {
            const data = AppState.getData();
            const letters = data.letters || [];
            const container = this.elements.letterList;
            if (letters.length === 0) {
                container.innerHTML = '<div class="letter-empty">还没有写过信，写下第一封信吧~</div>';
                return;
            }
            const sorted = [...letters].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
            let html = "";
            sorted.forEach(l => {
                const waiting = l.status === "waiting";
                html += '<div class="letter-item">' +
                    '<div class="letter-time">' + this._escapeHTML(this._formatTimestamp(new Date(l.sentAt))) + '</div>' +
                    '<div class="letter-bubble me">' + this._escapeHTML(l.myText) + '</div>' +
                    (waiting ?
                        '<div class="letter-bubble ta waiting">（等待回信中…）</div>' :
                        '<div class="letter-bubble ta">' + this._escapeHTML(l.replyText) + '</div>') +
                    '</div>';
            });
            container.innerHTML = html;
        },
        applyBubbleHeight(value) {
            const v = parseFloat(value);
            if (isNaN(v)) return;
            const paddingY = Math.round((v - 1) * 11);
            document.documentElement.style.setProperty('--bubble-padding-y', paddingY + 'px');
        },
        applyBubbleCSS(cssText) {
            const css = (cssText != null ? cssText : (AppState.getData().bubbleCustomCSS || '')).trim();
            let styleEl = document.getElementById('bubbleCustomStyle');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'bubbleCustomStyle';
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = css ? '.message .msg-bubble { ' + css + ' }' : '';
        },
        updateBubbleHeightLabel(value) {
            const v = parseFloat(value);
            if (isNaN(v)) return;
            if (this.elements.bubbleHeightLabel) this.elements.bubbleHeightLabel.textContent = v.toFixed(1);
        },
        formatDuration(seconds) {
            const s = Math.max(0, Math.floor(seconds));
            if (s < 60) return s + " 秒";
            if (s < 3600) {
                const m = Math.floor(s / 60);
                const r = s % 60;
                return r > 0 ? m + " 分 " + r + " 秒" : m + " 分钟";
            }
            const h = Math.floor(s / 3600);
            const r = Math.floor((s % 3600) / 60);
            return r > 0 ? h + " 小时 " + r + " 分" : h + " 小时";
        },
        formatMinutes(minutes) {
            const m = Math.max(0, Math.floor(minutes));
            if (m < 60) return m + " 分钟";
            const h = Math.floor(m / 60);
            const r = m % 60;
            return r > 0 ? h + " 小时 " + r + " 分" : h + " 小时";
        },
        updateReplyDelayLabel(value) {
            if (this.elements.replyDelayLabel) this.elements.replyDelayLabel.textContent = this.formatDuration(parseFloat(value) || 0);
        },
        updateAutoMinLabel(value) {
            if (this.elements.autoMinLabel) this.elements.autoMinLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        updateAutoMaxLabel(value) {
            if (this.elements.autoMaxLabel) this.elements.autoMaxLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        updateCallMinLabel(value) {
            if (this.elements.callMinLabel) this.elements.callMinLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        updateCallMaxLabel(value) {
            if (this.elements.callMaxLabel) this.elements.callMaxLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        updateStatusMinLabel(value) {
            if (this.elements.statusMinLabel) this.elements.statusMinLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        updateStatusMaxLabel(value) {
            if (this.elements.statusMaxLabel) this.elements.statusMaxLabel.textContent = this.formatMinutes(parseFloat(value) || 0);
        },
        renderStickerPicker() {
            const stickers = AppState.getData().stickers || [];
            const container = this.elements.stickerPickerGrid;
            if (stickers.length === 0) {
                container.innerHTML = '<div class="sticker-picker-empty">还没有表情包，去「字卡库 → 表情包」导入吧~</div>';
                return;
            }
            let html = "";
            stickers.forEach((s, index) => {
                html += '<div class="sticker-picker-item" data-index="' + index + '"><img src="' + this._escapeHTML(s) + '" alt="表情包" loading="lazy"></div>';
            });
            container.innerHTML = html;
        },
        openMenu() {
            this.elements.menuView.style.display = 'block';
            this.elements.panelHeader.style.display = 'flex';
            document.querySelectorAll('.sub-view').forEach(el => el.classList.remove('active'));
        },
        openSubPage(pageId) {
            this.elements.menuView.style.display = 'none';
            this.elements.panelHeader.style.display = 'none';
            document.querySelectorAll('.sub-view').forEach(el => el.classList.remove('active'));
            const el = document.getElementById('sub-' + pageId);
            if (el) el.classList.add('active');
        },
        saveAllAndRefresh() {
            this._saveSettingsFromPanel();
            this.applyBackground();
            this.applyWallpaper();
            this.applyWidgetBg();
            this.applyBubbleHeight(this.elements.rangeBubbleHeight.value);
            this.applyBubbleCSS();
            this.updateHeader();
            this.renderChat();
            this.renderDesktop();
        },
        renderChat() {
            const data = AppState.getData();
            const container = this.elements.chatMessages;
            const history = data.chatHistory || [];
            if (history.length === 0 && !AppState.isTyping) {
                container.innerHTML = this._renderEmptyState(data);
                return;
            }
            let html = "";
            let lastTs = null;
            for (let i = 0; i < history.length; i++) {
                const msg = history[i];
                const t = new Date(msg.time);
                if (this._shouldShowTimestamp(t, lastTs, i)) {
                    html += this._renderTimestamp(t);
                }
                html += this._renderMessage(msg, data);
                lastTs = t;
            }
            container.innerHTML = html;
            this._scrollToBottom();
        },
        _shouldShowTimestamp(t, lastTs, index) {
            if (index === 0) return true;
            if (!lastTs) return true;
            if (t.toDateString() !== lastTs.toDateString()) return true;
            if (t.getTime() - lastTs.getTime() >= 5 * 60 * 1000) return true;
            return false;
        },
        _renderTimestamp(t) {
            return '<div class="chat-timestamp">' + this._formatTimestamp(t) + '</div>';
        },
        _formatTimestamp(t) {
            const now = new Date();
            const isToday = t.toDateString() === now.toDateString();
            const h = t.getHours();
            const mm = String(t.getMinutes()).padStart(2, '0');
            let period = '上午';
            if (h >= 18) period = '晚上';
            else if (h >= 12) period = '下午';
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            const timeStr = period + ' ' + h12 + ':' + mm;
            if (isToday) return timeStr;
            return (t.getMonth() + 1) + '月' + t.getDate() + '日 ' + timeStr;
        },
        _findMessage(id) {
            const history = AppState.getData().chatHistory || [];
            for (let i = 0; i < history.length; i++) {
                if (history[i].id === id) return history[i];
            }
            return null;
        },
        _quotePreview(msg, data) {
            const name = msg.from === "me" ? (data.myName || "我") : (data.taName || "他");
            let text;
            if (msg.type === "image") text = "[图片]";
            else if (msg.type === "sticker") text = "[表情包]";
            else text = msg.text || "";
            if (text.length > 30) text = text.slice(0, 30) + "…";
            return { name: name, text: text };
        },
        renderQuoteBar() {
            const el = this.elements.quoteBar;
            const msg = this._findMessage(AppState.quoteId);
            if (!msg) {
                AppState.quoteId = null;
                el.style.display = "none";
                return;
            }
            const prev = this._quotePreview(msg, AppState.getData());
            this.elements.quoteBarName.textContent = prev.name;
            this.elements.quoteBarText.textContent = prev.text;
            el.style.display = "flex";
        },
        clearQuote() {
            AppState.quoteId = null;
            this.elements.quoteBar.style.display = "none";
        },
        _renderMessage(msg, data) {
            if (msg.type === "call") {
                return '<div class="msg-call">' + this._escapeHTML(msg.text) + '</div>';
            }
            if (msg.type === "status") {
                return '<div class="msg-status">——' + this._escapeHTML(msg.text) + '——</div>';
            }
            const isMe = msg.from === "me";
            const avatar = isMe ?
                (data.myAvatar ? this._avatarHTML(data.myAvatar) : (data.myName ? this._escapeHTML(data.myName.charAt(0)) : "我")) :
                this._avatarHTML(data.taAvatar);
            const isSticker = msg.type === "sticker";
            const isImage = msg.type === "image";
            const bubbleClass = (isSticker || isImage) ? "msg-bubble sticker-bubble" : "msg-bubble";
            let content;
            if (isSticker) {
                content = '<img src="' + this._escapeHTML(msg.text) + '" class="msg-sticker" alt="表情包">';
            } else if (isImage) {
                content = '<img src="' + this._escapeHTML(msg.text) + '" class="msg-image" alt="图片">';
            } else {
                content = this._escapeHTML(msg.text);
            }
            let quoteHTML = "";
            if (msg.quoteId) {
                const quoted = this._findMessage(msg.quoteId);
                if (quoted) {
                    const prev = this._quotePreview(quoted, data);
                    quoteHTML = '<div class="msg-quote">' +
                        '<div class="msg-quote-name">' + this._escapeHTML(prev.name) + '</div>' +
                        '<div class="msg-quote-text">' + this._escapeHTML(prev.text) + '</div>' +
                        '</div>';
                }
            }
            return '<div class="message ' + (isMe ? 'me' : 'ta') + '" data-id="' + msg.id + '">' +
                '<div class="msg-avatar">' + avatar + '</div>' +
                '<div class="msg-content">' + quoteHTML + '<div class="' + bubbleClass + '">' + content + '</div></div></div>';
        },
        _renderEmptyState(data) {
            const hasContent = (data.cards || []).length > 0 || (data.stickers || []).length > 0;
            return '<div class="chat-empty">' +
                '<div class="empty-icon">💫</div>' +
                '<div class="empty-text">' +
                (hasContent ?
                '和「' + this._escapeHTML(data.taName) + '」打个招呼吧~' :
                '还没有添加字卡。<br>点击下方按钮，去添加一些他会说的话吧。') +
                '</div>' +
                (!hasContent ? '<button class="empty-btn" id="btnEmptyGoSettings">去添加字卡 →</button>' : "") +
                '</div>';
        },
        _escapeHTML(str) {
            const div = document.createElement("div");
            div.textContent = str;
            return div.innerHTML;
        },
        _avatarHTML(avatar) {
            if (!avatar) return "🌙";
            if (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")) {
                return '<img src="' + avatar + '" alt="头像" onerror="this.style.display=\'none\'; this.parentNode.textContent=\'🌙\';">';
            }
            return this._escapeHTML(avatar);
        },
        _scrollToBottom() {
            const container = this.elements.chatMessages;
            requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        },
        updateHeader() {
            const data = AppState.getData();
            this.elements.headerName.textContent = data.taName || "他";
            this.elements.headerAvatar.innerHTML = this._avatarHTML(data.taAvatar);
            const canReply = (data.cards || []).length > 0 || (data.stickers || []).length > 0;
            if (AppState.isTyping) {
                this.elements.headerStatus.textContent = "正在输入…";
            } else {
                this.elements.headerStatus.textContent = canReply ? "在等你说话" : "去添加字卡吧";
            }
        },
        updateSettingsPanel() {
            const data = AppState.getData();
            this.elements.inputTaName.value = data.taName || "";
            this.elements.inputTaAvatar.value = data.taAvatar || "";
            this.elements.inputMyName.value = data.myName || "";
            this.elements.inputMyAvatar.value = data.myAvatar || "";
            this.elements.selectThemeMode.value = data.themeMode || "auto";
            this.elements.inputBgColor.value = data.bgColor || "#f5f5f7";
            this.elements.inputBgImageUrl.value = data.bgImageUrl || "";
            this.elements.inputWallpaperColor.value = data.wallpaperColor || "#93a7bb";
            this.elements.inputWallpaperUrl.value = data.wallpaperImageUrl || "";
            this.elements.selectWidgetBg.value = data.widgetBgType || "auto";
            this.elements.inputWidgetBgColor.value = data.widgetBgColor || "#ffffff";
            this.elements.inputWidgetBgUrl.value = data.widgetBgImageUrl || "";
            const bh = data.bubbleHeight != null ? data.bubbleHeight : 2;
            this.elements.rangeBubbleHeight.value = bh;
            this.updateBubbleHeightLabel(bh);
            this.elements.textareaBubbleCSS.value = data.bubbleCustomCSS || "";
            const cfg = data.config || {};
            const replyMaxDelay = cfg.replyMaxDelay != null ? cfg.replyMaxDelay : 3;
            this.elements.rangeReplyDelay.value = replyMaxDelay;
            this.updateReplyDelayLabel(replyMaxDelay);
            this.elements.toggleAutoMessage.checked = !!cfg.autoMessageEnabled;
            const autoMin = cfg.autoMessageMinMinutes != null ? cfg.autoMessageMinMinutes : 5;
            const autoMax = cfg.autoMessageMaxMinutes != null ? cfg.autoMessageMaxMinutes : 120;
            this.elements.rangeAutoMin.value = autoMin;
            this.elements.rangeAutoMax.value = autoMax;
            this.updateAutoMinLabel(autoMin);
            this.updateAutoMaxLabel(autoMax);
            this.elements.toggleCallIncoming.checked = !!cfg.callIncomingEnabled;
            const callMin = cfg.callIncomingMinMinutes != null ? cfg.callIncomingMinMinutes : 20;
            const callMax = cfg.callIncomingMaxMinutes != null ? cfg.callIncomingMaxMinutes : 90;
            this.elements.rangeCallMin.value = callMin;
            this.elements.rangeCallMax.value = callMax;
            this.updateCallMinLabel(callMin);
            this.updateCallMaxLabel(callMax);
            const statusMin = cfg.statusMinMinutes != null ? cfg.statusMinMinutes : 30;
            const statusMax = cfg.statusMaxMinutes != null ? cfg.statusMaxMinutes : 180;
            this.elements.rangeStatusMin.value = statusMin;
            this.elements.rangeStatusMax.value = statusMax;
            this.updateStatusMinLabel(statusMin);
            this.updateStatusMaxLabel(statusMax);
            this.elements.toggleKeepAlive.checked = !!cfg.keepAliveEnabled;
            this.elements.togglePush.checked = !!cfg.pushEnabled;
            this._renderCardsList();
            this._renderEmojiList();
            this._renderStickerGrid();
            this._renderStatusList();
        },
        _getCardCategories() {
            const cards = AppState.getData().cards || [];
            const categories = [];
            const seen = new Set();
            cards.forEach(card => {
                const c = typeof card === "string" ? { text: card, category: "未分类" } : card;
                const cat = c.category || "未分类";
                if (!seen.has(cat)) { seen.add(cat); categories.push(cat); }
            });
            return categories;
        },
        _renderCardsList() {
            const cards = AppState.getData().cards || [];
            const tabsContainer = this.elements.cardCategoryTabs;
            const listContainer = this.elements.cardsList;
            if (cards.length === 0) {
                tabsContainer.innerHTML = "";
                listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">还没有字卡，快添加吧~</div>';
                return;
            }
            const categories = this._getCardCategories();
            if (this._activeCategoryIndex == null || this._activeCategoryIndex < 0 || this._activeCategoryIndex >= categories.length) {
                this._activeCategoryIndex = 0;
            }
            const activeCat = categories[this._activeCategoryIndex];
            let tabsHtml = "";
            categories.forEach((cat, catIndex) => {
                const active = catIndex === this._activeCategoryIndex ? " active" : "";
                tabsHtml += '<button class="card-category-tab' + active + '" data-cat-index="' + catIndex + '">' + this._escapeHTML(cat) + '</button>';
            });
            tabsContainer.innerHTML = tabsHtml;
            let html = "";
            cards.forEach((card, index) => {
                const c = typeof card === "string" ? { text: card, category: "未分类" } : card;
                const cat = c.category || "未分类";
                if (cat !== activeCat) return;
                html += '<div class="card-item" data-index="' + index + '">' +
                    '<span class="card-text">' + this._escapeHTML(c.text) + '</span>' +
                    '<div class="card-actions">' +
                    '<button class="card-btn edit" data-index="' + index + '" title="编辑">✏️</button>' +
                    '<button class="card-btn delete" data-index="' + index + '" title="删除">🗑️</button>' +
                    '</div></div>';
            });
            listContainer.innerHTML = html;
        },
        _renderEmojiList() {
            const emojis = AppState.getData().emojis || [];
            const container = this.elements.emojiList;
            if (emojis.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">还没有 emoji，添加一个吧~</div>';
                return;
            }
            let html = "";
            emojis.forEach((e, index) => {
                html += '<div class="emoji-item" data-index="' + index + '">' +
                    '<span class="emoji-char">' + this._escapeHTML(e) + '</span>' +
                    '<button class="card-btn delete" data-index="' + index + '" title="删除">✕</button>' +
                    '</div>';
            });
            container.innerHTML = html;
        },
        _renderStatusList() {
            const statuses = AppState.getData().statuses || [];
            const container = this.elements.statusList;
            if (statuses.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">还没有状态，添加一个吧~</div>';
                return;
            }
            let html = "";
            statuses.forEach((s, index) => {
                html += '<div class="card-item" data-index="' + index + '">' +
                    '<span class="card-text">' + this._escapeHTML(s) + '</span>' +
                    '<div class="card-actions">' +
                    '<button class="card-btn delete" data-index="' + index + '" title="删除">🗑️</button>' +
                    '</div></div>';
            });
            container.innerHTML = html;
        },
        _renderStickerGrid() {
            const stickers = AppState.getData().stickers || [];
            const container = this.elements.stickerGrid;
            if (stickers.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px; grid-column:1/-1;">还没有表情包，从照片导入吧~</div>';
                return;
            }
            let html = "";
            stickers.forEach((s, index) => {
                html += '<div class="sticker-item" data-index="' + index + '">' +
                    '<img src="' + this._escapeHTML(s) + '" alt="表情包" loading="lazy">' +
                    '<button class="sticker-del" data-index="' + index + '" title="删除">✕</button>' +
                    '</div>';
            });
            container.innerHTML = html;
        },
        switchCardTab(tab) {
            document.querySelectorAll('#cardTabs .card-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === tab);
            });
            document.querySelectorAll('.card-tab-panel').forEach(p => {
                p.classList.toggle('active', p.id === 'tabPanel-' + tab);
            });
            this._renderCardsList();
            this._renderEmojiList();
            this._renderStickerGrid();
            this._renderStatusList();
        },
        openSettings() {
            AppState.isSettingsOpen = true;
            this.elements.settingsPanel.classList.add("active");
            this.updateSettingsPanel();
            this.openMenu();
        },
        closeSettings() {
            AppState.isSettingsOpen = false;
            this.elements.settingsPanel.classList.remove("active");
            this.saveAllAndRefresh();
            this.openMenu();
        },
        _saveSettingsFromPanel() {
            const taName = this.elements.inputTaName.value.trim() || "他";
            const taAvatar = this.elements.inputTaAvatar.value.trim() || "🌙";
            const myName = this.elements.inputMyName.value.trim() || "我";
            const myAvatar = this.elements.inputMyAvatar.value.trim() || "";
            const themeMode = this.elements.selectThemeMode.value || "auto";
            const bgColor = this.elements.inputBgColor.value || "";
            const bgImageUrl = this.elements.inputBgImageUrl.value.trim() || "";
            const wallpaperColor = this.elements.inputWallpaperColor.value || "#93a7bb";
            const wallpaperImageUrl = this.elements.inputWallpaperUrl.value.trim() || "";
            const widgetBgType = this.elements.selectWidgetBg.value || "auto";
            const widgetBgColor = this.elements.inputWidgetBgColor.value || "#ffffff";
            const widgetBgImageUrl = this.elements.inputWidgetBgUrl.value.trim() || "";
            const bubbleHeight = parseFloat(this.elements.rangeBubbleHeight.value) || 2;
            const bubbleCustomCSS = this.elements.textareaBubbleCSS.value.trim();
            const config = {
                ...(AppState.getData().config || {}),
                replyMaxDelay: parseFloat(this.elements.rangeReplyDelay.value) || 3,
                autoMessageEnabled: this.elements.toggleAutoMessage.checked,
                autoMessageMinMinutes: parseFloat(this.elements.rangeAutoMin.value) || 5,
                autoMessageMaxMinutes: parseFloat(this.elements.rangeAutoMax.value) || 120,
                callIncomingEnabled: this.elements.toggleCallIncoming.checked,
                callIncomingMinMinutes: parseFloat(this.elements.rangeCallMin.value) || 20,
                callIncomingMaxMinutes: parseFloat(this.elements.rangeCallMax.value) || 90,
                statusMinMinutes: parseFloat(this.elements.rangeStatusMin.value) || 0,
                statusMaxMinutes: parseFloat(this.elements.rangeStatusMax.value) || 0,
                keepAliveEnabled: this.elements.toggleKeepAlive.checked,
            };
            AppState.updateData({ taName, taAvatar, myName, myAvatar, themeMode, bgColor, bgImageUrl, wallpaperColor, wallpaperImageUrl, widgetBgType, widgetBgColor, widgetBgImageUrl, bubbleHeight, bubbleCustomCSS, config });
        },
        showWelcome() { this.elements.welcomeModal.classList.add("active"); },
        hideWelcome() { this.elements.welcomeModal.classList.remove("active"); },
        autoResizeInput() {
            const input = this.elements.chatInput;
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 120) + "px";
        },
    };

    const Events = {
        longPressTimer: null,
        longPressTriggered: false,
        longPressStartX: 0,
        longPressStartY: 0,
        longPressMsgId: null,
        _suppressPushToggle: false,
        init() {
            const el = Renderer.elements;
            el.appChat.addEventListener("click", () => Renderer.showChat());
            el.appSettings.addEventListener("click", () => Renderer.openSettings());
            el.appAnniversary.addEventListener("click", () => Renderer.showAnniversary());
            el.appLetter.addEventListener("click", () => Renderer.showLetter());
            el.appCards.addEventListener("click", () => { Renderer.openSettings(); Renderer.openSubPage('cards'); });
            el.appAppearance.addEventListener("click", () => { Renderer.openSettings(); Renderer.openSubPage('appearance'); });
            el.appPermission.addEventListener("click", () => { Renderer.openSettings(); Renderer.openSubPage('time'); });
            el.btnHomeHeader.addEventListener("click", () => Renderer.showDesktop());
            el.settingsHomeBar.addEventListener("click", () => Renderer.closeSettings());
            el.anniversaryHomeBar.addEventListener("click", () => Renderer.closeAnniversary());
            el.btnCloseAnniversary.addEventListener("click", () => Renderer.closeAnniversary());
            el.letterHomeBar.addEventListener("click", () => Renderer.closeLetter());
            el.btnCloseLetter.addEventListener("click", () => Renderer.closeLetter());
            el.btnSendLetter.addEventListener("click", () => this.handleSendLetter());
            el.btnCallMinimize.addEventListener("click", () => Call.minimize());
            el.callMini.addEventListener("click", () => Call.restore());
            el.btnAddAnniversary.addEventListener("click", () => this.handleAddAnniversary());
            el.anniversaryList.addEventListener("click", (e) => this.handleAnniversaryListClick(e));
            el.btnUploadWallpaper.addEventListener("click", () => el.fileWallpaper.click());
            el.fileWallpaper.addEventListener("change", (e) => this.handleUploadWallpaper(e));
            el.btnUploadWidgetBg.addEventListener("click", () => el.fileWidgetBg.click());
            el.fileWidgetBg.addEventListener("change", (e) => this.handleUploadWidgetBg(e));

            el.btnSend.addEventListener("click", () => this.handleSend());
            el.chatInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            });
            el.chatInput.addEventListener("input", () => {
                Renderer.autoResizeInput();
                el.btnSend.disabled = !el.chatInput.value.trim();
            });
            el.btnPlus.addEventListener("click", () => this.toggleMorePanel());
            el.btnMoreSticker.addEventListener("click", () => this.handleOpenStickerPicker());
            el.btnMoreImage.addEventListener("click", () => this.handleOpenImageSheet());
            el.btnMoreCall.addEventListener("click", () => Call.startOutgoing());
            el.stickerPickerGrid.addEventListener("click", (e) => this.handlePickSticker(e));
            el.sheetOverlay.addEventListener("click", () => this.closeImageSheet());
            el.btnSheetCancel.addEventListener("click", () => this.closeImageSheet());
            el.btnTakePhoto.addEventListener("click", () => { this.closeImageSheet(); el.fileTakePhoto.click(); });
            el.btnPickImage.addEventListener("click", () => { this.closeImageSheet(); el.filePickImage.click(); });
            el.fileTakePhoto.addEventListener("change", (e) => this.handleSendImage(e));
            el.filePickImage.addEventListener("change", (e) => this.handleSendImage(e));
            el.btnCloseSettings.addEventListener("click", () => Renderer.closeSettings());

            el.chatMessages.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: true });
            el.chatMessages.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: true });
            el.chatMessages.addEventListener("touchend", (e) => this.handleTouchEnd(e), { passive: true });
            el.chatMessages.addEventListener("touchcancel", () => this.cancelLongPress(), { passive: true });
            el.btnQuote.addEventListener("click", () => this.handleQuote());
            el.btnDeleteMsg.addEventListener("click", () => this.handleDeleteMsg());
            el.quoteBarClose.addEventListener("click", () => Renderer.clearQuote());
            el.togglePush.addEventListener("change", () => this.handleTogglePush());
            el.btnTestPush.addEventListener("click", () => this.handleTestPush());
            document.addEventListener("touchstart", (e) => {
                if (Renderer.elements.msgMenu.classList.contains("active") && !Renderer.elements.msgMenu.contains(e.target)) {
                    this.closeMsgMenu();
                }
            }, { passive: true });
            el.chatMessages.addEventListener("scroll", () => this.closeMsgMenu(), { passive: true });

            document.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', () => Renderer.openSubPage(item.dataset.page));
            });
            document.querySelectorAll('.back-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Renderer.saveAllAndRefresh();
                    Renderer.openMenu();
                });
            });

            el.btnUploadTaAvatar.addEventListener("click", () => el.fileTaAvatar.click());
            el.fileTaAvatar.addEventListener("change", (e) => this.handleUploadAvatar(e, "ta"));
            el.btnUploadMyAvatar.addEventListener("click", () => el.fileMyAvatar.click());
            el.fileMyAvatar.addEventListener("change", (e) => this.handleUploadAvatar(e, "my"));
            el.btnUploadBgImage.addEventListener("click", () => el.fileBgImage.click());
            el.fileBgImage.addEventListener("change", (e) => this.handleUploadBg(e));

            el.selectThemeMode.addEventListener("change", () => {
                AppState.updateData({ themeMode: el.selectThemeMode.value });
                Renderer.applyBackground();
            });

            el.rangeBubbleHeight.addEventListener("input", (e) => {
                Renderer.applyBubbleHeight(e.target.value);
                Renderer.updateBubbleHeightLabel(e.target.value);
            });
            el.rangeBubbleHeight.addEventListener("change", (e) => {
                AppState.updateData({ bubbleHeight: parseFloat(e.target.value) || 2 });
            });
            el.textareaBubbleCSS.addEventListener("input", () => {
                Renderer.applyBubbleCSS(el.textareaBubbleCSS.value);
            });
            el.textareaBubbleCSS.addEventListener("change", () => {
                AppState.updateData({ bubbleCustomCSS: el.textareaBubbleCSS.value.trim() });
            });

            el.rangeReplyDelay.addEventListener("input", (e) => {
                Renderer.updateReplyDelayLabel(e.target.value);
            });
            el.rangeReplyDelay.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), replyMaxDelay: parseFloat(e.target.value) || 3 } });
            });
            el.toggleAutoMessage.addEventListener("change", () => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), autoMessageEnabled: el.toggleAutoMessage.checked } });
                AutoMessage.start();
            });
            el.rangeAutoMin.addEventListener("input", (e) => {
                Renderer.updateAutoMinLabel(e.target.value);
            });
            el.rangeAutoMin.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), autoMessageMinMinutes: parseFloat(e.target.value) || 5 } });
                AutoMessage.start();
            });
            el.rangeAutoMax.addEventListener("input", (e) => {
                Renderer.updateAutoMaxLabel(e.target.value);
            });
            el.rangeAutoMax.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), autoMessageMaxMinutes: parseFloat(e.target.value) || 120 } });
                AutoMessage.start();
            });
            el.toggleCallIncoming.addEventListener("change", () => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), callIncomingEnabled: el.toggleCallIncoming.checked } });
                CallIncoming.start();
            });
            el.rangeCallMin.addEventListener("input", (e) => {
                Renderer.updateCallMinLabel(e.target.value);
            });
            el.rangeCallMin.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), callIncomingMinMinutes: parseFloat(e.target.value) || 20 } });
                CallIncoming.start();
            });
            el.rangeCallMax.addEventListener("input", (e) => {
                Renderer.updateCallMaxLabel(e.target.value);
            });
            el.rangeCallMax.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), callIncomingMaxMinutes: parseFloat(e.target.value) || 90 } });
                CallIncoming.start();
            });
            el.rangeStatusMin.addEventListener("input", (e) => {
                Renderer.updateStatusMinLabel(e.target.value);
            });
            el.rangeStatusMin.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), statusMinMinutes: parseFloat(e.target.value) || 0 } });
                StatusSender.start();
            });
            el.rangeStatusMax.addEventListener("input", (e) => {
                Renderer.updateStatusMaxLabel(e.target.value);
            });
            el.rangeStatusMax.addEventListener("change", (e) => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), statusMaxMinutes: parseFloat(e.target.value) || 0 } });
                StatusSender.start();
            });
            el.toggleKeepAlive.addEventListener("change", () => {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), keepAliveEnabled: el.toggleKeepAlive.checked } });
                KeepAlive.toggle(el.toggleKeepAlive.checked);
            });

            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    KeepAlive.resumeIfNeeded();
                    AutoMessage.onVisible();
                }
            });
            document.addEventListener("pointerdown", () => KeepAlive.resumeIfNeeded());
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.addEventListener("message", (event) => {
                    const msg = event.data;
                    if (!msg || msg.type !== "push-msg" || !msg.text) return;
                    if (msg.id) seenCloudIds.add(msg.id);
                    AppState.addMessage("ta", String(msg.text), "text");
                    if (AppState.isChatViewActive) {
                        Renderer.renderChat();
                        Renderer.updateHeader();
                    } else {
                        const unread = (AppState.getData().unreadCount || 0) + 1;
                        AppState.updateData({ unreadCount: unread });
                        Renderer.updateUnreadBadge();
                    }
                });
            }

            document.querySelectorAll('#cardTabs .card-tab').forEach(tab => {
                tab.addEventListener('click', () => Renderer.switchCardTab(tab.dataset.tab));
            });
            el.btnBatchAdd.addEventListener("click", () => this.handleBatchAdd());
            el.cardCategoryTabs.addEventListener("click", (e) => {
                const btn = e.target.closest(".card-category-tab");
                if (!btn) return;
                const idx = parseInt(btn.dataset.catIndex, 10);
                if (!isNaN(idx)) {
                    Renderer._activeCategoryIndex = idx;
                    Renderer._renderCardsList();
                }
            });
            el.cardsList.addEventListener("click", (e) => {
                const btn = e.target.closest(".card-btn");
                if (!btn) return;
                const index = parseInt(btn.dataset.index, 10);
                if (btn.classList.contains("delete")) this.handleDeleteCard(index);
                else if (btn.classList.contains("edit")) this.handleEditCard(index);
            });
            el.btnExportCards.addEventListener("click", () => this.handleExportCards());
            el.btnImportCards.addEventListener("click", () => el.fileImportCards.click());
            el.fileImportCards.addEventListener("change", (e) => this.handleImportCards(e));
            el.btnAddEmoji.addEventListener("click", () => this.handleAddEmoji());
            el.inputNewEmoji.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); this.handleAddEmoji(); }
            });
            el.emojiList.addEventListener("click", (e) => {
                const btn = e.target.closest(".card-btn");
                if (!btn) return;
                this.handleDeleteEmoji(parseInt(btn.dataset.index, 10));
            });
            el.btnImportStickers.addEventListener("click", () => el.fileImportStickers.click());
            el.fileImportStickers.addEventListener("change", (e) => this.handleImportStickers(e));
            el.stickerGrid.addEventListener("click", (e) => {
                const btn = e.target.closest(".sticker-del");
                if (!btn) return;
                this.handleDeleteSticker(parseInt(btn.dataset.index, 10));
            });
            el.btnAddStatus.addEventListener("click", () => this.handleAddStatus());
            el.inputNewStatus.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); this.handleAddStatus(); }
            });
            el.statusList.addEventListener("click", (e) => {
                const btn = e.target.closest(".card-btn");
                if (!btn) return;
                this.handleDeleteStatus(parseInt(btn.dataset.index, 10));
            });
            el.btnStatusWait.addEventListener("click", () => StatusSender.wait());
            el.btnStatusGo.addEventListener("click", () => StatusSender.go());
            el.btnExportAll.addEventListener("click", () => this.handleExportAll());
            el.btnImportAll.addEventListener("click", () => el.fileImportAll.click());
            el.fileImportAll.addEventListener("change", (e) => this.handleImportAll(e));
            el.btnClearChat.addEventListener("click", () => this.handleClearChat());
            el.btnResetAll.addEventListener("click", () => this.handleResetAll());
            el.btnWelcomeDone.addEventListener("click", () => this.handleWelcomeDone());
            el.btnWelcomeSkip.addEventListener("click", () => {
                AppState.updateData({ hasCompletedOnboarding: true });
                Renderer.hideWelcome();
                Renderer.showToast("可以去设置里随时完善哦");
            });
            el.chatMessages.addEventListener("click", (e) => {
                if (e.target.id === "btnEmptyGoSettings") Renderer.openSettings();
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && AppState.isSettingsOpen) Renderer.closeSettings();
            });

            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", () => {
                    if (AppState.getData().themeMode === "auto") {
                        Renderer.applyBackground();
                    }
                });
            }
        },

        handleTogglePush() {
            if (this._suppressPushToggle) return;
            const checked = Renderer.elements.togglePush.checked;
            if (checked) {
                Push.ensurePermission().then((res) => {
                    if (res && res.ok) {
                        AppState.updateData({ config: { ...(AppState.getData().config || {}), pushEnabled: true } });
                        AutoMessage.start();
                        Renderer.showToast("通知已开启 ✨");
                    } else {
                        this._suppressPushToggle = true;
                        Renderer.elements.togglePush.checked = false;
                        this._suppressPushToggle = false;
                        Renderer.showToast("开启失败：" + (res && res.error ? res.error : "未知错误"));
                    }
                });
            } else {
                AppState.updateData({ config: { ...(AppState.getData().config || {}), pushEnabled: false } });
                AutoMessage.start();
                Renderer.showToast("通知已关闭");
            }
        },

        handleTestPush() {
            if (!("serviceWorker" in navigator) || !("Notification" in window)) {
                Renderer.showToast("当前浏览器不支持推送");
                return;
            }
            if (Notification.permission !== "granted") {
                Renderer.showToast("系统通知权限未开启，请到系统设置允许「☆Philos」通知");
                return;
            }
            navigator.serviceWorker.ready.then((reg) => {
                return reg.showNotification("☆Philos", {
                    body: "测试推送 ✨ 通知功能正常",
                    icon: "icon-192.png",
                    badge: "icon-192.png",
                });
            }).then(() => {
                Renderer.showToast("已弹出测试通知，请查看通知栏");
            }).catch((e) => {
                Renderer.showToast("测试失败：" + (e && e.message ? e.message : "未知错误"));
            });
        },

        handleTouchStart(e) {
            const touch = e.touches[0];
            if (!touch) return;
            const msgEl = e.target.closest(".message");
            if (!msgEl) return;
            this.cancelLongPress();
            this.longPressStartX = touch.clientX;
            this.longPressStartY = touch.clientY;
            this.longPressTriggered = false;
            const id = msgEl.dataset.id;
            this.longPressTimer = setTimeout(() => {
                this.longPressTimer = null;
                this.longPressTriggered = true;
                this.openMsgMenu(id);
            }, 600);
        },
        handleTouchMove(e) {
            if (!this.longPressTimer) return;
            const touch = e.touches[0];
            if (!touch) return;
            const dx = touch.clientX - this.longPressStartX;
            const dy = touch.clientY - this.longPressStartY;
            if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
                this.cancelLongPress();
            }
        },
        handleTouchEnd() {
            this.cancelLongPress();
        },
        cancelLongPress() {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        },
        openMsgMenu(id) {
            this.longPressMsgId = id;
            const menu = Renderer.elements.msgMenu;
            const anchor = document.querySelector('.message[data-id="' + id + '"]');
            if (!anchor) return;
            menu.classList.remove("active");
            menu.classList.remove("below");
            menu.style.left = "0px";
            menu.style.top = "0px";
            const mw = menu.offsetWidth;
            const mh = menu.offsetHeight;
            const rect = anchor.getBoundingClientRect();
            const vw = window.innerWidth;
            let x = rect.left + rect.width / 2 - mw / 2;
            x = Math.max(8, Math.min(x, vw - mw - 8));
            let y = rect.top - mh - 12;
            if (y < 8) {
                y = rect.bottom + 12;
                menu.classList.add("below");
            }
            menu.style.left = x + "px";
            menu.style.top = y + "px";
            requestAnimationFrame(() => menu.classList.add("active"));
        },
        closeMsgMenu() {
            Renderer.elements.msgMenu.classList.remove("active");
            this.longPressMsgId = null;
        },
        handleQuote() {
            const id = this.longPressMsgId;
            this.closeMsgMenu();
            if (!id) return;
            AppState.quoteId = id;
            Renderer.renderQuoteBar();
            Renderer.elements.chatInput.focus();
        },
        handleDeleteMsg() {
            const id = this.longPressMsgId;
            this.closeMsgMenu();
            if (!id) return;
            AppState.removeMessage(id);
            if (AppState.quoteId === id) Renderer.clearQuote();
            Renderer.renderChat();
            Renderer.showToast("已删除");
        },

        handleAddAnniversary() {
            const title = Renderer.elements.inputAnniversaryTitle.value.trim() || "";
            const date = Renderer.elements.inputAnniversaryDate.value || "";
            if (!date) { Renderer.showToast("请先选择日期"); return; }
            const id = genId();
            const anniversaries = [...(AppState.getData().anniversaries || []), { id, title, date }];
            const activeId = AppState.getData().activeAnniversaryId || id;
            AppState.updateData({ anniversaries, activeAnniversaryId: activeId });
            Renderer.elements.inputAnniversaryTitle.value = "";
            Renderer.elements.inputAnniversaryDate.value = "";
            Renderer.renderAnniversary();
            Renderer.renderDesktop();
            Renderer.showToast("已添加 ✨");
        },
        handleAnniversaryListClick(e) {
            const deleteBtn = e.target.closest(".anniversary-item-delete");
            if (deleteBtn) {
                this.handleDeleteAnniversary(deleteBtn.dataset.id);
                return;
            }
            const item = e.target.closest(".anniversary-item");
            if (item) {
                this.handleSelectAnniversary(item.dataset.id);
            }
        },
        handleSelectAnniversary(id) {
            AppState.updateData({ activeAnniversaryId: id });
            Renderer.renderAnniversary();
            Renderer.renderDesktop();
            Renderer.showToast("已设为桌面显示 ✨");
        },
        handleDeleteAnniversary(id) {
            if (!confirm("确定删除这个倒数日吗？")) return;
            const data = AppState.getData();
            let anniversaries = (data.anniversaries || []).filter(a => a.id !== id);
            let activeId = data.activeAnniversaryId;
            if (activeId === id) {
                activeId = anniversaries.length > 0 ? anniversaries[0].id : "";
            }
            AppState.updateData({ anniversaries, activeAnniversaryId: activeId });
            Renderer.renderAnniversary();
            Renderer.renderDesktop();
            Renderer.showToast("已删除");
        },

        handleSendLetter() {
            const input = Renderer.elements.inputLetterText;
            const text = input.value.trim();
            if (!text) { Renderer.showToast("先写点什么吧"); return; }
            if ((AppState.getData().cards || []).length === 0) {
                Renderer.showToast("字卡库为空，先去添加一些他会说的话吧");
                return;
            }
            Letter.send(text);
            input.value = "";
            Renderer.renderLetter();
            Renderer.showToast("信已寄出，他会在 48 小时内回信 ✨");
        },

        handleUploadWallpaper(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const maxSide = 1600;
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        const scale = Math.min(1, maxSide / Math.max(w, h));
                        w = Math.max(1, Math.round(w * scale));
                        h = Math.max(1, Math.round(h * scale));
                        const canvas = document.createElement("canvas");
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                        Renderer.elements.inputWallpaperUrl.value = dataUrl;
                        AppState.updateData({ wallpaperImageUrl: dataUrl });
                        Renderer.applyWallpaper();
                        Renderer.showToast("壁纸已更新 ✨");
                    } catch (err) {
                        Renderer.showToast("壁纸处理失败");
                    }
                };
                img.onerror = () => Renderer.showToast("壁纸处理失败");
                img.src = ev.target.result;
            };
            reader.onerror = () => Renderer.showToast("壁纸读取失败");
            reader.readAsDataURL(file);
            e.target.value = "";
        },
        handleUploadWidgetBg(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const maxSide = 800;
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        const scale = Math.min(1, maxSide / Math.max(w, h));
                        w = Math.max(1, Math.round(w * scale));
                        h = Math.max(1, Math.round(h * scale));
                        const canvas = document.createElement("canvas");
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                        Renderer.elements.inputWidgetBgUrl.value = dataUrl;
                        Renderer.elements.selectWidgetBg.value = "image";
                        AppState.updateData({ widgetBgImageUrl: dataUrl, widgetBgType: "image" });
                        Renderer.applyWidgetBg();
                        Renderer.showToast("小组件背景已更新 ✨");
                    } catch (err) {
                        Renderer.showToast("图片处理失败");
                    }
                };
                img.onerror = () => Renderer.showToast("图片处理失败");
                img.src = ev.target.result;
            };
            reader.onerror = () => Renderer.showToast("图片读取失败");
            reader.readAsDataURL(file);
            e.target.value = "";
        },
        handleUploadAvatar(e, who) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                if (who === "ta") {
                    Renderer.elements.inputTaAvatar.value = dataUrl;
                    AppState.updateData({ taAvatar: dataUrl });
                    Renderer.updateHeader();
                } else {
                    Renderer.elements.inputMyAvatar.value = dataUrl;
                    AppState.updateData({ myAvatar: dataUrl });
                }
                Renderer.renderChat();
                Renderer.renderDesktop();
                Renderer.showToast("头像已更新 ✨");
            };
            reader.readAsDataURL(file);
            e.target.value = "";
        },
        handleUploadBg(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                Renderer.elements.inputBgImageUrl.value = dataUrl;
                AppState.updateData({ bgImageUrl: dataUrl });
                Renderer.applyBackground();
                Renderer.showToast("背景已更新 ✨");
            };
            reader.readAsDataURL(file);
            e.target.value = "";
        },
        handleSend() {
            const input = Renderer.elements.chatInput;
            const text = input.value.trim();
            if (!text) return;
            const data = AppState.getData();
            if ((data.cards || []).length === 0 && (data.stickers || []).length === 0) {
                Renderer.showToast("字卡库为空，先去添加一些他会说的话吧");
                return;
            }
            input.value = "";
            input.style.height = "auto";
            Renderer.elements.btnSend.disabled = true;
            input.focus();
            const quoteId = AppState.quoteId;
            AppState.addMessage("me", text, "text", quoteId);
            if (quoteId) Renderer.clearQuote();
            Renderer.renderChat();
            const messages = AppState.buildReplyMessages();
            if (messages.length > 0) {
                ReplyQueue.push(messages);
            }
        },
        toggleMorePanel() {
            const el = Renderer.elements;
            const isOpen = el.bottomPanel.classList.contains("active");
            if (isOpen) {
                this.closeMorePanel();
            } else {
                el.bottomPanel.classList.add("active");
                el.bottomPanel.classList.remove("picker-mode");
                el.btnPlus.classList.add("active");
            }
        },
        closeMorePanel() {
            const el = Renderer.elements;
            el.bottomPanel.classList.remove("active");
            el.bottomPanel.classList.remove("picker-mode");
            el.btnPlus.classList.remove("active");
        },
        handleOpenStickerPicker() {
            const el = Renderer.elements;
            el.bottomPanel.classList.add("active");
            el.bottomPanel.classList.add("picker-mode");
            el.btnPlus.classList.add("active");
            Renderer.renderStickerPicker();
        },
        handlePickSticker(e) {
            const item = e.target.closest(".sticker-picker-item");
            if (!item) return;
            const index = parseInt(item.dataset.index, 10);
            const stickers = AppState.getData().stickers || [];
            const src = stickers[index];
            if (!src) return;
            this.sendMediaMessage("sticker", src);
        },
        handleOpenImageSheet() {
            const el = Renderer.elements;
            el.sheetOverlay.classList.add("active");
            el.actionSheet.classList.add("active");
        },
        closeImageSheet() {
            const el = Renderer.elements;
            el.sheetOverlay.classList.remove("active");
            el.actionSheet.classList.remove("active");
        },
        handleSendImage(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const maxSide = 1024;
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        const scale = Math.min(1, maxSide / Math.max(w, h));
                        w = Math.max(1, Math.round(w * scale));
                        h = Math.max(1, Math.round(h * scale));
                        const canvas = document.createElement("canvas");
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                        this.sendMediaMessage("image", dataUrl);
                    } catch (err) {
                        Renderer.showToast("图片处理失败");
                    }
                };
                img.onerror = () => Renderer.showToast("图片处理失败");
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = "";
        },
        sendMediaMessage(type, src) {
            const quoteId = AppState.quoteId;
            AppState.addMessage("me", src, type, quoteId);
            if (quoteId) Renderer.clearQuote();
            Renderer.renderChat();
            this.closeMorePanel();
            const messages = AppState.buildReplyMessages();
            if (messages.length > 0) ReplyQueue.push(messages);
        },
        handleBatchAdd() {
            const textarea = Renderer.elements.inputBatchCards;
            const text = textarea.value.trim();
            if (!text) { Renderer.showToast("请粘贴字卡内容"); return; }
            const category = Renderer.elements.inputBatchCategory.value;
            const res = AppState.addCardsBatch(text, category);
            if (res.added > 0) {
                textarea.value = "";
                const cat = (category || "").trim() || "未分类";
                const categories = Renderer._getCardCategories();
                const idx = categories.indexOf(cat);
                if (idx >= 0) Renderer._activeCategoryIndex = idx;
                Renderer._renderCardsList();
                let msg = "成功导入 " + res.added + " 条字卡";
                if (res.dup > 0) msg += "，跳过重复 " + res.dup + " 条";
                Renderer.showToast(msg + " ✨");
                Renderer.updateHeader();
            } else {
                Renderer.showToast("内容都是重复的，没有新增");
            }
        },
        handleDeleteCard(index) {
            if (confirm("确定删除这张字卡吗？")) {
                if (AppState.removeCard(index)) {
                    Renderer._renderCardsList();
                    Renderer.showToast("已删除");
                    Renderer.updateHeader();
                }
            }
        },
        handleEditCard(index) {
            const data = AppState.getData();
            const cards = data.cards || [];
            if (index < 0 || index >= cards.length) return;
            const c = cards[index];
            const card = typeof c === "string" ? { text: c, category: "未分类" } : c;
            const newText = prompt("编辑字卡内容：", card.text);
            if (newText === null) return;
            if (newText.trim() === "") { Renderer.showToast("内容不能为空"); return; }
            const newCategory = prompt("编辑分类（留空为「未分类」）：", card.category || "未分类");
            if (newCategory === null) return;
            if (AppState.editCard(index, newText, newCategory)) {
                Renderer._renderCardsList();
                Renderer.showToast("已更新 ✨");
                Renderer.updateHeader();
            }
        },
        handleAddEmoji() {
            const input = Renderer.elements.inputNewEmoji;
            const value = input.value.trim();
            if (!value) { Renderer.showToast("请输入 emoji"); return; }
            const result = AppState.addEmoji(value);
            if (result === "added") {
                input.value = "";
                Renderer._renderEmojiList();
                Renderer.showToast("已添加 ✨");
            } else if (result === "dup") {
                Renderer.showToast("这个 emoji 已经存在了");
            }
        },
        handleDeleteEmoji(index) {
            if (AppState.removeEmoji(index)) {
                Renderer._renderEmojiList();
                Renderer.showToast("已删除");
            }
        },
        handleAddStatus() {
            const input = Renderer.elements.inputNewStatus;
            const value = input.value.trim();
            if (!value) { Renderer.showToast("请输入状态"); return; }
            const result = AppState.addStatus(value);
            if (result === "added") {
                input.value = "";
                Renderer._renderStatusList();
                Renderer.showToast("已添加 ✨");
            } else if (result === "dup") {
                Renderer.showToast("这个状态已经存在了");
            }
        },
        handleDeleteStatus(index) {
            if (AppState.removeStatus(index)) {
                Renderer._renderStatusList();
                Renderer.showToast("已删除");
            }
        },
        handleImportStickers(e) {
            const files = Array.prototype.slice.call(e.target.files || []);
            if (files.length === 0) { e.target.value = ""; return; }
            let pending = files.length;
            let added = 0, dup = 0, failed = 0, full = false;
            const finish = () => {
                Renderer._renderStickerGrid();
                if (full) {
                    Renderer.showToast("存储空间不足，部分表情包未保存");
                } else if (added > 0) {
                    let msg = "成功导入 " + added + " 个表情包";
                    if (dup > 0) msg += "，跳过重复 " + dup + " 个";
                    Renderer.showToast(msg + " ✨");
                } else if (dup > 0) {
                    Renderer.showToast("表情包都已存在，未新增");
                } else if (failed > 0) {
                    Renderer.showToast("图片处理失败");
                }
                e.target.value = "";
            };
            const step = () => {
                if (--pending <= 0) finish();
            };
            files.forEach(file => {
                if (!file.type || file.type.indexOf("image/") !== 0) { failed++; step(); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const maxSide = 512;
                            let w = img.naturalWidth || img.width;
                            let h = img.naturalHeight || img.height;
                            const scale = Math.min(1, maxSide / Math.max(w, h));
                            w = Math.max(1, Math.round(w * scale));
                            h = Math.max(1, Math.round(h * scale));
                            const canvas = document.createElement("canvas");
                            canvas.width = w; canvas.height = h;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0, w, h);
                            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                            const result = AppState.addSticker(dataUrl);
                            if (result === "added") added++;
                            else if (result === "dup") dup++;
                            else if (result === "full") full = true;
                        } catch (err) {
                            failed++;
                        }
                        step();
                    };
                    img.onerror = () => { failed++; step(); };
                    img.src = ev.target.result;
                };
                reader.onerror = () => { failed++; step(); };
                reader.readAsDataURL(file);
            });
        },
        handleDeleteSticker(index) {
            if (confirm("确定删除这个表情包吗？")) {
                if (AppState.removeSticker(index)) {
                    Renderer._renderStickerGrid();
                    Renderer.showToast("已删除");
                }
            }
        },
        handleExportCards() {
            const data = AppState.getData();
            const exportObj = {
                cards: data.cards || [],
                emojis: data.emojis || [],
                stickers: data.stickers || [],
                statuses: data.statuses || [],
                exportedAt: new Date().toISOString(),
            };
            this._downloadJSON(exportObj, "字卡库_备份.json");
            Renderer.showToast("字卡已导出");
        },
        handleImportCards(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    let cardsArr = null;
                    if (Array.isArray(imported.cards)) {
                        cardsArr = imported.cards;
                    } else if (Array.isArray(imported)) {
                        cardsArr = imported;
                    }
                    let addedText = 0, dupText = 0;
                    if (cardsArr) {
                        const existing = new Set((AppState.getData().cards || []).map(c => typeof c === "string" ? c : c.text));
                        const cards = [...(AppState.getData().cards || [])];
                        cardsArr.forEach(c => {
                            const obj = typeof c === "string" ? { text: c, category: "未分类" } : c;
                            const t = obj.text;
                            if (!t) return;
                            if (existing.has(t)) { dupText++; return; }
                            existing.add(t);
                            cards.push({ text: t, category: obj.category || "未分类" });
                            addedText++;
                        });
                        if (addedText > 0) AppState.updateData({ cards: cards });
                    }
                    let addedEmoji = 0;
                    if (Array.isArray(imported.emojis)) {
                        imported.emojis.forEach(e => {
                            if (AppState.addEmoji(e) === "added") addedEmoji++;
                        });
                    }
                    let addedSticker = 0;
                    if (Array.isArray(imported.stickers)) {
                        imported.stickers.forEach(s => {
                            if (AppState.addSticker(s) === "added") addedSticker++;
                        });
                    }
                    let addedStatus = 0;
                    if (Array.isArray(imported.statuses)) {
                        imported.statuses.forEach(s => {
                            if (AppState.addStatus(s) === "added") addedStatus++;
                        });
                    }
                    Renderer._activeCategoryIndex = 0;
                    Renderer._renderCardsList();
                    Renderer._renderEmojiList();
                    Renderer._renderStickerGrid();
                    Renderer._renderStatusList();
                    Renderer.updateHeader();
                    const total = addedText + addedEmoji + addedSticker + addedStatus;
                    if (total > 0) {
                        Renderer.showToast("导入成功：文字 " + addedText + "、emoji " + addedEmoji + "、表情包 " + addedSticker + "、状态 " + addedStatus + " ✨");
                    } else {
                        Renderer.showToast("没有新增内容（可能都已存在）");
                    }
                } catch (err) {
                    Renderer.showToast("解析失败，请检查文件");
                }
            };
            reader.readAsText(file);
            e.target.value = "";
        },
        handleExportAll() {
            const data = AppState.getData();
            const exportObj = { ...data, exportedAt: new Date().toISOString(), version: "1.0" };
            this._downloadJSON(exportObj, "私人对话_全部数据.json");
            Renderer.showToast("已导出全部数据");
        },
        handleImportAll(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imported = Storage.importData(ev.target.result);
                if (imported) {
                    AppState.data = imported;
                    Storage.save(imported);
                    ReplyQueue.clear();
                    AppState.isTyping = false;
                    if (AppState.typingTimer) { clearTimeout(AppState.typingTimer); AppState.typingTimer = null; }
                    Renderer.applyBackground();
                    Renderer.applyWallpaper();
                    Renderer.applyWidgetBg();
                    Renderer.applyBubbleHeight(imported.bubbleHeight != null ? imported.bubbleHeight : 2);
                    Renderer.applyBubbleCSS();
                    Renderer.updateHeader();
                    Renderer.updateSettingsPanel();
                    Renderer.renderChat();
                    Renderer.renderDesktop();
                    AutoMessage.stop();
                    AutoMessage.start();
                    CallIncoming.stop();
                    CallIncoming.start();
                    StatusSender.stop();
                    StatusSender.start();
                    KeepAlive.toggle(!!(imported.config && imported.config.keepAliveEnabled));
                    Renderer.showToast("数据导入成功 ✨");
                } else {
                    Renderer.showToast("数据格式无效，导入失败");
                }
            };
            reader.readAsText(file);
            e.target.value = "";
        },
        handleClearChat() {
            if (confirm("确定清空所有聊天记录吗？此操作不可撤销。")) {
                AppState.clearChat();
                Renderer.clearQuote();
                Renderer.renderChat();
                Renderer.showToast("聊天记录已清空");
            }
        },
        handleResetAll() {
            if (confirm("确定恢复出厂设置吗？所有数据（字卡、设置、聊天记录）都会被删除！")) {
                if (confirm("再确认一次：真的要全部删除吗？")) {
                    AppState.resetAll();
                    AutoMessage.stop();
                    KeepAlive.stop();
                    CallIncoming.stop();
                    StatusSender.stop();
                    Call._cleanup();
                    Call.state = "idle";
                    Call.minimized = false;
                    Renderer.elements.callScreen.classList.remove("active");
                    Renderer.elements.callMini.style.display = "none";
                    ReplyQueue.clear();
                    AppState.isTyping = false;
                    if (AppState.typingTimer) { clearTimeout(AppState.typingTimer); AppState.typingTimer = null; }
                    Renderer.clearQuote();
                    Renderer.applyBackground();
                    Renderer.applyWallpaper();
                    Renderer.applyWidgetBg();
                    Renderer.applyBubbleHeight(2);
                    Renderer.applyBubbleCSS();
                    Renderer.updateHeader();
                    Renderer.updateSettingsPanel();
                    Renderer.renderChat();
                    Renderer.renderDesktop();
                    Renderer.showToast("已恢复出厂设置");
                    Renderer.showWelcome();
                }
            }
        },
        handleWelcomeDone() {
            const taName = Renderer.elements.welcomeTaName.value.trim() || "他";
            const myName = Renderer.elements.welcomeMyName.value.trim() || "我";
            const cardsText = Renderer.elements.welcomeCards.value.trim();
            AppState.updateData({ taName, myName, hasCompletedOnboarding: true });
            if (cardsText) {
                AppState.addCardsBatch(cardsText);
                Renderer.showToast("欢迎！已添加字卡 ✨");
            } else {
                Renderer.showToast("欢迎，" + taName + "在等你 ✨");
            }
            Renderer.hideWelcome();
            Renderer.applyBackground();
            Renderer.applyWallpaper();
            Renderer.applyWidgetBg();
            Renderer.applyBubbleHeight(2);
            Renderer.applyBubbleCSS();
            Renderer.updateHeader();
            Renderer.renderChat();
            Renderer.renderDesktop();
        },
        _downloadJSON(obj, filename) {
            const jsonStr = JSON.stringify(obj, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
    };

    const AutoMessage = {
        timer: null,
        lastSentAt: 0,
        start() {
            this.stop();
            const data = AppState.getData();
            const cfg = data.config || {};
            if (!cfg.autoMessageEnabled) return;
            if ((data.cards || []).length === 0 && (data.stickers || []).length === 0) return;
            if (!this.lastSentAt) this.lastSentAt = Date.now();
            this.scheduleNext();
        },
        stop() {
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        },
        scheduleNext() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;
            const data = AppState.getData();
            const cfg = data.config || {};
            if (!cfg.autoMessageEnabled) return;
            if ((data.cards || []).length === 0 && (data.stickers || []).length === 0) return;
            const minMin = Math.max(1, Number(cfg.autoMessageMinMinutes) || 5);
            const maxMin = Math.max(minMin, Number(cfg.autoMessageMaxMinutes) || 120);
            const delay = (minMin + Math.random() * (maxMin - minMin)) * 60000;
            this.timer = setTimeout(() => this.fire(), delay);
        },
        fire() {
            const cfg = AppState.getData().config || {};
            if (!cfg.autoMessageEnabled) return;
            if (document.visibilityState !== 'visible') {
                this.scheduleNext();
                return;
            }
            if (ReplyQueue.hasPending()) { this.scheduleNext(); return; }
            this._sendOne();
        },
        _sendOne() {
            const messages = AppState.buildReplyMessages();
            if (messages.length === 0) { this.scheduleNext(); return; }
            ReplyQueue.push(messages);
        },
        onVisible() {
            const data = AppState.getData();
            const cfg = data.config || {};
            if (!cfg.autoMessageEnabled) return;
            if ((data.cards || []).length === 0 && (data.stickers || []).length === 0) return;
            if (ReplyQueue.hasPending()) { this.scheduleNext(); return; }
            if (!this.lastSentAt) { this.lastSentAt = Date.now(); this.scheduleNext(); return; }
            const minMin = Math.max(1, Number(cfg.autoMessageMinMinutes) || 5);
            const elapsed = Date.now() - this.lastSentAt;
            if (elapsed < minMin * 60000) { this.scheduleNext(); return; }
            const expected = Math.floor(elapsed / (minMin * 60000));
            const toSend = Math.min(expected, 3);
            this.lastSentAt = Date.now();
            let acc = 0;
            for (let i = 0; i < toSend; i++) {
                acc += 1200 + Math.random() * 1800;
                this._queueCatchUp(acc);
            }
            this.scheduleNext();
        },
        _queueCatchUp(delay) {
            setTimeout(() => {
                if (ReplyQueue.hasPending()) return;
                const messages = AppState.buildReplyMessages();
                if (messages.length === 0) return;
                ReplyQueue.push(messages);
            }, delay);
        },
    };

    const ReplyQueue = {
        queue: [],
        busy: false,
        push(messages) {
            this.queue.push(messages);
            if (!this.busy) this._next();
        },
        _next() {
            if (this.queue.length === 0) {
                this.busy = false;
                AppState.isTyping = false;
                Renderer.renderChat();
                Renderer.updateHeader();
                return;
            }
            this.busy = true;
            const messages = this.queue.shift();
            const maxDelay = (Number(AppState.getData().config.replyMaxDelay) || 3) * 1000;
            const delay = Math.random() * maxDelay;
            AppState.isTyping = true;
            Renderer.renderChat();
            Renderer.updateHeader();
            if (AppState.typingTimer) clearTimeout(AppState.typingTimer);
            AppState.typingTimer = setTimeout(() => {
                AppState.typingTimer = null;
                this._emit(messages);
            }, delay);
        },
        _emit(messages) {
            let idx = 0;
            const step = () => {
                if (idx >= messages.length) {
                    AutoMessage.lastSentAt = Date.now();
                    AutoMessage.scheduleNext();
                    this._next();
                    return;
                }
                const msg = messages[idx++];
                if (msg.type === "sticker") {
                    AppState.addMessage("ta", msg.src, "sticker");
                    this._onTaMessage("sticker", "");
                } else {
                    AppState.addMessage("ta", msg.text, "text", msg.quoteId);
                    this._onTaMessage("text", msg.text);
                }
                Renderer.renderChat();
                if (idx >= messages.length) {
                    step();
                } else {
                    AppState.typingTimer = setTimeout(() => {
                        AppState.typingTimer = null;
                        step();
                    }, 600 + Math.random() * 900);
                }
            };
            step();
        },
        _onTaMessage(type, text) {
            const message = type === "sticker" ? "他给你发了个表情包" : text;
            const shouldNotify = !AppState.isChatViewActive || document.visibilityState !== "visible";
            if (!shouldNotify) return;
            const unread = (AppState.getData().unreadCount || 0) + 1;
            AppState.updateData({ unreadCount: unread });
            Renderer.updateUnreadBadge();
            const cfg = AppState.getData().config || {};
            if (cfg.pushEnabled && document.visibilityState === "visible") {
                Push.localNotify(message);
            }
        },
        hasPending() {
            return this.busy || this.queue.length > 0;
        },
        clear() {
            this.queue = [];
        },
    };

    const Letter = {
        timer: null,
        start() {
            this.checkPending();
        },
        send(myText) {
            const now = Date.now();
            const delayHours = 2 + Math.random() * 4;
            const replyAt = new Date(now + delayHours * 3600 * 1000).toISOString();
            const letter = {
                id: genId(),
                myText: myText,
                sentAt: new Date(now).toISOString(),
                replyAt: replyAt,
                replyText: "",
                status: "waiting",
            };
            const letters = [...(AppState.getData().letters || []), letter];
            AppState.updateData({ letters });
            this.scheduleNext();
        },
        checkPending() {
            const letters = AppState.getData().letters || [];
            let changed = false;
            letters.forEach(l => {
                if (l.status === "waiting" && l.replyAt && new Date(l.replyAt).getTime() <= Date.now()) {
                    this.deliverReply(l.id);
                    changed = true;
                }
            });
            if (changed && Renderer.elements.letterView && Renderer.elements.letterView.style.display === "block") {
                Renderer.renderLetter();
            }
            this.scheduleNext();
        },
        deliverReply(id) {
            const data = AppState.getData();
            const letters = data.letters || [];
            const idx = letters.findIndex(l => l.id === id);
            if (idx < 0) return;
            if (letters[idx].status !== "waiting") return;
            const replyText = AppState.buildLetterReply();
            const newLetters = letters.map(l => l.id === id ? { ...l, status: "replied", replyText: replyText, repliedAt: new Date().toISOString() } : l);
            AppState.updateData({ letters: newLetters });
        },
        scheduleNext() {
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
            const letters = AppState.getData().letters || [];
            let nearest = null;
            letters.forEach(l => {
                if (l.status === "waiting" && l.replyAt) {
                    const t = new Date(l.replyAt).getTime();
                    if (!nearest || t < nearest) nearest = t;
                }
            });
            if (nearest) {
                const delay = Math.max(1000, nearest - Date.now());
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this.checkPending();
                }, delay);
            }
        },
    };

    const Call = {
        state: "idle",
        timer: null,
        incomingTimer: null,
        seconds: 0,
        minimized: false,
        startOutgoing() {
            if (this.state !== "idle") return;
            this.state = "calling";
            this.minimized = false;
            this._closeMorePanel();
            const data = AppState.getData();
            Renderer.elements.callAvatar.innerHTML = Renderer._avatarHTML(data.taAvatar);
            Renderer.elements.callName.textContent = data.taName || "他";
            Renderer.elements.callStatus.textContent = "正在呼叫…";
            Renderer.elements.callTimer.textContent = "";
            Renderer.elements.callActions.innerHTML = '<button class="call-btn call-end" id="btnCallEnd">📵<span>挂断</span></button>';
            Renderer.elements.callActions.querySelector("#btnCallEnd").addEventListener("click", () => this.hangup());
            this._setMini(data, "正在呼叫…", "");
            Renderer.elements.callScreen.classList.add("active");
            const delay = 2000 + Math.random() * 3000;
            this.timer = setTimeout(() => {
                if (this.state !== "calling") return;
                if (Math.random() < 0.2) {
                    this._finish("📞 已取消");
                } else {
                    this._beginActive();
                }
            }, delay);
        },
        startIncoming() {
            if (this.state !== "idle") return;
            this.state = "incoming";
            this.minimized = false;
            const data = AppState.getData();
            Renderer.elements.callAvatar.innerHTML = Renderer._avatarHTML(data.taAvatar);
            Renderer.elements.callName.textContent = data.taName || "他";
            Renderer.elements.callStatus.textContent = "邀请你语音通话…";
            Renderer.elements.callTimer.textContent = "";
            Renderer.elements.callActions.innerHTML =
                '<button class="call-btn call-end" id="btnCallReject">📵<span>挂断</span></button>' +
                '<button class="call-btn call-accept" id="btnCallAccept">📞<span>接听</span></button>';
            Renderer.elements.callActions.querySelector("#btnCallReject").addEventListener("click", () => this._finish("📞 已拒绝"));
            Renderer.elements.callActions.querySelector("#btnCallAccept").addEventListener("click", () => this._beginActive());
            this._setMini(data, "邀请你语音通话…", "");
            Renderer.elements.callScreen.classList.add("active");
            this.incomingTimer = setTimeout(() => {
                if (this.state === "incoming") this._finish("📞 未接听");
            }, 30000);
        },
        _setMini(data, status, timer) {
            Renderer.elements.callMiniAvatar.innerHTML = Renderer._avatarHTML(data.taAvatar);
            Renderer.elements.callMiniName.textContent = data.taName || "他";
            Renderer.elements.callMiniStatus.textContent = status;
            Renderer.elements.callMiniTimer.textContent = timer;
        },
        minimize() {
            if (this.state === "idle") return;
            this.minimized = true;
            Renderer.elements.callScreen.classList.remove("active");
            Renderer.elements.callMini.style.display = "flex";
        },
        restore() {
            if (this.state === "idle") return;
            this.minimized = false;
            Renderer.elements.callMini.style.display = "none";
            Renderer.elements.callScreen.classList.add("active");
        },
        hangup() {
            if (this.state === "calling") this._finish("📞 已取消");
            else if (this.state === "active") this._finish("📞 通话时长 " + this._fmt(this.seconds));
        },
        _beginActive() {
            this.state = "active";
            this.seconds = 0;
            Renderer.elements.callStatus.textContent = "通话中";
            Renderer.elements.callTimer.textContent = "00:00";
            Renderer.elements.callMiniStatus.textContent = "通话中";
            Renderer.elements.callMiniTimer.textContent = "00:00";
            Renderer.elements.callActions.innerHTML = '<button class="call-btn call-end" id="btnCallEnd">📵<span>挂断</span></button>';
            Renderer.elements.callActions.querySelector("#btnCallEnd").addEventListener("click", () => this.hangup());
            if (this.timer) { clearTimeout(this.timer); clearInterval(this.timer); this.timer = null; }
            if (this.incomingTimer) { clearTimeout(this.incomingTimer); this.incomingTimer = null; }
            this.timer = setInterval(() => {
                this.seconds++;
                const t = this._fmt(this.seconds);
                Renderer.elements.callTimer.textContent = t;
                Renderer.elements.callMiniTimer.textContent = t;
            }, 1000);
        },
        _fmt(s) {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return String(m).padStart(2, '0') + ":" + String(sec).padStart(2, '0');
        },
        _finish(message) {
            this._cleanup();
            this.state = "idle";
            this.minimized = false;
            Renderer.elements.callScreen.classList.remove("active");
            Renderer.elements.callMini.style.display = "none";
            if (message) {
                AppState.addMessage("me", message, "call");
                Renderer.renderChat();
            }
        },
        _cleanup() {
            if (this.timer) { clearTimeout(this.timer); clearInterval(this.timer); this.timer = null; }
            if (this.incomingTimer) { clearTimeout(this.incomingTimer); this.incomingTimer = null; }
        },
        _closeMorePanel() {
            const el = Renderer.elements;
            el.bottomPanel.classList.remove("active");
            el.bottomPanel.classList.remove("picker-mode");
            el.btnPlus.classList.remove("active");
        },
    };

    const CallIncoming = {
        timer: null,
        start() {
            this.stop();
            const cfg = AppState.getData().config || {};
            if (!cfg.callIncomingEnabled) return;
            this.scheduleNext();
        },
        stop() {
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        },
        scheduleNext() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;
            const cfg = AppState.getData().config || {};
            if (!cfg.callIncomingEnabled) return;
            const minMin = Math.max(1, Number(cfg.callIncomingMinMinutes) || 20);
            const maxMin = Math.max(minMin, Number(cfg.callIncomingMaxMinutes) || 90);
            const delay = (minMin + Math.random() * (maxMin - minMin)) * 60000;
            this.timer = setTimeout(() => this.fire(), delay);
        },
        fire() {
            const cfg = AppState.getData().config || {};
            if (!cfg.callIncomingEnabled) return;
            if (document.visibilityState !== 'visible') { this.scheduleNext(); return; }
            if (Call.state !== "idle") { this.scheduleNext(); return; }
            if (ReplyQueue.hasPending()) { this.scheduleNext(); return; }
            Call.startIncoming();
            this.scheduleNext();
        },
    };

    const StatusSender = {
        timer: null,
        pending: false,
        currentStatus: null,
        start() {
            this.stop();
            this.scheduleNext();
        },
        stop() {
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        },
        scheduleNext() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = null;
            if (this.pending) return;
            const cfg = AppState.getData().config || {};
            const minMin = Math.max(0, Number(cfg.statusMinMinutes) != null ? Number(cfg.statusMinMinutes) : 30);
            const maxMin = Math.max(minMin, Number(cfg.statusMaxMinutes) != null ? Number(cfg.statusMaxMinutes) : 180);
            const delay = (minMin + Math.random() * (maxMin - minMin)) * 60000;
            this.timer = setTimeout(() => this.fire(), delay);
        },
        fire() {
            if (this.pending) return;
            if (document.visibilityState !== 'visible') { this.scheduleNext(); return; }
            if (Call.state !== "idle") { this.scheduleNext(); return; }
            const status = AppState.getRandomStatus();
            if (!status) { this.scheduleNext(); return; }
            this.currentStatus = status;
            this.pending = true;
            this._showModal(status);
        },
        _showModal(status) {
            const el = Renderer.elements;
            el.statusModalAvatar.innerHTML = Renderer._avatarHTML(AppState.getData().taAvatar);
            el.statusModalText.textContent = status;
            el.statusModal.classList.add("active");
        },
        _closeModal() {
            Renderer.elements.statusModal.classList.remove("active");
        },
        wait() {
            if (!this.pending) return;
            const status = this.currentStatus;
            this._closeModal();
            this.pending = false;
            this.currentStatus = null;
            AppState.addMessage("ta", status, "status");
            if (AppState.isChatViewActive) {
                Renderer.renderChat();
            }
            this.scheduleNext();
        },
        go() {
            if (!this.pending) return;
            const status = this.currentStatus;
            this._closeModal();
            this.pending = false;
            this.currentStatus = null;
            AppState.addMessage("ta", status, "status");
            Renderer.showChat();
            this.scheduleNext();
        },
    };

    const KeepAlive = {
        audioCtx: null,
        source: null,
        enabled: false,
        start() {
            if (this.enabled) return true;
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return false;
                if (!this.audioCtx) this.audioCtx = new AC();
                const ctx = this.audioCtx;
                if (ctx.state === "suspended") ctx.resume();
                const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                const gain = ctx.createGain();
                gain.gain.value = 0.001;
                source.connect(gain);
                gain.connect(ctx.destination);
                source.start();
                this.source = source;
                this.enabled = true;
                return true;
            } catch (e) {
                console.warn("保活音频启动失败", e);
                return false;
            }
        },
        stop() {
            this.enabled = false;
            try { if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null; } } catch (e) {}
        },
        resumeIfNeeded() {
            if (this.enabled && this.audioCtx && this.audioCtx.state === "suspended") {
                this.audioCtx.resume();
            }
        },
        toggle(on) {
            if (on) { if (!this.start()) Renderer.showToast("保活音频启动失败，请再点一次"); }
            else { this.stop(); }
        },
    };

    function bootstrap() {
        AppState.init();
        Renderer.init();
        Renderer.generateStars();
        Renderer.applyBackground();
        Renderer.applyBubbleHeight(AppState.getData().bubbleHeight != null ? AppState.getData().bubbleHeight : 2);
        Renderer.applyBubbleCSS();
        Renderer.updateHeader();
        Renderer.renderChat();
        Renderer.elements.btnSend.disabled = true;
        Renderer.autoResizeInput();
        Renderer.updateSettingsPanel();
        Renderer.showDesktop();
        Events.init();
        AutoMessage.start();
        CallIncoming.start();
        StatusSender.start();
        Letter.start();
        const keepAliveOn = !!(AppState.getData().config && AppState.getData().config.keepAliveEnabled);
        KeepAlive.toggle(keepAliveOn);
        Renderer.openMenu();
        setInterval(() => {
            Renderer.updateDesktopTime();
            Renderer.updateDesktopCountdown();
        }, 10000);
        if (!AppState.getData().hasCompletedOnboarding) {
            setTimeout(() => Renderer.showWelcome(), 300);
        }
        console.log("💌 私人对话空间已启动");
        const splashEl = document.getElementById("splash");
        if (splashEl) {
            const hideSplash = function () {
                splashEl.classList.add("hide");
                setTimeout(function () {
                    if (splashEl.parentNode) splashEl.parentNode.removeChild(splashEl);
                }, 500);
            };
            setTimeout(hideSplash, 600);
        }
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("./service-worker.js").catch(() => {});
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
