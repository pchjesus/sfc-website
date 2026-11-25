# SFC v2.5 + v2.6 Integrated Preview

**Branch:** `preview/sfc-v2.5-v2.6-integrated`  
**Production:** main v2.4.2 remains unchanged until the owner reviews and approves.

## v2.5 — Meaningful, restrained interaction
- Home: editorial progression and hover emphasis within existing Why SFC, no new marketing claims or duplicate content panels.
- About: SVG paths and analysis diagrams animate on stage changes; uses existing keyboard-accessible 4-stage selector.
- Activities: one timeline—the existing stage filter buttons are visually linked, with a read-only contextual summary. Its filter logic retains persistent DOM and never adds translateX or cloned rows.
- Recruitment: an explicit `planned / open / closed` status strip mirrors CMS settings without falsely representing application-specific progress; public application downloads remain available when an official file exists.

## v2.6 — Research Archive & Reader
- One responsive archive UI for demo data and published public research. Sample labels are unmistakable. Public data is always fetched using the anonymous Supabase client with RLS; no authorized browser session is reused.
- Server-side publication query: `status=published`, `deleted_at is null`, `scheduled_at <= now` (or null), restricted to research; `range()` six rows per page with exact count. Industry and sanitized cross-field search are filtered server-side. Stable sort by date/title + id.
- Archive URL parameters: `sfcq` (search), `sfcs` (sector), `sfco` (order), `sfcv` (view), `sfcp` (page). Previously selected query, layout and page survive a report return and can be shared.
- The main public post feed now fetches up to 80 **metadata-only** rows rather than 300 bodies; actual report body is requested on entering a report. The Updates tab remains a recent feed, **not yet a paginated full archive**.
- Published research uses a styled Reader with intro, generated heading navigation, methodology/limitations, source PDF preview/download, share button, and keyboard-operable navigation. The system never invents study outcomes or citations.
- Studio reuses existing research fields and adds a non-destructive outline tool and improved methodology/limitations preview. No new DB columns or schema migration.
- All sample data remains examples; 0 published research and 0 public sessions existed at last read-only database check. Never treat screenshots as real publications.

## Validation and constraints
- Public anonymous queries and client-side rendering must not expose drafts, future scheduled publications, private attachments, other users' content or Supabase secrets.
- Baseline 29 mock-browser scenarios + added integrated tests (archive demo, live pagination, reader, Studio outline, responsive stage/status UI).
- Check 360, 390, 768, 1440px, keyboard navigation, reduced motion, rapid filtering, no page-wide horizontal shift or stuck animations.
- Test fixture `tests/fixtures/supabase-mock.js` simulates PostgREST filters/range/count; its success is **not** a live Supabase RLS/security certification.
- Studio/Auth configuration and real file download integration still need a separate production-user QA before merging.
- GitHub Actions uploads screenshots in `sfc-v2.6-integrated-visual-previews`. To open a branch-only interactive preview, use a local HTTP server or a pinned commit preview mirror; **do not sign in to a third-party mirror**.

### Local preview
```bash
git fetch origin
git switch preview/sfc-v2.5-v2.6-integrated
python3 -m http.server 8080
# http://localhost:8080/#home
# http://localhost:8080/#about
# http://localhost:8080/#activities
# http://localhost:8080/#research
# http://localhost:8080/#recruitment
```

No permission to merge into `main` or deploy production until the owner explicitly approves this branch.
