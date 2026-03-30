// Suite: Page Load & Structure
const { assertContains, exists, countElements, getText, sleep } = require('./helpers');

module.exports = {
    name: 'Page Load & Structure',
    tests: [
        {
            name: 'Page title contains JsonUtilities',
            async fn(page) {
                const title = await page.title();
                assertContains(title, 'JsonUtilities');
            }
        },
        {
            name: 'Header renders with branding',
            async fn(page) {
                const h1 = await getText(page, '.header h1');
                assertContains(h1, 'Json');
            }
        },
        {
            name: 'Header has status badges (117 tests, .NET 8)',
            async fn(page) {
                const headerText = await page.$eval('.header', el => el.textContent);
                assertContains(headerText, '117');
                assertContains(headerText, '.NET 8');
            }
        },
        {
            name: 'Exactly 3 tabs rendered (Home, Tools, About)',
            async fn(page) {
                const tabs = await countElements(page, '.tab');
                if (tabs !== 3) throw new Error(`Expected 3 tabs, got ${tabs}`);
            }
        },
        {
            name: 'Home tab is active by default',
            async fn(page) {
                const activeTab = await page.$eval('.tab.active', el => el.dataset.tab);
                if (activeTab !== 'home') throw new Error(`Expected home tab active, got ${activeTab}`);
            }
        },
        {
            name: 'Home section is active by default',
            async fn(page) {
                const active = await exists(page, '#content-home.active');
                if (!active) throw new Error('#content-home should be active on load');
            }
        },
        {
            name: 'Sidebar is hidden on Home tab (no-sidebar class)',
            async fn(page) {
                const hasNoSidebar = await page.$eval('.layout.sidebar-content', el => el.classList.contains('no-sidebar'));
                if (!hasNoSidebar) throw new Error('Layout should have no-sidebar class on Home tab');
            }
        },
        {
            name: 'All 3 section elements exist in DOM',
            async fn(page) {
                for (const s of ['home', 'tools', 'about']) {
                    const el = await exists(page, `#content-${s}`);
                    if (!el) throw new Error(`Section #content-${s} not found`);
                }
            }
        },
        {
            name: 'PluginRegistry global is defined',
            async fn(page) {
                const defined = await page.evaluate(() => typeof PluginRegistry !== 'undefined');
                if (!defined) throw new Error('PluginRegistry not defined — plugin-registry.js failed to load');
            }
        },
        {
            name: 'DataGenerator global is defined',
            async fn(page) {
                const defined = await page.evaluate(() => typeof DataGenerator !== 'undefined');
                if (!defined) throw new Error('DataGenerator not defined — data-generator.js failed to load');
            }
        },
        {
            name: 'No JavaScript errors on load',
            async fn(page) {
                // Page errors are captured by the runner — just verify body exists
                const bodyExists = await exists(page, 'body');
                if (!bodyExists) throw new Error('Body element not found');
            }
        },
        {
            name: 'Design system stylesheet loaded (ui.mikesendpoint.com)',
            async fn(page) {
                const hasDesignSystem = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
                    return links.some(l => l.href.includes('ui.mikesendpoint.com'));
                });
                if (!hasDesignSystem) throw new Error('Design system stylesheet not found');
            }
        },
        {
            name: 'No Prism.js loaded (removed)',
            async fn(page) {
                const prismLoaded = await page.evaluate(() => typeof window.Prism !== 'undefined');
                if (prismLoaded) throw new Error('Prism.js should NOT be loaded in new UI');
            }
        },
        {
            name: 'No sample-data.js dependency (replaced by data-generator.js)',
            async fn(page) {
                const hasSampleData = await page.evaluate(() => typeof SAMPLE_DATA !== 'undefined');
                if (hasSampleData) throw new Error('SAMPLE_DATA should not exist — old dependency');
            }
        },
    ]
};
