// Suite: Plugin Registry (MatchEngine, Tokenizer, DataGenerator, ApiTransport)
const { assertContains, sleep } = require('./helpers');

module.exports = {
    name: 'Plugin Registry',
    tests: [
        // ── MatchEngine ──────────────────────────────────────────────────────
        {
            name: 'MatchEngine: prefix engine matches correctly',
            async fn(page) {
                const result = await page.evaluate(() => {
                    return PluginRegistry.MatchEngine.match('wireless', 'wire');
                });
                if (!result) throw new Error('prefix engine should match "wireless" with query "wire"');
            }
        },
        {
            name: 'MatchEngine: prefix engine rejects non-prefix',
            async fn(page) {
                const result = await page.evaluate(() => {
                    return PluginRegistry.MatchEngine.match('wireless', 'less');
                });
                if (result) throw new Error('prefix engine should NOT match "wireless" with query "less"');
            }
        },
        {
            name: 'MatchEngine: contains engine finds substrings',
            async fn(page) {
                const result = await page.evaluate(() => {
                    PluginRegistry.MatchEngine.setActive('contains');
                    const r = PluginRegistry.MatchEngine.match('wireless', 'less');
                    PluginRegistry.MatchEngine.setActive('prefix'); // restore
                    return r;
                });
                if (!result) throw new Error('contains engine should match "wireless" with query "less"');
            }
        },
        {
            name: 'MatchEngine: exact engine matches only exact',
            async fn(page) {
                const result = await page.evaluate(() => {
                    PluginRegistry.MatchEngine.setActive('exact');
                    const r1 = PluginRegistry.MatchEngine.match('wireless', 'wireless');
                    const r2 = PluginRegistry.MatchEngine.match('wireless', 'wire');
                    PluginRegistry.MatchEngine.setActive('prefix');
                    return { r1, r2 };
                });
                if (!result.r1) throw new Error('exact engine should match "wireless" === "wireless"');
                if (result.r2) throw new Error('exact engine should NOT match "wireless" with "wire"');
            }
        },
        {
            name: 'MatchEngine: fuzzy engine tolerates typos',
            async fn(page) {
                const result = await page.evaluate(() => {
                    PluginRegistry.MatchEngine.setActive('fuzzy');
                    const r = PluginRegistry.MatchEngine.match('wireless', 'wireles'); // 1 char off
                    PluginRegistry.MatchEngine.setActive('prefix');
                    return r;
                });
                if (!result) throw new Error('fuzzy engine should match "wireless" with "wireles" (1 char off)');
            }
        },
        {
            name: 'MatchEngine: register() adds custom engine',
            async fn(page) {
                const result = await page.evaluate(() => {
                    PluginRegistry.MatchEngine.register('backwards', (word, query) =>
                        word.split('').reverse().join('').toLowerCase().startsWith(query.toLowerCase())
                    );
                    PluginRegistry.MatchEngine.setActive('backwards');
                    const r = PluginRegistry.MatchEngine.match('hello', 'oll'); // "olleh" starts with "oll"
                    PluginRegistry.MatchEngine.setActive('prefix');
                    return r;
                });
                if (!result) throw new Error('Custom backwards engine should match "hello" with query "oll"');
            }
        },
        {
            name: 'MatchEngine: list() returns all registered engines',
            async fn(page) {
                const engines = await page.evaluate(() => PluginRegistry.MatchEngine.list());
                if (!engines.includes('prefix')) throw new Error('prefix not in engine list');
                if (!engines.includes('contains')) throw new Error('contains not in engine list');
                if (!engines.includes('exact')) throw new Error('exact not in engine list');
                if (!engines.includes('fuzzy')) throw new Error('fuzzy not in engine list');
            }
        },
        {
            name: 'MatchEngine: setActive() throws for unknown engine',
            async fn(page) {
                const threw = await page.evaluate(() => {
                    try {
                        PluginRegistry.MatchEngine.setActive('nonexistent_engine_xyz');
                        return false;
                    } catch (e) {
                        return true;
                    }
                });
                if (!threw) throw new Error('setActive() should throw for unknown engine name');
            }
        },

        // ── Tokenizer ────────────────────────────────────────────────────────
        {
            name: 'Tokenizer: word-split tokenizes correctly',
            async fn(page) {
                const tokens = await page.evaluate(() => {
                    return PluginRegistry.Tokenizer.tokenize('hello world, foo-bar');
                });
                if (!tokens.includes('hello')) throw new Error('word-split should include "hello"');
                if (!tokens.includes('world')) throw new Error('word-split should include "world"');
                if (!tokens.includes('foo')) throw new Error('word-split should include "foo"');
            }
        },
        {
            name: 'Tokenizer: whitespace tokenizer splits on spaces only',
            async fn(page) {
                const tokens = await page.evaluate(() => {
                    PluginRegistry.Tokenizer.setActive('whitespace');
                    const t = PluginRegistry.Tokenizer.tokenize('hello world foo-bar');
                    PluginRegistry.Tokenizer.setActive('word-split');
                    return t;
                });
                if (!tokens.includes('foo-bar')) throw new Error('whitespace tokenizer should keep "foo-bar" as one token');
            }
        },
        {
            name: 'Tokenizer: register() adds custom tokenizer',
            async fn(page) {
                const tokens = await page.evaluate(() => {
                    PluginRegistry.Tokenizer.register('uppercase-only', (val) =>
                        val.match(/[A-Z][a-z]+/g) || []
                    );
                    PluginRegistry.Tokenizer.setActive('uppercase-only');
                    const t = PluginRegistry.Tokenizer.tokenize('Hello World foo bar');
                    PluginRegistry.Tokenizer.setActive('word-split');
                    return t;
                });
                if (!tokens.includes('Hello')) throw new Error('Custom tokenizer should extract "Hello"');
                if (!tokens.includes('World')) throw new Error('Custom tokenizer should extract "World"');
            }
        },
        {
            name: 'Tokenizer: list() returns all registered tokenizers',
            async fn(page) {
                const tokenizers = await page.evaluate(() => PluginRegistry.Tokenizer.list());
                if (!tokenizers.includes('word-split')) throw new Error('word-split not in tokenizer list');
                if (!tokenizers.includes('whitespace')) throw new Error('whitespace not in tokenizer list');
                if (!tokenizers.includes('ngram-2')) throw new Error('ngram-2 not in tokenizer list');
            }
        },

        // ── DataGenerator ────────────────────────────────────────────────────
        {
            name: 'DataGenerator: all 4 built-in types registered',
            async fn(page) {
                const types = await page.evaluate(() => PluginRegistry.DataGenerator.types());
                for (const t of ['ecommerce', 'movies', 'blog', 'employees']) {
                    if (!types.includes(t)) throw new Error(`DataGenerator type "${t}" not registered`);
                }
            }
        },
        {
            name: 'DataGenerator: register() adds custom type',
            async fn(page) {
                const result = await page.evaluate(() => {
                    DataGenerator.register('custom-test', (count) => ({
                        items: Array.from({ length: count }, (_, i) => ({ id: i, name: `item-${i}` }))
                    }));
                    const data = PluginRegistry.DataGenerator.generate('custom-test', 3);
                    return data.items.length;
                });
                if (result !== 3) throw new Error(`Custom generator should produce 3 items, got ${result}`);
            }
        },
        {
            name: 'DataGenerator: generate() throws for unknown type',
            async fn(page) {
                const threw = await page.evaluate(() => {
                    try {
                        PluginRegistry.DataGenerator.generate('nonexistent_type_xyz', 10);
                        return false;
                    } catch (e) {
                        return true;
                    }
                });
                if (!threw) throw new Error('generate() should throw for unknown type');
            }
        },

        // ── ApiTransport ─────────────────────────────────────────────────────
        {
            name: 'ApiTransport: lambda transport is registered and active',
            async fn(page) {
                const active = await page.evaluate(() => PluginRegistry.ApiTransport.getActive());
                if (active !== 'lambda') throw new Error(`Expected lambda transport active, got ${active}`);
            }
        },
        {
            name: 'ApiTransport: mock transport is registered',
            async fn(page) {
                const transports = await page.evaluate(() => PluginRegistry.ApiTransport.list());
                if (!transports.includes('mock')) throw new Error('mock transport not registered');
            }
        },
        {
            name: 'ApiTransport: mock transport returns valid byte-range response',
            async fn(page) {
                const result = await page.evaluate(async () => {
                    PluginRegistry.ApiTransport.setActive('mock');
                    const res = await PluginRegistry.ApiTransport.fetch('/api/scan/byte-range', { jsonContent: '{}' });
                    PluginRegistry.ApiTransport.setActive('lambda');
                    return res;
                });
                if (!result.success) throw new Error('Mock transport should return success:true');
                if (!result.collections) throw new Error('Mock transport should return collections');
            }
        },
        {
            name: 'ApiTransport: mock transport returns valid validate response',
            async fn(page) {
                const result = await page.evaluate(async () => {
                    PluginRegistry.ApiTransport.setActive('mock');
                    const res = await PluginRegistry.ApiTransport.fetch('/api/scan/validate', { jsonContent: '{}' });
                    PluginRegistry.ApiTransport.setActive('lambda');
                    return res;
                });
                if (!result.isValidStructure) throw new Error('Mock validate should return isValidStructure:true');
                if (!result.isValidUtf8) throw new Error('Mock validate should return isValidUtf8:true');
            }
        },
        {
            name: 'ApiTransport: register() adds custom transport',
            async fn(page) {
                const result = await page.evaluate(async () => {
                    PluginRegistry.ApiTransport.register('test-transport', async (path, body) => ({
                        success: true,
                        _transport: 'test',
                        path
                    }));
                    PluginRegistry.ApiTransport.setActive('test-transport');
                    const res = await PluginRegistry.ApiTransport.fetch('/test', {});
                    PluginRegistry.ApiTransport.setActive('lambda');
                    return res;
                });
                if (result._transport !== 'test') throw new Error('Custom transport should be called');
                if (result.path !== '/test') throw new Error('Custom transport should receive path');
            }
        },

        // ── summary() ────────────────────────────────────────────────────────
        {
            name: 'PluginRegistry.summary() returns all 4 slots',
            async fn(page) {
                const summary = await page.evaluate(() => PluginRegistry.summary());
                if (!summary.MatchEngine) throw new Error('summary missing MatchEngine');
                if (!summary.Tokenizer) throw new Error('summary missing Tokenizer');
                if (!summary.DataGenerator) throw new Error('summary missing DataGenerator');
                if (!summary.ApiTransport) throw new Error('summary missing ApiTransport');
                if (summary.MatchEngine.active !== 'prefix') throw new Error('MatchEngine active should be prefix');
                if (summary.ApiTransport.active !== 'lambda') throw new Error('ApiTransport active should be lambda');
            }
        },
    ]
};
