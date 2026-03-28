// plugin-registry.js — Pluggable engine registry for JsonUtilities
// ─────────────────────────────────────────────────────────────────────────────
// Four hot-swappable slots:
//   MatchEngine   — (word, query) => boolean
//   Tokenizer     — (value) => string[]
//   DataGenerator — (count) => object  (registered types)
//   ApiTransport  — (path, body) => Promise<object>
//
// Usage:
//   PluginRegistry.MatchEngine.register('backwards', (w, q) => w.split('').reverse().join('').startsWith(q));
//   PluginRegistry.MatchEngine.setActive('backwards');
//   PluginRegistry.MatchEngine.match('hello', 'oll'); // true
// ─────────────────────────────────────────────────────────────────────────────

const PluginRegistry = (() => {

    // ── Generic slot factory ──────────────────────────────────────────────────

    function makeSlot(defaultName, defaultFn) {
        const _engines = {};
        let _active = defaultName;

        _engines[defaultName] = defaultFn;

        return {
            /** Register a new implementation. Overwrites if name already exists. */
            register(name, fn) {
                if (typeof fn !== 'function') throw new Error(`PluginRegistry: "${name}" must be a function`);
                _engines[name] = fn;
                return this; // chainable
            },

            /** Set the active implementation by name. */
            setActive(name) {
                if (!_engines[name]) throw new Error(`PluginRegistry: unknown engine "${name}". Available: ${Object.keys(_engines).join(', ')}`);
                _active = name;
                return this;
            },

            /** Get the name of the currently active implementation. */
            getActive() { return _active; },

            /** List all registered implementation names. */
            list() { return Object.keys(_engines); },

            /** Get a specific implementation function by name (or active if omitted). */
            get(name) { return _engines[name || _active]; },

            /** Call the active implementation with the given arguments. */
            call(...args) { return _engines[_active](...args); },
        };
    }

    // ── MatchEngine ───────────────────────────────────────────────────────────
    // Signature: (word: string, query: string) => boolean

    const MatchEngine = makeSlot('prefix', (word, query) =>
        word.toLowerCase().startsWith(query.toLowerCase())
    );

    MatchEngine.register('contains', (word, query) =>
        word.toLowerCase().includes(query.toLowerCase())
    );

    MatchEngine.register('exact', (word, query) =>
        word.toLowerCase() === query.toLowerCase()
    );

    MatchEngine.register('fuzzy', (word, query) => {
        // Simple Levenshtein distance — matches if distance <= floor(query.length / 3)
        const w = word.toLowerCase();
        const q = query.toLowerCase();
        if (w.startsWith(q)) return true;
        const maxDist = Math.floor(q.length / 3);
        if (maxDist === 0) return w === q;
        // DP levenshtein on first (q.length + maxDist) chars of word
        const wSlice = w.slice(0, q.length + maxDist);
        const m = wSlice.length, n = q.length;
        const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = wSlice[i - 1] === q[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return Math.min(...dp.map(row => row[n])) <= maxDist;
    });

    // Convenience wrapper used by app.js
    MatchEngine.match = (word, query) => MatchEngine.call(word, query);


    // ── Tokenizer ─────────────────────────────────────────────────────────────
    // Signature: (value: string) => string[]

    const Tokenizer = makeSlot('word-split', (value) =>
        String(value).split(/[\s,.\-_/();:]+/).filter(w => w.length >= 2)
    );

    Tokenizer.register('whitespace', (value) =>
        String(value).split(/\s+/).filter(w => w.length >= 1)
    );

    Tokenizer.register('ngram-2', (value) => {
        const words = String(value).split(/\s+/).filter(w => w.length >= 2);
        const ngrams = [...words];
        for (let i = 0; i < words.length - 1; i++) {
            ngrams.push(`${words[i]} ${words[i + 1]}`);
        }
        return ngrams;
    });

    Tokenizer.register('char-ngram-3', (value) => {
        const s = String(value).toLowerCase().replace(/\s+/g, '');
        const out = [];
        for (let i = 0; i <= s.length - 3; i++) out.push(s.slice(i, i + 3));
        return out;
    });

    // Convenience wrapper used by app.js
    Tokenizer.tokenize = (value) => Tokenizer.call(value);


    // ── DataGenerator ─────────────────────────────────────────────────────────
    // Signature: (count: number) => object
    // Note: built-in types are registered by data-generator.js after it loads.
    // This slot just holds the registry; DataGenerator.js calls register() for each type.

    const DataGeneratorSlot = makeSlot('__placeholder__', () => ({}));

    // Override call to dispatch by type name (different pattern from other slots)
    DataGeneratorSlot.generate = function(type, count) {
        const fn = this.get(type);
        if (!fn) throw new Error(`DataGenerator: unknown type "${type}". Available: ${this.list().filter(n => n !== '__placeholder__').join(', ')}`);
        return fn(count);
    };

    DataGeneratorSlot.types = function() {
        return this.list().filter(n => n !== '__placeholder__');
    };


    // ── ApiTransport ──────────────────────────────────────────────────────────
    // Signature: (path: string, body: object) => Promise<object>

    const API_BASE = 'https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws';
    const LOCAL_API_BASE = 'http://localhost:5968';

    async function postJson(baseUrl, path, body) {
        const target = `${baseUrl}${path}`;
        const res = await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
    }

    const ApiTransport = makeSlot('auto', async (path, body) => {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (isLocalhost && window.location.port === '5968')
            return postJson('', path, body);
        if (isLocalhost)
            return postJson(LOCAL_API_BASE, path, body);
        return postJson(API_BASE, path, body);
    });

    ApiTransport.register('same-origin', async (path, body) => postJson('', path, body));
    ApiTransport.register('localhost', async (path, body) => postJson(LOCAL_API_BASE, path, body));
    ApiTransport.register('lambda', async (path, body) => postJson(API_BASE, path, body));
    ApiTransport.register('browser', async (path, body) => {
        if (!window.JsonToolsBrowserTransport || typeof window.JsonToolsBrowserTransport.fetch !== 'function')
            throw new Error('Browser Preview is not ready yet.');
        return window.JsonToolsBrowserTransport.fetch(path, body);
    });

    // Mock transport for testing — returns canned responses
    ApiTransport.register('mock', async (path, body) => {
        // Minimal mock responses for each endpoint
        if (path.includes('byte-range')) {
            return {
                success: true,
                collections: { mock: [{ startPosition: 0, length: 50, itemIndex: 0, hash: 'abc123', jsonContent: '{"id":1}' }] },
                stats: { collectionsScanned: 1, totalObjectsFound: 1, bytesProcessed: 50, processingTimeMs: 1 }
            };
        }
        if (path.includes('pathscan')) {
            return {
                success: true,
                objects: [{ startPosition: 0, length: 50, jsonContent: '{"id":1}' }],
                stats: { bytesProcessed: 50, processingTimeMs: 1 }
            };
        }
        if (path.includes('trie')) {
            return { success: true, matches: ['mock-term', 'mock-value'], totalIndexed: 42 };
        }
        if (path.includes('validate')) {
            return { success: true, isValidStructure: true, isValidUtf8: true, bytesChecked: 50 };
        }
        if (path.includes('semantic')) {
            return {
                success: true,
                objects: [{ startPosition: 0, length: 50, itemIndex: 0, jsonContent: '{"id":1,"title":"Mock"}' }],
                matchedOffsets: [0],
                indexedFields: ['title'],
                collectionPaths: ['mock'],
                stats: { bytesProcessed: 50, objectsIndexed: 1, matchesFound: 1, collectionsScanned: 1, termsIndexed: 3, processingTimeMs: 1 }
            };
        }
        return { success: true };
    });

    // Convenience wrapper used by app.js
    ApiTransport.fetch = (path, body) => ApiTransport.call(path, body);


    // ── Public API ────────────────────────────────────────────────────────────

    return {
        MatchEngine,
        Tokenizer,
        DataGenerator: DataGeneratorSlot,
        ApiTransport,

        /** Get a summary of all registered plugins for display in the UI. */
        summary() {
            return {
                MatchEngine:   { active: MatchEngine.getActive(),    available: MatchEngine.list() },
                Tokenizer:     { active: Tokenizer.getActive(),      available: Tokenizer.list() },
                DataGenerator: { active: null,                       available: DataGeneratorSlot.types() },
                ApiTransport:  { active: ApiTransport.getActive(),   available: ApiTransport.list() },
            };
        }
    };
})();
