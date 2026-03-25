// Suite: About Tab
const {
    switchTab, assertContains, countElements, exists, sleep
} = require('./helpers');

module.exports = {
    name: 'About Tab',
    tests: [
        {
            name: 'Tab switches to about correctly',
            async fn(page) {
                await switchTab(page, 'about');
                const active = await exists(page, '#content-about.active');
                if (!active) throw new Error('about section not active');
            }
        },
        {
            name: 'About tab shows 6 feature cards',
            async fn(page) {
                await switchTab(page, 'about');
                const cards = await countElements(page, '#content-about .feature-card');
                if (cards < 6) throw new Error(`Expected 6 feature cards, got ${cards}`);
            }
        },
        {
            name: 'Feature cards mention key features',
            async fn(page) {
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about .feature-grid', el => el.textContent);
                assertContains(text, 'Byte-Range', 'Should mention Byte-Range Scanning');
                assertContains(text, 'Path Extraction', 'Should mention Path Extraction');
                assertContains(text, 'Trie', 'Should mention Trie Indexing');
                assertContains(text, 'Semantic', 'Should mention Semantic Search');
                assertContains(text, 'UTF-8', 'Should mention UTF-8 Validation');
                assertContains(text, 'Fluent', 'Should mention Fluent API');
            }
        },
        {
            name: 'Quick Start code block is present and syntax highlighted',
            async fn(page) {
                await switchTab(page, 'about');
                const codeBlock = await exists(page, '#content-about pre code.language-csharp');
                if (!codeBlock) throw new Error('C# code block not found in About tab');
                const tokens = await countElements(page, '#content-about .token');
                if (tokens === 0) throw new Error('No Prism tokens in About code block');
            }
        },
        {
            name: 'Quick Start code contains fluent API example',
            async fn(page) {
                await switchTab(page, 'about');
                const code = await page.$eval('#content-about pre code', el => el.textContent);
                assertContains(code, 'JsonTools.Scan', 'Should show JsonTools.Scan');
                assertContains(code, 'ForCollections', 'Should show ForCollections');
                assertContains(code, 'RunAsync', 'Should show RunAsync');
                assertContains(code, 'BuildSemanticIndex', 'Should show BuildSemanticIndex');
            }
        },
        {
            name: 'Copy button exists on Quick Start code block',
            async fn(page) {
                await switchTab(page, 'about');
                const copyBtn = await exists(page, '#content-about .copy-btn');
                if (!copyBtn) throw new Error('Copy button not found in About tab code block');
            }
        },
        {
            name: 'Test Suite section shows 105 passing badge',
            async fn(page) {
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, '105', 'Should mention 105 tests');
                assertContains(text, 'passing', 'Should say passing');
            }
        },
        {
            name: 'Test Suite section shows 0 failing badge',
            async fn(page) {
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, '0 failing', 'Should show 0 failing');
            }
        },
        {
            name: 'About tab description mentions .NET 8',
            async fn(page) {
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, '.NET 8', 'Should mention .NET 8');
            }
        },
    ]
};
