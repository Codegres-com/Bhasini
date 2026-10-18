const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Native helper published by package-app.js. Executables cannot run from inside app.asar,
// so electron-builder unpacks it (see "asarUnpack" in package.json).
const HELPER_PATH = path
  .join(__dirname, 'app', 'global-keyboard', 'BhasiniGlobalKeyboard.exe')
  .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

const MAX_RESTARTS = 3;
const METHODS = ['Phonetic', 'Inscript'];

/**
 * Global (Direct Type) keyboard: drives BhasiniGlobalKeyboard.exe, which hooks the keyboard
 * system-wide so F9 switches every application (browser, Word, Excel, ...) to the selected
 * Indian language.
 *
 * Emits 'state' with { available, enabled, language, method } whenever anything changes.
 * `languages` lists { code, name, nativeName, inscript } as reported by the helper.
 */
class GlobalKeyboard extends EventEmitter {
  constructor({ language = 'hi', method = 'Phonetic' } = {}) {
    super();
    this.state = { available: false, enabled: false, language, method };
    this.languages = [];
    this.child = null;
    this.restarts = 0;
    this.stopping = false;
  }

  start() {
    if (process.platform !== 'win32' || !fs.existsSync(HELPER_PATH)) {
      console.warn(`Global keyboard helper not found at ${HELPER_PATH}; Global mode disabled.`);
      return;
    }

    const args = ['--host-pid', String(process.pid), '--language', this.state.language, '--method', this.state.method];
    if (this.state.enabled) args.push('--enabled');

    const child = spawn(HELPER_PATH, args, { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    this.child = child;
    child.stdout.setEncoding('utf8');

    readline.createInterface({ input: child.stdout }).on('line', (line) => this._onLine(line));

    child.on('error', (err) => console.error('Global keyboard helper failed to start:', err));
    child.on('exit', (code) => {
      this.child = null;
      this._setState({ available: false });
      if (!this.stopping && code !== 2 && this.restarts < MAX_RESTARTS) {
        this.restarts++;
        console.warn(`Global keyboard helper exited (${code}); restarting.`);
        setTimeout(() => this.start(), 1000);
      }
    });
  }

  stop() {
    this.stopping = true;
    if (this.child) {
      this._send('exit');
      this.child.stdin.end();
    }
  }

  toggle() {
    this._send('toggle');
  }

  setEnabled(enabled) {
    this._send(enabled ? 'enable' : 'disable');
  }

  setLanguage(code) {
    if (!/^[A-Za-z-]+$/.test(code || '') || code === 'en') return;
    this._send(`language ${code}`);
  }

  setMethod(method) {
    if (!METHODS.includes(method)) return;
    this._send(`method ${method}`);
  }

  languageInfo(code = this.state.language) {
    return this.languages.find((l) => l.code === code);
  }

  _send(command) {
    if (this.child && this.child.stdin.writable) {
      this.child.stdin.write(`${command}\n`);
    }
  }

  _onLine(line) {
    const trimmed = line.trim();
    const space = trimmed.indexOf(' ');
    const type = space < 0 ? trimmed : trimmed.slice(0, space);
    const rest = space < 0 ? '' : trimmed.slice(space + 1);

    if (type === 'lang') {
      const [code, name, nativeName, inscript] = rest.split('\t');
      if (!this.languages.some((l) => l.code === code)) {
        this.languages.push({ code, name, nativeName, inscript: inscript === '1' });
      }
    } else if (type === 'state') {
      const [enabled, language, method] = rest.split(' ');
      this._setState({ available: true, enabled: enabled === 'on', language, method });
    } else if (type === 'error') {
      console.error('Global keyboard helper error:', rest);
    }
  }

  _setState(changes) {
    const previous = this.state;
    this.state = { ...previous, ...changes };
    this.emit('state', this.state, previous);
  }
}

module.exports = { GlobalKeyboard };
