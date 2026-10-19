// "Install Bhasini" prompt, shown on every page load until the app is installed.
// - Android: a one-tap Install button when the browser offers it (beforeinstallprompt), menu steps otherwise.
// - iPhone and iPad: Add to Home Screen steps.
// - Windows browsers: a link to the Bhasini app in the Microsoft Store (it types in every app with F9).
// Not shown on other desktops, inside the installed web app, or in the Windows app itself. It is a
// small banner, not a full-screen interstitial, so it doesn't cover the page for readers or search engines.
(function () {
    'use strict';

    var standalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        window.navigator.standalone === true;
    var ua = navigator.userAgent;
    // iPadOS reports itself as a Mac, so also check for touch.
    var isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    var isWindows = !isAndroid && /Windows NT/.test(ua);
    if (standalone || window.bhasiniDesktop || !(isIos || isAndroid || isWindows)) return;

    var STORE_URL = 'https://apps.microsoft.com/detail/9P7SKZ1P9RN8';

    var deferred = null; // the browser's install prompt, once it offers one
    var banner = null;
    var dismissed = false;

    var css = [
        '#install-banner{position:fixed;z-index:1080;left:50%;bottom:16px;transform:translate(-50%,140%);',
        'width:min(420px,calc(100vw - 24px));box-sizing:border-box;display:flex;gap:12px;align-items:center;',
        'padding:12px 12px 12px 14px;background:#fff;color:#222;border-radius:14px;',
        'box-shadow:0 10px 30px rgba(31,42,92,.22);border:1px solid #e3ded2;',
        "font-family:'Poppins','Nirmala UI',system-ui,sans-serif;transition:transform .35s ease}",
        '#install-banner.show{transform:translate(-50%,0)}',
        '#install-banner img{width:44px;height:44px;border-radius:10px;flex-shrink:0}',
        '#install-banner .ib-text{flex:1;min-width:0;line-height:1.35}',
        '#install-banner .ib-title{font-weight:600;font-size:.95rem;color:#1f2a5c}',
        '#install-banner .ib-sub{font-size:.8rem;color:#6b6f80}',
        '#install-banner .ib-install{border:0;border-radius:10px;padding:9px 14px;font-weight:600;font-size:.9rem;',
        'background:#f07b2b;color:#fff;cursor:pointer;white-space:nowrap;text-decoration:none}',
        '#install-banner .ib-install[hidden]{display:none}',
        '#install-banner.ib-desktop{left:auto;right:20px;bottom:20px;transform:translateY(140%)}',
        '#install-banner.ib-desktop.show{transform:translateY(0)}',
        '#install-banner .ib-install:focus-visible,#install-banner .ib-close:focus-visible{outline:2px solid #1f2a5c;outline-offset:2px}',
        '#install-banner .ib-close{border:0;background:none;color:#6b6f80;font-size:1.3rem;line-height:1;',
        'padding:6px;cursor:pointer;align-self:flex-start}',
        '@media (max-width:640px){#install-banner{bottom:calc(10px + env(safe-area-inset-bottom))}}',
        '@media (prefers-reduced-motion:reduce){#install-banner{transition:none}}'
    ].join('');

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    }

    function subtitle() {
        if (isWindows) return 'Type 22 Indian languages in Word, WhatsApp and every app with F9.';
        if (deferred) return 'One tap to type in 22 Indian languages, right from your home screen.';
        if (isIos) return 'Tap Share → "Add to Home Screen" to install.';
        return 'Open your browser menu and choose "Install app" or "Add to Home screen".';
    }

    function render() {
        if (!banner) return;
        banner.querySelector('.ib-sub').textContent = subtitle();
        banner.querySelector('.ib-install').hidden = !isWindows && !deferred;
    }

    function hide() {
        dismissed = true;
        if (!banner) return;
        banner.classList.remove('show');
        var b = banner;
        setTimeout(function () { b.remove(); }, 400);
        banner = null;
    }

    function show() {
        if (dismissed || banner) return;
        var style = el('style');
        style.textContent = css;
        document.head.appendChild(style);

        banner = el('div', isWindows ? 'ib-desktop' : '');
        banner.id = 'install-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'install-banner-title');

        var icon = el('img');
        icon.src = 'icon-192.png';
        icon.alt = '';

        var text = el('div', 'ib-text');
        var title = el('div', 'ib-title', isWindows ? 'Get Bhasini for Windows' : 'Install the Bhasini app');
        title.id = 'install-banner-title';
        text.appendChild(title);
        text.appendChild(el('div', 'ib-sub'));

        var install;
        if (isWindows) {
            install = el('a', 'ib-install', 'Get the app');
            install.href = STORE_URL;
            install.target = '_blank';
            install.rel = 'noopener';
            install.addEventListener('click', function () { setTimeout(hide, 0); });
        } else {
            install = el('button', 'ib-install', 'Install');
            install.type = 'button';
            install.addEventListener('click', function () {
                if (!deferred) return;
                var prompt = deferred;
                deferred = null;
                prompt.prompt();
                prompt.userChoice.then(hide, hide);
            });
        }

        var close = el('button', 'ib-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Not now');
        close.addEventListener('click', hide);

        banner.appendChild(icon);
        banner.appendChild(text);
        banner.appendChild(install);
        banner.appendChild(close);
        document.body.appendChild(banner);
        render();
        // Read layout once so the slide-in transition runs (requestAnimationFrame pauses in background tabs).
        void banner.offsetHeight;
        banner.classList.add('show');
    }

    // On Windows the Store app is the better install (Global mode works in every app), so leave the
    // browser's own web-app install alone there.
    if (!isWindows) window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        render();
    });
    window.addEventListener('appinstalled', hide);

    // On phones, once someone taps into the editor to type, get out of the way of the on-screen keyboard.
    // (A tap, not focus: the editor focuses itself on load, which must not cancel the banner.)
    if (!isWindows) document.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('.ql-editor')) hide();
    }, true);

    // Let the page paint first, so the banner is the second thing people see, not the first.
    function schedule() { setTimeout(show, 2500); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
    else schedule();
})();
