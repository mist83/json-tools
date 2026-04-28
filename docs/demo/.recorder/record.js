// JSON Tools — oscar-cut demo recorder.
//
// Drives the local static build (python3 http.server on $PORT) through the
// hero flow: Browser Preview mode -> paste real-world JSON -> validate ->
// path-extract products -> hold the byte-range payoff frame.
//
// Output: a single 1280x800 .webm at <outDir>/raw/<random>.webm. The
// outer harness moves it to docs/demo/demo.webm and also captures
// poster.png from the payoff frame.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = process.env.PORT || '8788';
const BASE = `http://localhost:${PORT}/`;
const OUT_DIR = process.env.OUT_DIR
  || path.join(__dirname, 'video-out');
const POSTER_PATH = process.env.POSTER_PATH
  || path.join(__dirname, '..', 'poster.png');

const VIEWPORT = { width: 1280, height: 800 };

// A realistic, multi-collection JSON blob the user might have on hand.
const PASTE_JSON = `{
  "products": [
    {
      "id": "prod-001",
      "name": "Wireless Headphones",
      "price": 79.99,
      "category": "Electronics",
      "inStock": true,
      "rating": 4.5
    },
    {
      "id": "prod-002",
      "name": "Running Shoes",
      "price": 129.99,
      "category": "Sports",
      "inStock": false,
      "rating": 4.8
    },
    {
      "id": "prod-003",
      "name": "Coffee Maker",
      "price": 49.99,
      "category": "Home",
      "inStock": true,
      "rating": 4.2
    },
    {
      "id": "prod-004",
      "name": "Mechanical Keyboard",
      "price": 159.0,
      "category": "Office",
      "inStock": true,
      "rating": 4.7
    }
  ],
  "reviews": [
    {
      "productId": "prod-001",
      "rating": 5,
      "comment": "Excellent sound quality!",
      "author": "John D.",
      "verified": true
    },
    {
      "productId": "prod-002",
      "rating": 4,
      "comment": "Very comfortable for long runs",
      "author": "Sarah M.",
      "verified": true
    }
  ],
  "orders": [
    {
      "orderId": "ord-12345",
      "customerId": "cust-789",
      "items": ["prod-001", "prod-003"],
      "total": 129.98,
      "status": "shipped"
    }
  ]
}`;

async function typeSlowly(locator, text, perChar = 12) {
  await locator.click();
  await locator.fill('');
  await locator.type(text, { delay: perChar });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Wipe any prior video so we always emit exactly one fresh .webm.
  for (const f of fs.readdirSync(OUT_DIR)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  // ── Beat 1 (00.0s): cold open on the workspace ───────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1 .header-accent', { timeout: 15000 });
  // Make sure the badges have laid out before we start the beat timing.
  await page.waitForSelector('#execution-mode-badge');
  await page.waitForTimeout(2700);

  // ── Beat 2 (~03.0s): switch to Browser Preview ───────────────────────
  await page
    .locator('.sidebar-item[data-home-panel="execution"]')
    .first()
    .click();
  await page.waitForTimeout(700);
  await page.locator('#execution-mode').selectOption('browser');
  await page.waitForTimeout(2700);

  // ── Beat 3 (~07.0s): paste a real-world JSON catalog ─────────────────
  await page
    .locator('.sidebar-item[data-home-panel="paste"]')
    .first()
    .click();
  await page.waitForTimeout(500);
  await page.locator('#home-paste-name').fill('Product Catalog');
  await page.waitForTimeout(150);
  // Use fill() for the body — typing the whole blob would blow the budget.
  // We "type" the dataset name instead so there's visible motion.
  await page.locator('#home-paste-json').fill(PASTE_JSON);
  await page.waitForTimeout(700);
  await page
    .locator('button.btn-primary', { hasText: 'Use This Data' })
    .first()
    .click();
  // Active-dataset banner flips green.
  await page.waitForSelector('#home-active-status .alert-success', {
    timeout: 5000,
  });
  await page.waitForTimeout(2200);

  // ── Beat 4 (~13.0s): validate, both checks pass ──────────────────────
  // Hash-jump straight to Tools so the transition feels sharp.
  await page.evaluate(() => {
    window.location.hash = 'tools';
  });
  await page.waitForSelector('#tool-byte-range', { timeout: 5000 });
  await page.waitForTimeout(700);
  await page
    .locator('.sidebar-item[data-tool="validate"]')
    .first()
    .click();
  await page.waitForSelector('#tool-validate.active', { timeout: 3000 });
  await page.waitForTimeout(500);
  await page
    .locator('button.btn-primary', { hasText: 'Validate Active Dataset' })
    .first()
    .click();
  // Wait for the success banner.
  await page.waitForSelector('#validate-results .alert-success', {
    timeout: 5000,
  });
  await page.waitForTimeout(3300);

  // ── Beat 5 (~19.0s): path extraction payoff ──────────────────────────
  await page
    .locator('.sidebar-item[data-tool="path-extract"]')
    .first()
    .click();
  await page.waitForSelector('#tool-path-extract.active', { timeout: 3000 });
  await page.waitForTimeout(500);
  await typeSlowly(page.locator('#path-extract-path'), 'products', 55);
  await page.waitForTimeout(400);
  await page
    .locator('button.btn-primary', { hasText: 'Extract Objects' })
    .first()
    .click();
  await page.waitForSelector('#path-extract-results .alert-success', {
    timeout: 5000,
  });
  // Let the byte-range bars finish their entry animation.
  await page.waitForTimeout(1800);

  // Capture the poster from the payoff frame before we tear the context down.
  await page.screenshot({ path: POSTER_PATH, fullPage: false });

  // Hold the payoff frame, then close the context to flush the .webm.
  await page.waitForTimeout(2400);

  await context.close();
  await browser.close();

  // Report the recorded file path so the harness can move it.
  const files = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => path.join(OUT_DIR, f));
  if (files.length === 0) {
    throw new Error('No .webm produced.');
  }
  process.stdout.write(files[0] + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
