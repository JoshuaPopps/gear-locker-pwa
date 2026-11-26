# Gear Locker

Riding gear, with a home. Every jacket, helmet, glove, and boot — what it is, what size, what shape it's in, and what it cost.

- **Locker tab** — every item, name-sorted, with search (name or brand), a bike filter (all / one bike / general-only), and a type filter (populated from the types actually in use). Each row shows the item, its bike, size, cost, and condition, with Edit and Delete. The add form takes a name as the only required field — type, brand, size, bike, cost, condition, date, and notes are all optional. The same form edits: tap Edit on a row and it fills in, with a Cancel edit button.
- **Summary tab** — per-bike totals and all-bikes totals: items, total value, plus a per-type count (most items first, then by name).
- **Bikes tab** — the shared Pocket Garage roster (b1 1995 Fat Boy, b2 1990 Softail, b3 1947 Knucklehead) plus an add-a-bike form.
- **Data tab** — export whole locker as JSON, export one bike as JSON or readable text, import (replaces the locker), load example data, delete all gear (gear only — the shared roster is never touched).

## The honesty rule

Every brand, size, and cost on screen is one the rider typed in. Nothing is invented: no brand, size, or cost is ever suggested. A size left blank stays blank. Gear with no cost entered has no value in the totals — the summary says how many items are unpriced instead of guessing a price. A $0 cost is a real price (free gear); a blank cost means unknown.

## Tech

- No build step, no dependencies, no account, no server. Gear lives in this device's localStorage (`gear-locker-v1`) and moves as one plain JSON file.
- Bikes live in the shared `pocket-garage-bikes` key via the vendored `bike-profile.js` (byte-identical to the canonical copy). Gear points at a roster key, or at `""` for general gear.
- 1990 Treatment: gloss tank black #070709, chrome, purple #9d6bff, UnifrakturCook headings, Archivo Narrow body. Offline-capable via `sw.js` (cache `gear-locker-v1`); the update button (`sw-update.js`) takes over only when tapped.
- Tests: `node test.js` (core logic) and `python3 test_ui.py` (Playwright, real browser). See TESTING.md.
