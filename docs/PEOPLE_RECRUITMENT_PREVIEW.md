# SFC v2.6.5 — People & Recruitment preview

## Change boundary
- Branch: `preview/sfc-people-recruitment-v2.6.5`.
- Built from production `main` at `bf5b21690d971d6714b74dfd56205ceef1054ff3`.
- **Do not merge or deploy to GitHub Pages until explicit owner approval.**
- Only People and Recruitment public presentation, the matching public CMS adapter, QA, and preview assets changed. No Supabase schema/RLS/Storage or admin Studio mutation.

## People
- Converts repeated expandable role rows into a **single-selection editorial Team Map**. The initially displayed roles are planning examples and do not suggest real people.
- All public-facing roles or people display their names, responsibilities, and biographies immediately on one responsive editorial grid. No duplicate detail panel or click is required.
- People profiles are ordinary readable content, not unnecessary buttons; no selection state, roving tab stop or hidden explanation is used.
- When actual `cms_people` records are published and visible, the **same map** displays their publicly registered name, role, term, bio and sort order. No profile photos or inferred hierarchy are fabricated. If there are no visible records, the map returns to the explicitly marked planning examples.
- At narrow widths the map becomes a vertical list, with no horizontal viewport overflow. An optional Recruitment link leads naturally to the next action.

## Recruitment
- One clear status in the intro, with 2×2 compact facts below; the old duplicate status track is visually suppressed and retained in the DOM solely for backward-compatible status synchronization.
- The primary action is computed from public CMS state:
  - `planned` → visit Activities, **never** open an empty PDF modal.
  - `open` + PDF/DOCX → show the existing public application preview/download modal.
  - `open` without file → jump to published submission instructions / method.
  - `closed` → explore public Research, not an application button.
  - `planned` or `closed` + official form → offer a subordinate, optional file-viewing action without implying that applications are open.
- DOCX-only availability is labelled correctly; no PDF is pretended to exist.
- Four process steps are **planned procedural information**, not a personal progress or completed-step indicator. Every stage displays its description in the same four-column strip (two columns on narrow screens), without any click or a duplicate detail panel.
- Current FAQ accessibility, keyboard behavior, real official application links and mobile PDF/DOCX preview remain available.
- Transition targets: ordinary hover ~240–300ms, no content-replacement animations, stable layout positions. Reduced-motion preferences disable motion.

## Automated regression
- `npm test`: static assets, DOM IDs, JS syntax, CMS safety contracts.
- `python tests/browser-check.py`: original 29 baseline scenarios, adapted for intentionally new planned-status CTA.
- `python tests/integrated-check.py`: existing integrated 8 scenarios.
- `python tests/people-recruitment-check.py`: new People/Recruitment controls with 360/390/768/1440 px, all-visible descriptions, live/mock CMS person replacement, planned/open/closed, forms present/missing/DOCX-only, rapidly reversed stages and no unauthorized writes.
- `python tests/preview-capture.py`: public Home/Research etc. screenshots **plus** People desktop/role visible/mobile and Recruitment desktop/process selected/mobile.

**Limitations:** Chromium mock tests cannot certify real Supabase authentication, public RLS, private Storage permissions, actual official file rendering, or live data accuracy. No actual current committee records are present; example roles are explicitly examples. Future Studio editing of process/FAQ is **not** implemented here (requires approval and a separate schema/content design).

## Preview
For a local full-fidelity test (recommended):

```bash
git fetch origin
git switch preview/sfc-people-recruitment-v2.6.5
python3 -m http.server 8080
# http://localhost:8080/#people
# http://localhost:8080/#recruitment
```

GitHub Actions uploads `sfc-visual-branch-previews` screenshot artifacts on branch pushes. A read-only external CDN preview of `index.html` can be viewed using a pinned commit link; **never sign into Studio through an external mirror**.

## Next steps
1. Owner reviews desktop/mobile layout, interactive node and process speed, wording, status/CTA.
2. Fix feedback on this branch; repeat QA.
3. Only after approval, merge to main and verify Pages deployment + main branch QA.
4. Open a new conversation for a **v2.7 design audit** (the owner will supply additional visual QA constraints).
5. After that audit, ask Codex to conduct a full functional verification. Codex should test behavior and permission boundaries, not reinterpret design approval as authorization to release.

## Visibility-first refinement
After review, People and Recruitment stopped using selectable details for ordinary facts. All People biographies and all four Recruitment stage descriptions are visible immediately, without hover/click. This does not change the still-interactive FAQ or official application CTA. When SFC publishes real person records, each card carries all visible fields in the same place. No fabricated photos or role hierarchy.
