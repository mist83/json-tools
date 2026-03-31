// Suite: About Tab
const { assertContains, exists, countElements, switchTab, waitForAppReady } = require('./helpers');

module.exports = {
    name: 'About Tab',
    tests: [
        {
            name: 'About tab switches correctly',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const active = await exists(page, '#content-about');
                if (!active) throw new Error('#content-about not present after clicking About tab');
            }
        },
        {
            name: 'About tab has correct heading',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const h2 = await page.$eval('#content-about h2', el => el.textContent);
                assertContains(h2, 'JsonUtilities');
            }
        },
        {
            name: 'Feature cards grid renders 6 cards',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const cards = await countElements(page, '#content-about .card');
                if (cards < 6) throw new Error(`Expected at least 6 feature cards, got ${cards}`);
            }
        },
        {
            name: 'Feature cards use design system .card class (not custom)',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const hasCards = await exists(page, '#content-about .card');
                if (!hasCards) throw new Error('Feature cards should use .card class');
                const hasOldClass = await exists(page, '#content-about .feature-card');
                if (hasOldClass) throw new Error('.feature-card class should not exist — use .card');
            }
        },
        {
            name: 'Byte-Range Scanning feature card exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, 'Byte-Range Scanning');
            }
        },
        {
            name: 'Trie Indexing feature card exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, 'Trie Indexing');
            }
        },
        {
            name: 'Quick Start code block exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const codeBlock = await exists(page, '#content-about pre code');
                if (!codeBlock) throw new Error('Quick Start code block not found');
            }
        },
        {
            name: 'Quick Start code contains C# examples',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const code = await page.$eval('#content-about pre code', el => el.textContent);
                assertContains(code, 'JsonTools');
                assertContains(code, 'RunAsync');
            }
        },
        {
            name: 'Test suite section shows 117 passing badge',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, '117');
                assertContains(text, 'passing');
            }
        },
        {
            name: 'Test suite badges use design system status-badge class',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const badges = await countElements(page, '#content-about .status-badge');
                if (badges === 0) throw new Error('No status-badge elements found in About tab');
            }
        },
        {
            name: 'No custom .hero-badge class (replaced by status-badge)',
            async fn(page) {
                const heroBadges = await countElements(page, '.hero-badge');
                if (heroBadges > 0) throw new Error('.hero-badge class should not exist — use .status-badge');
            }
        },
        {
            name: 'Sidebar is not present on About tab',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'about');
                const sidebar = await exists(page, '#tools-sidebar');
                if (sidebar) throw new Error('Sidebar should not be present on About tab');
            }
        },
    ]
};
