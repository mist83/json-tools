#!/usr/bin/env node
// JsonUtilities E2E Test Runner
// Usage: node tests/run.js
//        HEADLESS=false node tests/run.js   (watch mode)
//        BASE_URL=http://localhost:5000 node tests/run.js

const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'https://json-tools.mikesendpoint.com';
const HEADLESS = process.env.HEADLESS !== 'false';
const API_TIMEOUT = 25000; // 25s — Lambda cold start can be slow
const NAV_TIMEOUT = 30000;

// ── Test registry ─────────────────────────────────────────────────────────────
const suites = [
    require('./suite-page-load'),
    require('./suite-home-tab'),
    require('./suite-tools-tab'),
    require('./suite-byte-range'),
    require('./suite-path-extract'),
    require('./suite-trie-index'),
    require('./suite-semantic-search'),
    require('./suite-validate'),
    require('./suite-about'),
    require('./suite-plugin-registry'),
];

// ── Runner ────────────────────────────────────────────────────────────────────
async function run() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  JsonUtilities E2E Tests`);
    console.log(`  Target: ${BASE_URL}`);
    console.log(`  Mode:   ${HEADLESS ? 'headless' : 'headed'}`);
    console.log(`${'═'.repeat(60)}\n`);

    const browser = await puppeteer.launch({
        headless: HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-cache'],
        defaultViewport: { width: 1280, height: 900 }
    });

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const suite of suites) {
        console.log(`\n  ▶ ${suite.name}`);
        const page = await browser.newPage();
        page.setDefaultTimeout(API_TIMEOUT);
        page.setDefaultNavigationTimeout(NAV_TIMEOUT);

        // Capture console errors from the page
        const pageErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') pageErrors.push(msg.text());
        });
        page.on('pageerror', err => pageErrors.push(err.message));

        try {
            await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
        } catch (e) {
            console.log(`    ✗ FATAL: Could not load page — ${e.message}`);
            failed++;
            failures.push({ suite: suite.name, test: 'page load', error: e.message });
            await page.close();
            continue;
        }

        for (const test of suite.tests) {
            // Skip if page/browser is no longer usable
            if (page.isClosed()) break;

            try {
                await test.fn(page, { BASE_URL, API_TIMEOUT });
                console.log(`    ✓ ${test.name}`);
                passed++;
            } catch (e) {
                const msg = e.message || '';
                // If browser/frame is gone, stop this suite
                if (msg.includes('detached Frame') || msg.includes('Connection closed') || msg.includes('Target closed')) {
                    console.log(`    ✗ ${test.name}`);
                    console.log(`        → ${msg}`);
                    failed++;
                    failures.push({ suite: suite.name, test: test.name, error: msg });
                    break; // stop suite, open fresh page for next suite
                }
                console.log(`    ✗ ${test.name}`);
                console.log(`        → ${msg}`);
                failed++;
                failures.push({ suite: suite.name, test: test.name, error: msg });
                // Reload page for next test to avoid state bleed
                try {
                    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
                } catch (_) {}
            }
        }

        if (pageErrors.length > 0) {
            console.log(`    ⚠ Page console errors: ${pageErrors.slice(0, 3).join(' | ')}`);
        }

        await page.close();
    }

    await browser.close();

    // ── Summary ───────────────────────────────────────────────────────────────
    const total = passed + failed;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Results: ${passed}/${total} passed  (${failed} failed)`);
    if (failures.length > 0) {
        console.log(`\n  Failures:`);
        failures.forEach(f => {
            console.log(`    ✗ [${f.suite}] ${f.test}`);
            console.log(`        ${f.error}`);
        });
    }
    console.log(`${'═'.repeat(60)}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(1);
});
