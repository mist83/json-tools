# JSON Tools — Demo Shotlist

Total: ~28s. 1280x800 chromium, headless, recorded with Playwright.
Mode: Browser Preview (no backend required), running against a local
`python3 -m http.server` over `publishDir = .`.

The hero flow is **paste-real-JSON → validate → switch to path
extraction → see byte-precise objects light up**. We avoid touring
every tool and instead lock onto the single moment that sells the
library: "look — your JSON, sliced by exact byte position."

## Beats

1. **00.0 - 03.0s — Cold open on the workspace.**
   Land on Home. Header reads "JsonUtilities" with the green
   "117 tests passing" and ".NET 8 / Zero-alloc" badges. Linger one
   beat so the badges register.

2. **03.0 - 07.0s — Set the stage: Browser Preview.**
   Click Execution Mode in the sidebar, switch the dropdown to
   "Browser Preview — keep data in this tab." Status text confirms
   "data stays in the tab." Establishes "no backend, this is real."

3. **07.0 - 13.0s — Paste a real-world JSON catalog.**
   Click Paste JSON. Drop a multi-collection e-commerce blob into the
   textarea (products / reviews / orders). Hit "Use This Data."
   Active-dataset banner flips green with the size in bytes.

4. **13.0 - 19.0s — Validate. Both checks pass.**
   Hash-jump to Tools, Validate panel. Click "Validate Active
   Dataset." Two green cards land: "JSON Structure" and "UTF-8
   Delimiter Safety." This is the credibility beat.

5. **19.0 - 28.0s — Payoff: byte-precise path extraction.**
   Switch to Path Extraction. Type `products` into the path field,
   click "Extract Objects." Result: each object renders as a card
   with a byte-position bar showing its exact slice of the file plus
   an MD5-style summary. Hold the payoff frame for ~3s — this is
   also the poster.

## Payoff frame (poster)

A Tools-tab Path Extraction result with multiple object cards, each
showing byte-range bars filling in across the file. Captured at the
end of beat 5.
