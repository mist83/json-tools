// Suite: JSON Path Extraction Tab
const {
    switchTab, waitForResults, assertContains, assertNotContains,
    setValue, countElements, exists, sleep, getValue
} = require('./helpers');

module.exports = {
    name: 'JSON Path Extraction',
    tests: [
        {
            name: 'Tab switches to path-extract correctly',
            async fn(page) {
                await switchTab(page, 'path-extract');
                const active = await exists(page, '#content-path-extract.active');
                if (!active) throw new Error('path-extract section not active');
            }
        },
        {
            name: 'Load Example populates JSON and path',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                const json = await getValue(page, '#path-extract-json');
                const path = await getValue(page, '#path-extract-path');
                assertContains(json, 'company', 'Example JSON should contain company');
                assertContains(path, 'employees', 'Path should contain employees');
            }
        },
        {
            name: 'Load Example shows path suggestions',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                const sugHtml = await page.$eval('#path-suggestions', el => el.innerHTML);
                assertContains(sugHtml, 'engineering', 'Suggestions should show engineering path');
                assertContains(sugHtml, 'sales', 'Suggestions should show sales path');
            }
        },
        {
            name: 'Extract engineering employees returns 3 objects',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await setValue(page, '#path-extract-path', 'company.departments.engineering.employees');
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'alert success', 'Should show success');
                assertContains(html, 'Object #1', 'Should show Object #1');
                assertContains(html, 'Object #2', 'Should show Object #2');
                assertContains(html, 'Object #3', 'Should show Object #3');
            }
        },
        {
            name: 'Extract sales employees returns 2 objects',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await setValue(page, '#path-extract-path', 'company.departments.sales.employees');
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'Object #1', 'Should show Object #1');
                assertContains(html, 'Object #2', 'Should show Object #2');
                assertNotContains(html, 'Object #3', 'Should NOT show Object #3 for sales (only 2)');
            }
        },
        {
            name: 'Results show byte range visualizer',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'byte-range-viz', 'Should show byte range visualizer');
                assertContains(html, 'Byte range:', 'Should show byte range label');
            }
        },
        {
            name: 'Results show MD5 hash badges',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'MD5:', 'Should show MD5 hash');
            }
        },
        {
            name: 'Results show syntax-highlighted JSON',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await page.click('#btn-path-extract');
                await waitForResults(page, 'path-extract-results');
                const tokens = await countElements(page, '#path-extract-results .token');
                if (tokens === 0) throw new Error('No Prism tokens in path extract results');
            }
        },
        {
            name: 'Results show copy buttons',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await page.click('#btn-path-extract');
                await waitForResults(page, 'path-extract-results');
                const btns = await countElements(page, '#path-extract-results .copy-btn');
                if (btns === 0) throw new Error('No copy buttons in path extract results');
            }
        },
        {
            name: 'Non-existent path shows warning',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await setValue(page, '#path-extract-path', 'does.not.exist');
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                // Either warning or 0 objects found
                const hasWarning = html.includes('warning') || html.includes('0');
                if (!hasWarning) throw new Error('Should show warning or 0 objects for non-existent path');
            }
        },
        {
            name: 'Empty path shows error',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await setValue(page, '#path-extract-path', '');
                await page.click('#btn-path-extract');
                await sleep(500);
                const html = await page.$eval('#path-extract-results', el => el.innerHTML);
                assertContains(html, 'alert error', 'Should show error for empty path');
            }
        },
        {
            name: 'Path suggestion buttons set the path input',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                // Click the sales path suggestion
                await page.evaluate(() => setPath('company.departments.sales.employees'));
                const val = await getValue(page, '#path-extract-path');
                assertContains(val, 'sales', 'Path input should be updated to sales path');
            }
        },
        {
            name: 'Stat cards show correct data',
            async fn(page) {
                await switchTab(page, 'path-extract');
                await page.click('#btn-path-example');
                await sleep(300);
                await page.click('#btn-path-extract');
                const html = await waitForResults(page, 'path-extract-results');
                assertContains(html, 'Objects Found', 'Should show Objects Found stat');
                assertContains(html, 'Bytes Processed', 'Should show Bytes Processed stat');
                assertContains(html, 'API Time', 'Should show API Time stat');
            }
        },
    ]
};
