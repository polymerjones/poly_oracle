---
name: session-handoff
description: Write a detailed session handoff document recording what was fixed/changed this session — symptom, root cause, file:line references, commit SHAs, verification status, gotchas, and open follow-ups — so a future session (or a post-compaction you) resumes cold with full context. Use when wrapping up a work session, or when the user says "handoff", "document what we fixed", "session notes", "log this session", or asks to capture context for next time.
---

# session-handoff

Capture a session's work as a durable, detailed handoff in `handoffs/`, so a future session
resumes cold with full context instead of re-deriving everything. These files are committed
with the repo — they ARE the shared project memory (distinct from `~/.claude` memory, which is
for cross-project, personal-to-Claude facts).

## When to run
- End of a work session, or when the user asks to "document / log what we fixed", "handoff", etc.
- After the meaningful changes are committed — run once the dust settles, not mid-task.

## Workflow

1. **Scaffold the file.** From the project root:
   ```sh
   .claude/skills/session-handoff/scripts/new-handoff.sh "<short-slug>"
   ```
   Creates `handoffs/YYYY-MM-DD-<slug>.md` pre-filled with this session's commits and
   changed-file stat (raw material in a collapsed block at the bottom), and prints the path.
   Pick a slug that names the theme (e.g. `stroid-toss-wrap`, `vercel-deploy-fixes`).

2. **Fill in every section** from the actual conversation — be concrete; vague notes are
   useless on resume. For EACH issue document **Symptom** (verbatim if the user reported it)
   → **Root cause** → **Fix** with `file.js:line` references and the **commit SHA** →
   **Verified** (what was tested, confirmed vs. still-unverified). Then:
   - **Still open / follow-ups** — anything deferred, with enough detail to act on.
   - **Gotchas / learnings** — the non-obvious facts discovered this session (e.g. "Vercel
     serves the repo root, not `www/`"; "tossed stroids must keep launch velocity untouched to
     wrap"). This is the highest-value section — capture what cost you time to figure out.
   - **Pre-release reminders** — carry forward any unresolved CLAUDE.md checklist items.
   Delete the auto-collected raw git block once you've curated it into the sections above.

3. **Update the index.** Add a one-line pointer to `handoffs/README.md`, newest first:
   `- [YYYY-MM-DD — Title](YYYY-MM-DD-slug.md) — one-line hook`. Create `README.md` if absent.

4. **Commit** the handoff + index (and any stray `HANDOFF_*.md` you fold in). A plain commit is
   fine — this is docs, not a build, so it does NOT need a `BUILD_TS` bump or `prepare:web`.
   Use `git add handoffs/ && git commit -m "docs: session handoff — <title>"`.

5. **Report** the path written and the index line added.

## Notes
- Reference code as `file:line` (clickable) and always cite the commit SHA for each fix.
- Explain the *why* and the *non-obvious* — don't restate a diff git already records.
- One handoff per session; if a session spans days, append to the same file, don't fork.
- Fold any ad-hoc `HANDOFF_*.md` notes from the session into the dated file, then delete them.
