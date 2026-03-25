// Suite: JSON Validation Tab
const {
    switchTab, waitForResults, assertContains, assertNotContains,
    setValue, countElements, exists, sleep, getValue
} = require('./helpers');

module.exports = {
    name: 'JSON Validation',
    tests: [
        {
            name: 'Tab switches to validate correctly',
            async fn(page) {
                await switchTab(page, 'validate');
                const active = await exists(page, '#content-validate.active');
                if (!active) throw new Error('validate section not active');
            }
        },
        {
            name: 'Load Valid Example populates textarea',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                const val = await getValue(page, '#validate-json');
                assertContains(val, 'catalog', 'Valid example should contain catalog');
                assertContains(val, 'unicode', 'Valid example should contain unicode field');
            }
        },
        {
            name: 'Load Invalid Example populates textarea with broken JSON',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-invalid-example');
                await sleep(200);
                const val = await getValue(page, '#validate-json');
                assertContains(val, 'broken', 'Invalid example should contain "broken"');
            }
        },
        {
            name: 'Valid JSON passes both checks',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert success', 'Valid JSON should show success alert');
                assertContains(html, 'All checks passed', 'Should say all checks passed');
            }
        },
        {
            name: 'Valid JSON shows JSON Structure check as pass',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'validation-check pass', 'Should show pass validation check');
                assertContains(html, 'JSON Structure', 'Should show JSON Structure label');
            }
        },
        {
            name: 'Valid JSON shows UTF-8 Delimiter Safety as pass',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'UTF-8 Delimiter Safety', 'Should show UTF-8 check');
                // Both checks should be pass
                const passCount = (html.match(/validation-check pass/g) || []).length;
                if (passCount < 2) throw new Error(`Expected 2 pass checks, got ${passCount}`);
            }
        },
        {
            name: 'Invalid JSON shows error alert',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-invalid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert error', 'Invalid JSON should show error alert');
                assertContains(html, 'Validation failed', 'Should say validation failed');
            }
        },
        {
            name: 'Invalid JSON shows JSON Structure as fail',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-invalid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'validation-check fail', 'Should show fail validation check');
            }
        },
        {
            name: 'Validation shows bytes checked stat',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'Bytes Checked', 'Should show Bytes Checked stat');
            }
        },
        {
            name: 'Validation shows Overall stat',
            async fn(page) {
                await switchTab(page, 'validate');
                await page.click('#btn-validate-valid-example');
                await sleep(200);
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'Overall', 'Should show Overall stat');
                assertContains(html, '✓ Valid', 'Should show ✓ Valid for valid JSON');
            }
        },
        {
            name: 'Custom valid JSON validates correctly',
            async fn(page) {
                await switchTab(page, 'validate');
                await setValue(page, '#validate-json', '{"name":"test","values":[1,2,3],"nested":{"ok":true}}');
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert success', 'Custom valid JSON should pass');
            }
        },
        {
            name: 'Custom invalid JSON fails validation',
            async fn(page) {
                await switchTab(page, 'validate');
                await setValue(page, '#validate-json', '{bad json here');
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert error', 'Custom invalid JSON should fail');
            }
        },
        {
            name: 'Empty input shows error',
            async fn(page) {
                await switchTab(page, 'validate');
                await setValue(page, '#validate-json', '');
                await page.click('#btn-validate-run');
                await sleep(500);
                const html = await page.$eval('#validate-results', el => el.innerHTML);
                assertContains(html, 'alert error', 'Empty input should show error');
            }
        },
        {
            name: 'Unicode JSON validates correctly',
            async fn(page) {
                await switchTab(page, 'validate');
                await setValue(page, '#validate-json', '{"greeting":"こんにちは","emoji":"🎉","arabic":"مرحبا"}');
                await page.click('#btn-validate-run');
                const html = await waitForResults(page, 'validate-results');
                assertContains(html, 'alert success', 'Unicode JSON should pass validation');
            }
        },
    ]
};
