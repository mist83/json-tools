// Suite: Tools Tab & Sidebar Navigation
const { assertContains, exists, countElements, sleep, waitForText, switchTab, waitForAppReady, freshLoad } = require('./helpers');

async function loadDataAndGoToTools(page) {
    await freshLoad(page);
    await page.select('#gen-type', 'ecommerce');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await switchTab(page, 'tools');
}

module.exports = {
    name: 'Tools Tab & Sidebar Navigation',
    tests: [
        {
            name: 'Tools tab switches correctly',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const toolsSidebar = await exists(page, '#tools-sidebar');
                if (!toolsSidebar) throw new Error('#tools-sidebar not present after clicking Tools tab');
            }
        },
        {
            name: 'Sidebar is visible on Tools tab',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const sidebar = await exists(page, '#tools-sidebar');
                if (!sidebar) throw new Error('Sidebar #tools-sidebar should be visible on Tools tab');
            }
        },
        {
            name: 'Sidebar is not present on Home tab',
            async fn(page) {
                await freshLoad(page);
                await switchTab(page, 'tools');
                await switchTab(page, 'home');
                const toolsWrapperVisible = await page.evaluate(() => {
                    const wrapper = document.querySelector('[data-tab-id="tools"]');
                    return !!wrapper && wrapper.classList.contains('display-block');
                });
                if (toolsWrapperVisible) throw new Error('Tools wrapper should not remain active on Home tab');
            }
        },
        {
            name: 'Sidebar is not present on About tab',
            async fn(page) {
                await switchTab(page, 'tools');
                await switchTab(page, 'about');
                const toolsWrapperVisible = await page.evaluate(() => {
                    const wrapper = document.querySelector('[data-tab-id="tools"]');
                    return !!wrapper && wrapper.classList.contains('display-block');
                });
                if (toolsWrapperVisible) throw new Error('Tools wrapper should not remain active on About tab');
            }
        },
        {
            name: 'No-data banner shows when no dataset loaded',
            async fn(page) {
                await freshLoad(page);
                await switchTab(page, 'tools');
                const bannerHidden = await page.$eval('#no-data-banner', el => el.classList.contains('hidden'));
                if (bannerHidden) throw new Error('No-data banner should be visible when no dataset loaded');
            }
        },
        {
            name: 'No-data banner hides after dataset loaded',
            async fn(page) {
                await loadDataAndGoToTools(page);
                const bannerHidden = await page.$eval('#no-data-banner', el => el.classList.contains('hidden'));
                if (!bannerHidden) throw new Error('No-data banner should be hidden after dataset loaded');
            }
        },
        {
            name: 'Sidebar has all 5 tool items',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const tools = await countElements(page, '.sidebar-item[data-tool]');
                if (tools !== 5) throw new Error(`Expected 5 tool items in sidebar, got ${tools}`);
            }
        },
        {
            name: 'Sidebar dataset label shows "No data loaded" initially',
            async fn(page) {
                await freshLoad(page);
                await switchTab(page, 'tools');
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
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('#sidebar-dataset-info');
                await sleep(500);
                const homeInput = await exists(page, '#home-paste-json');
                if (!homeInput) throw new Error('Clicking dataset label should navigate to Home tab');
            }
        },
        {
            name: 'All 5 tool panels exist in DOM',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                for (const tool of ['byte-range', 'path-extract', 'trie-index', 'semantic', 'validate']) {
                    const el = await exists(page, `#tool-${tool}`);
                    if (!el) throw new Error(`Tool panel #tool-${tool} not found`);
                }
            }
        },
        {
            name: 'Byte-Range tool panel is active by default in Tools tab',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const active = await exists(page, '#tool-byte-range.active');
                if (!active) throw new Error('#tool-byte-range should be active by default');
            }
        },
        {
            name: 'Switching to Path Extraction tool shows correct panel',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="path-extract"]');
                await sleep(200);
                const active = await exists(page, '#tool-path-extract.active');
                if (!active) throw new Error('#tool-path-extract should be active');
            }
        },
        {
            name: 'Switching to Trie Index tool shows correct panel',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                const active = await exists(page, '#tool-trie-index.active');
                if (!active) throw new Error('#tool-trie-index should be active');
            }
        },
        {
            name: 'Switching to Semantic Search tool shows correct panel',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="semantic"]');
                await sleep(200);
                const active = await exists(page, '#tool-semantic.active');
                if (!active) throw new Error('#tool-semantic should be active');
            }
        },
        {
            name: 'Switching to Validate tool shows correct panel',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="validate"]');
                await sleep(200);
                const active = await exists(page, '#tool-validate.active');
                if (!active) throw new Error('#tool-validate should be active');
            }
        },
        {
            name: 'Active sidebar item updates when switching tools',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                const activeItem = await page.$eval('.sidebar-item.active[data-tool]', el => el.dataset.tool);
                if (activeItem !== 'trie-index') throw new Error(`Expected trie-index active, got ${activeItem}`);
            }
        },
    ]
};
