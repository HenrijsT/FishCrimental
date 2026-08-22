# Third-party notices

FishCrimental includes and depends on the software below. Each is used under
its own licence, reproduced here as those licences require. This file does not
change the licence of FishCrimental itself — see `LICENSE`.

## Shipped in the built game

Exactly one third-party package ends up in the bundle a player runs.

### break_eternity.js 2.1.3 — MIT

```
MIT License

Copyright (c) 2019 Timothy Stiles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Svelte — MIT

Svelte compiles to plain JavaScript, so a small amount of Svelte's own runtime
is included in the build. Svelte is © the Svelte contributors, under the MIT
licence: https://github.com/sveltejs/svelte/blob/main/LICENSE.md

### Fonts — SIL Open Font License 1.1

Self-hosted in `static/fonts/`, latin subset, and served from the game's own
origin. Nothing is fetched at runtime: the game is a static bundle that has to
work with no network, so a webfont CDN would be a dependency it could not
honour.

| Font             | Used by                        | Copyright                         |
| ---------------- | ------------------------------ | --------------------------------- |
| Barlow Condensed | the instrument panel, headings | © The Barlow Project Authors      |
| IBM Plex Mono    | both front-ends, all figures   | © IBM Corp.                       |
| Young Serif      | the Logbook, masthead          | © The Young Serif Project Authors |
| Spectral         | the Logbook, body text         | © Productype Foundry              |
| Courier Prime    | the Logbook, figures           | © Quote-Unquote Apps              |

All five are licensed under the **SIL Open Font License, Version 1.1**. The OFL
permits bundling and redistribution with a work, including a commercial one,
provided the fonts are not sold on their own and any modified version is not
released under the reserved font name. **They are shipped unmodified.** Full
licence text: <https://openfontlicense.org>

A Steam or desktop build must ship this notice alongside the fonts.

## Build and development tooling only

These do not ship in the game. They are listed for completeness, because a
distributed build is produced with them.

| Package                                                                     | Licence    |
| --------------------------------------------------------------------------- | ---------- |
| `@sveltejs/kit`, `@sveltejs/adapter-static`, `@sveltejs/vite-plugin-svelte` | MIT        |
| `vite`, `vitest`, `eslint`, `prettier`, `postcss`, `autoprefixer`           | MIT        |
| `typescript`, `@lhci/cli`                                                   | Apache-2.0 |
| `tslib`                                                                     | 0BSD       |
| `lightningcss` (via Vite)                                                   | MPL-2.0    |
| `axe-core` (via `@lhci/cli`)                                                | MPL-2.0    |

A scan of all 651 installed packages found **no GPL, LGPL or AGPL dependency
anywhere in the tree**. The only reciprocal licence present is MPL-2.0, which
is file-level copyleft: it obliges you to publish changes to _those files_, and
imposes nothing on the rest of the project. Neither MPL package is modified
here, and neither ships in the game.

Full breakdown of the installed tree: 506 MIT, 52 Apache-2.0, 49 ISC,
19 BSD-2-Clause, 12 BSD-3-Clause, 4 MPL-2.0, 3 0BSD, 2 CC-BY-4.0,
1 Python-2.0, 1 CC0-1.0, 1 BlueOak-1.0.0, 1 BSD.

## If the game is shipped as a desktop binary

Shipping a Tauri or Electron build adds that framework's dependencies, which
are not in this tree. Re-run the scan and extend this file before any
distribution. A Steam release should include this file in the installed game
directory or in an in-game credits screen.
