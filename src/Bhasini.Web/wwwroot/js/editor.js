// Quill editor bridge. Every key is sent synchronously to the C# TypingSession, which answers
// with an edit ({ delete, insert }) to apply at the caret, or null to let the key through.
window.bhasini = window.bhasini || {};

window.bhasini.editor = {
    quill: null,
    dotNet: null,
    active: true,
    _applying: false,

    init: function (selector, dotNetRef) {
        this.dotNet = dotNetRef;
        const quill = this.quill = new Quill(selector, {
            theme: 'snow',
            placeholder: 'Start typing…',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }, { 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
                    [{ 'align': [] }, 'blockquote', 'link'],
                    ['clean']
                ]
            }
        });

        const root = quill.root;
        ['autocomplete', 'autocorrect', 'autocapitalize'].forEach(a => root.setAttribute(a, 'off'));
        root.setAttribute('spellcheck', 'false');
        root.setAttribute('data-gramm', 'false');

        // Desktop keyboards: the cancellable beforeinput carries the typed character.
        root.addEventListener('beforeinput', (e) => this._onBeforeInput(e), true);
        root.addEventListener('keydown', (e) => this._onKeyDown(e), true);
        root.addEventListener('paste', () => this._reset(), true);
        root.addEventListener('mousedown', () => this._reset(), true);
        root.addEventListener('touchstart', () => this._reset(), { passive: true, capture: true });

        // Mobile keyboards often insert text without a cancellable beforeinput: undo the raw
        // character and route it through the session instead.
        quill.on('text-change', (delta, oldDelta, source) => this._onTextChange(delta, source));
        quill.on('selection-change', (range, oldRange, source) => {
            if (source === 'user' && !this._applying) this._reset();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F9' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.repeat) {
                e.preventDefault();
                this.dotNet.invokeMethodAsync('OnToggleInput');
            }
        }, true);

        const copy = document.getElementById('btn-copy');
        if (copy) copy.addEventListener('click', () => this.copy());

        quill.focus();
    },

    _reset: function () {
        if (this.dotNet) this.dotNet.invokeMethod('OnReset');
    },

    _isAsciiKey: function (ch) {
        return ch.length === 1 && ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) < 0x7F;
    },

    _onBeforeInput: function (e) {
        if (!this.active || !e.cancelable) return;

        if (e.inputType === 'insertText' && e.data) {
            const chars = Array.from(e.data);
            // Text from an OS-level Indic keyboard is already in the right script.
            if (!chars.every(c => c.charCodeAt(0) < 0x80)) {
                this._reset();
                return;
            }
            e.preventDefault();
            chars.forEach(c => this._typeChar(c));
        } else if (e.inputType === 'deleteContentBackward') {
            const range = this.quill.getSelection();
            if (range && range.length > 0) { this._reset(); return; }
            const result = this.dotNet.invokeMethod('OnBackspace');
            if (result) {
                e.preventDefault();
                this._apply(result);
            }
        } else if (e.inputType !== 'insertCompositionText') {
            this._reset();
        }
    },

    _onKeyDown: function (e) {
        if (!this.active || e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Backspace') {
            const range = this.quill.getSelection();
            if (range && range.length > 0) { this._reset(); return; }
            const result = this.dotNet.invokeMethod('OnBackspace');
            if (result) {
                e.preventDefault();
                e.stopPropagation();
                this._apply(result);
            }
        } else if (['Enter', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(e.key)) {
            this._reset();
        }
    },

    _onTextChange: function (delta, source) {
        if (source !== 'user' || this._applying || !this.active) return;

        let index = 0;
        for (const op of delta.ops) {
            if (op.retain) { index += op.retain; continue; }
            if (typeof op.insert === 'string' && op.insert.length === 1 && this._isAsciiKey(op.insert)) {
                const ch = op.insert;
                const result = this.dotNet.invokeMethod('OnKey', ch);
                if (result) {
                    this.quill.deleteText(index, 1, 'silent');
                    this.quill.setSelection(index, 0, 'silent');
                    this._apply(result);
                }
                return;
            }
            break;
        }
        this._reset();
    },

    _typeChar: function (ch) {
        const range = this.quill.getSelection(true);
        if (range && range.length > 0) {
            this._reset();
            this.quill.deleteText(range.index, range.length, 'user');
            this.quill.setSelection(range.index, 0, 'silent');
        }
        const result = this._isAsciiKey(ch) ? this.dotNet.invokeMethod('OnKey', ch) : null;
        if (!result) this._reset();
        this._apply(result || { delete: 0, insert: ch });
    },

    _apply: function (result) {
        const quill = this.quill;
        this._applying = true;
        try {
            const range = quill.getSelection(true);
            let index = range ? range.index : quill.getLength() - 1;
            const formats = quill.getFormat(index, 0);
            const del = Math.min(result.delete || 0, index);
            if (del > 0) {
                quill.deleteText(index - del, del, 'user');
                index -= del;
            }
            if (result.insert) {
                quill.insertText(index, result.insert, formats, 'user');
                index += result.insert.length;
            }
            quill.setSelection(index, 0, 'silent');
        } finally {
            this._applying = false;
        }
    },

    setActive: function (active) {
        this.active = active;
    },

    setLanguage: function (lang) {
        const root = this.quill.root;
        root.className = root.className.split(' ').filter(c => !c.startsWith('script-')).join(' ');
        root.classList.add(lang.fontClass);
        root.setAttribute('lang', lang.code);
        root.setAttribute('dir', lang.rtl ? 'rtl' : 'ltr');
        root.classList.toggle('rtl', !!lang.rtl);
        this.active = lang.active;
    },

    focus: function () { if (this.quill) this.quill.focus(); },

    insertText: function (text) {
        this.quill.focus();
        this._apply({ delete: 0, insert: text });
    },

    undo: function () { this.quill.history.undo(); this._reset(); },
    redo: function () { this.quill.history.redo(); this._reset(); },

    copy: async function () {
        const range = this.quill.getSelection();
        const text = range && range.length > 0 ? this.quill.getText(range.index, range.length) : this.quill.getText();
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            document.execCommand('copy');
        }
    },

    getHtml: function () { return this.quill.root.innerHTML; },
    getText: function () { return this.quill.getText(); },

    setHtml: function (html) {
        this.quill.setContents([], 'silent');
        this.quill.clipboard.dangerouslyPasteHTML(0, html, 'api');
    },

    setText: function (text) { this.quill.setText(text, 'api'); },

    getSelectedText: function () {
        const range = this.quill.getSelection();
        return range && range.length > 0 ? this.quill.getText(range.index, range.length) : '';
    },

    replaceSelection: function (text) {
        const range = this.quill.getSelection(true);
        if (!range) return;
        this.quill.deleteText(range.index, range.length, 'api');
        this.quill.insertText(range.index, text, 'api');
        this.quill.setSelection(range.index + text.length, 0, 'api');
    }
};

window.bhasini.files = {
    download: function (filename, content, type) {
        const url = URL.createObjectURL(new Blob([content], { type: type }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    saveDocx: async function (filename, html) {
        const blob = await window.docshift.toDocx(html);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    docxToHtml: async function (bytes) {
        const result = await window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        return result.value;
    }
};

// Bridge to the Windows app's Global (Direct Type) keyboard. `window.bhasiniDesktop` is exposed
// by BhasiniWindows/preload.js; in a normal browser it is absent and these calls do nothing.
window.bhasini.desktop = {
    _bridge: function () {
        return window.bhasiniDesktop && window.bhasiniDesktop.globalKeyboard;
    },

    // Returns { available, enabled, language, method } in the desktop app, or null in a browser.
    init: async function (dotNetRef) {
        const bridge = this._bridge();
        if (!bridge) return null;
        bridge.onStateChanged((state) => dotNetRef.invokeMethodAsync('OnGlobalKeyboardState', state));
        return await bridge.getState();
    },

    toggle: function () { const b = this._bridge(); if (b) b.toggle(); },
    setLanguage: function (code) { const b = this._bridge(); if (b) b.setLanguage(code); },
    setMethod: function (method) { const b = this._bridge(); if (b) b.setMethod(method); }
};

window.bhasini.storage = {
    key: 'bhasini.settings.v1',
    load: function () {
        try {
            const raw = localStorage.getItem(this.key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
    save: function (settings) {
        try { localStorage.setItem(this.key, JSON.stringify(settings)); } catch { }
    }
};

// Landing pages: when the language changes, bring in the text of that language's page (built by
// tools/Bhasini.SiteGen) without reloading the app. Returns false when there is no such page,
// e.g. under `dotnet run`, where nothing was generated.
window.bhasini.site = {
    load: async function (path) {
        try {
            const current = document.querySelector('.site-content');
            if (!current) return false;
            const response = await fetch(path, { headers: { Accept: 'text/html' } });
            if (!response.ok) return false;
            const page = new DOMParser().parseFromString(await response.text(), 'text/html');
            const fresh = page.querySelector('.site-content');
            if (!fresh) return false;

            current.replaceWith(document.importNode(fresh, true));
            const selectors = [
                'meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:url"]',
                'meta[property="og:title"]', 'meta[property="og:description"]',
                'meta[name="twitter:title"]', 'meta[name="twitter:description"]',
            ];
            for (const selector of selectors) {
                const from = page.head.querySelector(selector);
                const to = document.head.querySelector(selector);
                if (!from || !to) continue;
                for (const attr of ['content', 'href']) {
                    if (from.hasAttribute(attr)) to.setAttribute(attr, from.getAttribute(attr));
                }
            }
            document.head.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove());
            page.head.querySelectorAll('script[type="application/ld+json"]').forEach(s => document.head.appendChild(document.importNode(s, true)));
            return true;
        } catch {
            return false;
        }
    }
};
