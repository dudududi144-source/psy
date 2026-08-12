# FOUNDATION_CONSUMER_FREEZE.md — PSY canonical state freeze
Purpose: freeze the exact PSY state BEFORE the foundation contract gate, so the
psy (product) <-> psy4 (foundation lab) boundary is defined against a known-good product.
All facts below verified via GitHub API (no local clone exists in this environment;
all changes in this project are made through the GitHub Contents API, therefore no
worktree exists anywhere and the remote tree is by construction always clean).

## Frozen state (all values API-verified)
- Canonical product repo: dudududi144-source/psy  (PSY = canonical musical product)
- main HEAD (pre-gate): 2da2a79550223bdfeeaa71276b799c4ad3c2fe1b
- origin/main == refs/heads/main (no other remotes exist on this repo)
- worktree: NONE (no local clone; API-only workflow) -> WORKTREE == CLEAN by construction
- tag v4.0-m2-song -> 4b2863626f9bdeb75d35c0320ac5362258529e98 (M2 backup commit).
  Note: the tag predates the two audit docs (CROSS_REPO_AUDIT.md, PSY6_ARCHITECTURE.md)
  which were committed after tagging; it tags the product code state exactly.
- M2 merge proof: commit 5cb45e2d771a (m2-song head, tests green) is an ANCESTOR of main
  (compare 5cb45e2d...main => main is "ahead"). M2 is genuinely merged. main is the
  canonical M2 product line.
- M2 CI result: GitHub Actions run 31565505860, head 5cb45e2d, conclusion SUCCESS,
  22/22 tests (node --test, ubuntu-latest, node 24). Workflow: .github/workflows/m2-tests.yml.
  Caveat: that run executed on branch m2-song; no run has executed on main yet because the
  workflow trigger was scoped to m2-song. The code is byte-identical (index.html blob
  3bfa1b106897 is identical on main and m2-song). The foundation gate updates the workflow
  to trigger on main as well.
- Deployed version: GitHub Pages built from main (source: main, path /). Live index.html
  blob sha == 3bfa1b106897 == M2 blob. Version marker in deployed file: 4.0.0-m2-song.
  LOCAL == REMOTE holds trivially (no local copies exist).
- Architecture documents in tree at freeze:
  - CROSS_REPO_AUDIT.md (d0df6010feb3)
  - PSY6_ARCHITECTURE.md (2da2a7955022)

## Runtime representation check (Step 7 of the gate)
Verified by grep of main index.html (blob 3bfa1b106897):
- buildSong x3, SECTION_TEMPLATE x3, resolveThemeBar x2  -> M2 Song/Theme model present
- var SECTIONS = 0 occurrences                            -> M1 arranger removed
- makePatterns x5 (definition + called in constructor + variate) -> STILL PRESENT
- device.patterns x2 -> STILL PRESENT
- ARP read: this.patterns.arp[absStep%16] -> ARP still consumes makePatterns output
Conclusion: Song/Theme model is the primary representation, but ONE duplicate pattern
representation remains (ARP via makePatterns). Classification: MIGRATION_REQUIRED.
Migration contract: see FOUNDATION_CONTRACT.md section "ARP / M2 migration contract".
No deletion performed in this gate (per gate rules).

## Commit chain at freeze
2da2a795 docs: PSY6_ARCHITECTURE.md
d0df6010 docs: CROSS_REPO_AUDIT.md
4b286362 Backup: stable PSY-6 v4.0 M2 song engine (22/22 green)  <- tag v4.0-m2-song
5cb45e2d test: swing regression                                    <- m2-song head (CI green)
8048d41d test: swing test fix #1 (was a test bug)
84d580fb test: BREAK harmonic-minor assertion fix (test bug: assumed C root; key is A)
79123e8c test: M2 suite (21 tests)
45f35ded ci: minimal M2 workflow

## Security note
Leaked credentials (turso.txt: turso/cloudflare/github/supabase) remain an OPEN issue,
tracked separately. This gate adds no credentials anywhere. See FOUNDATION_CONTRACT.md
SECURITY section.
