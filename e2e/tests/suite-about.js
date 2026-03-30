// Suite: About Tab
const { assertContains, exists, countElements, sleep } = require('./helpers');

module.exports = {
    name: 'About Tab',
    tests: [
        {
            name: 'About tab switches correctly',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const active = await exists(page, '#content-about.active');
                if (!active) throw new Error('#content-about not active after clicking About tab');
            }
        },
        {
            name: 'About tab has correct heading',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const h2 = await page.$eval('#content-about h2', el => el.textContent);
                assertContains(h2, 'JsonUtilities');
            }
        },
        {
            name: 'Feature cards grid renders 6 cards',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const cards = await countElements(page, '#content-about .card');
                if (cards < 6) throw new Error(`Expected at least 6 feature cards, got ${cards}`);
            }
        },
        {
            name: 'Feature cards use design system .card class (not custom)',
            async fn(page) {
                await page.click('[data-tab="about"]');
                // Verify cards use .card class from design system
                const hasCards = await exists(page, '#content-about .card');
                if (!hasCards) throw new Error('Feature cards should use .card class');
                // Verify no .feature-card class (old custom class)
                const hasOldClass = await exists(page, '#content-about .feature-card');
                if (hasOldClass) throw new Error('.feature-card class should not exist — use .card');
            }
        },
        {
            name: 'Byte-Range Scanning feature card exists',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, 'Byte-Range Scanning');
            }
        },
        {
            name: 'Trie Indexing feature card exists',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, 'Trie Indexing');
            }
        },
        {
            name: 'Quick Start code block exists',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const codeBlock = await exists(page, '#content-about pre code');
                if (!codeBlock) throw new Error('Quick Start code block not found');
            }
        },
        {
            name: 'Quick Start code contains C# examples',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const code = await page.$eval('#content-about pre code', el => el.textContent);
                assertContains(code, 'JsonTools');
                assertContains(code, 'RunAsync');
            }
        },
        {
            name: 'Test suite section shows 117 passing badge',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const text = await page.$eval('#content-about', el => el.textContent);
                assertContains(text, '117');
                assertContains(text, 'passing');
            }
        },
        {
            name: 'Test suite badges use design system status-badge class',
            async fn(page) {
                await page.click('[data-tab="about"]');
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
            name: 'Sidebar is hidden on About tab',
            async fn(page) {
                await page.click('[data-tab="about"]');
                const hasNoSidebar = await page.$eval('.layout.sidebar-content', el => el.classList.contains('no-sidebar'));
                if (!hasNoSidebar) throw new Error('Sidebar should be hidden on About tab');
            }
        },
    ]
};
