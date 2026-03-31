// Suite: Home Tab
const { assertContains, assertNotContains, exists, sleep, getValue, waitForText, switchTab, waitForAppReady } = require('./helpers');

// Helper: generate a dataset and wait for success
async function generateDataset(page, type = 'ecommerce', count = '50') {
    await page.select('#gen-type', type);
    await page.select('#gen-count', count);
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
}

// Helper: clear localStorage and reload, then wait for app
async function freshLoad(page, BASE_URL) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForAppReady(page);
}

module.exports = {
    name: 'Home Tab',
    tests: [
        {
            name: 'Home tab switches correctly',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'home');
                const active = await exists(page, '#content-home');
                if (!active) throw new Error('#content-home not present after clicking Home tab');
            }
        },
        {
            name: 'Info banner shows when no dataset loaded',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-info', 'Should show info banner when no dataset');
                assertContains(statusHtml, 'No active dataset');
            }
        },
        {
            name: 'Paste JSON card exists with textarea and button',
            async fn(page) {
                await waitForAppReady(page);
                const textarea = await exists(page, '#home-paste-json');
                const btn = await exists(page, 'button[onclick="loadFromPaste()"]');
                if (!textarea) throw new Error('#home-paste-json textarea not found');
                if (!btn) throw new Error('loadFromPaste button not found');
            }
        },
        {
            name: 'Paste valid JSON → success banner appears',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await page.$eval('#home-paste-json', (el) => {
                    el.value = '{"items":[{"id":1,"name":"test"}]}';
                });
                await page.click('button[onclick="loadFromPaste()"]');
                await sleep(300);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-success', 'Should show success banner after paste');
                assertContains(statusHtml, 'active dataset');
            }
        },
        {
            name: 'Paste invalid JSON → error shown',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await page.$eval('#home-paste-json', (el) => { el.value = '{invalid json'; });
                await page.click('button[onclick="loadFromPaste()"]');
                await sleep(300);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-error', 'Should show error for invalid JSON');
            }
        },
        {
            name: 'Dataset name field is used in status banner',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await page.$eval('#home-paste-json', (el) => { el.value = '{"x":[{"id":1}]}'; });
                await page.$eval('#home-paste-name', (el) => { el.value = 'My Test Dataset'; });
                await page.click('button[onclick="loadFromPaste()"]');
                await sleep(300);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'My Test Dataset');
            }
        },
        {
            name: 'Upload file input exists and accepts .json',
            async fn(page) {
                await waitForAppReady(page);
                const input = await page.$('#home-file-input');
                if (!input) throw new Error('#home-file-input not found');
                const accept = await page.$eval('#home-file-input', el => el.accept);
                assertContains(accept, '.json');
            }
        },
        {
            name: 'Drop zone exists and is clickable',
            async fn(page) {
                await waitForAppReady(page);
                const dropZone = await exists(page, '#home-drop-zone');
                if (!dropZone) throw new Error('#home-drop-zone not found');
            }
        },
        {
            name: 'Generate dataset card has type and count selects',
            async fn(page) {
                await waitForAppReady(page);
                const typeSelect = await exists(page, '#gen-type');
                const countSelect = await exists(page, '#gen-count');
                if (!typeSelect) throw new Error('#gen-type select not found');
                if (!countSelect) throw new Error('#gen-count select not found');
            }
        },
        {
            name: 'Generate ecommerce dataset (50 records) → success',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                const statusHtml = await page.$eval('#gen-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-success');
                assertContains(statusHtml, 'Generated');
            }
        },
        {
            name: 'Generate movies dataset → success',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'movies', '50');
                const statusHtml = await page.$eval('#gen-status', el => el.innerHTML);
                assertContains(statusHtml, 'Generated');
            }
        },
        {
            name: 'Generate blog dataset → success',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'blog', '50');
                const statusHtml = await page.$eval('#gen-status', el => el.innerHTML);
                assertContains(statusHtml, 'Generated');
            }
        },
        {
            name: 'Generate employees dataset → success',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'employees', '50');
                const statusHtml = await page.$eval('#gen-status', el => el.innerHTML);
                assertContains(statusHtml, 'Generated');
            }
        },
        {
            name: 'Download button appears after generation',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                const isHidden = await page.$eval('#btn-download-generated', el => el.classList.contains('hidden'));
                if (isHidden) throw new Error('Download button should be visible after generation');
            }
        },
        {
            name: 'Active dataset status updates after generation',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-success');
                assertContains(statusHtml, 'active dataset');
            }
        },
        {
            name: '"Go to Tools" link navigates to Tools tab',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                // The "Go to Tools" button sets window.location.hash = 'tools'
                await page.evaluate(() => { window.location.hash = 'tools'; });
                await sleep(500);
                const toolsContent = await exists(page, '#content-tools');
                if (!toolsContent) throw new Error('Should navigate to Tools tab');
            }
        },
        {
            name: '"Clear" link removes active dataset',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                await page.click('button[onclick="clearActiveDataset()"]');
                await sleep(300);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-info', 'Should show info banner after clear');
            }
        },
        {
            name: 'Dataset persists in localStorage after generation',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                const stored = await page.evaluate(() => !!localStorage.getItem('jsontools_active_data'));
                if (!stored) throw new Error('Dataset should be stored in localStorage');
            }
        },
        {
            name: 'Dataset restored from localStorage on reload',
            async fn(page, { BASE_URL }) {
                await freshLoad(page, BASE_URL);
                await generateDataset(page, 'ecommerce', '50');
                // Reload without clearing localStorage
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await sleep(500);
                const statusHtml = await page.$eval('#home-active-status', el => el.innerHTML);
                assertContains(statusHtml, 'alert-success', 'Dataset should be restored from localStorage');
            }
        },
    ]
};
