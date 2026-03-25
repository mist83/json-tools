// Suite: Semantic Search Tab
const {
    switchTab, waitForResults, assertContains, assertNotContains,
    setValue, countElements, exists, sleep, getValue
} = require('./helpers');

module.exports = {
    name: 'Semantic Search',
    tests: [
        {
            name: 'Tab switches to semantic correctly',
            async fn(page) {
                await switchTab(page, 'semantic');
                const active = await exists(page, '#content-semantic.active');
                if (!active) throw new Error('semantic section not active');
            }
        },
        {
            name: 'Load Example populates JSON and search term',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                const json = await getValue(page, '#semantic-json');
                const term = await getValue(page, '#semantic-search-term');
                assertContains(json, 'shows', 'Example JSON should contain shows');
                assertContains(json, 'Tom Hanks', 'Example JSON should contain Tom Hanks');
                if (!term || term.length === 0) throw new Error('Search term should be populated');
            }
        },
        {
            name: 'Load Example renders field chips',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                const chips = await countElements(page, '#semantic-field-chips .field-chip');
                if (chips < 2) throw new Error(`Expected at least 2 field chips, got ${chips}`);
            }
        },
        {
            name: 'Field chips are active by default',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                const activeChips = await countElements(page, '#semantic-field-chips .field-chip.active');
                if (activeChips === 0) throw new Error('At least one field chip should be active');
            }
        },
        {
            name: 'Field chip toggles on click',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                const chip = await page.$('#semantic-field-chips .field-chip.active');
                if (!chip) throw new Error('No active chip to toggle');
                const textBefore = await chip.evaluate(el => el.textContent.trim());
                await chip.click();
                await sleep(100);
                const isActive = await chip.evaluate(el => el.classList.contains('active'));
                if (isActive) throw new Error(`Chip "${textBefore}" should be deactivated after click`);
                // Toggle back
                await chip.click();
            }
        },
        {
            name: 'Search for "hanks" finds Tom Hanks movies',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'hanks');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'alert success', 'Should show success');
                assertContains(html, 'Hanks', 'Should find Tom Hanks');
                // Tom Hanks is in Forrest Gump and Cast Away = 2 matches
                assertContains(html, 'Match #1', 'Should show Match #1');
                assertContains(html, 'Match #2', 'Should show Match #2');
            }
        },
        {
            name: 'Search for "morgan" finds Morgan Freeman movie',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'morgan');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'Freeman', 'Should find Morgan Freeman');
            }
        },
        {
            name: 'Search for "crime" finds crime movies',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'crime');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'Match #1', 'Should find at least one crime match');
            }
        },
        {
            name: 'Search highlights the search term in results',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'hanks');
                await page.click('#btn-semantic-search');
                await waitForResults(page, 'semantic-results');
                // Wait a bit for post-Prism DOM manipulation to apply <mark> tags
                await sleep(500);
                // Check via DOM query — marks are added via DOM manipulation after Prism runs
                const markCount = await countElements(page, '#semantic-results mark');
                if (markCount === 0) {
                    // Fallback: check innerHTML for mark (in case DOM manipulation already ran)
                    const html = await page.$eval('#semantic-results', el => el.innerHTML);
                    assertContains(html, 'mark', 'Should highlight search term with <mark> element');
                }
                // If markCount > 0, test passes
            }
        },
        {
            name: 'Results show matched keyword badges',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'hanks');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'badge purple', 'Should show purple keyword badges');
                assertContains(html, 'ti-tag', 'Should show tag icons on keyword badges');
            }
        },
        {
            name: 'Results show byte offset badges',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'hanks');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'byte ', 'Should show byte offset in results');
            }
        },
        {
            name: 'Results show copy buttons',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'hanks');
                await page.click('#btn-semantic-search');
                await waitForResults(page, 'semantic-results');
                const btns = await countElements(page, '#semantic-results .copy-btn');
                if (btns === 0) throw new Error('No copy buttons in semantic results');
            }
        },
        {
            name: 'No-match search shows warning',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', 'xyznonexistent999');
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'warning', 'Should show warning for no matches');
            }
        },
        {
            name: 'Stat cards show Objects Indexed, Fields Indexed, Matches Found',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await page.click('#btn-semantic-search');
                const html = await waitForResults(page, 'semantic-results');
                assertContains(html, 'Objects Indexed', 'Should show Objects Indexed stat');
                assertContains(html, 'Fields Indexed', 'Should show Fields Indexed stat');
                assertContains(html, 'Matches Found', 'Should show Matches Found stat');
            }
        },
        {
            name: 'Empty search term shows error',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await setValue(page, '#semantic-search-term', '');
                await page.click('#btn-semantic-search');
                await sleep(500);
                const html = await page.$eval('#semantic-results', el => el.innerHTML);
                assertContains(html, 'alert error', 'Should show error for empty search term');
            }
        },
        {
            name: 'Term suggestion buttons set the search term',
            async fn(page) {
                await switchTab(page, 'semantic');
                await page.click('#btn-semantic-example');
                await sleep(300);
                await page.evaluate(() => setSemanticTerm('dark'));
                const val = await getValue(page, '#semantic-search-term');
                if (val !== 'dark') throw new Error(`Expected "dark", got "${val}"`);
            }
        },
    ]
};
