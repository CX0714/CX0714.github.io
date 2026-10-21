(function() {
    "use strict";

    const STORAGE_KEY = "private_chat_app_v1";
    let appData = {
        taName: "他", taAvatar: "🌙", myName: "我", myAvatar: "",
        chatHistory: [], cards: [], anniversaries: [], letters: [], themeMode: "auto"
    };

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) appData = { ...appData, ...JSON.parse(saved) };
    } catch (e) {}

    const screens = document.querySelectorAll('.screen');
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    }

    function renderDesktop() {
        document.getElementById("widgetAvatar").innerHTML = appData.taAvatar || "🌙";
        document.getElementById("wLine1").innerText = "Solo vibe";
        document.getElementById("wLine2").innerText = "@Philos";
        document.getElementById("wLine3").innerText = "Love is the resonance.";
        document.getElementById("wLine4").innerText = "📍 家里";

        document.getElementById("headerAvatar").innerHTML = appData.taAvatar || "🌙";
        document.getElementById("headerName").innerText = appData.taName || "他";
        
        document.getElementById("settingsMyAvatar").innerHTML = appData.myAvatar || "👤";
        document.getElementById("settingsMyName").innerText = appData.myName || "your账户名";
    }

    function renderChat() {
        const container = document.getElementById("chatMessages");
        container.innerHTML = "";
        
        if (!appData.chatHistory || appData.chatHistory.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#ccc; margin-top:50px; font-size:14px;">还没有聊天记录哦</div>';
            return;
        }

        appData.chatHistory.forEach(msg => {
            const row = document.createElement("div");
            row.className = `msg-row ${msg.from}`;
            
            const bubble = document.createElement("div");
            bubble.className = "msg-bubble";
            
            if (msg.type === "text") {
                bubble.innerText = msg.text;
            } else if (msg.type === "sticker" || msg.type === "image") {
                bubble.innerHTML = `<img src="${msg.text}" style="max-width:120px; border-radius:8px;">`;
            }
            row.appendChild(bubble);
            container.appendChild(row);
        });
        container.scrollTop = container.scrollHeight;
    }

    function bindEvents() {
        // 页面跳转
        document.getElementById('appChat').addEventListener('click', () => { renderChat(); showScreen('chatView'); });
        document.getElementById('appSettings').addEventListener('click', () => showScreen('settingsView'));
        document.getElementById('appCards').addEventListener('click', () => showScreen('cardsView'));
        document.getElementById('appCountdown').addEventListener('click', () => showScreen('countdownView'));
        document.getElementById('appLetter').addEventListener('click', () => showScreen('letterView'));
        document.getElementById('appWidgets').addEventListener('click', () => showScreen('widgetsView'));
        
        document.getElementById('dockAppearance').addEventListener('click', () => showScreen('settingsView'));
        document.getElementById('dockPermission').addEventListener('click', () => showScreen('settingsView'));

        // 各子页面返回
        ['btnChatBack', 'btnCardsBack', 'btnCountdownBack', 'btnLetterBack', 'btnWidgetsBack', 'btnSettingsBack'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => showScreen('desktopView'));
        });

        // 设置子菜单返回
        document.getElementById('btnSubBack').addEventListener('click', () => {
            document.getElementById('settingsSubPage').style.display = 'none';
            document.getElementById('settingsMainPage').style.display = 'block';
        });

        // 点击设置列表
        document.querySelectorAll('.settings-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('settingsMainPage').style.display = 'none';
                document.getElementById('settingsSubPage').style.display = 'flex';
                const pageName = item.querySelector('span').innerText;
                document.getElementById('subPageTitle').innerText = pageName;
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            const splash = document.getElementById("splash");
            if (splash) {
                splash.classList.add("hide");
                setTimeout(() => splash.style.display = 'none', 500);
            }
        }, 600);

        renderDesktop();
        bindEvents();
    });

})();
