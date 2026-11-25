# SFC v2.4 — Branch Preview Only

**Branch:** `preview/sfc-v2.4-about-activities`  
**Production main:** deliberately unchanged. Do not merge without review.

## What changed

1. **Activities fix** — Initial rows are created once. Filtering changes each
   existing row's height and opacity only, never horizontal transforms, list
   snapshots, or replacements. This applies to sample weeks and actual Supabase
   curriculum, with controls and keyboard state retained.
2. **Page-width stability** — persistent scrollbar gutter avoids a centered
   container shifting when the number of filtered rows becomes smaller than
   the viewport. Explicit `#scheduleList` containment and hidden rules.
3. **Home: WHY SFC** — before the Research list, an editorial value proposition
   and three concise intended learning outcomes. Existing Hero, research feed,
   planned schedule and recruitment remain unchanged.
4. **About: Why join** — shorter prose, three original concept diagrams for
   financial analysis, valuation, and equity research. A four-stage interactive
   diagram (Observe → Analyze → Value → Defend) with keyboard navigation,
   reduced-motion support and user-facing honesty about planned learning.
5. **Original CMS interface** — existing `.about-photo-panel h2/p` and
   `.about-end p` selectors remain editable by the Studio. No fabricated
   alumni count, actual publications, real sessions or application files.

## How to preview without touching production

Open this branch's `index.html` with a local static server:

```bash
git switch preview/sfc-v2.4-about-activities
python3 -m http.server 8080
# http://localhost:8080/#home
# http://localhost:8080/#about
# http://localhost:8080/#activities
```

**Branch workflow:** on a push, `SFC static checks` runs Node static tests,
Chromium browser tests, then takes Home/About/Activities desktop/mobile
screenshots. Find the `sfc-v2.4-visual-previews` artifact under the specific
GitHub Actions run. These are screenshots, not a live hosted preview.

A public third-party CDN HTML preview may be possible from a commit permalink,
but it is not an official SFC deployment and **may not support all Supabase or
external network resources**. Do not confuse it with GitHub Pages production.

## Critical acceptance tests

- Activities `application → research → application` must never shift content
  to the right, create duplicated rows or resize the entire viewport.
- Verify at 1440, 768 and 360px. Verify true DOM identity is retained.
- Click stages rapidly, open accordion, switch stage, restore stage, and make
  sure focus/selected state remain correct.
- Verify both sample and CMS-loaded curriculum.
- Verify About keyboard Left/Right/Home/End and four SVG states.
- Verify original CMS editor and public sites continue to work with no schema
  or access-control changes.
- Search, canonical and main deployment remain pointed to production until
  an approved merge.

No database migrations or official SFC content changed.
