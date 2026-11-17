/* Philos 小修：字卡库菜单层级、小组件图片放大 */
(function () {
    "use strict";

    function injectStyles() {
        if (document.getElementById("philos-fixes-style")) return;
        var st = document.createElement("style");
        st.id = "philos-fixes-style";
        st.textContent =
            /* 字卡库右上角「三个点」的导入/导出菜单要压在二级界面之上 */
            ".cards-menu{z-index:30 !important;}" +
            "#cardsView .cards-menu{z-index:30 !important;}" +
            /* 小组件：双头像纪念日（A）——头像更大、留白更少 */
            ".ws-a{padding:8px !important;gap:6px !important;}" +
            ".ws-a-title{font-size:10.5px !important;margin-bottom:1px;}" +
            ".ws-a-row{gap:7px !important;}" +
            ".ws-a-avatar{width:58px !important;height:58px !important;}" +
            ".ws-a-days{font-size:19px !important;}" +
            /* 小组件：黑胶唱片（B）——唱片更大 */
            ".ws-b{padding:8px !important;gap:6px !important;}" +
            ".ws-b-title{font-size:10.5px !important;}" +
            ".ws-b-card{width:104px !important;height:104px !important;}" +
            /* C 模板顶部大图稍高一点 */
            ".ws-c-img{height:56% !important;}";
        document.head.appendChild(st);
    }

    function fixMenu() {
        var menu = document.getElementById("cardsMenu");
        if (!menu) return;
        if (menu.style.zIndex !== "30") menu.style.zIndex = "30";
    }

    function tick() {
        if (document.hidden) return;
        injectStyles();
        fixMenu();
    }

    function init() {
        injectStyles();
        fixMenu();
        setInterval(tick, 1500);
        window.addEventListener("focus", tick);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else setTimeout(init, 0);
})();
