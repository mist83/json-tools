# Agent Handoff — JsonUtilities Demo UI

**Last updated:** 2026-03-31  
**Status:** UI is migrated to `ui.mikesendpoint.com`, local `.NET` tests and local Puppeteer E2E are green, and the latest follow-up fixed cached-tab hash/event sync plus the mobile header badge overflow.

---

## What This Repo Is

A high-performance C# .NET 8 JSON scanning library with an interactive demo UI.

- **Core library:** `src/JsonUtilities/` — byte-range scanning, path extraction, trie indexing, semantic search
- **Demo API:** `src/JsonUtilitiesDemo/` — ASP.NET Core Lambda API serving the UI and Swagger
- **Demo UI:** `index.html` + `app.js` + `plugin-registry.js` + `data-generator.js` + `tabs/`
- **Tests:** `tests/JsonUtilities.Tests/` — 117 xUnit tests, all passing
- **E2E tests:** `e2e/` — Puppeteer suite targeting the running demo

**Run locally:**
```bash
dotnet run --project src/JsonUtilitiesDemo/JsonUtilitiesDemo.csproj --urls http://localhost:5968
# UI at http://localhost:5968
# Swagger at http://localhost:5968/swagger
```

**Run .NET tests:**
```bash
dotnet test  # Passed! 117/117
```

**Run E2E tests:**
```bash
cd e2e && npm install
BASE_URL=http://localhost:5968 node tests/run.js
```

---

## UI Architecture (Current State)

### What Changed (this session)

The UI was migrated from a monolithic `index.html` to the canonical `ui.mikesendpoint.com` framework:

| Before | After |
|--------|-------|
| `ui.mullmania.com/active/style.css` | `ui.mikesendpoint.com/active/style.css` |
| No `ui.js` | `ui.mikesendpoint.com/js/ui.js` (TabsEverywhere) |
| All HTML in one `index.html` | Shell `index.html` + `tabs/home.html`, `tabs/tools.html`, `tabs/about.html` |
| Hand-rolled tab switching | TabsEverywhere framework |
| Inline `style=` everywhere | Canonical utility classes |

Follow-up fixes in the current pass:

- Cached `htmlSource` tabs now dispatch `tabs-everywhere:tab-changed` and update the URL hash even when the DOM is reused from cache.
- The header badge row now reflows cleanly on narrower viewports instead of clipping off-screen.

### How TabsEverywhere Works (Critical for E2E)

TabsEverywhere is **not** a simple tab switcher. It:

1. Renders tab buttons into `#tabs-container` with `id="tab-{id}"` and `data-tab-id="{id}"`
2. Fetches tab HTML from `htmlSource` URLs (e.g. `/tabs/home.html`)
3. Wraps injected HTML in `<div data-tab-id="{id}" class="display-block">` (active) or `class="display-none"` (inactive)
4. **Caches** loaded tabs — once loaded, the DOM stays, only visibility toggles
5. Fires `tabs-everywhere:tab-changed` event when a tab loads

**DOM structure after tools tab loads:**
```html
#content-container
  <div data-tab-id="home" class="display-none" style="display:none">
    <div class="tab-scrollable-content">
      <!-- home.html content injected here -->
      <div id="content-home">...</div>
    </div>
  </div>
  <div data-tab-id="tools" class="display-block" style="display:block">
    <div class="tab-scrollable-content">
      <!-- tools.html content injected here -->
      <div class="layout sidebar-content" id="tools-layout">
        <div class="sidebar" id="tools-sidebar">...</div>
        <div class="content">...</div>
      </div>
    </div>
  </div>
```

**Key selectors:**
- Tab buttons: `#tab-home`, `#tab-tools`, `#tab-about` (also have `data-tab-id`)
- Active tab button: `.tab.active` or `#tab-tools.active`
- Active content wrapper: `[data-tab-id="tools"].display-block`
- Tools sidebar: `#tools-sidebar` (only exists after tools tab is first loaded)
- Tool panels: `#tool-byte-range`, `#tool-path-extract`, etc.

### Local JS Files

`ui.js` detects `localhost` and loads sub-scripts from `/js/` on the local server instead of from `ui.mikesendpoint.com`. The files are checked in at `js/`:

```
js/modals.js
js/tabs.js
js/toasts.js
js/tables.js
js/cards.js
```

These are snapshots from `ui.mikesendpoint.com/js/`. If the canonical framework updates, re-download:
```bash
for f in modals.js tabs.js toasts.js tables.js cards.js; do
  curl -s "https://ui.mikesendpoint.com/js/$f" -o "js/$f"
done
```

### window.UI.tabs

`window.UI.tabs` must be set to the `TabsEverywhere` instance BEFORE `init()` is called, because the hashchange handler fires during init and calls `window.UI.tabs.loadTab(...)`. This is done in `index.html`:

```js
window.UI.tabs = window._tabsEverywhere;  // set BEFORE init()
await window._tabsEverywhere.init();
```

---

## E2E Test Status

### Current Local Result

- `dotnet test` passes locally: `117/117`
- `BASE_URL=http://localhost:5968 node tests/run.js` passes locally: `148/148`
- Browser follow-up still worth keeping: reload/hash navigation and mobile layout should remain part of future smoke coverage because those were the two most recent regressions

---

## App.js Tab Event Wiring

`app.js` listens for `tabs-everywhere:tab-changed` to re-initialize tab-specific JS after dynamic content injection:

```js
document.addEventListener('tabs-everywhere:tab-changed', (e) => {
    const tabId = e.detail && e.detail.tabId;
    onTabLoaded(tabId);
});
```

`onTabLoaded` calls:
- `refreshExecutionModeUI()` — updates the mode badge and select
- `refreshHomeStatus()` — updates the dataset status banner
- `refreshSidebarLabel()` — updates sidebar dataset label
- `refreshNoDataBanner()` — shows/hides the no-data warning
- `initHome()` — wires file upload and drag-drop (home tab only)
- `initTrieLiveSearch()` — wires the trie search input debounce (tools tab only)

---

## WASM Status

No Blazor/WebAssembly code exists. The handoff plan is at `docs/blazor-wasm/README.md`. The current "Browser Preview" mode is a JavaScript mirror of the API contract — not real C# in the browser.

---

## Deployment

- **Live demo:** https://json-utilities.mullmania.com
- **API:** Lambda URL in `plugin-registry.js` (`API_BASE`)
- **Static files:** S3 + CloudFront (see `docs/` for deployment notes)

The `.NET` app serves static files from the repo root (where `index.html` lives). The `tabs/` and `js/` directories are served automatically.

---

## Canonical UI Reference

- **Style guide:** https://ui.mikesendpoint.com/llm-docs.md
- **CSS:** `https://ui.mikesendpoint.com/active/style.css`
- **JS bundle:** `https://ui.mikesendpoint.com/js/ui.js`
- **Canon rules:** https://gist.githubusercontent.com/mist83/eebea7c7f0e5347928c0d45ef98a730b/raw/canon-compiled.md

Key rules:
- CSS Grid only, no Flexbox
- No inline styles — use canonical utility classes
- No custom CSS — use framework classes
- Tabler Icons only (no emojis, no Font Awesome)
- Vanilla JS only

---

## File Map

```
index.html              Shell — TabsEverywhere init, header, CSS/JS imports
app.js                  All frontend logic — tab events, tool runners, browser transport
plugin-registry.js      Pluggable engines: MatchEngine, Tokenizer, DataGenerator, ApiTransport
data-generator.js       Fake data generators for ecommerce/movies/blog/employees
tabs/
  home.html             Home tab — dataset loading (paste/upload/generate)
  tools.html            Tools tab — sidebar + 5 tool panels
  about.html            About tab — feature cards, quick start, test badge
js/
  modals.js             ModalsEverywhere (from ui.mikesendpoint.com)
  tabs.js               TabsEverywhere (from ui.mikesendpoint.com)
  toasts.js             ToastsEverywhere
  tables.js             TablesEverywhere
  cards.js              CardsEverywhere
e2e/
  tests/
    helpers.js          Shared Puppeteer helpers — switchTab, waitForAppReady, etc.
    run.js              Test runner
    suite-*.js          Test suites (one per feature area)
src/
  JsonUtilities/        Core library
  JsonUtilitiesDemo/    ASP.NET Core API + static file host
tests/
  JsonUtilities.Tests/  117 xUnit tests
docs/
  blazor-wasm/README.md WASM handoff plan
  agent-handoff.md      This file
```
