(function() {
    "use strict";

    // 1. 初始化数据 (读取你以前存在手机里的数据)
    const STORAGE_KEY = "private_chat_app_v1";
    let appData = {
        taName: "他", taAvatar: "🌙", myName: "我", myAvatar: "",
        chatHistory: [], cards: [], anniversaries: [], letters: [],
        themeMode: "auto"
    };

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            appData = { ...appData, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn("读取数据失败", e);
    }

    // 2. 页面切换逻辑
    const screens = document.querySelectorAll('.screen');
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    }

    // 3. 渲染主屏幕
    function renderDesktop() {
        // 渲染顶部组件
        const wAvatar = document.getElementById("widgetAvatar");
        if (wAvatar) wAvatar.innerHTML = appData.taAvatar || "🌙";
        
        // 把假横线换成好看的占位
        document.getElementById("wLine1").innerText = "Solo vibe";
        document.getElementById("wLine2").innerText = "@Philos";
        document.getElementById("wLine3").innerText = "Love is the resonance.";
        document.getElementById("wLine4").innerText = "📍 家里";

        // 渲染图标区域的文字 (可以加图标SVG，这里先写文字)
        document.getElementById("headerAvatar").innerText = appData.taAvatar || "🌙";
        document.getElementById("headerName").innerText = appData.taName || "他";
        
        // 渲染设置里的账户
        document.getElementById("settingsMyAvatar").innerText = appData.myAvatar || "👤";
        document.getElementById("settingsMyName").innerText = appData.myName || "your账户名";
    }

    // 4. 渲染聊天记录
    function renderChat() {
        const container = document.getElementById("chatMessages");
        container.innerHTML = "";
        
        if (appData.chatHistory.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#ccc; margin-top:50px; font-size:14px;">还没有聊天记录哦</div>';
            return;
        }

        appData.chatHistory.forEach(msg => {
            const row = document.createElement("div");
            row.className = `msg-row ${msg.from}`;
            
            // 气泡
            const bubble = document.createElement("div");
            bubble.className = "msg-bubble";
            
            if (msg.type === "text") {
                bubble.innerText = msg.text;
            } else if (msg.type === "sticker" || msg.type === "image") {
                bubble.innerHTML = `<img src="${msg.text}" style="max-width:120px; border-radius:8px;">`;
            }
            
            // 头像 (暂时隐藏，以后根据设置加)
            
            row.appendChild(bubble);
            container.appendChild(row);
        });
        
        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    // 5. 绑定所有事件
    function bindEvents() {
        // 主屏 -> 子页面
        document.getElementById('appChat').addEventListener('click', () => { renderChat(); showScreen('chatView'); });
        document.getElementById('appSettings').addEventListener('click', () => showScreen('settingsView'));
        document.getElementById('appCards').addEventListener('click', () => showScreen('cardsView'));
        document.getElementById('appCountdown').addEventListener('click', () => showScreen('countdownView'));
        document.getElementById('appLetter').addEventListener('click', () => showScreen('letterView'));
        document.getElementById('appWidgets').addEventListener('click', () => showScreen('widgetsView'));
        
        document.getElementById('dockAppearance').addEventListener('click', () => showScreen('settingsView'));
        document.getElementById('dockPermission').addEventListener('click', () => showScreen('settingsView'));

        // 子页面 -> 主屏
        ['btnChatBack', 'btnCardsBack', 'btnCountdownBack', 'btnLetterBack', 'btnWidgetsBack'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => showScreen('desktopView'));
        });

        // 设置页面的子菜单返回
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

    // 6. 启动流程
    document.addEventListener("DOMContentLoaded", () => {
        // 关闭启动页
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
