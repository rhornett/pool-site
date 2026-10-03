# Rikki Hornett NFL Owner's Pool — orientation for Claude Code

Live at **hornett.org**. This file is read automatically at the start of every
Claude Code session in this repo. For the full build history and reasoning,
see `README-how-this-works.md` in this same folder — read it before making
any non-trivial change.

## What this is

A single-page dashboard for a 116-entry NFL confidence-style pool. Each entry
picked real NFL teams within a $10 "selection value" budget (separate from
the real $50/line entry fee). The site tracks live scores, simulates playoff
odds, and shows a shareable weekly recap — all client-side, no backend.

## Where the code actually lives

**`public/index.html` is the entire application.** All CSS, all HTML, and the
full JS app (one big IIFE in a `<script>` tag) live in this one file, plus a
`<script id="data-json">` block holding the baked season/entries data. There
is no build step, no bundler, no framework. Edit this file directly.

`public/bonuses.json` is a small, hand-maintained override file for ESPN's
auto-detected division winners and playoff results — see the "Scoring"
section in the README before touching it.

`public/upload.html` looks stale (Cloudflare redirects `/upload` to
Netlify), but Netlify still builds that page from this repo via
`netlify.toml`. Don't delete it.

## Deploy

Push to `main` on GitHub (`rhornett/pool-site`) → Cloudflare Pages
auto-deploys in under a minute. That's it — no other step.

## The one rule that matters most here

**Every number on this dashboard has been verified against an independent
calculation before shipping, not just eyeballed.** Pool Odds, Best/Worst
Possible Score, the playoff bracket, the owner/team popups — all of it was
built by writing the feature, then separately recomputing the expected
result (brute force, an independent script, or a hand-picked scenario with a
known answer) and confirming they match, usually via a real headless-browser
test, before calling it done. If you're asked to touch scoring, simulation,
or financial logic, hold yourself to the same bar: don't trust that code
"looks right" — check it against something that can't be wrong the same way
the code could be.

A second, related habit worth keeping: this dashboard is deliberately honest
about what it knows vs. estimates. Live ESPN data is labeled as such;
anything simulated or inferred says so in its own copy (e.g. playoff seeding
is "current standing, not official elimination"; Pool Odds says "our
simulation" out loud). Don't quietly blur that line when adding features.

## Quick architecture map

- **Scoring**: `wins*1 + divisionWinner*5 + playoffWins*3 + confChamp*5 +
  sbChamp*10`. Playoff wins / conf champ / SB champ are read automatically
  from ESPN's *completed* postseason games (`fetchPlayoffAuto()`);
  `bonuses.json` can override them. Division winners come from ESPN's
  standings `clincher` code (`z` or `*` = clinched division), so +5 lands
  only once a title is mathematically clinched — never just because a team
  currently leads its division. A non-empty `divisionWinners` in
  `bonuses.json` replaces ESPN's list. Pool Odds locks already-awarded
  division winners in and doesn't re-add their +5. Edit Standings
  (`#admin`) only saves to that browser's localStorage and gets overwritten
  by the next bonus refresh, so it's not a real way to award bonuses.
- **Live data**: ESPN's undocumented public JSON endpoints (scoreboard,
  standings, team projections). No API key, no auth. Team IDs for the
  projection endpoint are a hardcoded table in the code — ESPN's team-list
  endpoint is CORS-blocked from a browser, so don't reintroduce a fetch to
  it; the hardcoded table was verified against live standings data instead.
- **Pool Odds / Predicted Standings**: a 20,000-trial Monte Carlo playoff
  simulation, seeded deterministically from a hash of the real current
  inputs — same real data always gives the same result, genuinely new data
  gives a new one.
- **Best/Worst Possible Score**: 0/1 knapsack problems. Worst Possible
  specifically maximizes spend first, then minimizes score among max-spend
  combinations — "spend $0" is deliberately excluded as a cheat answer.
- **Clickable names**: every owner name and every team mention site-wide is
  clickable via shared `ownerLinkHtml()` / `teamLinkHtml()` helpers and a
  single delegated click listener, opening a shared detail modal. Reuse
  these helpers for any new place a name or team appears — don't hand-roll
  another click handler.

## Testing changes

There's no test suite to run. The established pattern for anything
touching real numbers: build a small standalone HTML page with `fetch`
mocked to return controlled data, drive it with Playwright, and assert the
displayed values match an independently-computed expected result. Ask if
you want help setting this up the same way for a new change.
