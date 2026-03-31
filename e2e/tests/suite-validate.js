// Suite: JSON Validation Tool
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
    await page.click('[data-tool="validate"]');
    await sleep(200);
}

module.exports = {
    name: 'JSON Validation Tool',
    tests: [
        {
            name: 'Validate tool panel exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const el = await exists(page, '#tool-validate');
                if (!el) throw new Error('#tool-validate not found');
            }
        },
        {
            name: 'Validate button exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="validate"]');
                const btn = await exists(page, 'button[onclick="runValidate()"]');
                if (!btn) throw new Error('runValidate button not found');
            }
        },
        {
            name: 'No dataset → error message shown',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="validate"]');
                await sleep(200);
                await page.click('button[onclick="runValidate()"]');
                await sleep(500);
                const html = await page.$eval('#validate-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Validate generated dataset → all checks pass',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert-success');
                assertContains(html, 'All checks passed');
            }
        },
        {
            name: 'Validate shows bytes checked stat',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'Bytes Checked');
                assertContains(html, 'KB');
            }
        },
        {
            name: 'Validate shows JSON Structure check card',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'JSON Structure');
                assertContains(html, 'Balanced braces');
            }
        },
        {
            name: 'Validate shows UTF-8 Delimiter Safety check card',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'UTF-8 Delimiter Safety');
            }
        },
        {
            name: 'Validate shows ✓ Valid overall status',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, '✓ Valid');
            }
        },
        {
            name: 'Validate pasted invalid JSON → error shown at paste time',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await page.$eval('#home-paste-json', el => { el.value = '{"broken": [1, 2,}'; });
                await page.click('button[onclick="loadFromPaste()"]');
                await sleep(300);
                const homeStatus = await page.$eval('#home-active-status', el => el.innerHTML);
                // Invalid JSON should be rejected at paste time with an error
                assertContains(homeStatus, 'alert-error');
            }
        },
        {
            name: 'Movies dataset validates successfully',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await page.select('#gen-type', 'movies');
                await page.select('#gen-count', '50');
                await page.click('button[onclick="generateDataset()"]');
                await waitForText(page, '#gen-status', 'Generated', 8000);
                await switchTab(page, 'tools');
                await page.click('[data-tool="validate"]');
                await sleep(200);
                await page.click('button[onclick="runValidate()"]');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert-success');
            }
        },
    ]
};
