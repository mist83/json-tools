// JsonUtilities Demo — Frontend Application
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSidebar();
    initByteRange();
    initPathExtract();
    initTrieIndex();
    initSemanticSearch();
    initValidate();
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
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function initSidebar() {
    document.getElementById('sidebar-load-example').addEventListener('click', () => {
        const tab = activeTab();
        const map = {
            'byte-range':   'btn-byte-range-example',
            'path-extract': 'btn-path-example',
            'trie-index':   'btn-trie-example',
            'semantic':     'btn-semantic-example',
            'validate':     'btn-validate-valid-example',
        };
        if (map[tab]) document.getElementById(map[tab]).click();
    });

    document.getElementById('sidebar-upload-file').addEventListener('click', () => {
        const tab = activeTab();
        const map = {
            'byte-range':   'btn-byte-range-upload',
            'path-extract': 'btn-path-upload',
            'trie-index':   'btn-trie-upload',
            'semantic':     'btn-semantic-upload',
            'validate':     'btn-validate-upload',
        };
        if (map[tab]) document.getElementById(map[tab]).click();
    });

    document.getElementById('sidebar-clear-all').addEventListener('click', () => {
        clearTab(activeTab());
    });

    document.getElementById('sidebar-api-docs').addEventListener('click', () =>
        window.open(`${API_BASE}/`, '_blank'));

    document.getElementById('sidebar-github').addEventListener('click', () =>
        window.open('https://github.com/mist83/json-tools', '_blank'));
}

function activeTab() {
    return document.querySelector('.tab.active')?.dataset.tab ?? 'byte-range';
}

function clearTab(tab) {
    const clears = {
        'byte-range':   () => { $val('byte-range-json', ''); $val('byte-range-collections', ''); clear('byte-range-results'); },
        'path-extract': () => { $val('path-extract-json', ''); $val('path-extract-path', ''); clear('path-extract-results'); clear('path-suggestions'); },
        'trie-index':   () => { $val('trie-index-json', ''); $val('trie-search-term', ''); clear('trie-index-results'); clear('search-suggestions'); hide('trie-live-indicator'); },
        'semantic':     () => { $val('semantic-json', ''); $val('semantic-search-term', ''); clear('semantic-results'); clear('semantic-term-suggestions'); },
        'validate':     () => { $val('validate-json', ''); clear('validate-results'); },
    };
    clears[tab]?.();
}

// ── Byte-Range Scanning ───────────────────────────────────────────────────────

function initByteRange() {
    document.getElementById('btn-byte-range-example').addEventListener('click', () => {
        const d = SAMPLE_DATA.byteRangeScan;
        $val('byte-range-json', d.json);
        $val('byte-range-collections', d.collections.join(', '));
        clear('byte-range-results');
    });

    document.getElementById('btn-byte-range-scan').addEventListener('click', scanByteRange);
    document.getElementById('btn-byte-range-upload').addEventListener('click', () =>
        document.getElementById('file-byte-range').click());
    document.getElementById('file-byte-range').addEventListener('change', e =>
        handleFileUpload(e.target.files[0], 'byte-range-json'));
}

async function scanByteRange() {
    const jsonContent = $val('byte-range-json').trim();
    const collectionsRaw = $val('byte-range-collections').trim();
    const calculateHashes = document.getElementById('byte-range-hashes').checked;
    const parallel = document.getElementById('byte-range-parallel').checked;
    const resultsDiv = document.getElementById('byte-range-results');

    if (!jsonContent) { showError(resultsDiv, 'Please provide JSON content'); return; }

    const collections = collectionsRaw ? collectionsRaw.split(',').map(c => c.trim()).filter(Boolean) : [];
    showLoading(resultsDiv, 'Scanning collections…');

    const t0 = performance.now();
    try {
        const res = await apiFetch('/api/scan/byte-range', {
            jsonContent,
            targetCollections: collections,
            calculateHashes,
            validateUtf8: true,
            parallelProcessing: parallel
        });
        const elapsed = performance.now() - t0;

        if (res.success) {
            renderByteRangeResults(resultsDiv, res, jsonContent, elapsed);
        } else {
            showError(resultsDiv, res.error || 'Scan failed');
        }
    } catch (err) {
        showError(resultsDiv, `API Error: ${err.message}`);
    }
}

function renderByteRangeResults(container, result, originalJson, clientMs) {
    const { collections, stats } = result;
    const totalBytes = new TextEncoder().encode(originalJson).length;
    const throughputMBs = (totalBytes / 1024 / 1024) / (stats.processingTimeMs / 1000);
    const barPct = Math.min(100, throughputMBs * 10);

    let html = alertBanner('success', `<i class="ti ti-check"></i> Scan complete — ${stats.totalObjectsFound} objects in ${stats.collectionsScanned} collection(s)`);

    // Stats grid
    html += `<div class="grid-4 gap-sm" style="margin:var(--space-md) 0">
        ${statCard(stats.collectionsScanned, 'Collections')}
        ${statCard(stats.totalObjectsFound, 'Objects Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Processed')}
        ${statCard(stats.processingTimeMs.toFixed(1) + ' ms', 'API Time')}
    </div>`;

    // Throughput bar
    html += `<div style="margin:var(--space-sm) 0 var(--space-md)">
        <div class="text-muted" style="font-size:var(--text-xs);margin-bottom:4px">Throughput: ${throughputMBs.toFixed(1)} MB/s</div>
        <div style="height:6px;background:var(--border-color);border-radius:var(--radius-sm);overflow:hidden">
            <div class="throughput-fill" style="height:100%;background:var(--color-primary);border-radius:var(--radius-sm);width:0%;transition:width 0.6s ease" data-target="${barPct}%"></div>
        </div>
    </div>`;

    // Collections
    for (const [name, objects] of Object.entries(collections)) {
        html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-folder"></i> ${escHtml(name)} <span class="status-badge status-info">${objects.length} objects</span></h3>`;

        objects.forEach((obj, i) => {
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
                    <pre style="margin:0;border-radius:0;max-height:220px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                    <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
                </div>
            </div>`;
        });
    }

    container.innerHTML = html;
    animateBars(container);
}

// ── JSON Path Extraction ──────────────────────────────────────────────────────

function initPathExtract() {
    document.getElementById('btn-path-example').addEventListener('click', () => {
        const d = SAMPLE_DATA.jsonPathExtract;
        $val('path-extract-json', d.json);
        $val('path-extract-path', d.paths[0].path);
        const sug = document.getElementById('path-suggestions');
        sug.innerHTML = '<strong>Try these paths:</strong><br>' +
            d.paths.map(p =>
                `<button class="btn-link" onclick="setPath('${p.path}')">${p.path}</button> — ${p.description}`
            ).join('<br>');
        clear('path-extract-results');
    });

    document.getElementById('btn-path-extract').addEventListener('click', extractByPath);
    document.getElementById('btn-path-upload').addEventListener('click', () =>
        document.getElementById('file-path-extract').click());
    document.getElementById('file-path-extract').addEventListener('change', e =>
        handleFileUpload(e.target.files[0], 'path-extract-json'));
}

function setPath(path) { $val('path-extract-path', path); }

async function extractByPath() {
    const jsonContent = $val('path-extract-json').trim();
    const jsonPath    = $val('path-extract-path').trim();
    const resultsDiv  = document.getElementById('path-extract-results');

    if (!jsonContent) { showError(resultsDiv, 'Please provide JSON content'); return; }
    if (!jsonPath)    { showError(resultsDiv, 'Please provide a JSON path'); return; }

    showLoading(resultsDiv, `Extracting objects at "${jsonPath}"…`);

    try {
        const res = await apiFetch('/api/pathscan/extract', { jsonContent, jsonPath });
        if (res.success) {
            renderPathResults(resultsDiv, res, jsonPath, jsonContent);
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

    html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-list"></i> Extracted Objects</h3>`;

    objects.forEach((obj, i) => {
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
                <pre style="margin:0;border-radius:0;max-height:220px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    animateBars(container);
}

// ── Trie Indexing ─────────────────────────────────────────────────────────────

let _trieDebounce = null;
let _trieIndexed = false;

function initTrieIndex() {
    document.getElementById('btn-trie-example').addEventListener('click', () => {
        const d = SAMPLE_DATA.trieIndex;
        $val('trie-index-json', d.json);
        $val('trie-search-term', d.searchTerms[0]);
        const sug = document.getElementById('search-suggestions');
        sug.innerHTML = '<strong>Try searching:</strong> ' +
            d.searchTerms.map(t =>
                `<button class="btn-link" onclick="setSearchTerm('${t}')">${t}</button>`
            ).join(' ');
        clear('trie-index-results');
        _trieIndexed = false;
    });

    document.getElementById('btn-trie-index').addEventListener('click', indexAndSearch);
    document.getElementById('btn-trie-upload').addEventListener('click', () =>
        document.getElementById('file-trie-index').click());
    document.getElementById('file-trie-index').addEventListener('change', e =>
        handleFileUpload(e.target.files[0], 'trie-index-json'));

    document.getElementById('trie-search-term').addEventListener('input', () => {
        if (!_trieIndexed) return;
        clearTimeout(_trieDebounce);
        _trieDebounce = setTimeout(indexAndSearch, 400);
    });
}

function setSearchTerm(term) {
    $val('trie-search-term', term);
    if (_trieIndexed) indexAndSearch();
}

async function indexAndSearch() {
    const jsonContent = $val('trie-index-json').trim();
    const searchTerm  = $val('trie-search-term').trim();
    const resultsDiv  = document.getElementById('trie-index-results');
    const liveInd     = document.getElementById('trie-live-indicator');

    if (!jsonContent) { showError(resultsDiv, 'Please provide JSON content'); return; }

    if (!_trieIndexed) showLoading(resultsDiv, 'Building trie index…');

    try {
        const res = await apiFetch('/api/trie/index', { jsonContent, searchTerm });
        _trieIndexed = true;
        show(liveInd);

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
        html += `<div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:6px;flex-wrap:wrap;padding:var(--space-md);background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-sm)">`;
        matches.forEach(m => {
            const highlighted = searchTerm
                ? escHtml(m).replace(
                    new RegExp(`^(${escRegex(escHtml(searchTerm))})`, 'i'),
                    '<strong>$1</strong>'
                  )
                : escHtml(m);
            html += `<span class="status-badge status-info" style="cursor:pointer" onclick="setSearchTerm('${escHtml(m)}')">${highlighted}</span>`;
        });
        html += `</div>`;
    } else if (searchTerm) {
        html += alertBanner('warning', `<i class="ti ti-alert-triangle"></i> No matches for "<strong>${escHtml(searchTerm)}</strong>"`);
    }

    container.innerHTML = html;
}

// ── Semantic Search ───────────────────────────────────────────────────────────

let _semanticFields = new Set(['cast', 'title', 'description']);

function initSemanticSearch() {
    document.getElementById('btn-semantic-example').addEventListener('click', () => {
        const d = SAMPLE_DATA.semanticSearch;
        $val('semantic-json', d.json);
        $val('semantic-search-term', d.searchTerms[0]);

        _semanticFields = new Set(d.indexedFields);
        renderFieldChips(d.indexedFields);

        const sug = document.getElementById('semantic-term-suggestions');
        sug.innerHTML = '<strong>Try searching:</strong> ' +
            d.searchTerms.map(t =>
                `<button class="btn-link" onclick="setSemanticTerm('${t}')">${t}</button>`
            ).join(' ');

        clear('semantic-results');
    });

    document.getElementById('btn-semantic-search').addEventListener('click', semanticSearch);
    document.getElementById('btn-semantic-upload').addEventListener('click', () =>
        document.getElementById('file-semantic').click());
    document.getElementById('file-semantic').addEventListener('change', e =>
        handleFileUpload(e.target.files[0], 'semantic-json'));
}

function renderFieldChips(fields) {
    const container = document.getElementById('semantic-field-chips');
    container.innerHTML = '';
    fields.forEach(f => {
        const chip = document.createElement('span');
        chip.className = 'status-badge ' + (_semanticFields.has(f) ? 'status-success' : 'status-info');
        chip.style.cursor = 'pointer';
        chip.innerHTML = `<i class="ti ti-tag"></i> ${escHtml(f)}`;
        chip.addEventListener('click', () => {
            if (_semanticFields.has(f)) _semanticFields.delete(f);
            else _semanticFields.add(f);
            chip.className = 'status-badge ' + (_semanticFields.has(f) ? 'status-success' : 'status-info');
        });
        container.appendChild(chip);
    });
}

function setSemanticTerm(term) { $val('semantic-search-term', term); }

async function semanticSearch() {
    const jsonContent = $val('semantic-json').trim();
    const searchTerm  = $val('semantic-search-term').trim();
    const resultsDiv  = document.getElementById('semantic-results');

    if (!jsonContent) { showError(resultsDiv, 'Please provide JSON content'); return; }
    if (!searchTerm)  { showError(resultsDiv, 'Please enter a search term'); return; }

    const fields = [..._semanticFields];
    if (fields.length === 0) { showError(resultsDiv, 'Please select at least one field to index'); return; }

    showLoading(resultsDiv, `Building semantic index on [${fields.join(', ')}] and searching for "${searchTerm}"…`);

    try {
        let detectedCollections = [];
        try {
            const parsed = JSON.parse(jsonContent);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                detectedCollections = Object.entries(parsed)
                    .filter(([, v]) => Array.isArray(v))
                    .map(([k]) => k);
            }
        } catch { /* fall through */ }

        const scanRes = await apiFetch('/api/scan/byte-range', {
            jsonContent,
            targetCollections: detectedCollections.length > 0 ? detectedCollections : null,
            calculateHashes: false,
            validateUtf8: false,
            includeJsonContent: true
        });

        if (!scanRes.success) { showError(resultsDiv, scanRes.error || 'Scan failed'); return; }

        const allObjects = Object.values(scanRes.collections).flat();
        const index = buildClientSemanticIndex(allObjects, fields, searchTerm.toLowerCase());

        renderSemanticResults(resultsDiv, index, searchTerm, allObjects, fields, scanRes.stats);
    } catch (err) {
        showError(resultsDiv, `Error: ${err.message}`);
    }
}

function buildClientSemanticIndex(objects, fields, prefix) {
    const matches = [];
    const lowerPrefix = prefix.toLowerCase();

    objects.forEach((obj, idx) => {
        if (!obj.jsonContent) return;
        let parsed;
        try { parsed = JSON.parse(obj.jsonContent); } catch { return; }

        const words = extractWords(parsed, fields);
        const matchedWords = words.filter(w => w.toLowerCase().startsWith(lowerPrefix));

        if (matchedWords.length > 0) {
            matches.push({ obj, matchedWords: [...new Set(matchedWords)], idx });
        }
    });

    return matches;
}

function extractWords(obj, fields) {
    const words = [];
    if (typeof obj !== 'object' || obj === null) return words;

    for (const [key, val] of Object.entries(obj)) {
        const shouldIndex = fields.length === 0 ||
            fields.some(f => f.toLowerCase() === key.toLowerCase());
        if (!shouldIndex) continue;
        collectStrings(val, words);
    }
    return words;
}

function collectStrings(val, out) {
    if (typeof val === 'string') {
        val.split(/[\s,.\-_/();:]+/).filter(w => w.length >= 2).forEach(w => out.push(w));
    } else if (Array.isArray(val)) {
        val.forEach(v => collectStrings(v, out));
    } else if (typeof val === 'object' && val !== null) {
        Object.values(val).forEach(v => collectStrings(v, out));
    }
}

function renderSemanticResults(container, matches, searchTerm, allObjects, fields, stats) {
    let html = alertBanner('success',
        `<i class="ti ti-brain"></i> Indexed <strong>${allObjects.length}</strong> objects across fields [${fields.map(f => `<code>${escHtml(f)}</code>`).join(', ')}] — found <strong>${matches.length}</strong> match(es) for "<strong>${escHtml(searchTerm)}</strong>"`
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

    html += `<h3 style="margin:var(--space-md) 0 var(--space-sm)"><i class="ti ti-brain"></i> Matching Objects <span class="status-badge status-enabled">${matches.length} results</span></h3>`;

    matches.forEach(({ obj, matchedWords }, i) => {
        html += `<div class="card" style="margin-bottom:var(--space-sm);padding:0;overflow:hidden">
            <div class="grid-between" style="padding:var(--space-sm) var(--space-md);background:var(--bg-tertiary);border-bottom:1px solid var(--border-color)">
                <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:8px;align-items:center">
                    <strong>Match #${i + 1}</strong>
                    <span class="status-badge status-info"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                    <span class="status-badge status-warning">byte ${obj.startPosition.toLocaleString()}</span>
                </div>
                <div style="display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:4px">
                    ${matchedWords.slice(0, 5).map(w =>
                        `<span class="status-badge status-success"><i class="ti ti-tag"></i> ${escHtml(w)}</span>`
                    ).join('')}
                </div>
            </div>
            <div style="position:relative">
                <pre style="margin:0;border-radius:0;max-height:220px;overflow-y:auto;border-left:none"><code>${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                <button class="btn-secondary" style="position:absolute;top:6px;right:6px;padding:3px 8px;font-size:var(--text-xs)" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;

    // Highlight search term in rendered text nodes
    if (searchTerm) {
        container.querySelectorAll('pre code').forEach(block => {
            highlightTextInElement(block, searchTerm);
        });
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

// ── Validation ────────────────────────────────────────────────────────────────

function initValidate() {
    document.getElementById('btn-validate-valid-example').addEventListener('click', () => {
        $val('validate-json', SAMPLE_DATA.validate.validJson);
        clear('validate-results');
    });
    document.getElementById('btn-validate-invalid-example').addEventListener('click', () => {
        $val('validate-json', SAMPLE_DATA.validate.invalidJson);
        clear('validate-results');
    });
    document.getElementById('btn-validate-run').addEventListener('click', validateJson);
    document.getElementById('btn-validate-upload').addEventListener('click', () =>
        document.getElementById('file-validate').click());
    document.getElementById('file-validate').addEventListener('change', e =>
        handleFileUpload(e.target.files[0], 'validate-json'));
}

async function validateJson() {
    const jsonContent = $val('validate-json').trim();
    const resultsDiv  = document.getElementById('validate-results');

    if (!jsonContent) { showError(resultsDiv, 'Please provide JSON content'); return; }

    showLoading(resultsDiv, 'Validating…');

    try {
        const res = await apiFetch('/api/scan/validate', { jsonContent });
        if (res.success) {
            renderValidateResults(resultsDiv, res, jsonContent);
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

async function apiFetch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
}

function handleFileUpload(file, targetId) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
        showError(document.getElementById(targetId).closest('.section').querySelector('[id$="-results"]') || document.body,
            `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
        return;
    }
    if (!file.name.endsWith('.json')) {
        return;
    }
    const reader = new FileReader();
    reader.onload = e => $val(targetId, e.target.result);
    reader.readAsText(file);
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
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function $val(id, val) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (val !== undefined) { el.value = val; return val; }
    return el.value;
}

function clear(id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
}

function show(el) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.style.display = '';
}

function hide(el) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.style.display = 'none';
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
