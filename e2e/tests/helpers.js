// Shared helpers for all E2E test suites

const API_TIMEOUT = 20000;

/**
 * Click a tab by its data-tab value and wait for the section to become active.
 */
async function switchTab(page, tabName) {
    await page.click(`[data-tab="${tabName}"]`);
    await page.waitForSelector(`#content-${tabName}.active`, { timeout: 3000 });
}

/**
 * Wait for a results div to contain non-loading content.
 * Polls until the spinner is gone and content is present.
 */
async function waitForResults(page, resultsId, timeout = API_TIMEOUT) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const html = await page.$eval(`#${resultsId}`, el => el.innerHTML);
        if (html && !html.includes('spinner') && !html.includes('loading-message') && html.trim().length > 20) {
            return html;
        }
        await sleep(300);
    }
    throw new Error(`Results in #${resultsId} never appeared (timeout ${timeout}ms)`);
}

/**
 * Assert that a string contains a substring (case-insensitive by default).
 */
function assertContains(haystack, needle, message) {
    if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
        throw new Error(message || `Expected to find "${needle}" in:\n${haystack.slice(0, 300)}`);
    }
}

/**
 * Assert that a string does NOT contain a substring.
 */
function assertNotContains(haystack, needle, message) {
    if (haystack.toLowerCase().includes(needle.toLowerCase())) {
        throw new Error(message || `Expected NOT to find "${needle}" in content`);
    }
}

/**
 * Assert a numeric value is within a range.
 */
function assertInRange(val, min, max, label) {
    if (val < min || val > max) {
        throw new Error(`${label}: expected ${val} to be between ${min} and ${max}`);
    }
}

/**
 * Get the text content of an element.
 */
async function getText(page, selector) {
    return page.$eval(selector, el => el.textContent.trim());
}

/**
 * Get the inner HTML of an element.
 */
async function getHtml(page, selector) {
    return page.$eval(selector, el => el.innerHTML);
}

/**
 * Get the value of an input/textarea.
 */
async function getValue(page, selector) {
    return page.$eval(selector, el => el.value);
}

/**
 * Set the value of a textarea/input directly (bypasses slow typing).
 */
async function setValue(page, selector, value) {
    await page.$eval(selector, (el, v) => { el.value = v; }, value);
}

/**
 * Count elements matching a selector.
 */
async function countElements(page, selector) {
    return page.$$eval(selector, els => els.length);
}

/**
 * Wait for an element to contain specific text.
 */
async function waitForText(page, selector, text, timeout = API_TIMEOUT) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const content = await page.$eval(selector, el => el.textContent);
            if (content.toLowerCase().includes(text.toLowerCase())) return content;
        } catch (_) {}
        await sleep(300);
    }
    throw new Error(`Timed out waiting for "${text}" in ${selector}`);
}

/**
 * Check if an element exists on the page.
 */
async function exists(page, selector) {
    return !!(await page.$(selector));
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

module.exports = {
    switchTab,
    waitForResults,
    assertContains,
    assertNotContains,
    assertInRange,
    getText,
    getHtml,
    getValue,
    setValue,
    countElements,
    waitForText,
    exists,
    sleep,
};
