// Suite: Sidebar Functionality
// Tests the new sidebar within the Tools tab (dataset label, tool navigation)
const { assertContains, exists, countElements, sleep, waitForText, switchTab, waitForAppReady } = require('./helpers');

async function loadDataAndGoToTools(page) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForAppReady(page);
    await page.select('#gen-type', 'ecommerce');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await switchTab(page, 'tools');
}

module.exports = {
    name: 'Sidebar Functionality',
    tests: [
        {
            name: 'Sidebar renders inside Tools tab',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const sidebar = await exists(page, '#tools-sidebar');
                if (!sidebar) throw new Error('#tools-sidebar not found in Tools tab');
            }
        },
        {
            name: 'Sidebar has Active Dataset section header',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const headers = await page.$$eval('.sidebar-header', els => els.map(e => e.textContent.trim()));
                const hasDataset = headers.some(h => h.toLowerCase().includes('dataset'));
                if (!hasDataset) throw new Error('Sidebar should have "Active Dataset" header');
            }
        },
        {
            name: 'Sidebar has Tools section header',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const headers = await page.$$eval('.sidebar-header', els => els.map(e => e.textContent.trim()));
                const hasTools = headers.some(h => h.toLowerCase().includes('tools'));
                if (!hasTools) throw new Error('Sidebar should have "Tools" header');
            }
        },
        {
            name: 'Sidebar dataset item navigates to Home on click',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('#sidebar-dataset-info');
                await sleep(500);
                const homeContent = await exists(page, '#content-home');
                if (!homeContent) throw new Error('Clicking sidebar dataset item should navigate to Home');
            }
        },
        {
            name: 'Sidebar shows all 5 tool navigation items',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const count = await countElements(page, '.sidebar-item[data-tool]');
                if (count !== 5) throw new Error(`Expected 5 tool items, got ${count}`);
            }
        },
        {
            name: 'Byte-Range sidebar item is active by default',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const active = await exists(page, '.sidebar-item.active[data-tool="byte-range"]');
                if (!active) throw new Error('byte-range sidebar item should be active by default');
            }
        },
        {
            name: 'Clicking Path Extraction sidebar item activates it',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="path-extract"]');
                await sleep(200);
                const active = await exists(page, '.sidebar-item.active[data-tool="path-extract"]');
                if (!active) throw new Error('path-extract sidebar item should become active');
            }
        },
        {
            name: 'Clicking Semantic Search sidebar item activates it',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="semantic"]');
                await sleep(200);
                const active = await exists(page, '.sidebar-item.active[data-tool="semantic"]');
                if (!active) throw new Error('semantic sidebar item should become active');
            }
        },
        {
            name: 'Sidebar dataset label updates after loading data',
            async fn(page) {
                await loadDataAndGoToTools(page);
                const label = await page.$eval('#sidebar-dataset-label', el => el.textContent.trim());
                if (label === 'No data loaded') throw new Error('Sidebar label should update after loading data');
                assertContains(label, 'KB');
            }
        },
        {
            name: 'Sidebar uses canonical .sidebar-item class',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const items = await countElements(page, '.sidebar-item');
                if (items < 6) throw new Error(`Expected at least 6 .sidebar-item elements, got ${items}`);
            }
        },
        {
            name: 'Sidebar uses canonical .sidebar-header class',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const headers = await countElements(page, '.sidebar-header');
                if (headers < 2) throw new Error(`Expected at least 2 .sidebar-header elements, got ${headers}`);
            }
        },
    ]
};
