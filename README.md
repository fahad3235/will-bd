# Will BD

An offline, bilingual (English / Bangla) will and estate-planning guide
for Bangladesh. Build a plain-language will outline step by step, list
your assets, check the one-third rule for bequests to non-heirs, work
through signing checklists, and test what you learned - all without an
account, a server, or any network request.

## Problem

Most people in Bangladesh never write a will: they do not know where to
start, what a will needs (an executor, two witnesses, named beneficiaries),
or how the one-third rule limits gifts to non-heirs. A bank nominee is
often mistaken for a will, and a will written once is rarely reviewed.
Will BD turns that into a guided checklist: it collects the pieces one at
a time, shows a plain-language outline as you go, and keeps everything
private in the browser.

## Features

- **Dashboard** - total asset value, beneficiary count, checklist
  percentage, and outline completeness (Complete / Incomplete).
- **Will outline builder** - testator (full name required; address and
  NID optional, 10/13/17 digits if given), beneficiaries (name required,
  relation, share 1-100%; shares must sum to 100% or less; at least one
  required), executor (name + relation required, optional Bangladeshi
  mobile), two witnesses (both names required for completeness), guardian
  for minor children (optional), and special wishes (free text, max 500
  characters). The app generates a plain-language will **outline** (not a
  legal document) in the current language, with a Print button.
  Inline validation errors everywhere. Completeness = testator name +
  at least 1 beneficiary + executor + 2 witnesses.
- **One-third rule calculator** - enter an estate value in taka
  (0-999,999,999) and see the maximum bequest to a non-heir,
  `floor(value / 3)`, with the rule in plain language. Labelled as
  general information, not legal advice.
- **Asset inventory** - add, edit, and delete assets (Land, House/Flat,
  Bank account, Gold, Business, Vehicle, Other) with a description and a
  value in taka. Running total displayed and persisted.
- **Checklists (persisted, per-list + overall %)** - "Before you write"
  (6 items: NID card, land deed / khatian, bank statements, nominee
  forms, list of debts, any previous will) and "Signing day" (5 items:
  two adult witnesses present, sign every page, write the date, keep the
  original in a safe place, give a copy to the executor).
- **Quiz** - 10 questions, one at a time with Next, an explanation after
  every answer, and a final score with a persisted best score. Every
  question uses only the well-known facts listed in the "Good to know"
  section: a will takes effect after death; two adult witnesses are the
  standard practice; a bank nominee is a custodian/trustee, not the
  owner; bequests to non-heirs are limited to one-third under Muslim
  personal law; registration is optional; a will can be changed or
  revoked during life; the executor carries it out; a beneficiary should
  not act as a witness; a guardian for minor children can be named; keep
  the will where the executor can find it.
- **Good to know** - 4 short facts: nomination is not a will; the
  one-third rule; registration is optional; review the will after big
  life events (marriage, birth, buying land).
- **Bilingual UI** - one tap switches English / Bangla, including
  Bengali digits in stats and taka amounts. The language choice persists.
- **Data tools** - export a JSON backup (also exposed as
  `window.__willExported` for testing), strict import (bad JSON, wrong
  version, bad types, dangling ids, or share sum over 100% are rejected
  and existing data is left untouched), erase everything only after
  typing DELETE exactly, and a clearly-labelled "Load demo data" button
  that never auto-loads.
- **Offline-first** - zero network requests. All data lives in
  `localStorage` under `will-bd:data` (version 1) and `will-bd:lang`.
  The app ships empty: no preset people, assets, or prices.

## Stack

- Plain HTML, CSS, and JavaScript - no frameworks, no build step, no
  external fonts, images, or network requests.
- `js/logic.js` - pure logic (no DOM, no storage), unit-tested from Node.
- `js/i18n.js` - all UI strings in English and Bangla (Bengali stored as
  `\uXXXX` escapes so every source file stays pure ASCII).
- `js/app.js` - DOM rendering and event wiring only.
- Tests: `node:assert` unit tests and a headless-Chrome smoke test over
  raw CDP with Node's built-in WebSocket (no npm dependencies).

## Prerequisites

- Any modern browser (Chrome, Firefox, Safari, Edge).
- Node.js 18+ only if you want to run the tests.

## Install

No install step. Clone the repo (or download it) and open `index.html`
in a browser - or serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Dev commands

```sh
node tests/test.js        # unit tests (logic.js)
node tests/smoke.mjs 1280 # headless-Chrome smoke test, desktop
node tests/smoke.mjs 390  # headless-Chrome smoke test, mobile
```

The smoke test drives the Playwright-cached `headless_shell` binary over
CDP and writes screenshots to `tests/smoke-1280.png` and
`tests/smoke-390.png` (excluded from the repo by `.gitignore`).

## Environment

None. There are no secrets, API keys, or environment variables. The app
makes no network requests at all.

## Testing

- `node tests/test.js` - 65 test cases (createStore shape, NID and
  Bangladeshi phone validation, testator rules, beneficiary validation
  including share 0 / over 100 / non-integer / sum over 100, executor
  and witness rules, guardian and wishes limits, completeness and
  outline parts, one-third math hand-checked at 900000 -> 300000,
  1000000 -> 333333, 0 -> 0, 999999 -> 333333, asset add/edit/delete
  and totals, checklist toggle and progress math, quiz scoring
  10 / 0 / partial, best-score recording, export/import round-trip and
  strict-import rejections, demo data, Bengali digits, digit grouping
  and money formatting in both languages).
  Result on 2026-11-21: **65 passed, 0 failed**.
- `node tests/smoke.mjs 1280` - 65 checks in a real headless browser
  (empty states, calculator 900000 -> 300,000 and negative rejection,
  asset add 500,000 then edit to 600,000, beneficiary 0% and 110% share
  rejections, testator/executor/witnesses saved, outline Complete with
  all names, checklist 1 of 11 = 9%, quiz 9/10 with explanations and a
  persisted best score, Bangla toggle with Bengali digits + persistence,
  reload persistence, markup-name safety, export/erase/import
  round-trip, demo data load, no overflow, 0 console errors, 0 failed
  requests).
  Result on 2026-11-21: **65 passed, 0 failed**.
- `node tests/smoke.mjs 390` - same 65 checks at mobile width.
  Result on 2026-11-21: **65 passed, 0 failed**.

See `TEST_RESULTS.md` for the full run log.

## Deployment

GitHub Pages (or any static host): push the repo and enable Pages from
the repo root. `index.html` is the entry point; everything is relative
paths.

## Limitations

- This is a personal planning tool. The outline is a **draft to take to
  a lawyer** - it is NOT a legal document and NOT legal advice. Laws
  change and every family is different; verify everything with a lawyer
  before signing anything.
- The one-third rule is stated for Muslim personal law in Bangladesh.
  Other personal laws differ; the calculator is general information
  only.
- Data lives only in one browser's `localStorage`. Clearing browser
  data loses the outline unless you exported a JSON backup first.
- Money amounts are integers in taka; no paisa support.
- Shares are percentages of the estate as a planning aid; they do not
  replace the legal rules of succession.

## Status

Complete MVP, tested locally 2026-11-21. Ready for GitHub Pages.
