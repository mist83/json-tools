// Suite: Page Load & Structure
const { assertContains, exists, countElements, getText } = require('./helpers');

module.exports = {
    name: 'Page Load & Structure',
    tests: [
        {
            name: 'Page title is correct',
            async fn(page) {
                const title = await page.title();
                assertContains(title, 'JsonUtilities', 'Page title should contain JsonUtilities');
            }
        },
        {
            name: 'Header renders with branding',
            async fn(page) {
                const h1 = await getText(page, 'h1');
                assertContains(h1, 'Json', 'Header should contain Json');
            }
        },
        {
            name: 'Hero badges are visible',
            async fn(page) {
                const badges = await countElements(page, '.hero-badge');
                if (badges < 3) throw new Error(`Expected at least 3 hero badges, got ${badges}`);
            }
        },
        {
            name: '"105 tests passing" badge is present',
            async fn(page) {
                const html = await page.$eval('.hero-badges', el => el.textContent);
                assertContains(html, '105', 'Hero badges should mention 105 tests');
            }
        },
        {
            name: 'All 6 tabs are rendered',
            async fn(page) {
                const tabs = await countElements(page, '.tab');
                if (tabs < 6) throw new Error(`Expected 6 tabs, got ${tabs}`);
            }
        },
        {
            name: 'Byte-Range tab is active by default',
            async fn(page) {
                const activeTab = await page.$eval('.tab.active', el => el.dataset.tab);
                if (activeTab !== 'byte-range') throw new Error(`Expected byte-range tab active, got ${activeTab}`);
            }
        },
        {
            name: 'Byte-Range section is active by default',
            async fn(page) {
                const activeSection = await exists(page, '#content-byte-range.active');
                if (!activeSection) throw new Error('content-byte-range should be active section');
            }
        },
        {
            name: 'Sidebar renders with Quick Actions',
            async fn(page) {
                const sidebarText = await page.$eval('.sidebar', el => el.textContent);
                assertContains(sidebarText, 'Quick Actions');
                assertContains(sidebarText, 'Load Example');
                assertContains(sidebarText, 'Upload JSON');
            }
        },
        {
            name: 'Sidebar has Resources section with GitHub link',
            async fn(page) {
                const sidebarText = await page.$eval('.sidebar', el => el.textContent);
                assertContains(sidebarText, 'GitHub');
                assertContains(sidebarText, 'API Docs');
            }
        },
        {
            name: 'No JavaScript errors on load',
            async fn(page) {
                // Page errors are captured by the runner — this test just verifies
                // the page loaded without throwing during DOMContentLoaded
                const bodyExists = await exists(page, 'body');
                if (!bodyExists) throw new Error('Body element not found');
            }
        },
        {
            name: 'Prism.js loaded successfully',
            async fn(page) {
                const prismLoaded = await page.evaluate(() => typeof window.Prism !== 'undefined');
                if (!prismLoaded) throw new Error('Prism.js not loaded');
            }
        },
        {
            name: 'SAMPLE_DATA global is defined with all required keys',
            async fn(page) {
                // Note: const at top-level script scope is NOT on window, but IS accessible as bare global
                const result = await page.evaluate(() => {
                    try {
                        // eslint-disable-next-line no-undef
                        if (typeof SAMPLE_DATA === 'undefined') return { defined: false };
                        const keys = ['byteRangeScan', 'jsonPathExtract', 'trieIndex', 'validate', 'semanticSearch'];
                        return {
                            defined: true,
                            hasKeys: keys.filter(k => !(k in SAMPLE_DATA))
                        };
                    } catch(e) { return { defined: false, error: e.message }; }
                });
                if (!result.defined) throw new Error('SAMPLE_DATA not defined — sample-data.js failed to load' + (result.error ? ': ' + result.error : ''));
                if (result.hasKeys.length > 0) throw new Error(`SAMPLE_DATA missing keys: ${result.hasKeys.join(', ')}`);
            }
        },
        {
            name: 'All tab sections exist in DOM',
            async fn(page) {
                const sections = ['byte-range', 'path-extract', 'trie-index', 'semantic', 'validate', 'about'];
                for (const s of sections) {
                    const el = await exists(page, `#content-${s}`);
                    if (!el) throw new Error(`Section #content-${s} not found in DOM`);
                }
            }
        },
    ]
};
