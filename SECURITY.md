# Security

## What CalcShelf can and can't do

CalcShelf is an offline app. It asks Android for **no permissions**, so it can't use the internet, your contacts, your location, the camera or the microphone.

- **Everything stays on the phone.** Your documents, settings, and the calculator OS files or ROMs you load are kept in the app's private storage.
- **No network.** A content security policy on every page allows only the app's own files to load. Nothing can be fetched from another site or sent to one, and scripts can't be injected.
- **Links** in the Guide & manuals tab open in your phone's browser. Only web links (http and https) are opened; any other kind of link is blocked.
- **Files you save** (backups, CSV exports, screenshots) go to Downloads/TI-89. A file name is always reduced to a plain name, so a file can't be written anywhere else.
- **Files you open** (backups, OS files, ROMs, calculator programs) are read by the app's own code or by the emulator cores, which run as WebAssembly inside the app's web view.
- **The CAS** (Giac) runs in secure mode, in a separate worker, with no access to files.
- **The emulator pages** exchange messages with the app only, and check where every message comes from.
- **Modules** are data only: a JSON file with formulas, calculators, tables, constants and text. CalcShelf draws every screen itself, shows Markdown text without any HTML, and opens only https:// links, in the browser. Before a module's expression goes to the CAS, CalcShelf checks that it only computes: no assignment, strings, loops, programs, settings, files or input and output, and a 10-second limit. A module's inputs get private names, so it can't change your variables. The app never downloads modules; your browser does, and you import the file.
- **Formulas from backups or files** are rendered by MathLive with its HTML-styling commands removed. HTML in them is shown as text, never run.

## Restoring a backup someone else made

A backup restores tabs, history, variables and definitions. They are calculator data, and are shown and evaluated as such. Still, only restore backups from people you trust, as with any file.

## Checked for 2.7.6

- **Modules:** a module with an assignment, a blocked command, HTML or a non-https link is refused, or the HTML and link are left out (tests/modules276.py).

## Checked for 2.7.5

- **MathLive 0.111.1** includes the fixes for CVE-2025-29049 and CVE-2026-54705, the cross-site-scripting problems fixed in MathLive 0.104.0 and 0.110.0.
- **The repository history** contains no signing keys or passwords. `build_apk.sh` reads them from environment variables.
- **The bundled test ROMs** in `core-build/tz80/test` contain only CalcShelf's own few dozen bytes of test code, built from the `.asm` sources next to them, and no TI code.

## Reporting a problem

Please open an issue at https://github.com/netadmindave/CalcShelf/issues. If the problem shouldn't be public before it is fixed, use **Security → Report a vulnerability** on the repository page, which opens a private advisory.
