// Suite: Trie Index & Live Search Tool
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
    await page.click('[data-tool="trie-index"]');
    await sleep(200);
}

module.exports = {
    name: 'Trie Index & Live Search Tool',
    tests: [
        {
            name: 'Trie Index tool panel exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const el = await exists(page, '#tool-trie-index');
                if (!el) throw new Error('#tool-trie-index not found');
            }
        },
        {
            name: 'Search term input exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                const el = await exists(page, '#trie-search-term');
                if (!el) throw new Error('#trie-search-term not found');
            }
        },
        {
            name: 'Live indicator is hidden initially',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                const isHidden = await page.$eval('#trie-live-indicator', el => el.classList.contains('hidden'));
                if (!isHidden) throw new Error('Live indicator should be hidden before first index');
            }
        },
        {
            name: 'No dataset → error message shown',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                await page.click('button[onclick="runTrieIndex()"]');
                await sleep(500);
                const html = await page.$eval('#trie-index-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Index & Search → success with term count',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'alert-success');
                assertContains(html, 'Terms Indexed');
            }
        },
        {
            name: 'Index shows stat cards',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'Terms Indexed');
                assertContains(html, 'Search Prefix');
                assertContains(html, 'Matches');
            }
        },
        {
            name: 'Live indicator appears after first index',
            async fn(page) {
                await setupWithData(page);
                await page.click('button[onclick="runTrieIndex()"]');
                await waitForResults(page, 'trie-index-results');
                const isHidden = await page.$eval('#trie-live-indicator', el => el.classList.contains('hidden'));
                if (isHidden) throw new Error('Live indicator should be visible after indexing');
            }
        },
        {
            name: 'Search with prefix "wire" returns matches',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#trie-search-term', el => { el.value = 'wire'; });
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'status-badge status-info');
            }
        },
        {
            name: 'Search with no matches shows warning',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#trie-search-term', el => { el.value = 'zzzzzzzznotfound'; });
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'alert-warning');
            }
        },
        {
            name: 'Match tags are clickable (onclick sets search term)',
            async fn(page) {
                await setupWithData(page);
                await page.$eval('#trie-search-term', el => { el.value = 'wire'; });
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'runTrieIndex()');
            }
        },
        {
            name: 'Blog dataset indexes correctly',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await page.select('#gen-type', 'blog');
                await page.select('#gen-count', '50');
                await page.click('button[onclick="generateDataset()"]');
                await waitForText(page, '#gen-status', 'Generated', 8000);
                await switchTab(page, 'tools');
                await page.click('[data-tool="trie-index"]');
                await sleep(200);
                await page.$eval('#trie-search-term', el => { el.value = 'cloud'; });
                await page.click('button[onclick="runTrieIndex()"]');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'alert-success');
            }
        },
    ]
};
