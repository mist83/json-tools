// JsonUtilities Demo — Frontend Application
// ─────────────────────────────────────────────────────────────────────────────
// Plugin registry (PluginRegistry) is loaded before this file via plugin-registry.js
// DataGenerator is loaded before this file via data-generator.js

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const LS_KEY = 'jsontools_active_data';
const LS_EXECUTION_MODE_KEY = 'jsontools_execution_mode';
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

// ── State ─────────────────────────────────────────────────────────────────────

let _activeDataset = null;       // { name, type, json, sizeBytes, loadedAt }
let _generatedJson = null;       // last generated JSON string (for download)
let _trieDebounce = null;
let _trieIndexed = false;
let _semanticFields = new Set();
let _executionMode = 'auto';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Initialize plugin registry with built-in data generators
    DataGenerator.init();
    initTabs();
    initHome();
    initTrieLiveSearch();
    loadExecutionMode();
    loadDatasetFromStorage();
    refreshExecutionModeUI();
    refreshHomeStatus();
    refreshSidebarLabel();
    // Start with sidebar hidden (Home tab is active)
    document.querySelector('.layout.sidebar-content').classList.add('no-sidebar');
});

// ── Tab Navigation ────────────────────────────────────────────────────────────

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.section').forEach(s =>
        s.classList.toggle('active', s.id === `content-${name}`));

    // Show/hide sidebar by toggling no-sidebar on the layout
    document.querySelector('.layout.sidebar-content').classList.toggle('no-sidebar', name !== 'tools');

    if (name === 'tools') refreshNoDataBanner();
}

// ── Tool Navigation (within Tools tab) ───────────────────────────────────────

function switchTool(name) {
    document.querySelectorAll('.sidebar-item[data-tool]').forEach(item =>
        item.classList.toggle('active', item.dataset.tool === name));
    document.querySelectorAll('.tool-panel').forEach(panel =>
        panel.classList.toggle('active', panel.id === `tool-${name}`));

    // Populate path suggestions when switching to path-extract
    if (name === 'path-extract' && _activeDataset) {
        renderPathSuggestions();
    }
    // Populate field chips when switching to semantic
    if (name === 'semantic' && _activeDataset) {
        renderSemanticFieldChips();
    }
}

// ── Execution Mode ────────────────────────────────────────────────────────────

function loadExecutionMode() {
    try {
        const stored = localStorage.getItem(LS_EXECUTION_MODE_KEY);
        if (stored) _executionMode = stored;
    } catch (e) { /* ignore */ }
    if (!['auto', 'localhost', 'browser', 'lambda'].includes(_executionMode)) {
        _executionMode = 'auto';
    }
    PluginRegistry.ApiTransport.setActive(_executionMode);
}

function setExecutionMode(mode) {
    _executionMode = mode;
    PluginRegistry.ApiTransport.setActive(mode);
    try {
        localStorage.setItem(LS_EXECUTION_MODE_KEY, mode);
    } catch (e) { /* ignore */ }
    refreshExecutionModeUI();
}

function refreshExecutionModeUI() {
    const select = document.getElementById('execution-mode');
    if (select) select.value = _executionMode;

    const status = document.getElementById('execution-mode-status');
    const badge = document.getElementById('execution-mode-badge');
    const info = getExecutionModeInfo();

    if (status) {
        status.innerHTML = `${info.description}<div style="margin-top:6px">${info.hint}</div>`;
    }
    if (badge) {
        badge.className = `status-badge ${info.badgeClass}`;
        badge.innerHTML = `<i class="${info.icon}"></i> ${escHtml(info.badgeLabel)}`;
    }
}

function getExecutionModeInfo() {
    switch (_executionMode) {
        case 'localhost':
            return {
                badgeLabel: 'Local API',
                badgeClass: 'status-warning',
                icon: 'ti ti-plug-connected',
                description: '<strong>Local API mode.</strong> The UI sends requests to <code>http://localhost:5968</code> so you can test the real .NET pipeline without deploying anything.',
                hint: 'Run <code>dotnet run --project src/JsonUtilitiesDemo/JsonUtilitiesDemo.csproj --urls http://localhost:5968</code>.'
            };
        case 'browser':
            return {
                badgeLabel: 'Browser Preview',
                badgeClass: 'status-enabled',
                icon: 'ti ti-lock',
                description: '<strong>Browser Preview mode.</strong> Data stays in this tab and no API calls are made. Great for sensitive JSON and fast curiosity-driven exploration.',
                hint: 'This mirrors the API contract in JavaScript. For exact C# hashing and server behavior, switch to Local API or Hosted API.'
            };
        case 'lambda':
            return {
                badgeLabel: 'Hosted API',
                badgeClass: 'status-info',
                icon: 'ti ti-cloud',
                description: '<strong>Hosted API mode.</strong> Requests go to the public demo backend, which runs the real .NET implementation.',
                hint: 'Use this when you want to compare local behavior with the published demo.'
            };
        default:
            return {
                badgeLabel: 'Auto mode',
                badgeClass: 'status-info',
                icon: 'ti ti-switch-3',
                description: '<strong>Auto mode.</strong> Localhost stays local and the public site stays hosted, so the safest default usually just works.',
                hint: 'On <code>localhost:5968</code> the UI uses the same origin. On other localhost ports it targets <code>http://localhost:5968</code>.'
            };
    }
}

// ── Dataset Management ────────────────────────────────────────────────────────

function setActiveDataset(dataset) {
    _activeDataset = dataset;
    try {
        // Store everything except very large JSON (>2MB) — store reference only
        const toStore = { ...dataset };
        if (dataset.json.length > 2 * 1024 * 1024) {
            toStore._oversized = true;
            toStore.json = dataset.json; // still store it, localStorage can handle ~5MB
        }
        localStorage.setItem(LS_KEY, JSON.stringify(toStore));
    } catch (e) {
        // localStorage full — just keep in memory
    }
    _trieIndexed = false;
    refreshHomeStatus();
    refreshSidebarLabel();
    refreshNoDataBanner();
}

function loadDatasetFromStorage() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) _activeDataset = JSON.parse(raw);
    } catch (e) { /* ignore */ }
}

function clearActiveDataset() {
    _activeDataset = null;
    _trieIndexed = false;
    localStorage.removeItem(LS_KEY);
    refreshHomeStatus();
    refreshSidebarLabel();
    refreshNoDataBanner();
}

function refreshSidebarLabel() {
    const label = document.getElementById('sidebar-dataset-label');
    if (!label) return;
    if (_activeDataset) {
        label.textContent = `${_activeDataset.name} (${fmtBytes(_activeDataset.sizeBytes)})`;
    } else {
        label.textContent = 'No data loaded';
    }
}

function refreshNoDataBanner() {
    const banner = document.getElementById('no-data-banner');
    if (!banner) return;
    banner.classList.toggle('visible', !_activeDataset);
}

function refreshHomeStatus() {
    const el = document.getElementById('home-active-status');
    if (!el) return;
    if (_activeDataset) {
        el.innerHTML = `<div class="alert alert-success" style="margin-bottom:var(--space-md)">
            <i class="ti ti-database"></i>
            <div>
                <strong>${escHtml(_activeDataset.name)}</strong> is the active dataset —
                ${fmtBytes(_activeDataset.sizeBytes)}, loaded ${new Date(_activeDataset.loadedAt).toLocaleTimeString()}
                <div style="margin-top:var(--space-xs)">
                    <button class="btn-link" onclick="switchTab('tools')"><i class="ti ti-tool"></i> Go to Tools</button>
                    &nbsp;·&nbsp;
                    <button class="btn-link" onclick="clearActiveDataset()"><i class="ti ti-trash"></i> Clear</button>
                </div>
            </div>
        </div>`;
    } else {
        el.innerHTML = `<div class="alert alert-info" style="margin-bottom:var(--space-md)">
            <i class="ti ti-info-circle"></i>
            <span>No active dataset. Paste, upload, or generate one below.</span>
        </div>`;
    }
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

function initHome() {
    // File upload
    const fileInput = document.getElementById('home-file-input');
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            document.getElementById('home-upload-status').innerHTML =
                alertBanner('error', `<i class="ti ti-x"></i> File too large (${fmtBytes(file.size)}). Max 5 MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            const json = ev.target.result;
            try {
                JSON.parse(json); // validate
                setActiveDataset({
                    name: file.name.replace('.json', ''),
                    type: 'upload',
                    json,
                    sizeBytes: new TextEncoder().encode(json).length,
                    loadedAt: Date.now()
                });
                document.getElementById('home-upload-status').innerHTML =
                    alertBanner('success', `<i class="ti ti-check"></i> Loaded <strong>${escHtml(file.name)}</strong>`);
            } catch {
                document.getElementById('home-upload-status').innerHTML =
                    alertBanner('error', '<i class="ti ti-x"></i> Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    });

    // Drag & drop
    const dropZone = document.getElementById('home-drop-zone');
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--color-primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer.files[0];
        if (file) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
    });
}

function loadFromPaste() {
    const json = document.getElementById('home-paste-json').value.trim();
    const name = document.getElementById('home-paste-name').value.trim() || 'Pasted JSON';
    if (!json) return;
    try {
        JSON.parse(json);
        setActiveDataset({
            name,
            type: 'paste',
            json,
            sizeBytes: new TextEncoder().encode(json).length,
            loadedAt: Date.now()
        });
    } catch {
        // Show error WITHOUT calling refreshHomeStatus() which would overwrite it
        document.getElementById('home-active-status').innerHTML =
            alertBanner('error', '<i class="ti ti-x"></i> Invalid JSON — check your input.');
    }
}

function generateDataset() {
    const type = document.getElementById('gen-type').value;
    const count = parseInt(document.getElementById('gen-count').value, 10);
    const statusEl = document.getElementById('gen-status');
    const downloadBtn = document.getElementById('btn-download-generated');

    statusEl.innerHTML = `<div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Generating ${count.toLocaleString()} records…</div>`;
    downloadBtn.classList.add('hidden');

    // Use setTimeout to let the spinner render before blocking JS
    setTimeout(() => {
        try {
            const data = DataGenerator.generate(type, count);
            const json = JSON.stringify(data, null, 2);
            _generatedJson = json;

            const typeLabel = document.getElementById('gen-type').options[document.getElementById('gen-type').selectedIndex].text.split(' (')[0];
            const name = `Generated ${typeLabel} (${count.toLocaleString()} records)`;

            setActiveDataset({
                name,
                type,
                json,
                sizeBytes: new TextEncoder().encode(json).length,
                loadedAt: Date.now()
            });

            // Count total records
            const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
            const collections = Object.keys(data).map(k => `${k} (${data[k].length})`).join(', ');

            statusEl.innerHTML = alertBanner('success',
                `<i class="ti ti-check"></i> Generated <strong>${totalRecords.toLocaleString()}</strong> records — ${escHtml(collections)} — ${fmtBytes(new TextEncoder().encode(json).length)}`
            );
            downloadBtn.classList.remove('hidden');
        } catch (err) {
            statusEl.innerHTML = alertBanner('error', `<i class="ti ti-x"></i> Generation failed: ${err.message}`);
        }
    }, 10);
}

function downloadGenerated() {
    if (!_generatedJson) return;
    const type = document.getElementById('gen-type').value;
    const count = document.getElementById('gen-count').value;
    const blob = new Blob([_generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${count}-records.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Tool: Byte-Range Scan ─────────────────────────────────────────────────────

async function runByteRange() {
    const resultsDiv = document.getElementById('byte-range-results');
    if (!_activeDataset) { showError(resultsDiv, 'No dataset loaded. Go to Home first.'); return; }

    const collectionsRaw = document.getElementById('byte-range-collections').value.trim();
    const calculateHashes = document.getElementById('byte-range-hashes').checked;
    const parallel = document.getElementById('byte-range-parallel').checked;
    const collections = collectionsRaw ? collectionsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];

    showLoading(resultsDiv, 'Scanning collections…');

    try {
        const res = await apiFetch('/api/scan/byte-range', {
            jsonContent: _activeDataset.json,
            targetCollections: collections,
            calculateHashes,
            validateUtf8: true,
            parallelProcessing: parallel
        });

        if (res.success) {
            renderByteRangeResults(resultsDiv, res, _activeDataset.json);
        } else {
            showError(resultsDiv, res.error || 'Scan failed');
        }
    } catch (err) {
        showError(resultsDiv, `API Error: ${err.message}`);
    }
}

function renderByteRangeResults(container, result, originalJson) {
    const { collections, stats } = result;
    const totalBytes = new TextEncoder().encode(originalJson).length;
    const throughputMBs = (totalBytes / 1024 / 1024) / (Math.max(stats.processingTimeMs, 0.1) / 1000);
    const barPct = Math.min(100, throughputMBs * 10);

    let html = alertBanner('success', `<i class="ti ti-check"></i> Scan complete — ${stats.totalObjectsFound} objects in ${stats.collectionsScanned} collection(s)`);
    html += renderExecutionSummary();
    html += renderWarnings(result);

    html += `<div class="grid-4 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(stats.collectionsScanned, 'Collections')}
        ${statCard(stats.totalObjectsFound, 'Objects Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Processed')}
        ${statCard(stats.processingTimeMs.toFixed(1) + ' ms', 'API Time')}
    </div>`;

    html += `<div style="margin:var(--space-sm) 0 var(--space-md)">
        <div class="text-muted" style="font-size:var(--text-xs);margin-bottom:4px">Throughput: ${throughputMBs.toFixed(1)} MB/s</div>
        <div style="height:6px;background:var(--border-color);border-radius:var(--radius-sm);overflow:hidden">
            <div class="throughput-fill" style="height:100%;background:var(--color-primary);border-radius:var(--radius-sm);width:0%;transition:width 0.6s ease" data-target="${barPct}%"></div>
        </div>
    </div>`;

    for (const [name, objects] of Object.entries(collections)) {
        const preview = objects.slice(0, 5); // show first 5 only
        html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)">
            <i class="ti ti-folder"></i> ${escHtml(name)}
            <span class="status-badge status-info">${objects.length} objects</span>
            ${objects.length > 5 ? `<span class="text-muted" style="font-size:var(--text-sm);font-weight:normal"> — showing first 5</span>` : ''}
        </h3>`;

        preview.forEach((obj, i) => {
            const pct = totalBytes > 0 ? ((obj.startPosition / totalBytes) * 100).toFixed(1) : 0;
            const widthPct = totalBytes > 0 ? Math.max(1, (obj.length / totalBytes) * 100).toFixed(2) : 1;

            html += `<div class="card" style="margin-bottom:var(--space-sm);padding:0;overflow:hidden">
                <div class="grid-between" style="padding:var(--space-sm) var(--space-md);background:var(--bg-tertiary);border-bottom:1px solid var(--border-color)">
                    <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center">
                        <strong>Object #${i + 1}</strong>
                        <span class="status-badge status-info"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                    </div>
                    <span class="status-badge status-warning">idx ${obj.itemIndex}</span>
                </div>
                <div style="padding:var(--space-sm) var(--space-md);border-bottom:1px solid var(--border-color);font-size:var(--text-xs);color:var(--text-secondary)">
                    Byte range: <strong>${obj.startPosition.toLocaleString()}</strong> → <strong>${(obj.startPosition + obj.length).toLocaleString()}</strong> (${pct}% into file)
                    <div style="height:4px;background:var(--border-color);border-radius:2px;margin-top:4px;position:relative;overflow:hidden">
                        <div style="position:absolute;height:100%;background:var(--color-warning);border-radius:2px;left:${pct}%;width:${widthPct}%;min-width:3px"></div>
                    </div>
                </div>
                ${obj.hash ? `<div style="padding:4px var(--space-md);font-size:var(--text-xs);color:var(--text-muted);font-family:var(--font-mono);border-bottom:1px solid var(--border-color)">MD5: <span style="color:var(--color-primary)">${obj.hash}</span></div>` : ''}
                <div style="position:relative">
                    <pre style="margin:0;border-radius:0;max-height:160px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                    <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
                </div>
            </div>`;
        });
    }

    container.innerHTML = html;
    animateBars(container);
}

// ── Tool: Path Extraction ─────────────────────────────────────────────────────

function renderPathSuggestions() {
    const sug = document.getElementById('path-suggestions');
    if (!sug || !_activeDataset) return;
    const paths = DataGenerator.suggestedPaths(_activeDataset.type) || [];
    if (paths.length === 0) { sug.innerHTML = ''; return; }
    sug.innerHTML = '<strong>Suggested paths:</strong> ' +
        paths.map(p => `<button class="btn-link" onclick="document.getElementById('path-extract-path').value='${p.path}'">${p.path}</button> — ${p.description}`).join(' &nbsp;·&nbsp; ');
}

async function runPathExtract() {
    const resultsDiv = document.getElementById('path-extract-results');
    if (!_activeDataset) { showError(resultsDiv, 'No dataset loaded. Go to Home first.'); return; }

    const jsonPath = document.getElementById('path-extract-path').value.trim();
    if (!jsonPath) { showError(resultsDiv, 'Please enter a JSON path.'); return; }

    showLoading(resultsDiv, `Extracting objects at "${jsonPath}"…`);

    try {
        const res = await apiFetch('/api/pathscan/extract', {
            jsonContent: _activeDataset.json,
            jsonPath
        });
        if (res.success) {
            renderPathResults(resultsDiv, res, jsonPath, _activeDataset.json);
        } else {
            showError(resultsDiv, res.error || 'Extraction failed');
        }
    } catch (err) {
        showError(resultsDiv, `API Error: ${err.message}`);
    }
}

function renderPathResults(container, result, jsonPath, originalJson) {
    const { objects, stats } = result;
    const totalBytes = new TextEncoder().encode(originalJson).length;

    let html = alertBanner('success', `<i class="ti ti-check"></i> Found <strong>${objects.length}</strong> object(s) at <code>${escHtml(jsonPath)}</code>`);
    html += renderExecutionSummary();
    html += renderWarnings(result);

    html += `<div class="grid-3 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(objects.length, 'Objects Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Processed')}
        ${statCard(stats.processingTimeMs.toFixed(1) + ' ms', 'API Time')}
    </div>`;

    if (objects.length === 0) {
        html += alertBanner('warning', '<i class="ti ti-alert-triangle"></i> No objects found at the specified path');
        container.innerHTML = html;
        return;
    }

    const preview = objects.slice(0, 5);
    html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-list"></i> Extracted Objects ${objects.length > 5 ? `<span class="text-muted" style="font-size:var(--text-sm);font-weight:normal">— showing first 5 of ${objects.length}</span>` : ''}</h3>`;

    preview.forEach((obj, i) => {
        const pct = totalBytes > 0 ? ((obj.startPosition / totalBytes) * 100).toFixed(1) : 0;
        const widthPct = totalBytes > 0 ? Math.max(1, (obj.length / totalBytes) * 100).toFixed(2) : 1;

        html += `<div class="card" style="margin-bottom:var(--space-sm);padding:0;overflow:hidden">
            <div class="grid-between" style="padding:var(--space-sm) var(--space-md);background:var(--bg-tertiary);border-bottom:1px solid var(--border-color)">
                <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center">
                    <strong>Object #${i + 1}</strong>
                    <span class="status-badge status-info"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                </div>
                ${obj.hash ? `<span class="status-badge status-disabled" title="${obj.hash}">MD5: ${obj.hash.slice(0,8)}…</span>` : ''}
            </div>
            <div style="padding:var(--space-sm) var(--space-md);border-bottom:1px solid var(--border-color);font-size:var(--text-xs);color:var(--text-secondary)">
                Byte range: <strong>${obj.startPosition.toLocaleString()}</strong> → <strong>${(obj.startPosition + obj.length).toLocaleString()}</strong> (${pct}% into file)
                <div style="height:4px;background:var(--border-color);border-radius:2px;margin-top:4px;position:relative;overflow:hidden">
                    <div style="position:absolute;height:100%;background:var(--color-warning);border-radius:2px;left:${pct}%;width:${widthPct}%;min-width:3px"></div>
                </div>
            </div>
            <div style="position:relative">
                <pre style="margin:0;border-radius:0;max-height:160px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    animateBars(container);
}

// ── Tool: Trie Index ──────────────────────────────────────────────────────────

function initTrieLiveSearch() {
    document.getElementById('trie-search-term').addEventListener('input', () => {
        if (!_trieIndexed) return;
        clearTimeout(_trieDebounce);
        _trieDebounce = setTimeout(runTrieIndex, 400);
    });
}

async function runTrieIndex() {
    const resultsDiv = document.getElementById('trie-index-results');
    if (!_activeDataset) { showError(resultsDiv, 'No dataset loaded. Go to Home first.'); return; }

    const searchTerm = document.getElementById('trie-search-term').value.trim();
    const liveInd = document.getElementById('trie-live-indicator');

    if (!_trieIndexed) showLoading(resultsDiv, 'Building trie index…');

    try {
        const res = await apiFetch('/api/trie/index', {
            jsonContent: _activeDataset.json,
            searchTerm
        });
        _trieIndexed = true;
        liveInd.classList.remove('hidden');

        if (res.success) {
            renderTrieResults(resultsDiv, res, searchTerm);
        } else {
            showError(resultsDiv, res.error || 'Indexing failed');
        }
    } catch (err) {
        showError(resultsDiv, `API Error: ${err.message}`);
    }
}

function renderTrieResults(container, result, searchTerm) {
    const { matches, totalIndexed } = result;

    let html = alertBanner('success', `<i class="ti ti-check"></i> Index built — <strong>${totalIndexed.toLocaleString()}</strong> terms indexed`);
    html += renderExecutionSummary();
    html += renderWarnings(result);

    html += `<div class="grid-3 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(totalIndexed.toLocaleString(), 'Terms Indexed')}
        ${statCard(searchTerm ? `"${escHtml(searchTerm)}"` : '—', 'Search Prefix')}
        ${statCard(matches.length, 'Matches')}
    </div>`;

    if (matches.length > 0) {
        html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-search"></i> Matching Terms <span class="status-badge status-enabled">${matches.length} results</span></h3>`;
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;padding:var(--space-md);background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm)">`;
        matches.forEach(m => {
            const highlighted = searchTerm
                ? escHtml(m).replace(new RegExp(`^(${escRegex(escHtml(searchTerm))})`, 'i'), '<strong>$1</strong>')
                : escHtml(m);
            html += `<span class="status-badge status-info" style="cursor:pointer" onclick="document.getElementById('trie-search-term').value='${escHtml(m)}';runTrieIndex()">${highlighted}</span>`;
        });
        html += `</div>`;
    } else if (searchTerm) {
        html += alertBanner('warning', `<i class="ti ti-alert-triangle"></i> No matches for "<strong>${escHtml(searchTerm)}</strong>"`);
    }

    container.innerHTML = html;
}

// ── Tool: Semantic Search ─────────────────────────────────────────────────────

function renderSemanticFieldChips() {
    const container = document.getElementById('semantic-field-chips');
    if (!container || !_activeDataset) return;

    const fields = DataGenerator.semanticFields(_activeDataset.type) || ['name', 'title', 'description'];
    _semanticFields = new Set(fields);

    container.innerHTML = '';
    fields.forEach(f => {
        const chip = document.createElement('span');
        chip.className = 'status-badge status-success';
        chip.dataset.clickable = 'true';
        chip.innerHTML = `<i class="ti ti-tag"></i> ${escHtml(f)}`;
        chip.addEventListener('click', () => {
            if (_semanticFields.has(f)) _semanticFields.delete(f);
            else _semanticFields.add(f);
            chip.className = 'status-badge ' + (_semanticFields.has(f) ? 'status-success' : 'status-info');
        });
        container.appendChild(chip);
    });
}

async function runSemanticSearch() {
    const resultsDiv = document.getElementById('semantic-results');
    if (!_activeDataset) { showError(resultsDiv, 'No dataset loaded. Go to Home first.'); return; }

    const searchTerm = document.getElementById('semantic-search-term').value.trim();
    if (!searchTerm) { showError(resultsDiv, 'Please enter a search term.'); return; }

    const fields = [..._semanticFields];
    if (fields.length === 0) { showError(resultsDiv, 'Please select at least one field to index.'); return; }

    showLoading(resultsDiv, `Building semantic index on [${fields.join(', ')}] and searching for "${searchTerm}"…`);

    try {
        const semanticRes = await apiFetch('/api/semantic/search', {
            jsonContent: _activeDataset.json,
            indexedFields: fields,
            collectionPaths: detectCollectionsFromJson(_activeDataset.json),
            searchTerm,
            indexNGrams: true,
            maxResults: 10
        });

        if (!semanticRes.success) { showError(resultsDiv, semanticRes.error || 'Semantic search failed'); return; }

        renderSemanticResults(resultsDiv, semanticRes, searchTerm, fields);
    } catch (err) {
        showError(resultsDiv, `Error: ${err.message}`);
    }
}

function findMatchedWordsForObject(obj, fields, searchTerm) {
    if (!obj.jsonContent) return [];

    try {
        const parsed = JSON.parse(obj.jsonContent);
        const words = extractWords(parsed, fields);
        return [...new Set(words.filter(word => PluginRegistry.MatchEngine.match(word, searchTerm)))];
    } catch {
        return [];
    }
}

function extractWords(obj, fields) {
    const words = [];
    if (typeof obj !== 'object' || obj === null) return words;
    for (const [key, val] of Object.entries(obj)) {
        const shouldIndex = fields.length === 0 || fields.some(f => f.toLowerCase() === key.toLowerCase());
        if (!shouldIndex) continue;
        collectStrings(val, words);
    }
    return words;
}

function collectStrings(val, out) {
    if (typeof val === 'string') {
        // Use pluggable Tokenizer
        PluginRegistry.Tokenizer.tokenize(val).forEach(w => out.push(w));
    } else if (Array.isArray(val)) {
        val.forEach(v => collectStrings(v, out));
    } else if (typeof val === 'object' && val !== null) {
        Object.values(val).forEach(v => collectStrings(v, out));
    }
}

function renderSemanticResults(container, result, searchTerm, fields) {
    const objects = result.objects || [];
    const stats = result.stats || {};
    const matches = objects.map(obj => ({ obj, matchedWords: findMatchedWordsForObject(obj, fields, searchTerm) }));

    let html = alertBanner('success',
        `<i class="ti ti-brain"></i> Indexed <strong>${(stats.objectsIndexed ?? objects.length).toLocaleString()}</strong> objects across [${fields.map(f => `<code>${escHtml(f)}</code>`).join(', ')}] — found <strong>${(stats.matchesFound ?? matches.length).toLocaleString()}</strong> match(es) for "<strong>${escHtml(searchTerm)}</strong>"`
    );
    html += renderExecutionSummary();
    html += renderWarnings(result);

    html += `<div class="grid-4 gap-sm" style="margin:var(--space-md) 0">
        ${statCard((stats.objectsIndexed ?? objects.length).toLocaleString(), 'Objects Indexed')}
        ${statCard(fields.length, 'Fields Indexed')}
        ${statCard((stats.matchesFound ?? matches.length).toLocaleString(), 'Matches Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Scanned')}
    </div>`;

    if ((stats.matchesFound ?? matches.length) === 0) {
        html += alertBanner('warning', `<i class="ti ti-alert-triangle"></i> No objects matched "<strong>${escHtml(searchTerm)}</strong>" in fields [${fields.join(', ')}]`);
        container.innerHTML = html;
        return;
    }

    const preview = matches.slice(0, 10);
    html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-brain"></i> Matching Objects <span class="status-badge status-enabled">${(stats.matchesFound ?? matches.length).toLocaleString()} results</span>${(stats.matchesFound ?? matches.length) > 10 ? ` <span class="text-muted" style="font-size:var(--text-sm);font-weight:normal">— showing first 10</span>` : ''}</h3>`;

    preview.forEach(({ obj, matchedWords }, i) => {
        html += `<div class="card" style="margin-bottom:var(--space-sm);padding:0;overflow:hidden">
            <div class="grid-between" style="padding:var(--space-sm) var(--space-md);background:var(--bg-tertiary);border-bottom:1px solid var(--border-color)">
                <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center">
                    <strong>Match #${i + 1}</strong>
                    <span class="status-badge status-info"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                    <span class="status-badge status-warning">byte ${obj.startPosition.toLocaleString()}</span>
                </div>
                <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:4px">
                    ${matchedWords.slice(0, 5).map(w => `<span class="status-badge status-success"><i class="ti ti-tag"></i> ${escHtml(w)}</span>`).join('')}
                </div>
            </div>
            <div style="position:relative">
                <pre style="margin:0;border-radius:0;max-height:160px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;

    if (searchTerm) {
        container.querySelectorAll('pre code').forEach(block => highlightTextInElement(block, searchTerm));
    }
}

function highlightTextInElement(element, term) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    nodes.forEach(textNode => {
        if (!re.test(textNode.textContent)) return;
        re.lastIndex = 0;
        const span = document.createElement('span');
        span.innerHTML = textNode.textContent.replace(re,
            '<mark style="background:var(--color-secondary);color:var(--text-primary);border-radius:2px;padding:0 1px">$1</mark>');
        textNode.parentNode.replaceChild(span, textNode);
    });
}

// ── Tool: Validate ────────────────────────────────────────────────────────────

async function runValidate() {
    const resultsDiv = document.getElementById('validate-results');
    if (!_activeDataset) { showError(resultsDiv, 'No dataset loaded. Go to Home first.'); return; }

    showLoading(resultsDiv, 'Validating…');

    try {
        const res = await apiFetch('/api/scan/validate', { jsonContent: _activeDataset.json });
        if (res.success) {
            renderValidateResults(resultsDiv, res, _activeDataset.json);
        } else {
            showError(resultsDiv, res.error || 'Validation failed');
        }
    } catch (err) {
        showError(resultsDiv, `API Error: ${err.message}`);
    }
}

function renderValidateResults(container, res, originalJson) {
    const allPass = res.isValidStructure && res.isValidUtf8;
    const bytes = res.bytesChecked ?? new TextEncoder().encode(originalJson).length;

    let html = allPass
        ? alertBanner('success', '<i class="ti ti-shield-check"></i> <strong>All checks passed</strong> — this JSON is valid and UTF-8 safe')
        : alertBanner('error',   '<i class="ti ti-shield-x"></i> <strong>Validation failed</strong> — see details below');
    html += renderExecutionSummary();
    html += renderWarnings(res);

    html += `<div class="grid-2 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(fmtBytes(bytes), 'Bytes Checked')}
        ${statCard(allPass ? '✓ Valid' : '✗ Invalid', 'Overall')}
    </div>`;

    html += `<div class="grid-2 gap-sm">
        <div class="card" style="border-left:3px solid ${res.isValidStructure ? 'var(--color-success)' : 'var(--color-danger)'}">
            <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center;margin-bottom:var(--space-sm)">
                <i class="ti ti-${res.isValidStructure ? 'check' : 'x'}" style="color:${res.isValidStructure ? 'var(--color-success)' : 'var(--color-danger)'}"></i>
                <strong>JSON Structure</strong>
            </div>
            <p class="text-secondary" style="font-size:var(--text-sm);margin:0">${res.isValidStructure
                ? 'Balanced braces, valid syntax, parseable by JsonDocument'
                : 'Invalid JSON — unbalanced braces, missing quotes, or syntax error'}</p>
        </div>
        <div class="card" style="border-left:3px solid ${res.isValidUtf8 ? 'var(--color-success)' : 'var(--color-danger)'}">
            <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center;margin-bottom:var(--space-sm)">
                <i class="ti ti-${res.isValidUtf8 ? 'check' : 'x'}" style="color:${res.isValidUtf8 ? 'var(--color-success)' : 'var(--color-danger)'}"></i>
                <strong>UTF-8 Delimiter Safety</strong>
            </div>
            <p class="text-secondary" style="font-size:var(--text-sm);margin:0">${res.isValidUtf8
                ? 'No multi-byte sequences overlap JSON delimiters ({ } " \\)'
                : `Unsafe sequence: ${escHtml(res.utf8Error || 'multi-byte character overlaps a JSON delimiter')}`}</p>
        </div>
    </div>`;

    container.innerHTML = html;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

// Route all API calls through the pluggable ApiTransport
async function apiFetch(path, body) {
    return PluginRegistry.ApiTransport.fetch(path, body);
}

function renderExecutionSummary() {
    const info = getExecutionModeInfo();
    return `<div style="margin-top:var(--space-sm);display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center">
        <span class="status-badge ${info.badgeClass}"><i class="${info.icon}"></i> ${escHtml(info.badgeLabel)}</span>
    </div>`;
}

function renderWarnings(result) {
    if (!result || !Array.isArray(result.warnings) || result.warnings.length === 0) return '';
    return result.warnings.map(warning =>
        alertBanner('warning', `<i class="ti ti-alert-triangle"></i> ${escHtml(warning)}`)
    ).join('');
}

function showLoading(container, msg) {
    container.innerHTML = `<div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:10px;align-items:center;padding:var(--space-lg);color:var(--text-secondary)"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div>${escHtml(msg)}</div>`;
}

function showError(container, msg) {
    container.innerHTML = `<div class="alert alert-error"><i class="ti ti-alert-circle"></i> ${escHtml(msg)}</div>`;
}

function alertBanner(type, html) {
    const cls = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : type === 'warning' ? 'alert-warning' : 'alert-info';
    return `<div class="alert ${cls}">${html}</div>`;
}

function statCard(value, label) {
    return `<div class="card" style="padding:var(--space-md)">
        <span class="stat-value">${value}</span>
        <span class="text-muted" style="font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.05em">${label}</span>
    </div>`;
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function detectCollectionsFromJson(jsonText) {
    try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
        return Object.entries(parsed)
            .filter(([, value]) => Array.isArray(value))
            .map(([key]) => key);
    } catch {
        return [];
    }
}

function prettyJson(str) {
    try { return JSON.stringify(JSON.parse(str), null, 2); }
    catch { return str; }
}

function fmtBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function animateBars(container) {
    requestAnimationFrame(() => {
        container.querySelectorAll('.throughput-fill').forEach(bar => {
            const target = bar.dataset.target;
            bar.style.width = '0%';
            requestAnimationFrame(() => { bar.style.width = target; });
        });
    });
}

function copyCode(btn) {
    const pre = btn.closest('div').querySelector('pre');
    const text = pre.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 2000);
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 2000);
    });
}

// ── Browser Preview Transport ────────────────────────────────────────────────

function browserWarning(message) {
    return message;
}

function browserValidationResponse(jsonContent, extra = {}) {
    const isValidStructure = (() => {
        try {
            JSON.parse(jsonContent);
            return true;
        } catch {
            return false;
        }
    })();

    return {
        success: true,
        isValidStructure,
        isValidUtf8: true,
        utf8Error: '',
        bytesChecked: UTF8_ENCODER.encode(jsonContent).length,
        warnings: [
            browserWarning('Browser Preview validates JSON structure locally. UTF-8 delimiter safety is assumed for in-memory browser strings.')
        ],
        ...extra
    };
}

function addBrowserObject(results, collectionName, bytes, start, endExclusive, itemIndex) {
    if (!results[collectionName]) results[collectionName] = [];
    results[collectionName].push({
        startPosition: start,
        length: endExclusive - start,
        itemIndex,
        hash: null,
        jsonContent: UTF8_DECODER.decode(bytes.subarray(start, endExclusive))
    });
}

function browserScanByteRange(body) {
    const startedAt = performance.now();
    const jsonContent = body.jsonContent || '';
    const bytes = UTF8_ENCODER.encode(jsonContent);
    const collections = (body.targetCollections && body.targetCollections.length > 0)
        ? body.targetCollections.filter(Boolean)
        : detectCollectionsFromJson(jsonContent);
    const warnings = [];

    if (body.calculateHashes) {
        warnings.push(browserWarning('Browser Preview skips MD5 hashing. Switch to Local API or Hosted API for real MD5 hashes.'));
    }

    if (collections.length === 0) {
        return {
            success: true,
            collections: {},
            stats: {
                bytesProcessed: bytes.length,
                totalObjectsFound: 0,
                collectionsScanned: 0,
                processingTimeMs: performance.now() - startedAt
            },
            warnings
        };
    }

    const searchKeys = collections.map(name => `"${String(name).toLowerCase()}"`);
    const maxKeyLen = searchKeys.reduce((max, key) => Math.max(max, key.length), 50);
    const results = {};

    let nameBuf = '';
    let foundCollectionName = null;
    let negate = false;
    let inQuote = false;
    let braceCount = 0;
    let currentStart = -1;
    let currentItemIndex = -1;

    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];

        if (foundCollectionName == null) {
            const ch = b < 128 ? String.fromCharCode(b).toLowerCase() : '\0';
            nameBuf += ch;
            if (nameBuf.length > maxKeyLen + 2) {
                nameBuf = nameBuf.slice(-(maxKeyLen + 2));
            }

            for (let k = 0; k < searchKeys.length; k++) {
                if (nameBuf.endsWith(searchKeys[k])) {
                    foundCollectionName = collections[k];
                    nameBuf = '';
                    break;
                }
            }
            continue;
        }

        let isEscape = false;
        if (b === 92) {
            negate = !negate;
            isEscape = true;
        }

        if (b === 34 && !negate) {
            inQuote = !inQuote;
            if (!isEscape) negate = false;
            continue;
        }

        if (!isEscape) negate = false;
        if (inQuote) continue;

        if (b === 123) {
            braceCount += 1;
            if (braceCount === 1) {
                currentStart = i;
                currentItemIndex += 1;
            }
            continue;
        }

        if (b === 125) {
            braceCount -= 1;
            if (braceCount === 0 && currentStart >= 0) {
                addBrowserObject(results, foundCollectionName, bytes, currentStart, i + 1, currentItemIndex);
                currentStart = -1;
            }
            continue;
        }

        if (b === 93 && braceCount === 0) {
            foundCollectionName = null;
            nameBuf = '';
            currentItemIndex = -1;
        }
    }

    const totalObjects = Object.values(results).reduce((sum, items) => sum + items.length, 0);
    return {
        success: true,
        collections: results,
        stats: {
            bytesProcessed: bytes.length,
            totalObjectsFound: totalObjects,
            collectionsScanned: Object.keys(results).length,
            processingTimeMs: performance.now() - startedAt
        },
        warnings
    };
}

function skipBalanced(text, startIndex, openChar, closeChar) {
    let depth = 1;
    let inQuote = false;
    let escape = false;

    for (let i = startIndex + 1; i < text.length; i++) {
        const c = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\') {
            escape = true;
            continue;
        }
        if (c === '"') {
            inQuote = !inQuote;
            continue;
        }
        if (inQuote) continue;
        if (c === openChar) depth += 1;
        else if (c === closeChar) depth -= 1;
        if (depth === 0) return i;
    }

    return text.length - 1;
}

function seekToArrayStart(text, startIndex) {
    let inQuote = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
        const c = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\') {
            escape = true;
            continue;
        }
        if (c === '"') {
            inQuote = !inQuote;
            continue;
        }
        if (inQuote) continue;
        if (c === '[') return i + 1;
        if (c === '{') i = skipBalanced(text, i, '{', '}');
    }

    return -1;
}

function findPathArrayStart(text, jsonPath) {
    const targetSegments = String(jsonPath || '')
        .split('.')
        .map(segment => segment.trim().toLowerCase())
        .filter(Boolean);

    if (targetSegments.length === 0) return -1;

    let inQuote = false;
    let escape = false;
    let token = '';
    let matchedDepth = 0;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (escape) {
            if (inQuote) token += c;
            escape = false;
            continue;
        }

        if (c === '\\') {
            if (inQuote) token += c;
            escape = true;
            continue;
        }

        if (c === '"') {
            if (inQuote) {
                const candidate = token.toLowerCase();
                if (candidate === targetSegments[matchedDepth]) matchedDepth += 1;
                else matchedDepth = candidate === targetSegments[0] ? 1 : 0;
                token = '';
                inQuote = false;
                if (matchedDepth === targetSegments.length) {
                    return seekToArrayStart(text, i + 1);
                }
            } else {
                inQuote = true;
                token = '';
            }
            continue;
        }

        if (inQuote) token += c;
    }

    return -1;
}

function extractObjectsFromArrayText(text, arrayStartIndex) {
    const objects = [];
    let inQuote = false;
    let escape = false;
    let depth = 0;
    let objectStart = -1;
    let itemIndex = 0;

    for (let i = arrayStartIndex; i < text.length; i++) {
        const c = text[i];

        if (escape) {
            escape = false;
            continue;
        }
        if (c === '\\') {
            escape = true;
            continue;
        }
        if (c === '"') {
            inQuote = !inQuote;
            continue;
        }
        if (inQuote) continue;

        if (depth === 0 && c === ']') break;

        if (c === '{') {
            if (depth === 0) objectStart = i;
            depth += 1;
            continue;
        }

        if (c === '}') {
            depth -= 1;
            if (depth === 0 && objectStart >= 0) {
                const jsonContent = text.slice(objectStart, i + 1);
                objects.push({
                    startPosition: UTF8_ENCODER.encode(text.slice(0, objectStart)).length,
                    length: UTF8_ENCODER.encode(jsonContent).length,
                    itemIndex,
                    hash: null,
                    jsonContent
                });
                itemIndex += 1;
                objectStart = -1;
            }
        }
    }

    return objects;
}

function browserExtractPath(body) {
    const startedAt = performance.now();
    const jsonContent = body.jsonContent || '';
    const arrayStartIndex = findPathArrayStart(jsonContent, body.jsonPath);
    const objects = arrayStartIndex >= 0 ? extractObjectsFromArrayText(jsonContent, arrayStartIndex) : [];

    return {
        success: true,
        objects,
        stats: {
            bytesProcessed: UTF8_ENCODER.encode(jsonContent).length,
            totalObjectsFound: objects.length,
            collectionsScanned: 1,
            processingTimeMs: performance.now() - startedAt
        },
        warnings: [
            browserWarning('Browser Preview skips MD5 hashing for path extraction. Switch to Local API or Hosted API for the exact C# behavior.')
        ]
    };
}

function indexElementForBrowserTrie(element, bag) {
    if (Array.isArray(element)) {
        element.forEach(item => indexElementForBrowserTrie(item, bag));
        return;
    }

    if (element && typeof element === 'object') {
        Object.entries(element).forEach(([key, value]) => {
            if (key.trim()) bag.push(key);
            indexElementForBrowserTrie(value, bag);
        });
        return;
    }

    if (typeof element === 'string') {
        element
            .split(/[\s,.;:_-]+/)
            .filter(word => word.length > 2)
            .forEach(word => bag.push(word));
        return;
    }

    if (typeof element === 'number') bag.push(String(element));
}

function browserTrieIndex(body) {
    const startedAt = performance.now();
    const terms = [];
    const searchTerm = (body.searchTerm || '').trim().toLowerCase();

    const parsed = JSON.parse(body.jsonContent || '{}');
    indexElementForBrowserTrie(parsed, terms);

    const matches = searchTerm
        ? [...new Set(terms.filter(term => term.toLowerCase().startsWith(searchTerm)))].sort((a, b) => a.localeCompare(b))
        : [];

    return {
        success: true,
        matches,
        totalIndexed: terms.length,
        warnings: [],
        stats: {
            processingTimeMs: performance.now() - startedAt
        }
    };
}

function browserSemanticSearch(body) {
    const startedAt = performance.now();
    const scanResult = browserScanByteRange({
        jsonContent: body.jsonContent,
        targetCollections: body.collectionPaths,
        calculateHashes: false,
        validateUtf8: false
    });
    const allObjects = Object.values(scanResult.collections).flat().sort((a, b) => a.startPosition - b.startPosition);
    const fields = body.indexedFields || [];
    const searchTerm = String(body.searchTerm || '').trim().toLowerCase();
    let termsIndexed = 0;

    const matches = [];
    allObjects.forEach(obj => {
        if (!obj.jsonContent) return;
        try {
            const parsed = JSON.parse(obj.jsonContent);
            const words = extractWords(parsed, fields);
            termsIndexed += words.length;
            const matchedWords = [...new Set(words.filter(word => PluginRegistry.MatchEngine.match(word, searchTerm)))];
            if (matchedWords.length > 0) matches.push(obj);
        } catch {
            // Ignore malformed objects in preview mode
        }
    });

    return {
        success: true,
        objects: matches.slice(0, Math.max(1, body.maxResults || 10)),
        matchedOffsets: matches.map(match => match.startPosition),
        indexedFields: fields,
        collectionPaths: body.collectionPaths && body.collectionPaths.length > 0 ? body.collectionPaths : detectCollectionsFromJson(body.jsonContent),
        stats: {
            bytesProcessed: scanResult.stats.bytesProcessed,
            objectsIndexed: allObjects.length,
            matchesFound: matches.length,
            collectionsScanned: scanResult.stats.collectionsScanned,
            termsIndexed,
            processingTimeMs: performance.now() - startedAt
        },
        warnings: [
            browserWarning('Browser Preview mirrors semantic indexing locally in JavaScript. Switch to Local API or Hosted API for the exact C# semantic-index pipeline.')
        ]
    };
}

window.JsonToolsBrowserTransport = {
    async fetch(path, body) {
        switch (path) {
            case '/api/scan/byte-range':
                return browserScanByteRange(body);
            case '/api/pathscan/extract':
                return browserExtractPath(body);
            case '/api/trie/index':
                return browserTrieIndex(body);
            case '/api/semantic/search':
                return browserSemanticSearch(body);
            case '/api/scan/validate':
                return browserValidationResponse(body.jsonContent || '');
            default:
                throw new Error(`Browser Preview does not implement ${path}`);
        }
    }
};
