// JsonUtilities Demo - Frontend JavaScript
// API Base URL
const API_BASE = 'https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeSidebar();
    initializeByteRangeExample();
    initializePathExtractExample();
    initializeTrieIndexExample();
});

// ===== Tab Navigation =====
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const sections = document.querySelectorAll('.section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs and sections
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding section
            tab.classList.add('active');
            const targetSection = document.getElementById(`content-${targetTab}`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

// ===== Sidebar Actions =====
function initializeSidebar() {
    // Load Example - triggers the active tab's example button
    document.getElementById('sidebar-load-example').addEventListener('click', () => {
        const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
        
        switch(activeTab) {
            case 'byte-range':
                document.getElementById('btn-byte-range-example').click();
                break;
            case 'path-extract':
                document.getElementById('btn-path-example').click();
                break;
            case 'trie-index':
                document.getElementById('btn-trie-example').click();
                break;
        }
    });
    
    // Upload File - triggers the active tab's upload button
    document.getElementById('sidebar-upload-file').addEventListener('click', () => {
        const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
        
        switch(activeTab) {
            case 'byte-range':
                document.getElementById('btn-byte-range-upload').click();
                break;
            case 'path-extract':
                document.getElementById('btn-path-upload').click();
                break;
            case 'trie-index':
                document.getElementById('btn-trie-upload').click();
                break;
        }
    });
    
    // Clear All - clears inputs and results for active tab
    document.getElementById('sidebar-clear-all').addEventListener('click', () => {
        const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
        
        switch(activeTab) {
            case 'byte-range':
                document.getElementById('byte-range-json').value = '';
                document.getElementById('byte-range-collections').value = '';
                document.getElementById('byte-range-results').innerHTML = '';
                break;
            case 'path-extract':
                document.getElementById('path-extract-json').value = '';
                document.getElementById('path-extract-path').value = '';
                document.getElementById('path-extract-results').innerHTML = '';
                document.getElementById('path-suggestions').innerHTML = '';
                break;
            case 'trie-index':
                document.getElementById('trie-index-json').value = '';
                document.getElementById('trie-search-term').value = '';
                document.getElementById('trie-index-results').innerHTML = '';
                document.getElementById('search-suggestions').innerHTML = '';
                break;
        }
    });
    
    // API Documentation
    document.getElementById('sidebar-api-docs').addEventListener('click', () => {
        window.open('https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws/', '_blank');
    });
    
    // GitHub Repository
    document.getElementById('sidebar-github').addEventListener('click', () => {
        window.open('https://github.com/mist83/json-tools', '_blank');
    });
}

// ===== Byte-Range Scanning =====
function initializeByteRangeExample() {
    const data = SAMPLE_DATA.byteRangeScan;
    document.getElementById('byte-range-description').textContent = data.description;
    
    document.getElementById('btn-byte-range-example').addEventListener('click', () => {
        document.getElementById('byte-range-json').value = data.json;
        document.getElementById('byte-range-collections').value = data.collections.join(', ');
        document.getElementById('byte-range-results').innerHTML = '';
    });
    
    document.getElementById('btn-byte-range-scan').addEventListener('click', () => {
        scanByteRange();
    });
    
    document.getElementById('btn-byte-range-upload').addEventListener('click', () => {
        document.getElementById('file-byte-range').click();
    });
    
    document.getElementById('file-byte-range').addEventListener('change', (e) => {
        handleFileUpload(e.target.files[0], 'byte-range-json');
    });
}

async function scanByteRange() {
    const jsonContent = document.getElementById('byte-range-json').value.trim();
    const collectionsInput = document.getElementById('byte-range-collections').value.trim();
    const calculateHashes = document.getElementById('byte-range-hashes').checked;
    const resultsDiv = document.getElementById('byte-range-results');
    
    if (!jsonContent) {
        showError(resultsDiv, 'Please provide JSON content');
        return;
    }
    
    const collections = collectionsInput ? collectionsInput.split(',').map(c => c.trim()) : [];
    
    showLoading(resultsDiv, 'Scanning collections...');
    
    try {
        const response = await fetch(`${API_BASE}/api/scan/byte-range`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonContent,
                targetCollections: collections,
                calculateHashes,
                validateUtf8: true
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayByteRangeResults(resultsDiv, result);
        } else {
            showError(resultsDiv, result.error || 'Scan failed');
        }
    } catch (error) {
        showError(resultsDiv, `API Error: ${error.message}`);
    }
}

function displayByteRangeResults(container, result) {
    const { collections, stats } = result;
    
    let html = '<div class="success-message"><i class="ti ti-check"></i> Scan completed successfully</div>';
    
    // Stats
    html += '<div class="stats-grid">';
    html += `<div class="stat-card"><strong>Collections Found:</strong> ${stats.collectionsScanned}</div>`;
    html += `<div class="stat-card"><strong>Total Objects:</strong> ${stats.totalObjectsFound}</div>`;
    html += `<div class="stat-card"><strong>Bytes Processed:</strong> ${stats.bytesProcessed.toLocaleString()}</div>`;
    html += `<div class="stat-card"><strong>Processing Time:</strong> ${stats.processingTimeMs.toFixed(2)}ms</div>`;
    html += '</div>';
    
    // Collections
    for (const [collectionName, objects] of Object.entries(collections)) {
        html += `<div class="result-section">`;
        html += `<h3><i class="ti ti-folder"></i> Collection: ${collectionName} (${objects.length} objects)</h3>`;
        
        objects.forEach((obj, idx) => {
            html += `<div class="result-item">`;
            html += `<div class="result-header">Object #${idx + 1} <span class="badge">Position: ${obj.startPosition}-${obj.startPosition + obj.length}</span></div>`;
            if (obj.hash) {
                html += `<div class="text-muted">Hash: ${obj.hash}</div>`;
            }
            html += `<pre class="code-block">${escapeHtml(obj.jsonContent || '')}</pre>`;
            html += `</div>`;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

// ===== JSON Path Extraction =====
function initializePathExtractExample() {
    const data = SAMPLE_DATA.jsonPathExtract;
    document.getElementById('path-extract-description').textContent = data.description;
    
    document.getElementById('btn-path-example').addEventListener('click', () => {
        document.getElementById('path-extract-json').value = data.json;
        document.getElementById('path-extract-path').value = data.paths[0].path;
        
        // Show path suggestions
        const suggestionsDiv = document.getElementById('path-suggestions');
        suggestionsDiv.innerHTML = '<strong>Try these paths:</strong><br>' + 
            data.paths.map(p => `<button class="btn-link" onclick="setPath('${p.path}')">${p.path}</button> - ${p.description}`).join('<br>');
        
        document.getElementById('path-extract-results').innerHTML = '';
    });
    
    document.getElementById('btn-path-extract').addEventListener('click', () => {
        extractByPath();
    });
    
    document.getElementById('btn-path-upload').addEventListener('click', () => {
        document.getElementById('file-path-extract').click();
    });
    
    document.getElementById('file-path-extract').addEventListener('change', (e) => {
        handleFileUpload(e.target.files[0], 'path-extract-json');
    });
}

function setPath(path) {
    document.getElementById('path-extract-path').value = path;
}

async function extractByPath() {
    const jsonContent = document.getElementById('path-extract-json').value.trim();
    const jsonPath = document.getElementById('path-extract-path').value.trim();
    const resultsDiv = document.getElementById('path-extract-results');
    
    if (!jsonContent) {
        showError(resultsDiv, 'Please provide JSON content');
        return;
    }
    
    if (!jsonPath) {
        showError(resultsDiv, 'Please provide a JSON path');
        return;
    }
    
    showLoading(resultsDiv, 'Extracting objects...');
    
    try {
        const response = await fetch(`${API_BASE}/api/pathscan/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonContent,
                jsonPath
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayPathExtractResults(resultsDiv, result, jsonPath);
        } else {
            showError(resultsDiv, result.error || 'Extraction failed');
        }
    } catch (error) {
        showError(resultsDiv, `API Error: ${error.message}`);
    }
}

function displayPathExtractResults(container, result, jsonPath) {
    const { objects, stats } = result;
    
    let html = '<div class="success-message"><i class="ti ti-check"></i> Extraction completed successfully</div>';
    
    // Stats
    html += '<div class="stats-grid">';
    html += `<div class="stat-card"><strong>Path:</strong> ${jsonPath}</div>`;
    html += `<div class="stat-card"><strong>Objects Found:</strong> ${stats.totalObjectsFound}</div>`;
    html += `<div class="stat-card"><strong>Bytes Processed:</strong> ${stats.bytesProcessed.toLocaleString()}</div>`;
    html += `<div class="stat-card"><strong>Processing Time:</strong> ${stats.processingTimeMs.toFixed(2)}ms</div>`;
    html += '</div>';
    
    // Objects
    if (objects.length > 0) {
        html += `<div class="result-section">`;
        html += `<h3><i class="ti ti-list"></i> Extracted Objects (${objects.length})</h3>`;
        
        objects.forEach((obj, idx) => {
            html += `<div class="result-item">`;
            html += `<div class="result-header">Object #${idx + 1} <span class="badge">Position: ${obj.startPosition}-${obj.startPosition + obj.length}</span></div>`;
            if (obj.hash) {
                html += `<div class="text-muted">Hash: ${obj.hash}</div>`;
            }
            html += `<pre class="code-block">${escapeHtml(obj.jsonContent || '')}</pre>`;
            html += `</div>`;
        });
        
        html += `</div>`;
    } else {
        html += '<div class="warning-message">No objects found at the specified path</div>';
    }
    
    container.innerHTML = html;
}

// ===== Trie Indexing =====
function initializeTrieIndexExample() {
    const data = SAMPLE_DATA.trieIndex;
    document.getElementById('trie-index-description').textContent = data.description;
    
    document.getElementById('btn-trie-example').addEventListener('click', () => {
        document.getElementById('trie-index-json').value = data.json;
        document.getElementById('trie-search-term').value = data.searchTerms[0];
        
        // Show search suggestions
        const suggestionsDiv = document.getElementById('search-suggestions');
        suggestionsDiv.innerHTML = '<strong>Try searching:</strong><br>' + 
            data.searchTerms.map(term => `<button class="btn-link" onclick="setSearchTerm('${term}')">${term}</button>`).join(' ');
        
        document.getElementById('trie-index-results').innerHTML = '';
    });
    
    document.getElementById('btn-trie-index').addEventListener('click', () => {
        indexAndSearch();
    });
    
    document.getElementById('btn-trie-upload').addEventListener('click', () => {
        document.getElementById('file-trie-index').click();
    });
    
    document.getElementById('file-trie-index').addEventListener('change', (e) => {
        handleFileUpload(e.target.files[0], 'trie-index-json');
    });
}

function setSearchTerm(term) {
    document.getElementById('trie-search-term').value = term;
}

async function indexAndSearch() {
    const jsonContent = document.getElementById('trie-index-json').value.trim();
    const searchTerm = document.getElementById('trie-search-term').value.trim();
    const resultsDiv = document.getElementById('trie-index-results');
    
    if (!jsonContent) {
        showError(resultsDiv, 'Please provide JSON content');
        return;
    }
    
    showLoading(resultsDiv, 'Building index and searching...');
    
    try {
        const response = await fetch(`${API_BASE}/api/trie/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonContent,
                searchTerm
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayTrieResults(resultsDiv, result, searchTerm);
        } else {
            showError(resultsDiv, result.error || 'Indexing failed');
        }
    } catch (error) {
        showError(resultsDiv, `API Error: ${error.message}`);
    }
}

function displayTrieResults(container, result, searchTerm) {
    const { matches, totalIndexed } = result;
    
    let html = '<div class="success-message"><i class="ti ti-check"></i> Indexing completed successfully</div>';
    
    // Stats
    html += '<div class="stats-grid">';
    html += `<div class="stat-card"><strong>Total Indexed:</strong> ${totalIndexed.toLocaleString()} terms</div>`;
    html += `<div class="stat-card"><strong>Search Term:</strong> "${searchTerm || '(none)'}"</div>`;
    html += `<div class="stat-card"><strong>Matches Found:</strong> ${matches.length}</div>`;
    html += '</div>';
    
    // Matches
    if (matches.length > 0) {
        html += `<div class="result-section">`;
        html += `<h3><i class="ti ti-search"></i> Matching Terms</h3>`;
        html += `<div class="tag-cloud">`;
        matches.forEach(match => {
            html += `<span class="tag">${escapeHtml(match)}</span>`;
        });
        html += `</div>`;
        html += `</div>`;
    } else if (searchTerm) {
        html += '<div class="warning-message">No matches found for the search term</div>';
    }
    
    container.innerHTML = html;
}

// ===== Utility Functions =====
function handleFileUpload(file, targetTextareaId) {
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
        alert(`File size exceeds 5MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        alert('Please upload a JSON file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById(targetTextareaId).value = e.target.result;
    };
    reader.onerror = () => {
        alert('Error reading file');
    };
    reader.readAsText(file);
}

function showLoading(container, message) {
    container.innerHTML = `<div class="loading-message"><i class="ti ti-loader"></i> ${message}</div>`;
}

function showError(container, message) {
    container.innerHTML = `<div class="error-message"><i class="ti ti-alert-circle"></i> ${message}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
