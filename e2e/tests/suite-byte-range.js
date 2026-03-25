// Suite: Byte-Range Scanning Tab
const {
    switchTab, waitForResults, assertContains, assertNotContains,
    setValue, countElements, exists, sleep, getValue
} = require('./helpers');

module.exports = {
    name: 'Byte-Range Scanning',
    tests: [
        {
            name: 'Tab switches to byte-range correctly',
            async fn(page) {
                await switchTab(page, 'byte-range');
                const active = await exists(page, '#content-byte-range.active');
                if (!active) throw new Error('byte-range section not active after tab click');
            }
        },
        {
            name: 'Load Example button populates JSON textarea',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                const val = await getValue(page, '#byte-range-json');
                if (!val || val.length < 50) throw new Error('JSON textarea not populated after Load Example');
                assertContains(val, 'products', 'Example JSON should contain "products"');
            }
        },
        {
            name: 'Load Example populates collections input',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                const val = await getValue(page, '#byte-range-collections');
                assertContains(val, 'products', 'Collections input should contain "products"');
            }
        },
        {
            name: 'Scan returns success alert',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'alert success', 'Should show success alert');
            }
        },
        {
            name: 'Scan shows correct collection count',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'products', 'Results should show products collection');
                assertContains(html, 'reviews', 'Results should show reviews collection');
                assertContains(html, 'orders', 'Results should show orders collection');
            }
        },
        {
            name: 'Scan shows stat cards with numbers',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'stat-card', 'Should render stat cards');
                assertContains(html, 'stat-value', 'Should render stat values');
            }
        },
        {
            name: 'Scan shows byte-range visualizer bars',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'byte-range-viz', 'Should render byte range visualizer');
                assertContains(html, 'Byte range:', 'Should show byte range label');
            }
        },
        {
            name: 'Scan shows MD5 hashes when checkbox checked',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                // Ensure hashes checkbox is checked
                const checked = await page.$eval('#byte-range-hashes', el => el.checked);
                if (!checked) await page.click('#byte-range-hashes');
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'MD5:', 'Should show MD5 hash when checkbox checked');
                assertContains(html, 'hash-line', 'Should render hash-line element');
            }
        },
        {
            name: 'Scan hides hashes when checkbox unchecked',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                // Uncheck hashes
                const checked = await page.$eval('#byte-range-hashes', el => el.checked);
                if (checked) await page.click('#byte-range-hashes');
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertNotContains(html, 'MD5:', 'Should NOT show MD5 hash when checkbox unchecked');
            }
        },
        {
            name: 'Scan shows syntax-highlighted JSON code blocks',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                await waitForResults(page, 'byte-range-results');
                // Prism adds token spans
                const tokenCount = await countElements(page, '#byte-range-results .token');
                if (tokenCount === 0) throw new Error('No Prism syntax highlighting tokens found');
            }
        },
        {
            name: 'Scan shows copy buttons on code blocks',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                await waitForResults(page, 'byte-range-results');
                const copyBtns = await countElements(page, '#byte-range-results .copy-btn');
                if (copyBtns === 0) throw new Error('No copy buttons found in results');
            }
        },
        {
            name: 'Scan shows throughput bar',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'throughput-bar', 'Should render throughput bar');
                assertContains(html, 'MB/s', 'Should show MB/s throughput');
            }
        },
        {
            name: 'Empty JSON shows error message',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await setValue(page, '#byte-range-json', '');
                await page.click('#btn-byte-range-scan');
                await sleep(500);
                const html = await page.$eval('#byte-range-results', el => el.innerHTML);
                assertContains(html, 'alert error', 'Should show error for empty input');
            }
        },
        {
            name: 'Custom JSON with single collection works',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await setValue(page, '#byte-range-json', '{"items":[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]}');
                await setValue(page, '#byte-range-collections', 'items');
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                assertContains(html, 'items', 'Should find items collection');
                assertContains(html, 'Object #1', 'Should show Object #1');
                assertContains(html, 'Object #2', 'Should show Object #2');
            }
        },
        {
            name: 'Object count in results matches expected',
            async fn(page) {
                await switchTab(page, 'byte-range');
                await page.click('#btn-byte-range-example');
                await sleep(300);
                await page.click('#btn-byte-range-scan');
                const html = await waitForResults(page, 'byte-range-results');
                // Example has 3 products, 2 reviews, 1 order = 6 total
                assertContains(html, '3 objects', 'products should have 3 objects');
            }
        },
    ]
};
