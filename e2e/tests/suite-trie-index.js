// Suite: Trie Indexing Tab
const {
    switchTab, waitForResults, assertContains, assertNotContains,
    setValue, countElements, exists, sleep, getValue, waitForText
} = require('./helpers');

module.exports = {
    name: 'Trie Indexing & Live Search',
    tests: [
        {
            name: 'Tab switches to trie-index correctly',
            async fn(page) {
                await switchTab(page, 'trie-index');
                const active = await exists(page, '#content-trie-index.active');
                if (!active) throw new Error('trie-index section not active');
            }
        },
        {
            name: 'Load Example populates JSON and search term',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                const json = await getValue(page, '#trie-index-json');
                const term = await getValue(page, '#trie-search-term');
                assertContains(json, 'posts', 'Example JSON should contain posts');
                if (!term || term.length === 0) throw new Error('Search term should be populated');
            }
        },
        {
            name: 'Load Example shows search term suggestions',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                const sugHtml = await page.$eval('#search-suggestions', el => el.innerHTML);
                assertContains(sugHtml, 'tech', 'Suggestions should include "tech"');
                assertContains(sugHtml, 'java', 'Suggestions should include "java"');
            }
        },
        {
            name: 'Index & Search returns success with term count',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'alert success', 'Should show success alert');
                assertContains(html, 'Terms Indexed', 'Should show Terms Indexed stat');
            }
        },
        {
            name: 'Search for "tech" returns matching tags',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await setValue(page, '#trie-search-term', 'tech');
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'tag-cloud', 'Should show tag cloud');
                assertContains(html, 'tech', 'Should find "tech" prefix matches');
            }
        },
        {
            name: 'Search for "java" returns javascript',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await setValue(page, '#trie-search-term', 'java');
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'java', 'Should find java prefix matches');
            }
        },
        {
            name: 'Search for "cloud" returns cloud-related terms',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await setValue(page, '#trie-search-term', 'cloud');
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'cloud', 'Should find cloud prefix matches');
            }
        },
        {
            name: 'No-match search shows warning',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await setValue(page, '#trie-search-term', 'xyznonexistent999');
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'warning', 'Should show warning for no matches');
            }
        },
        {
            name: 'Live indicator appears after first index',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await page.click('#btn-trie-index');
                await waitForResults(page, 'trie-index-results');
                // Live indicator should now be visible
                const display = await page.$eval('#trie-live-indicator', el => el.style.display);
                if (display === 'none') throw new Error('Live indicator should be visible after indexing');
            }
        },
        {
            name: 'Live search fires on input change after indexing',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                // First index
                await page.click('#btn-trie-index');
                await waitForResults(page, 'trie-index-results');
                // Set value directly and fire input event to trigger live search
                await page.$eval('#trie-search-term', el => {
                    el.value = 'micro';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                });
                // Wait for debounce (400ms) + API call
                await sleep(2000);
                const html = await page.$eval('#trie-index-results', el => el.innerHTML);
                assertContains(html, 'micro', 'Live search should update results for "micro"');
            }
        },
        {
            name: 'Tag click sets search term',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await setValue(page, '#trie-search-term', 'cloud');
                await page.click('#btn-trie-index');
                await waitForResults(page, 'trie-index-results');
                // Click a tag in the cloud
                const tagExists = await exists(page, '#trie-index-results .tag');
                if (!tagExists) throw new Error('No tags in tag cloud to click');
                await page.click('#trie-index-results .tag');
                await sleep(200);
                const term = await getValue(page, '#trie-search-term');
                if (!term || term.length === 0) throw new Error('Clicking tag should set search term');
            }
        },
        {
            name: 'Stat cards show Terms Indexed, Search Prefix, Matches',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await page.click('#btn-trie-example');
                await sleep(300);
                await page.click('#btn-trie-index');
                const html = await waitForResults(page, 'trie-index-results');
                assertContains(html, 'Terms Indexed', 'Should show Terms Indexed');
                assertContains(html, 'Search Prefix', 'Should show Search Prefix');
                assertContains(html, 'Matches', 'Should show Matches');
            }
        },
        {
            name: 'Empty JSON shows error',
            async fn(page) {
                await switchTab(page, 'trie-index');
                await setValue(page, '#trie-index-json', '');
                await page.click('#btn-trie-index');
                await sleep(500);
                const html = await page.$eval('#trie-index-results', el => el.innerHTML);
                assertContains(html, 'alert error', 'Should show error for empty JSON');
            }
        },
    ]
};
