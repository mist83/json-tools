// JsonUtilities Demo — Frontend Application
// ─────────────────────────────────────────────────────────────────────────────
// Plugin registry (PluginRegistry) is loaded before this file via plugin-registry.js
// DataGenerator is loaded before this file via data-generator.js

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const LS_KEY = 'jsontools_active_data';

// ── State ─────────────────────────────────────────────────────────────────────

let _activeDataset = null;       // { name, type, json, sizeBytes, loadedAt }
let _generatedJson = null;       // last generated JSON string (for download)
let _trieDebounce = null;
let _trieIndexed = false;
let _semanticFields = new Set();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Initialize plugin registry with built-in data generators
    DataGenerator.init();
    initTabs();
    initHome();
    initTrieLiveSearch();
    loadDatasetFromStorage();
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
    const throughputMBs = (totalBytes / 1024 / 1024) / (stats.processingTimeMs / 1000);
    const barPct = Math.min(100, throughputMBs * 10);

    let html = alertBanner('success', `<i class="ti ti-check"></i> Scan complete — ${stats.totalObjectsFound} objects in ${stats.collectionsScanned} collection(s)`);

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
        let detectedCollections = [];
        try {
            const parsed = JSON.parse(_activeDataset.json);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                detectedCollections = Object.entries(parsed).filter(([, v]) => Array.isArray(v)).map(([k]) => k);
            }
        } catch { /* fall through */ }

        const scanRes = await apiFetch('/api/scan/byte-range', {
            jsonContent: _activeDataset.json,
            targetCollections: detectedCollections.length > 0 ? detectedCollections : null,
            calculateHashes: false,
            validateUtf8: false,
            includeJsonContent: true
        });

        if (!scanRes.success) { showError(resultsDiv, scanRes.error || 'Scan failed'); return; }

        const allObjects = Object.values(scanRes.collections).flat();
        const matches = buildClientSemanticIndex(allObjects, fields, searchTerm.toLowerCase());

        renderSemanticResults(resultsDiv, matches, searchTerm, allObjects, fields, scanRes.stats);
    } catch (err) {
        showError(resultsDiv, `Error: ${err.message}`);
    }
}

function buildClientSemanticIndex(objects, fields, prefix) {
    const matches = [];
    objects.forEach((obj, idx) => {
        if (!obj.jsonContent) return;
        let parsed;
        try { parsed = JSON.parse(obj.jsonContent); } catch { return; }
        const words = extractWords(parsed, fields);
        // Use pluggable MatchEngine for matching
        const matchedWords = words.filter(w => PluginRegistry.MatchEngine.match(w, prefix));
        if (matchedWords.length > 0) matches.push({ obj, matchedWords: [...new Set(matchedWords)], idx });
    });
    return matches;
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

function renderSemanticResults(container, matches, searchTerm, allObjects, fields, stats) {
    let html = alertBanner('success',
        `<i class="ti ti-brain"></i> Indexed <strong>${allObjects.length}</strong> objects across [${fields.map(f => `<code>${escHtml(f)}</code>`).join(', ')}] — found <strong>${matches.length}</strong> match(es) for "<strong>${escHtml(searchTerm)}</strong>"`
    );

    html += `<div class="grid-4 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(allObjects.length, 'Objects Indexed')}
        ${statCard(fields.length, 'Fields Indexed')}
        ${statCard(matches.length, 'Matches Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Scanned')}
    </div>`;

    if (matches.length === 0) {
        html += alertBanner('warning', `<i class="ti ti-alert-triangle"></i> No objects matched "<strong>${escHtml(searchTerm)}</strong>" in fields [${fields.join(', ')}]`);
        container.innerHTML = html;
        return;
    }

    const preview = matches.slice(0, 10);
    html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-brain"></i> Matching Objects <span class="status-badge status-enabled">${matches.length} results</span>${matches.length > 10 ? ` <span class="text-muted" style="font-size:var(--text-sm);font-weight:normal">— showing first 10</span>` : ''}</h3>`;

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

function showLoading(container, msg) {
    container.innerHTML = `<div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:10px;align-items:center;padding:var(--space-lg);color:var(--text-secondary)"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div>${escHtml(msg)}</div>`;
}

function showError(container, msg) {
    container.innerHTML = `<div class="alert alert-error"><i class="ti ti-alert-circle"></i> ${msg}</div>`;
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
