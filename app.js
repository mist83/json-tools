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
    // Highlight static code blocks in About tab
    if (window.Prism) Prism.highlightAll();
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
        const tab = activeTab();
        clearTab(tab);
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
    const barPct = Math.min(100, throughputMBs * 10); // scale: 10 MB/s = 100%

    let html = alert('success', `<i class="ti ti-check"></i> Scan complete — ${stats.totalObjectsFound} objects in ${stats.collectionsScanned} collection(s)`);

    // Stats
    html += `<div class="stats-grid">
        ${statCard(stats.collectionsScanned, 'Collections')}
        ${statCard(stats.totalObjectsFound, 'Objects Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Processed')}
        ${statCard(stats.processingTimeMs.toFixed(1) + ' ms', 'API Time')}
    </div>`;

    // Throughput bar
    html += `<div class="throughput-bar-wrap">
        <div class="throughput-bar-label">Throughput: ${throughputMBs.toFixed(1)} MB/s</div>
        <div class="throughput-bar-track"><div class="throughput-bar-fill" style="width:${barPct}%"></div></div>
    </div>`;

    // Collections
    for (const [name, objects] of Object.entries(collections)) {
        html += `<div class="result-section">
            <h3><i class="ti ti-folder"></i> ${escHtml(name)} <span class="badge">${objects.length} objects</span></h3>`;

        objects.forEach((obj, i) => {
            const pct = totalBytes > 0
                ? ((obj.startPosition / totalBytes) * 100).toFixed(1)
                : 0;
            const widthPct = totalBytes > 0
                ? Math.max(1, (obj.length / totalBytes) * 100).toFixed(2)
                : 1;

            html += `<div class="result-item">
                <div class="result-item-header">
                    <div class="left">
                        <span style="font-weight:600">Object #${i + 1}</span>
                        <span class="badge"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                    </div>
                    <div class="right">
                        <span class="badge orange">idx ${obj.itemIndex}</span>
                    </div>
                </div>
                <div class="byte-range-viz">
                    <span>Byte range: <strong>${obj.startPosition.toLocaleString()}</strong> → <strong>${(obj.startPosition + obj.length).toLocaleString()}</strong> (${pct}% into file)</span>
                    <div class="range-bar">
                        <div class="range-fill" style="left:${pct}%;width:${widthPct}%"></div>
                    </div>
                </div>
                ${obj.hash ? `<div class="hash-line">MD5: <span>${obj.hash}</span></div>` : ''}
                <div class="code-wrap">
                    <pre><code class="language-json">${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                    <button class="copy-btn" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    container.innerHTML = html;
    highlightAll(container);
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

    let html = alert('success', `<i class="ti ti-check"></i> Found <strong>${objects.length}</strong> object(s) at <code>${escHtml(jsonPath)}</code>`);

    html += `<div class="stats-grid">
        ${statCard(objects.length, 'Objects Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Processed')}
        ${statCard(stats.processingTimeMs.toFixed(1) + ' ms', 'API Time')}
    </div>`;

    if (objects.length === 0) {
        html += alert('warning', '<i class="ti ti-alert-triangle"></i> No objects found at the specified path');
        container.innerHTML = html;
        return;
    }

    html += `<div class="result-section"><h3><i class="ti ti-list"></i> Extracted Objects</h3>`;

    objects.forEach((obj, i) => {
        const pct = totalBytes > 0 ? ((obj.startPosition / totalBytes) * 100).toFixed(1) : 0;
        const widthPct = totalBytes > 0 ? Math.max(1, (obj.length / totalBytes) * 100).toFixed(2) : 1;

        html += `<div class="result-item">
            <div class="result-item-header">
                <div class="left">
                    <span style="font-weight:600">Object #${i + 1}</span>
                    <span class="badge"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                </div>
                <div class="right">
                    ${obj.hash ? `<span class="badge purple" title="${obj.hash}">MD5: ${obj.hash.slice(0,8)}…</span>` : ''}
                </div>
            </div>
            <div class="byte-range-viz">
                <span>Byte range: <strong>${obj.startPosition.toLocaleString()}</strong> → <strong>${(obj.startPosition + obj.length).toLocaleString()}</strong> (${pct}% into file)</span>
                <div class="range-bar">
                    <div class="range-fill" style="left:${pct}%;width:${widthPct}%"></div>
                </div>
            </div>
            <div class="code-wrap">
                <pre><code class="language-json">${escHtml(prettyJson(obj.jsonContent || ''))}</code></pre>
                <button class="copy-btn" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    highlightAll(container);
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

    // Live search: debounce 400ms after typing
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

    let html = alert('success', `<i class="ti ti-check"></i> Index built — <strong>${totalIndexed.toLocaleString()}</strong> terms indexed`);

    html += `<div class="stats-grid">
        ${statCard(totalIndexed.toLocaleString(), 'Terms Indexed')}
        ${statCard(searchTerm ? `"${escHtml(searchTerm)}"` : '—', 'Search Prefix')}
        ${statCard(matches.length, 'Matches')}
    </div>`;

    if (matches.length > 0) {
        html += `<div class="result-section">
            <h3><i class="ti ti-search"></i> Matching Terms <span class="badge green">${matches.length} results</span></h3>
            <div class="tag-cloud">`;
        matches.forEach(m => {
            const highlighted = searchTerm
                ? escHtml(m).replace(
                    new RegExp(`^(${escRegex(escHtml(searchTerm))})`, 'i'),
                    '<span class="match-highlight">$1</span>'
                  )
                : escHtml(m);
            html += `<span class="tag" onclick="setSearchTerm('${escHtml(m)}')">${highlighted}</span>`;
        });
        html += `</div></div>`;
    } else if (searchTerm) {
        html += alert('warning', `<i class="ti ti-alert-triangle"></i> No matches for "<strong>${escHtml(searchTerm)}</strong>"`);
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

        // Build field chips
        _semanticFields = new Set(d.indexedFields);
        renderFieldChips(d.indexedFields);

        // Term suggestions
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
        chip.className = 'field-chip' + (_semanticFields.has(f) ? ' active' : '');
        chip.innerHTML = `<i class="ti ti-tag"></i> ${escHtml(f)}`;
        chip.addEventListener('click', () => {
            if (_semanticFields.has(f)) _semanticFields.delete(f);
            else _semanticFields.add(f);
            chip.classList.toggle('active', _semanticFields.has(f));
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
        // Step 1: byte-range scan to get all objects
        const scanRes = await apiFetch('/api/scan/byte-range', {
            jsonContent,
            targetCollections: [],
            calculateHashes: false,
            validateUtf8: false
        });

        if (!scanRes.success) { showError(resultsDiv, scanRes.error || 'Scan failed'); return; }

        // Step 2: client-side semantic index (trie of keyword → object indices)
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
    let html = alert('success',
        `<i class="ti ti-brain"></i> Indexed <strong>${allObjects.length}</strong> objects across fields [${fields.map(f => `<code>${escHtml(f)}</code>`).join(', ')}] — found <strong>${matches.length}</strong> match(es) for "<strong>${escHtml(searchTerm)}</strong>"`
    );

    html += `<div class="stats-grid">
        ${statCard(allObjects.length, 'Objects Indexed')}
        ${statCard(fields.length, 'Fields Indexed')}
        ${statCard(matches.length, 'Matches Found')}
        ${statCard(fmtBytes(stats.bytesProcessed), 'Bytes Scanned')}
    </div>`;

    if (matches.length === 0) {
        html += alert('warning', `<i class="ti ti-alert-triangle"></i> No objects matched "<strong>${escHtml(searchTerm)}</strong>" in fields [${fields.join(', ')}]`);
        container.innerHTML = html;
        return;
    }

    html += `<div class="result-section"><h3><i class="ti ti-brain"></i> Matching Objects <span class="badge purple">${matches.length} results</span></h3>`;

    matches.forEach(({ obj, matchedWords }, i) => {
        const pretty = prettyJson(obj.jsonContent || '');
        const highlighted = highlightTermInJson(pretty, searchTerm);

        html += `<div class="semantic-match">
            <div class="semantic-match-header">
                <div>
                    <span style="font-weight:600">Match #${i + 1}</span>
                    <span class="badge" style="margin-left:8px"><i class="ti ti-ruler"></i> ${fmtBytes(obj.length)}</span>
                    <span class="badge orange" style="margin-left:4px">byte ${obj.startPosition.toLocaleString()}</span>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${matchedWords.slice(0, 5).map(w =>
                        `<span class="badge purple"><i class="ti ti-tag"></i> ${escHtml(w)}</span>`
                    ).join('')}
                </div>
            </div>
            <div class="code-wrap">
                <pre><code class="language-json">${highlighted}</code></pre>
                <button class="copy-btn" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    highlightAll(container);
}

function highlightTermInJson(jsonText, term) {
    // Escape for HTML first, then highlight the search term
    const escaped = escHtml(jsonText);
    if (!term) return escaped;
    const re = new RegExp(`(${escRegex(escHtml(term))})`, 'gi');
    return escaped.replace(re, '<mark style="background:rgba(255,193,7,0.3);color:#FFD54F;border-radius:2px;padding:0 1px">$1</mark>');
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
        ? alert('success', '<i class="ti ti-shield-check"></i> <strong>All checks passed</strong> — this JSON is valid and UTF-8 safe')
        : alert('error',   '<i class="ti ti-shield-x"></i> <strong>Validation failed</strong> — see details below');

    html += `<div class="stats-grid">
        ${statCard(fmtBytes(bytes), 'Bytes Checked')}
        ${statCard(allPass ? '✓ Valid' : '✗ Invalid', 'Overall')}
    </div>`;

    html += `<div class="validation-result">
        <div class="validation-check ${res.isValidStructure ? 'pass' : 'fail'}">
            <div class="validation-icon ${res.isValidStructure ? 'pass' : 'fail'}">
                <i class="ti ti-${res.isValidStructure ? 'check' : 'x'}"></i>
            </div>
            <div>
                <div class="validation-label">JSON Structure</div>
                <div class="validation-detail">${res.isValidStructure
                    ? 'Balanced braces, valid syntax, parseable by JsonDocument'
                    : 'Invalid JSON — unbalanced braces, missing quotes, or syntax error'}</div>
            </div>
        </div>
        <div class="validation-check ${res.isValidUtf8 ? 'pass' : 'fail'}">
            <div class="validation-icon ${res.isValidUtf8 ? 'pass' : 'fail'}">
                <i class="ti ti-${res.isValidUtf8 ? 'check' : 'x'}"></i>
            </div>
            <div>
                <div class="validation-label">UTF-8 Delimiter Safety</div>
                <div class="validation-detail">${res.isValidUtf8
                    ? 'No multi-byte sequences overlap JSON delimiters ({ } " \\)'
                    : `Unsafe sequence: ${escHtml(res.utf8Error || 'multi-byte character overlaps a JSON delimiter')}`}</div>
            </div>
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
        alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
        return;
    }
    if (!file.name.endsWith('.json')) {
        alert('Please upload a .json file');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => $val(targetId, e.target.result);
    reader.onerror = () => alert('Error reading file');
    reader.readAsText(file);
}

function showLoading(container, msg) {
    container.innerHTML = `<div class="loading-message"><div class="spinner"></div>${escHtml(msg)}</div>`;
}

function showError(container, msg) {
    container.innerHTML = `<div class="alert error"><i class="ti ti-alert-circle"></i> ${msg}</div>`;
}

function alert(type, html) {
    return `<div class="alert ${type}">${html}</div>`;
}

function statCard(value, label) {
    return `<div class="stat-card">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${label}</span>
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

function highlightAll(container) {
    if (!window.Prism) return;
    container.querySelectorAll('pre code').forEach(block => {
        Prism.highlightElement(block);
    });
}

function animateBars(container) {
    // Trigger CSS transition on throughput bars
    requestAnimationFrame(() => {
        container.querySelectorAll('.throughput-bar-fill').forEach(bar => {
            const target = bar.style.width;
            bar.style.width = '0%';
            requestAnimationFrame(() => { bar.style.width = target; });
        });
    });
}

function copyCode(btn) {
    const pre = btn.closest('.code-wrap').querySelector('pre');
    const text = pre.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="ti ti-copy"></i> Copy';
        }, 2000);
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 2000);
    });
}
