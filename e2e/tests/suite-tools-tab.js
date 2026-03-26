// Suite: Tools Tab & Sidebar Navigation
const { assertContains, exists, countElements, sleep, waitForText } = require('./helpers');

async function loadDataAndGoToTools(page) {
    // Clear storage, generate data, go to tools
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await page.select('#gen-type', 'ecommerce');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await page.click('[data-tab="tools"]');
    await sleep(300);
}

module.exports = {
    name: 'Tools Tab & Sidebar Navigation',
    tests: [
        {
            name: 'Tools tab switches correctly',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                const active = await exists(page, '#content-tools.active');
                if (!active) throw new Error('#content-tools not active after clicking Tools tab');
            }
        },
        {
            name: 'Sidebar is visible on Tools tab',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                const hasNoSidebar = await page.$eval('.layout.sidebar-content', el => el.classList.contains('no-sidebar'));
                if (hasNoSidebar) throw new Error('Sidebar should be visible on Tools tab (no no-sidebar class)');
            }
        },
        {
            name: 'Sidebar is hidden on Home tab',
            async fn(page) {
                await page.click('[data-tab="home"]');
                const hasNoSidebar = await page.$eval('.layout.sidebar-content', el => el.classList.contains('no-sidebar'));
                if (!hasNoSidebar) throw new Error('Sidebar should be hidden on Home tab');
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
        {
            name: 'No-data banner shows when no dataset loaded',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await page.click('[data-tab="tools"]');
                await sleep(200);
                const bannerVisible = await page.$eval('#no-data-banner', el => el.classList.contains('visible'));
                if (!bannerVisible) throw new Error('No-data banner should be visible when no dataset loaded');
            }
        },
        {
            name: 'No-data banner hides after dataset loaded',
            async fn(page) {
                await loadDataAndGoToTools(page);
                const bannerVisible = await page.$eval('#no-data-banner', el => el.classList.contains('visible'));
                if (bannerVisible) throw new Error('No-data banner should be hidden after dataset loaded');
            }
        },
        {
            name: 'Sidebar has all 5 tool items',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                const tools = await countElements(page, '.sidebar-item[data-tool]');
                if (tools !== 5) throw new Error(`Expected 5 tool items in sidebar, got ${tools}`);
            }
        },
        {
            name: 'Sidebar dataset label shows "No data loaded" initially',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                const label = await page.$eval('#sidebar-dataset-label', el => el.textContent);
                assertContains(label, 'No data loaded');
            }
        },
        {
            name: 'Sidebar dataset label updates after data loaded',
            async fn(page) {
                await loadDataAndGoToTools(page);
                const label = await page.$eval('#sidebar-dataset-label', el => el.textContent);
                assertContains(label, 'KB', 'Sidebar label should show file size');
            }
        },
        {
            name: 'Clicking sidebar dataset label navigates to Home',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('#sidebar-dataset-info');
                await sleep(200);
                const active = await exists(page, '#content-home.active');
                if (!active) throw new Error('Clicking dataset label should navigate to Home tab');
            }
        },
        {
            name: 'All 5 tool panels exist in DOM',
            async fn(page) {
                for (const tool of ['byte-range', 'path-extract', 'trie-index', 'semantic', 'validate']) {
                    const el = await exists(page, `#tool-${tool}`);
                    if (!el) throw new Error(`Tool panel #tool-${tool} not found`);
                }
            }
        },
        {
            name: 'Byte-Range tool panel is active by default in Tools tab',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                const active = await exists(page, '#tool-byte-range.active');
                if (!active) throw new Error('#tool-byte-range should be active by default');
            }
        },
        {
            name: 'Switching to Path Extraction tool shows correct panel',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('[data-tool="path-extract"]');
                await sleep(200);
                const active = await exists(page, '#tool-path-extract.active');
                if (!active) throw new Error('#tool-path-extract should be active');
            }
        },
        {
            name: 'Switching to Trie Index tool shows correct panel',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                const active = await exists(page, '#tool-trie-index.active');
                if (!active) throw new Error('#tool-trie-index should be active');
            }
        },
        {
            name: 'Switching to Semantic Search tool shows correct panel',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('[data-tool="semantic"]');
                await sleep(200);
                const active = await exists(page, '#tool-semantic.active');
                if (!active) throw new Error('#tool-semantic should be active');
            }
        },
        {
            name: 'Switching to Validate tool shows correct panel',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('[data-tool="validate"]');
                await sleep(200);
                const active = await exists(page, '#tool-validate.active');
                if (!active) throw new Error('#tool-validate should be active');
            }
        },
        {
            name: 'Active sidebar item updates when switching tools',
            async fn(page) {
                await page.click('[data-tab="tools"]');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                const activeItem = await page.$eval('.sidebar-item.active[data-tool]', el => el.dataset.tool);
                if (activeItem !== 'trie-index') throw new Error(`Expected trie-index active, got ${activeItem}`);
            }
        },
    ]
};
