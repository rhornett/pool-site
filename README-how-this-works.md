# How the Rikki Hornett Pool Site Was Built — Quick Reference

A plain-language recap for future-you. Live at **hornett.org**.

## What it is

A live-scoring dashboard for a 116-entry NFL pool (72 households). Each
entry picked NFL teams within a $10 "selection value" budget — **separate
from the real $50/line entry fee** ($5,800 total pot = 116 × $50). The whole
thing is one self-contained HTML file with no backend: all data is baked in
at build time, and everything live comes from ESPN's public (undocumented)
JSON endpoints, fetched straight from the visitor's own browser.

## How the site is hosted (current)

- **Code lives in a GitHub repo**: `rhornett/pool-site`
- **Cloudflare Pages** builds and hosts the dashboard, auto-deploying on
  every push to `main`. Project name on Cloudflare: `pool-site`.
- **DNS**: `hornett.org`'s nameservers point to Cloudflare (moved off
  Namecheap's own DNS during setup).
- Repo structure:
  ```
  public/index.html     → the entire dashboard: HTML + CSS + JS + baked data, all in one file
  public/bonuses.json   → admin-maintained override file for division/playoff/SB winners
  public/_redirects     → routes /upload and /entry-form to their Netlify-hosted pages
  public/entry-form.html → pool entry form (committed, not linked yet; see Pending below)
  public/upload.html    → source of the live upload page that Netlify serves (see below), NOT dead weight
  netlify.toml, netlify/functions/generate-upload-url.js, package.json → the Netlify side of the upload flow
  ```
- **To update the dashboard**: replace `public/index.html` in the repo with
  a fresh export, commit to `main` — Cloudflare redeploys automatically,
  usually inside a minute. Nothing else to do.
- **To set division winners once they're official** (or correct a playoff
  result ESPN got wrong): update `public/bonuses.json` and push. This is the
  only way that reaches every visitor — see "Scoring rules" for why the
  in-page Edit Standings modal doesn't work for this.

### Why the upload page is still on Netlify

The dashboard migrated from Netlify to Cloudflare Pages, but the file
upload page (`upload.html`, with its presigned-URL-to-Cloudflare-R2 flow)
was left running on its original Netlify deployment rather than migrated.
`public/_redirects` on the Cloudflare side forwards `/upload.html` and
`/upload` to the live Netlify URL, so from a visitor's point of view it's
all one site.

Netlify appears to still build from this same repo (`netlify.toml`
publishes `public/` and the functions in `netlify/functions/`). As of
2026-10-03 the live Netlify upload page was identical to
`public/upload.html` apart from Netlify's own build-time form rewriting.
So `public/upload.html` is the real source for that page — don't delete it
as a "stale copy" even though Cloudflare redirects away from it. See the original Netlify/R2 notes further down for how that
piece works if it ever needs touching.

## The dashboard, tab by tab

**Live Scoreboard** (the default tab):
- Hero stats row: entries, households, total pot, avg teams/entry, Best
  Possible Score, and the live Pool Odds favorite with their win %
- **Pool Odds**: top 5 owners by live chance of winning the whole pool —
  real ESPN division-odds data feeding a from-here-to-the-Super-Bowl
  playoff simulation (see "Pool Odds simulation" below). Each card also
  shows a predicted final score for that owner.
- **Predicted Final Standings**: a *different* ranking from Pool Odds —
  ordered by each owner's average simulated finishing position rather than
  how often they win outright, so a consistently-solid owner can rank
  above someone who only occasionally gets a spectacular outcome.
- **This Week's Highlights**: top scorer, biggest climber, quietest week,
  most consistent, boom-or-bust — computed from week-over-week deltas.
- **Owner Leaderboard**: every entry, searchable, with a small inline bar
  chart per owner showing points scored each week vs. the pool average.
- **Weekly Recap**: a shareable card (shown inline, downloadable as a PNG)
  summarizing the week — top scorer, biggest climber, pool leader, Pool
  Odds favorite. Sized dynamically to fit whatever text it needs, since
  tied-name lists can run long.

**Team Scores**: every real NFL team, live record and point total, and a
playoff-standing badge — "Division Leader"/"Wild Card"/"In the hunt"/"Long
shot" with the actual live conference seed number. Explicitly labeled as
*current standing*, not official mathematical elimination.

**Playoff Bracket**: "if the playoffs started today" — real, live seeds
fill the wild-card round (bye for the 1-seed, 2v7/3v6/4v5 matchups).
Divisional round onward is marked TBD rather than guessed at; Pool Odds
already covers "who's likely to advance" as a simulation, so the bracket
itself stays to what's actually known.

**Insights**:
- **Score History**: top-5 owners' cumulative score over the season, plus
  two extra reference lines — the $10-budget Best Possible ceiling and
  Worst Possible floor, recalculated fresh at *each* week's own data, not
  just today's.
- **Best Possible Score** / **Worst Possible Score**: both knapsack
  problems against a budget (editable, defaults to $10). Worst Possible
  specifically finds the lowest score *while still spending the full
  budget* — not just picking nobody, which would be a meaningless answer.
- **Payout Breakdown**: 60/30/10 split, ties sharing their combined slots
  evenly.
- **Head-to-Head**: type-to-search pickers (not a plain dropdown — 116
  entries doesn't fit one) comparing any two entries' rosters side by side,
  shared teams highlighted, live game badges included.

**Pool Overview**: reference tables (entries, teams, etc.) from the
original build.

## Clickable names, everywhere

Every owner name and every team mention across the whole site — leaderboard,
Pool Odds, the bracket, Team Scores, Head-to-Head, Best/Worst Possible Score
— is clickable. Click an owner to see their full roster, rank, payout, and a
week-by-week points bar chart with the exact numbers; click a team to see
every real entry that holds it, sorted by their overall pool rank, with a
link back to each of them. Built on two small shared helpers
(`ownerLinkHtml()` / `teamLinkHtml()`) and one delegated click listener
rather than per-element handlers, since most of this content is regenerated
on every refresh.

## Pool Odds simulation

ESPN publishes each team's live, real chance to win its division — that
part is genuine ESPN data, fetched fresh. ESPN does *not* publish a clean
"chance to win the Super Bowl" number anywhere usable, so the rest of the
bracket (wild-card seeding, every individual playoff game, conference
championships, the Super Bowl) is simulated 20,000 times using each team's
projected strength as the engine. This is described as "our simulation" in
the page copy, deliberately distinct from the real ESPN inputs feeding it.

The simulation is **seeded deterministically** — a hash of the real current
inputs (every team's projection data, every owner's current score) feeds a
seeded PRNG, so reloading the page with nothing actually changed gives the
exact same percentages. Once real inputs change (odds shift, scores update),
the seed changes and the simulation produces a genuinely new result.

Team IDs for ESPN's per-team projection endpoint are a **hardcoded table**
in the code. ESPN's own team-list endpoint (which would normally supply
these) blocks cross-origin browser requests with a CORS error, so the IDs
were instead pulled from the standings endpoint (which works fine) and
hardcoded. If ESPN ever renumbers teams (it doesn't, in practice — these
IDs are permanent) this table would need updating; don't reintroduce a
runtime fetch to the blocked endpoint to "fix" this.

## Scoring rules

```
points = wins*1
         + (divisionWinner ? 5 : 0)
         + playoffWins*3
         + (confChamp ? 5 : 0)
         + (sbChamp ? 10 : 0)
```

Regular-season wins/losses sync live and automatically from ESPN. The
bonuses come from two places (`fetchPlayoffAuto()` and
`applyBonusesToStats()` in `index.html`):

- **Playoff wins, conference champ, Super Bowl champ — automatic from
  ESPN.** From week 17 onward (or once ESPN's scoreboard shows playoff
  games), the page reads ESPN's postseason scoreboard and counts every
  *completed* game, identifying the round from ESPN's headline text
  ("Wild Card"/"Divisional" = playoff win, "Championship" = conference
  champ, "Super Bowl" = SB champ; the Pro Bowl never scores). These are
  real results of finished games, not projections.
- **Division winner — manual only, via `bonuses.json`.** ESPN doesn't
  expose a usable "won the division" flag, and a team currently *leading*
  its division isn't the same as having officially *won* it. So +5 is
  only awarded for teams listed in `divisionWinners`. The "Division
  Leader" badges on Team Scores are a live seeding display, never a
  scoring trigger.

`bonuses.json` is also an override layer on top of ESPN, with
field-specific rules:

| Field | Effect |
|---|---|
| `divisionWinners` | The *only* source of division-winner bonuses |
| `playoffWins` | Replaces ESPN's count for just the teams listed |
| `confChamps` | Replaces ESPN's whole list, but only if non-empty |
| `sbChamp` | Replaces ESPN's champion, but only if non-empty |

**Edit Standings (`#admin`) does not set bonuses for anyone.** It saves to
the commissioner's own browser `localStorage`, so no other visitor ever
sees those edits — and even in that browser, every live poll (about every
two minutes) re-applies `bonuses.json` + ESPN and overwrites all four bonus
flags. Treat it as a local what-if tool; use `bonuses.json` for anything
real.

Not yet verified against real data: the postseason fetch requests
`dates=<season_year>` from ESPN, and there's no real 2026 postseason data
to confirm against until January. A mocked-fetch Playwright test of the
round matching and override rules would be worth doing before then.

## How the file upload works (unchanged from original Netlify build)

Files up to 1GB can't pass through a normal serverless function (small
payload limits), so the upload page uses a **presigned URL** pattern:

1. Visitor picks a file on `upload.html`
2. The page asks a Netlify function (`generate-upload-url.js`) for permission
3. That function talks to **Cloudflare R2** (S3-compatible object storage)
   and hands back a temporary, one-time upload link
4. The browser sends the file **directly to R2** — never through Netlify —
   which is what makes large files possible

**Where uploaded files land**: Cloudflare dashboard → R2 → `file-upload`
bucket → Objects tab. Named `uploads/<timestamp>-<sender name>-<filename>`.

### Two non-obvious gotchas that cost real debugging time
- The R2 bucket is **EU-jurisdiction**, so the function needs the
  EU-specific endpoint (`R2_ENDPOINT` env var), not R2's global default
- The AWS SDK defaults to a URL style R2 doesn't like
  (`bucket.account.r2.cloudflarestorage.com`); the function forces the
  style R2 actually expects via `forcePathStyle: true`

### The 5 environment variables (set in Netlify, not in code)
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`, `R2_ENDPOINT`

### CORS
The R2 bucket's CORS policy must list every domain allowed to upload to it
(currently `hornett.org` and the Netlify `.netlify.app` address). If
uploads start failing with a CORS error in the browser console after adding
a new domain, check this first.

## Security notes for future-you

- The R2 API token was regenerated at least once during setup after being
  visible in screenshots/chat — if anything seems off with uploads,
  rotating the token (Cloudflare → R2 → Manage API Tokens) and updating the
  two secret env vars in Netlify is a safe first troubleshooting step
- All R2 credentials live in Netlify's "Environment variables" screen —
  never in the code itself

## If something breaks later

- **Dashboard shows stale scores**: the page auto-syncs every couple of
  minutes and on tab focus; a hard refresh rules out local caching. If
  ESPN's own feed is lagging, that's on their end and usually resolves
  within minutes.
- **Pool Odds / playoff bracket look wrong or stuck**: check the browser
  console for a CORS or fetch error against ESPN's endpoints — ESPN
  occasionally changes response shapes without notice. The dashboard is
  built to degrade gracefully (shows a "couldn't load live odds" message)
  rather than show stale numbers silently, so a visible error message means
  something upstream actually changed.
- **Upload page fails**: check the browser console (F12) for the exact
  error — CORS errors and R2 credential errors look different and point to
  different fixes.
- **Site down / cert errors**: usually resolves itself within minutes; try
  a hard refresh or a different device/network before assuming it's
  actually broken.

## Pending items (not yet done, as of this writing)

- **Entry form** (`public/entry-form.html`): committed 2026-10-03 but not
  linked from anywhere yet. Its team prices, abbreviations and divisions
  were cross-checked against the baked `index.html` data (all 32 match, and
  all 116 real entries' totals reprice exactly). It submits via **Netlify
  Forms** (POST to `/`), so it only works when served from Netlify. On
  hornett.org (Cloudflare) that POST gets a 405 and the form shows "Could
  not submit", so it fails visibly rather than silently. `_redirects` now
  forwards `/entry-form.html` and `/entry-form` to the Netlify copy, like
  the upload page. Still to do: confirm Netlify builds it, and turn on email
  notifications for the `pool-entries` form in Netlify's dashboard.
- **Division winners** need entering into `divisionWinners` in
  `bonuses.json` once officially decided (expected around January). Playoff
  wins, conference and SB champs will fill in automatically from ESPN.
- **Possible future additions** raised but not built: showing which
  owners hold each team directly in the Playoff Bracket (beyond the
  click-through popup that already exists), playoff-specific highlights
  once the real postseason starts, auto-advancing the bracket as real
  playoff games are decided, and a simpler non-technical way to update
  `bonuses.json` than hand-editing JSON.

## Engineering standard for this codebase

Every piece of scoring, simulation, or financial logic on this site was
verified against an independent calculation before shipping — brute-force
enumeration, a hand-written cross-check script, or a scenario with a known
correct answer — usually run through a real headless browser, not just
read over and judged by eye. A few examples if it's useful to see the
pattern: the Worst Possible Score knapsack was checked against 30 random
brute-force trials; the Pool Odds simulation was checked for both symmetry
and dominance properties at 200,000 trials; the clickable team-detail
owner counts were cross-checked against an independently recomputed
distinct-entry count. Keep this bar for anything touching real numbers.
