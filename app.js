// 极简过渡版 app.js
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. 关闭启动页
    setTimeout(() => {
        const splash = document.getElementById("splash");
        if (splash) {
            splash.classList.add("hide");
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 600);

    // 2. 页面路由（切换功能）
    const screens = document.querySelectorAll('.screen');
    
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
    }

    // 3. 绑定各个按钮的点击事件
    // 主屏幕 -> 各个子页面
    document.getElementById('appChat').addEventListener('click', () => showScreen('chatView'));
    document.getElementById('appSettings').addEventListener('click', () => showScreen('settingsView'));
    document.getElementById('appCards').addEventListener('click', () => showScreen('cardsView'));
    document.getElementById('appCountdown').addEventListener('click', () => showScreen('countdownView'));
    document.getElementById('appLetter').addEventListener('click', () => showScreen('letterView'));
    document.getElementById('appWidgets').addEventListener('click', () => showScreen('widgetsView'));
    
    // Dock 栏里那两个快捷入口先指向设置界面
    document.getElementById('dockAppearance').addEventListener('click', () => showScreen('settingsView'));
    document.getElementById('dockPermission').addEventListener('click', () => showScreen('settingsView'));

    // 各个子页面返回主屏幕
    const backBtns = [
        'btnChatBack', 'btnCardsBack', 'btnCountdownBack', 
        'btnLetterBack', 'btnWidgetsBack'
    ];
    backBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => showScreen('desktopView'));
    });

    // 设置页面的返回逻辑
    document.getElementById('btnSubBack').addEventListener('click', () => {
        document.getElementById('settingsSubPage').style.display = 'none';
        document.getElementById('settingsMainPage').style.display = 'block';
    });

    // 点击设置里的列表项
    document.querySelectorAll('.settings-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('settingsMainPage').style.display = 'none';
            document.getElementById('settingsSubPage').style.display = 'flex';
            
            // 简单改个标题，确认点进去了
            const pageName = item.querySelector('span').innerText;
            document.getElementById('subPageTitle').innerText = pageName;
        });
    });

    // 返回桌面的设置项（这里先预留，以后加回到桌面的按钮，现在点左上角返回就行）
});
