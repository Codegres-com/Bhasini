// Dictation through the browser's Web Speech API (Chrome and Edge support most Indian locales).
window.bhasini = window.bhasini || {};

window.bhasini.speech = {
    recognition: null,
    dotNet: null,
    wanted: false,

    isSupported: function () {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    start: function (locale, dotNetRef) {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return;

        this.stop();
        this.dotNet = dotNetRef;
        this.wanted = true;

        const rec = this.recognition = new Recognition();
        rec.lang = locale;
        rec.continuous = true;
        rec.interimResults = false;

        rec.onstart = () => dotNetRef.invokeMethodAsync('OnSpeechState', true, null);
        rec.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const text = event.results[i][0].transcript.trim();
                    if (text) dotNetRef.invokeMethodAsync('OnSpeechResult', text);
                }
            }
        };
        rec.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            this.wanted = false;
            dotNetRef.invokeMethodAsync('OnSpeechState', false, event.error);
        };
        rec.onend = () => {
            // Chrome ends continuous sessions after a pause; keep listening until stopped.
            if (this.wanted && this.recognition === rec) {
                try { rec.start(); return; } catch { }
            }
            dotNetRef.invokeMethodAsync('OnSpeechState', false, null);
        };

        try {
            rec.start();
        } catch (err) {
            this.wanted = false;
            dotNetRef.invokeMethodAsync('OnSpeechState', false, String(err && err.message || err));
        }
    },

    stop: function () {
        this.wanted = false;
        if (this.recognition) {
            try { this.recognition.stop(); } catch { }
        }
    }
};
