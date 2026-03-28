// Suite: Execution Mode / Privacy Preview
const { assertContains, exists, sleep, waitForResults, waitForText } = require('./helpers');

async function generateData(page, type = 'movies', count = '50') {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await page.select('#execution-mode', 'browser');
    await page.select('#gen-type', type);
    await page.select('#gen-count', count);
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
}

module.exports = {
    name: 'Execution Mode / Privacy Preview',
    tests: [
        {
            name: 'Execution mode selector exists on Home tab',
            async fn(page) {
                const el = await exists(page, '#execution-mode');
                if (!el) throw new Error('#execution-mode not found');
            }
        },
        {
            name: 'Browser Preview mode updates the header badge',
            async fn(page) {
                await page.select('#execution-mode', 'browser');
                await sleep(200);
                const badge = await page.$eval('#execution-mode-badge', el => el.textContent);
                assertContains(badge, 'Browser Preview');
            }
        },
        {
            name: 'Browser Preview byte-range scan works without API mode',
            async fn(page) {
                await generateData(page, 'ecommerce', '50');
                await page.click('[data-tab="tools"]');
                await sleep(200);
                await page.click('[data-tool="byte-range"]');
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'Browser Preview');
                assertContains(html, 'Scan complete');
            }
        },
        {
            name: 'Browser Preview semantic search returns results',
            async fn(page) {
                await generateData(page, 'movies', '50');
                await page.click('[data-tab="tools"]');
                await sleep(200);
                await page.click('[data-tool="semantic"]');
                await sleep(200);
                await page.$eval('#semantic-search-term', el => { el.value = 'hanks'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results', 12000);
                assertContains(html, 'Browser Preview');
                assertContains(html, 'Matches Found');
            }
        }
    ]
};
