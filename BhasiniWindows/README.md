# Bhasini for Windows

Desktop packaging of [Bhasini](../README.md) for Windows 10 and 11 (64-bit). It wraps the Blazor
WebAssembly editor in Electron, served from a local loopback server, and adds **Global mode**:
type any of the 22 Indian languages in every application with **F9**.

Modelled on `KannadaNudiEditor/KannadaNudiWindows`.

## Global mode (Direct Type)

Press **F9** anywhere (browser, Word, Excel, Notepad, WhatsApp Desktop, …) to switch the whole
system between English and the selected Indian language. It uses the same phonetic and InScript
keys as the editor.

- The language and keyboard follow the editor's choice. They can also be changed from the tray
  icon: **Language** submenu, **Phonetic / InScript keyboard**.
- A small click-through toast in the bottom-right corner shows the current Global mode language
  and pulses when F9 switches it.
- Closing the editor keeps Bhasini in the tray so F9 keeps working. Use **Quit** in the tray menu
  to exit. **Start with Windows** is in the tray menu for non-Store builds.
- Implemented by `GlobalKeyboard/`, a small .NET 8 helper with a low-level keyboard hook. It
  references `src/Bhasini.Core`, so it types exactly what the editor would.
- Windows does not let a normal app type into windows running as Administrator, so Global mode
  has no effect there.

## Build

Prerequisites: .NET 8 SDK, Node.js 18+, Python 3 with Pillow (only to regenerate images).

```bash
npm install
```

```bash
npm run dist:appx
```

| Command | Output in `dist/` |
| :--- | :--- |
| `npm run dist:appx` | `Bhasini-<version>-Store.appx` for Microsoft Store upload (unsigned; the Store signs it) |
| `npm run dist:nsis` | `Bhasini-Setup-<version>.exe` installer |
| `npm run dist:portable` | `Bhasini-Portable-<version>.exe` |
| `npm run dist:unpacked` | `win-unpacked/Bhasini.exe` |
| `npm run dist` | all of the above plus a zip |

`npm run package` publishes the web app and the helper into `app/`. Every `dist:*` script runs it
first.

`npm run assets` regenerates `icon.ico`, `icon.png` and the Store tile images in `build/appx/`
from `branding/icon.html` and `branding/tile.html`.

## Microsoft Store identity

`package.json` → `build.appx` must match **Partner Center → your app → Product identity**:

| package.json | Partner Center field |
| :--- | :--- |
| `identityName` | Package/Identity/Name |
| `publisher` | Package/Identity/Publisher |
| `publisherDisplayName` | Package/Properties/PublisherDisplayName |
| `displayName` | the reserved app name |

Bump `version` in `package.json` for every Store submission; the AppX version is `<version>.0`.
