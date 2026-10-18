const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_CSPROJ = path.join(ROOT_DIR, 'src', 'Bhasini.Web', 'Bhasini.Web.csproj');
const WEB_PUBLISH_DIR = path.join(__dirname, 'obj', 'web-publish');
const WEB_PUBLISH_WWWROOT = path.join(WEB_PUBLISH_DIR, 'wwwroot');
const WIN_APP_DIR = path.join(__dirname, 'app');
const WIN_WWWROOT = path.join(WIN_APP_DIR, 'wwwroot');
const GLOBAL_KEYBOARD_CSPROJ = path.join(__dirname, 'GlobalKeyboard', 'BhasiniGlobalKeyboard.csproj');
const GLOBAL_KEYBOARD_OUT = path.join(WIN_APP_DIR, 'global-keyboard');

function run(command, cwd) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

console.log('==============================================');
console.log('  Packaging Bhasini into a Windows application ');
console.log('==============================================');

console.log('\n[1/4] Publishing the Bhasini Blazor WebAssembly app (Release)...');
fs.rmSync(WEB_PUBLISH_DIR, { recursive: true, force: true });
run(`dotnet publish "${WEB_CSPROJ}" -c Release -o "${WEB_PUBLISH_DIR}"`, ROOT_DIR);

console.log('\n[2/4] Cleaning previous app directory...');
fs.rmSync(WIN_APP_DIR, { recursive: true, force: true });
fs.mkdirSync(WIN_APP_DIR, { recursive: true });

console.log('\n[3/4] Copying published site to BhasiniWindows/app/wwwroot...');
fs.cpSync(WEB_PUBLISH_WWWROOT, WIN_WWWROOT, { recursive: true });

console.log('\n[4/4] Publishing the Global Keyboard helper (F9 system-wide typing)...');
run(`dotnet publish "${GLOBAL_KEYBOARD_CSPROJ}" -c Release -o "${GLOBAL_KEYBOARD_OUT}" -p:DebugType=none`, path.dirname(GLOBAL_KEYBOARD_CSPROJ));

const essentialFiles = [
  path.join(GLOBAL_KEYBOARD_OUT, 'BhasiniGlobalKeyboard.exe'),
  path.join(WIN_WWWROOT, 'index.html'),
  path.join(WIN_WWWROOT, '_framework', 'blazor.webassembly.js'),
  path.join(WIN_WWWROOT, 'js', 'editor.js'),
  path.join(WIN_WWWROOT, 'lib', 'quill', 'quill.js'),
  path.join(WIN_WWWROOT, 'lib', 'bootstrap', 'bootstrap.min.css'),
  path.join(WIN_WWWROOT, 'lib', 'docshift', 'docshift.min.js'),
  path.join(WIN_WWWROOT, 'lib', 'mammoth', 'mammoth.browser.min.js'),
];

const missing = essentialFiles.filter((file) => !fs.existsSync(file));
if (missing.length > 0) {
  missing.forEach((file) => console.error(`Missing expected file: ${file}`));
  process.exit(1);
}

console.log('\n[SUCCESS] Bhasini packaged into BhasiniWindows/app.');
