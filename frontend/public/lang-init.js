// Set <html lang> from the stored preference before first paint, so the page
// never flashes the wrong language. Externalized from an inline <script> so the
// CSP can forbid inline script entirely (script-src 'self', no 'unsafe-inline').
(function () {
    try {
        let lang = localStorage.getItem('nodus-lang') || 'en';
        if (lang === 'zh-TW') lang = 'zh';
        document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : (lang === 'ja' ? 'ja' : 'en');
    } catch (e) {
        document.documentElement.lang = 'en';
    }
})();
