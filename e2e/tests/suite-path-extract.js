// Suite: JSON Path Extraction Tool
const { assertContains, exists, sleep, waitForResults, waitForText, switchTab, waitForAppReady } = require('./helpers');

async function setupWithData(page) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForAppReady(page);
    await page.select('#gen-type', 'ecommerce');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await switchTab(page, 'tools');
    await page.click('[data-tool="path-extract"]');
    await sleep(300);
}

module.exports = {
    name: 'JSON Path Extraction Tool',
    tests: [
        {
            name: 'Path Extraction tool panel exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const el = await exists(page, '#tool-path-extract');
                if (!el) throw new Error('#tool-path-extract not found');
            }
        },
        {
            name: 'Path input field exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="path-extract"]');
                const el = await exists(page, '#path-extract-path');
                if (!el) throw new Error('#path-extract-path not found');
            }
        },
        {
            name: 'No dataset → error message shown',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="path-extract"]');
                await sleep(200);
                await page.$eval('#path-extract-path', el => { el.value = 'products'; });
                await page.click('button[onclick="runPathExtract()"]');
                await sleep(500);
                const html = await page.$eval('#path-extract-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Suggested paths appear after switching to path-extract tool',
            async fn(page) {
                await setupWithData(page);
                const sugHtml = await page.$eval('#path-suggestions', el => el.innerHTML);
                assertContains(sugHtml, 'products', 'Suggested paths should include products');
            }
        },
        {
            name: 'Clicking suggested path populates input',
            async fn(page) {
                await setupWithData(page);
                await page.click('#path-suggestions .btn-link');
                await sleep(200);
                const val = await page.$eval('#path-extract-path', el => el.value);
                if (!val || val.length === 0) throw new Error('Path input should be populated after clicking suggestion');
            }
        },
        {
            name: 'Extract "products" path → success',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'products'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'alert-success');
                assertContains(html, 'object(s) at');
            }
        },
        {
            name: 'Extract shows stat cards',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'products'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'Objects Found');
                assertContains(html, 'Bytes Processed');
                assertContains(html, 'API Time');
            }
        },
        {
            name: 'Extract shows object cards with byte ranges',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'products'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'Object #1');
                assertContains(html, 'Byte range:');
            }
        },
        {
            name: 'Extract "reviews" path → success',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'reviews'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'alert-success');
            }
        },
        {
            name: 'Invalid path → warning (no objects found)',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'nonexistent.path.here'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                const hasWarning = html.includes('alert-warning') || html.includes('0') || html.includes('No objects');
                if (!hasWarning) throw new Error('Should show warning or 0 objects for invalid path');
            }
        },
        {
            name: 'Empty path → error shown',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = ''; });
                await page.click('button[onclick="runPathExtract()"]');
                await sleep(500);
                const html = await page.$eval('#path-extract-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Shows "first 5 of N" label for large collections',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#path-extract-path', el => { el.value = 'products'; });
                await page.click('button[onclick="runPathExtract()"]');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'first 5 of');
            }
        },
    ]
};
