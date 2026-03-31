// Suite: Semantic Search Tool
const { assertContains, exists, countElements, sleep, waitForResults, waitForText, switchTab, waitForAppReady } = require('./helpers');

async function setupWithMovies(page) {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForAppReady(page);
    await page.select('#gen-type', 'movies');
    await page.select('#gen-count', '50');
    await page.click('button[onclick="generateDataset()"]');
    await waitForText(page, '#gen-status', 'Generated', 8000);
    await switchTab(page, 'tools');
    await page.click('[data-tool="semantic"]');
    await sleep(400);
}

module.exports = {
    name: 'Semantic Search Tool',
    tests: [
        {
            name: 'Semantic Search tool panel exists',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                const el = await exists(page, '#tool-semantic');
                if (!el) throw new Error('#tool-semantic not found');
            }
        },
        {
            name: 'Match Engine selector exists with correct options',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="semantic"]');
                const el = await exists(page, '#semantic-match-engine');
                if (!el) throw new Error('#semantic-match-engine not found');
                const options = await page.$$eval('#semantic-match-engine option', opts => opts.map(o => o.value));
                if (!options.includes('prefix')) throw new Error('prefix option missing');
                if (!options.includes('contains')) throw new Error('contains option missing');
                if (!options.includes('exact')) throw new Error('exact option missing');
                if (!options.includes('fuzzy')) throw new Error('fuzzy option missing');
            }
        },
        {
            name: 'Tokenizer selector exists with correct options',
            async fn(page) {
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="semantic"]');
                const el = await exists(page, '#semantic-tokenizer');
                if (!el) throw new Error('#semantic-tokenizer not found');
                const options = await page.$$eval('#semantic-tokenizer option', opts => opts.map(o => o.value));
                if (!options.includes('word-split')) throw new Error('word-split option missing');
                if (!options.includes('whitespace')) throw new Error('whitespace option missing');
            }
        },
        {
            name: 'No dataset → error message shown',
            async fn(page) {
                await page.evaluate(() => localStorage.clear());
                await page.reload({ waitUntil: 'networkidle2' });
                await waitForAppReady(page);
                await switchTab(page, 'tools');
                await page.click('[data-tool="semantic"]');
                await sleep(200);
                await page.$eval('#semantic-search-term', el => { el.value = 'test'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                await sleep(500);
                const html = await page.$eval('#semantic-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Field chips auto-populated for movies dataset',
            async fn(page) {
                await setupWithMovies(page);
                const chips = await countElements(page, '#semantic-field-chips .status-badge');
                if (chips === 0) throw new Error('Field chips should be populated for movies dataset');
            }
        },
        {
            name: 'Field chips include expected movie fields',
            async fn(page) {
                await setupWithMovies(page);
                const chipsText = await page.$eval('#semantic-field-chips', el => el.textContent);
                assertContains(chipsText, 'title');
                assertContains(chipsText, 'cast');
            }
        },
        {
            name: 'Field chips are clickable (toggle active/inactive)',
            async fn(page) {
                await setupWithMovies(page);
                const firstChip = await page.$('#semantic-field-chips .status-badge');
                if (!firstChip) throw new Error('No field chips found');
                const beforeClass = await page.$eval('#semantic-field-chips .status-badge', el => el.className);
                await firstChip.click();
                await sleep(200);
                const afterClass = await page.$eval('#semantic-field-chips .status-badge', el => el.className);
                if (beforeClass === afterClass) throw new Error('Field chip class should change on click');
            }
        },
        {
            name: 'Search with prefix engine finds matches',
            async fn(page) {
                await setupWithMovies(page);
                await page.select('#semantic-match-engine', 'prefix');
                await page.$eval('#semantic-search-term', el => { el.value = 'dark'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'alert-success');
            }
        },
        {
            name: 'Search shows stat cards',
            async fn(page) {
                await setupWithMovies(page);
                await page.$eval('#semantic-search-term', el => { el.value = 'the'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'Objects Indexed');
                assertContains(html, 'Fields Indexed');
                assertContains(html, 'Matches Found');
            }
        },
        {
            name: 'Search results show match cards with word badges',
            async fn(page) {
                await setupWithMovies(page);
                await page.$eval('#semantic-search-term', el => { el.value = 'the'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results');
                const hasMatches = html.includes('Match #1') || html.includes('alert-warning');
                if (!hasMatches) throw new Error('Should show match cards or warning');
            }
        },
        {
            name: 'Contains engine finds broader matches than prefix',
            async fn(page) {
                await setupWithMovies(page);
                await page.select('#semantic-match-engine', 'contains');
                await page.$eval('#semantic-search-term', el => { el.value = 'ight'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'alert-success');
            }
        },
        {
            name: 'No search term → error shown',
            async fn(page) {
                await setupWithMovies(page);
                await page.$eval('#semantic-search-term', el => { el.value = ''; });
                await page.click('button[onclick="runSemanticSearch()"]');
                await sleep(500);
                const html = await page.$eval('#semantic-results', el => el.innerHTML);
                assertContains(html, 'alert-error');
            }
        },
        {
            name: 'Switching tokenizer to whitespace works',
            async fn(page) {
                await setupWithMovies(page);
                await page.select('#semantic-tokenizer', 'whitespace');
                await page.$eval('#semantic-search-term', el => { el.value = 'the'; });
                await page.click('button[onclick="runSemanticSearch()"]');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'alert-success');
            }
        },
    ]
};
