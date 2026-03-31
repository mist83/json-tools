// Suite: Byte-Range Scanning Tool
const { assertContains, assertNotContains, exists, sleep, waitForText, waitForResults, switchTab, waitForAppReady } = require('./helpers');

async function goToByteRange(page) {
    await switchTab(page, 'tools');
    await page.click('[data-tool="byte-range"]');
    await sleep(100);
}

async function setupWithData(page) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForAppReady(page);
    await page.select('#gen-type', 'ecommerce');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await goToByteRange(page);
}

module.exports = {
    name: 'Byte-Range Scanning Tool',
    tests: [
        {
            name: 'Byte-Range tool panel exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const el = await exists(page, '#tool-byte-range');
                if (!el) throw new Error('#tool-byte-range not found');
            }
        },
        {
            name: 'Scan button exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const btn = await exists(page, 'button[onclick="runByteRange()"]');
                if (!btn) throw new Error('runByteRange button not found');
            }
        },
        {
            name: 'MD5 hashes checkbox exists and is checked by default',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const checked = await page.$eval('#byte-range-hashes', el => el.checked);
                if (!checked) throw new Error('#byte-range-hashes should be checked by default');
            }
        },
        {
            name: 'Parallel checkbox exists and is unchecked by default',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const checked = await page.$eval('#byte-range-parallel', el => el.checked);
                if (checked) throw new Error('#byte-range-parallel should be unchecked by default');
            }
        },
        {
            name: 'No dataset → error message shown',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('button[onclick="runByteRange()"]');
                await sleep(500);
                const html = await page.$eval('#byte-range-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Scan with ecommerce dataset → success alert',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'alert-success');
                assertContains(html, 'Scan complete');
            }
        },
        {
            name: 'Scan shows 4 stat cards',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'Collections');
                assertContains(html, 'Objects Found');
                assertContains(html, 'Bytes Processed');
                assertContains(html, 'API Time');
            }
        },
        {
            name: 'Scan shows throughput bar',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'MB/s');
                assertContains(html, 'throughput-fill');
            }
        },
        {
            name: 'Scan shows ecommerce collections (products, reviews, orders)',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'products');
                assertContains(html, 'reviews');
                assertContains(html, 'orders');
            }
        },
        {
            name: 'Scan shows byte range info for objects',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'Byte range:');
                assertContains(html, 'Object #1');
            }
        },
        {
            name: 'Scan shows MD5 hashes when checkbox checked',
            async fn(page) {
                await goToByteRange(page);
                const checked = await page.$eval('#byte-range-hashes', el => el.checked);
                if (!checked) await page.click('#byte-range-hashes');
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'MD5:');
            }
        },
        {
            name: 'Scan hides MD5 hashes when checkbox unchecked',
            async fn(page) {
                await goToByteRange(page);
                const checked = await page.$eval('#byte-range-hashes', el => el.checked);
                if (checked) await page.click('#byte-range-hashes');
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertNotContains(html, 'MD5:');
                await page.click('#byte-range-hashes'); // restore
            }
        },
        {
            name: 'Scan shows "showing first 5" label for large collections',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'showing first 5');
            }
        },
        {
            name: 'Copy buttons exist on result code blocks',
            async fn(page) {
                await goToByteRange(page);
                await page.click('button[onclick="runByteRange()"]');
                await waitForResults(page, 'byte-range-results');
                const copyBtns = await page.$$('#byte-range-results button');
                if (copyBtns.length === 0) throw new Error('No copy buttons found in results');
            }
        },
        {
            name: 'Target collections filter works',
            async fn(page) {
                await goToByteRange(page);
                await page.$eval('#byte-range-collections', el => { el.value = 'products'; });
                await page.click('button[onclick="runByteRange()"]');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'products');
                assertContains(html, '1 collection');
                await page.$eval('#byte-range-collections', el => { el.value = ''; });
            }
        },
    ]
};
