# React Doctor - local triage playbook

You are a coding agent (Cursor, Claude Code, Codex, etc.) running on a developer's machine. Use this playbook when the user asks to scan, triage, or clean up React Doctor diagnostics. Never assume the project has any React Doctor CI automation configured.

Before the loop runs, work through the two setup prompts below - "Pick a scan scope" (only when the working tree is dirty) and "Pick an output mode". Then run the five steps:

1. **Scan** - `react-doctor --json <scope-flag> <category-flags>` → `/tmp/diagnostics.json`.
2. **Filter** - drop matches against `.react-doctor/false-positives.md` and each rule's validation prompt.
3. **Triage** - partition by severity (errors before warnings) and flag anything needing human judgment as deferred.
4. **Fix** - apply errors serially with per-fix typecheck (revert if broken), then apply warnings in a batch with one validation at the end. Either in place (working-tree mode) or one branch + PR per bucket (PR mode).
5. **Validate + summarize** - print what changed in the working tree, or open/refresh the live `react-doctor:tracking` issue and print a chat summary of the PRs you opened.

---

## Pick a scan scope

Check `git status --porcelain` first. If it's empty (clean working tree), skip this question - Step 1's `--diff` already picks the right scope (branch vs base on a feature branch, full scan on the default branch).

If it's dirty, ask the user how tightly to scope the scan. With a structured question tool, single multiple-choice:

- prompt: "Which changes should React Doctor scan?"
- options:
  - id `uncommitted`, label: "Just my uncommitted edits - fastest loop, dirty files vs `HEAD`"
  - id `branch`, label: "Whole branch - committed work + uncommitted edits, diffed against base"
  - id `full`, label: "Full codebase - slow, broad sweep"

Otherwise ask in chat. Default to `uncommitted` - that's the typical intent when launching `/doctor` from a dirty tree (the user just wrote something and wants a quick lint before staging).

The answer maps to Step 1's scan flag:

| Scope         | `react-doctor` flag | What it scans                             |
| ------------- | ------------------- | ----------------------------------------- |
| `uncommitted` | `--diff HEAD`       | Working tree vs `HEAD` - dirty edits only |
| `branch`      | `--diff`            | Auto-detected branch vs merge-base        |
| `full`        | _(omit `--diff`)_   | Every source file in the project          |

---

## Pick an output mode

Before touching any files, ask the user which output mode they want. If your runtime exposes a structured question tool (Cursor's `AskQuestion`, Claude Code's equivalent), use it - single multiple-choice question:

- prompt: "How should I deliver the React Doctor fixes?"
- options:
  - id `working-tree`, label: "Unstaged working-tree changes - review the whole sweep with `git diff`"
  - id `pr`, label: "Separate PRs per category + a live tracking issue (dashboard of every open React Doctor PR)"

Otherwise ask in chat with both options spelled out and wait for an explicit answer. Default to `working-tree` if the user doesn't pick.

Spell out the trade-offs alongside the question so the user knows what they're choosing:

### `working-tree` (default)

Every fix lands in your working tree as a file edit - nothing is committed, staged, or pushed. You review the whole sweep with `git diff` and commit (or discard) the bits you like in one go. Output is local-only; no GitHub artifacts.

**Pick this when** you're cleaning up your own feature branch, you want a fast scan → fix → review loop, the cleanup is solo work, you don't want PR noise in the repo, or `gh` isn't set up.

### `pr`

Each `(severity, category)` slice becomes its own branch + commit + PR via `gh pr create` (e.g. `[React Doctor] State & Effects errors`, `[React Doctor] Performance warnings`). After the PRs land, the agent opens or refreshes the repo's single `react-doctor:tracking` issue as a live dashboard listing every open React Doctor PR (this run + carry-forward from previous runs), grouped by severity, with value blurbs and a collapsed run-details block. Repeated `/doctor` runs refresh the same issue rather than spamming new ones.

**Pick this when** you want teammates to review fixes a category at a time, each fix to be individually mergeable / revertable, an audit trail in the repo, or a persistent dashboard tracking every open React Doctor PR across multiple `/doctor` runs.

**Requires**:

- `gh` CLI installed and authenticated (`gh auth status` should succeed).
- A clean working tree before starting (`git status` empty) so each PR contains only React Doctor's changes.
- A current local default branch: run `git fetch origin && git merge --ff-only origin/<default-branch>` from the default branch so every bucket branch is cut from the up-to-date base. If the fast-forward fails (local default has diverged), fall back to `working-tree` mode.

If any prerequisite is missing, fall back to `working-tree` and tell the user why.

---

## 1. Scan

```bash
npx -y react-doctor@latest --json <scope-flag> <category-flags> --yes > /tmp/diagnostics.json
```

- `<scope-flag>` is whichever the user picked in "Pick a scan scope" (`--diff HEAD`, `--diff`, or omit). When the scope question was skipped (clean working tree), default to `--diff` - or omit entirely when `git branch --show-current` matches the default branch (the diff would be empty anyway).
- `<category-flags>` is empty unless the user asks for specific diagnostic categories. Use `--category <category>` for each requested category, such as `--category performance` or `--category accessibility`.
- Category flags narrow the displayed report and JSON diagnostics. They do not change which files React Doctor scans. Unknown categories fail before report output.
- Run from the package being scanned. If the project has multiple apps, default to the primary app the user is currently editing.
- All `diagnostics[]` empty → emit a one-line "clean - no findings" summary and stop.
- Non-zero exit or unparseable JSON → surface stderr verbatim to the user and stop.

Each diagnostic has `filePath`, `plugin`, `rule`, `severity`, `message`, `help`, `line`, `column`, `category`.

---

## 2. Filter

Read `.react-doctor/false-positives.md` if it exists. Drop diagnostics matching any pattern there. Patterns that say "skip after verifying X" require an actual `grep` / `Read` before suppressing - never suppress on filename alone when the pattern asks for a code-shape check.

For diagnostics that survive the static filter, fetch the rule's canonical prompt once per unique `<plugin>/<rule>` key and cache it under `/tmp/rule/`:

```bash
curl --silent --fail --create-dirs \
  --output "/tmp/rule/$plugin/$rule.md" \
  "https://www.react.doctor/prompts/rules/$plugin/$rule.md" || true
```

Each file has two sections:

- `## Validation prompt` - refines triage. If it names the exact code shape in front of you as a known FP, drop the diagnostic and remember the rule + shape for the summary's "newly suppressed FPs" section.
- `## Fix prompt` - drives Step 4's edit.

A 404 means the engine prompt table lags this rule - fall back to the static FP list and your own judgment.

Track three counts for the summary: `suppressed_static`, `suppressed_validation`, `surviving`.

---

## 3. Triage

Two questions per diagnostic. The first is mechanical (read the JSON), the second is judgment (read the rule prompt + the surrounding code).

**1. Severity** (from `severity` in the JSON) determines _when_ Step 4 touches it:

1. **Errors** (`severity: error`) - every error first, completely. Step 4 applies them serially with a typecheck after each fix and reverts on failure.
2. **Warnings** (`severity: warning`) - only after every error has been attempted (fixed, reverted, or deferred). Step 4 applies them in a batch and validates once at the end.

If Step 2's FP doc already suppressed every error-severity diagnostic, the warning pass is eligible immediately - there's nothing to "cover first".

**2. Fixability** decides _whether this exact occurrence_ is safe to touch. Default to **fix-now** for local, mechanical edits. Mark an occurrence **defer** only when a concrete blocker makes the edit unsafe:

- The rule's `## Validation prompt` (cached in `/tmp/rule/<plugin>/<rule>.md` from Step 2) flags this code shape as needing human judgment.
- The fix would touch sensitive areas: auth, billing, webhooks, payment flows, anything where a wrong edit becomes a production incident.
- The fix is a cross-file refactor spanning >3 files and the rule prompt does not give a mechanical recipe.
- The fix depends on runtime data the agent can't see (rate limits, feature flags, env-specific behavior).

Do **not** defer an entire rule, category, file, or bucket because some occurrences are risky. Split it: fix the safe local cases, defer only the specific risky lines. "Large file", "many sites", "subagent failed", or "running out of time" are not deferral reasons. If the recipe is mechanical and validation can catch mistakes, try the smallest safe edit and revert on failure.

Surface only the remaining deferred occurrences in the final summary under "Deferred".

---

## 4. Fix

For every **fix-now** diagnostic, re-read `/tmp/rule/<plugin>/<rule>.md`'s `## Fix prompt` - the canonical, reviewer-tested recipe. Apply the fix following the project's coding conventions (e.g. `CLAUDE.md` / `AGENTS.md` if present): inline first, no speculative abstraction, no helper wrappers for single call sites.

**Execution strategy** depends on severity (decided in Step 3):

- **Errors** - serial in the parent agent. After each fix, run the project's typecheck (`pnpm typecheck`, `tsc --noEmit`, or equivalent) for the affected app. If it fails, revert that single fix and continue with the next error - record it under "Reverted" in the summary.
- **Warnings** - batch. Apply every warning fix without per-fix validation, then run typecheck + lint + format once at the end. If validation passes, you're done. If it fails, revert the entire warning batch and re-apply serially with per-fix typecheck (same loop as errors) - this isolates the offender and salvages every fix that does pass on its own.

Process the error pass to completion first. Only start the warning pass once every error has been attempted (fixed, reverted, or deferred).

When a group mixes easy and hard cases, peel off the easy cases first. Single-site fixes, exact dependency edits, local `.current` moves, and other prompt-prescribed mechanical changes should become fixes or reverts - not deferrals. Leave a short note for the hard remainder.

**Parallelism (optional, encouraged)** - if your runtime exposes a subagent / task tool (Cursor's `Task` with `subagent_type: "generalPurpose"`, Claude Code's equivalent, Codex's `task`), use it. Fan-out points:

- **Working-tree mode**: partition the work by `filePath` and dispatch one subagent per file so concurrent writes don't collide. Each subagent gets its file's diagnostic list + the relevant `/tmp/rule/<plugin>/<rule>.md` fix prompts + the project's coding conventions, applies every fix in that file (errors first, then warnings), and reports back what changed so the parent can build the summary. Subagents skip the per-fix typecheck - a project-wide typecheck would see other subagents' in-progress edits and revert valid fixes. The parent runs one repo-level typecheck after the fan-out completes (still inside this step); if it fails, the parent reverts the fan-out's edits to the failing files, then re-applies those fixes serially with per-fix typecheck to isolate the offenders - the same salvage loop as the warning batch. Step 5's validation then runs on the salvaged tree.
- **PR mode**: dispatch one subagent per bucket. Each subagent owns its branch end-to-end (`git checkout -b …` → apply that bucket's fixes → validate → commit → push → `gh pr create`) and returns the PR URL. Buckets are file-disjoint by design, so concurrent branches are safe; just have each subagent start from a fresh checkout of the default branch.

Never mix error-pass and warning-pass subagents in the same wave - complete the error pass before fanning out warnings.

How the fixes actually land then depends on the mode the user picked at the start.

### Working-tree mode

Run the **error pass** first (serial + per-fix typecheck + revert-on-fail, per the execution strategy above), then the **warning pass** (batch + final validate; fall back to serial on batch failure). Fan out across files via subagents when possible - in that case per-fix typecheck is deferred to the parent's post-fan-out validation, per the parallelism section above.

Do **not** commit. Do **not** stage. Leave changes in the working tree so the user can review with `git diff` before committing.

### PR mode

Bucket the non-deferred diagnostics by `(severity, category)`. One PR per bucket - e.g. `[React Doctor] State & Effects errors`, `[React Doctor] Performance warnings`. Single-occurrence buckets are fine; don't artificially merge unrelated categories.

- Per bucket: ≤30 files / ≤600 LoC. Split by top-level subfolder if exceeded (e.g. `State & Effects (web)` vs `State & Effects (worker)`).
- Drop any bucket that would need >10 collateral file edits to land cleanly - files _outside_ the bucket's own diagnostics that must change for validation to pass (the bucket's diagnostic files count toward the split threshold above, not this drop rule). Record drops under "Buckets dropped" in the summary.
- Deferred diagnostics: don't open and don't list. Surface in the chat summary.

Order the bucket queue: every error-severity bucket first, every warning-severity bucket second. Don't start a warning bucket until every error bucket has been attempted (opened as a PR or dropped).

For each bucket, off a fresh checkout of the default branch (in parallel via subagents if available - one subagent per bucket, since branches are isolated):

1. `git checkout -b react-doctor/$(date -u +%Y-%m-%d)-$(git rev-parse --short HEAD)/<slug>` (short kebab: `state-effects-errors`, `perf-warnings`, etc.) - the short SHA disambiguates same-day re-runs after the base has moved. If the branch already exists (a re-run at the same HEAD), an earlier run already produced this bucket - skip it, record it under "Buckets carried forward" in the summary with the existing PR, and continue with the next bucket.
2. Apply the bucket's fixes per the execution strategy (errors serial + per-fix typecheck, warnings batched).
3. Validate: the project's typecheck + lint + format from the repo root. One retry on failure; still failing → reset the branch and move on silently (record under "Buckets dropped" in the summary).
4. Commit with a conventional prefix (`chore:` / `perf:` / `fix:` / `refactor:`), terse subject - the value-rich phrasing lives in the PR title.
5. Push the branch and open the PR with `gh pr create`:

- **Title** is value-first, no conventional-commit prefix, ≤72 chars, lead with verb + count + what (e.g. `[React Doctor] Removed 10 unused exports across web`).
- **Body**: bold value lead → optional 2-3 sentence why-it-matters → `## Changes` list where each bullet links to the pre-change line at the scan-time SHA. Wrap each permalink in a markdown link with `<path>:<line>` as the link text - bare URLs render as ugly nested snippets inside bulleted lists.
- **Inline review comments**: for any change where the diff doesn't speak for itself (runtime semantics shifts, non-obvious refactors), post one-line "why this" comments anchored to the changed lines via a single `gh api ... /pulls/<num>/reviews` POST. Skip the comments when the bucket is purely mechanical and the diff is self-evident (e.g. unused-export removal).
- **Label** the PR `react-doctor` (`gh label create react-doctor --color FBCA04 --description "Opened by react-doctor" --force` if the label is missing) so it shows up in the tracking dashboard and future `/doctor` runs carry it forward. Don't open separate PRs that just edit `.react-doctor/false-positives.md` - surface candidate FPs in the final chat summary instead.

6. `git checkout <default-branch>` (don't pull - keep the base consistent across buckets) before the next bucket.

If `gh pr create` fails (no remote, no auth, branch protection on the default branch), stop and surface the error verbatim - don't half-finish a bucket.

---

## 5. Validate + summarize

Score is `100 − 1.5 × |unique error rule keys| − 0.75 × |unique warning rule keys|`, rounded, clamped to 0; compute `S_before` from the post-static-filter set and `S_after` from the same set minus what Step 4 actually fixed (or, in PR mode, would address once the open PRs merge).

### Working-tree mode

Run the project's typecheck, lint, and format checks from the repo root. Discover them from `package.json` scripts (look for `typecheck`, `lint`, `format`, or equivalents like `check`) and any contributing docs (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`). For example, a pnpm project with the usual scripts might run:

```bash
pnpm typecheck && pnpm lint && pnpm format
```

Substitute the project's actual runner (`npm run`, `yarn`, `bun`, `turbo`, …) and skip whatever it doesn't define.

If any step fails, surface the error verbatim and stop. Do not attempt blind retries (Step 4's salvage loops have already run by this point) - the user is sitting at the keyboard and can decide.

Then emit:

```markdown
## React Doctor - N fixed, score S_before → S_after / 100

Edits are unstaged. Review with `git diff`, then commit (or discard) what you want.

### Fixed - errors

- `<plugin>/<rule>` - `<path>:<line>` - <one-line what changed>
- …

### Fixed - warnings

- `<plugin>/<rule>` - `<path>:<line>` - <one-line what changed>
- …

### Reverted - validation failed

- `<plugin>/<rule>` - `<path>:<line>` - <one-line why it failed>
- …

### Needs your call - deferred

- `<plugin>/<rule>` - `<path>:<line>` - <one-line why this needs human judgment>
- …

### Candidate false-positives (paste into `.react-doctor/false-positives.md`)

- `<plugin>/<rule>` - <code shape> - <one-line reason from the rule's validation prompt>
- …

<details>
<summary>Scan details</summary>

- Scope: `--diff` against `<base>` _(or "full scan")_
- Category filter: `<category-flags>` _(or "all categories")_
- Diagnostics: N scanned, F suppressed (A static, B validation prompt)

</details>
```

### PR mode

Every bucket was already validated before its PR was opened - don't re-run typecheck/lint at the repo level here. Produce two outputs: a **tracking issue** (long-lived dashboard that persists across `/doctor` runs) and a **chat summary** (short, just for the user, links to the issue).

#### Tracking issue

There must be exactly **one** `react-doctor:tracking` issue per repo - earlier `/doctor` runs may have already opened it. Look up the existing one:

```bash
gh issue list --label react-doctor:tracking --state open \
  --json number,title,body --limit 1
```

Compute today's PR set: every PR you opened this run + carry-forward (every other open `react-doctor`-labeled PR not opened by this run - `gh pr list --label react-doctor --state open --json number,title,url,labels,createdAt,body --limit 60`). Call this `open_prs`.

| State                                          | Action                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `existing_issue` open AND `open_prs` non-empty | `gh issue edit <num> --title "…" --body-file /tmp/body.md` - refresh in place.        |
| No open issue AND `open_prs` non-empty         | `gh issue create --label react-doctor:tracking --title "…" --body-file /tmp/body.md`. |
| `existing_issue` open AND `open_prs` empty     | Comment `No findings as of YYYY-MM-DD - closing.` and close it.                       |
| No open issue AND `open_prs` empty             | Do nothing.                                                                           |

**Never** open a second tracking issue when one is already open. **Never** close one that still has open PRs. Create the label first (`gh label create react-doctor:tracking --color 0E8A16 --description "Live react-doctor tracking issue" --force`) if it doesn't exist yet.

**Title** - reflects current live state, not just this run's diff:

- `[React Doctor] Score 65 → 70 - 12 PRs awaiting review` (score moved ≥ 1 this run)
- `[React Doctor] 12 PRs awaiting review` (no score move)

**Body** - one-line value lead (projected score lift from merging the open PRs) → open PRs grouped by severity, each bullet carrying its opening date and an 8-12 word value blurb so the issue scans without opening each one → collapsed run details → `_Last updated:_` footer. Skip empty sections:

```markdown
**Open React Doctor PRs awaiting review - merging them lifts the score from S_before to S_after / 100.**

## Errors

- [ ] #<num> - `<title>` - <8–12 word value blurb> (opened YYYY-MM-DD)

## Warnings

- [ ] #<num> - `<title>` - <blurb> (opened YYYY-MM-DD)

<details>
<summary>Latest run details</summary>

- Source: local `/doctor` run on YYYY-MM-DD
- Scanned M diagnostics, suppressed F false positives
- Categories addressed: <comma-separated list>

</details>

_Last updated: YYYY-MM-DD_
```

#### Chat summary

Print a short summary in chat. Don't duplicate the tracking issue body - surface only the bits the user needs to act on out-of-band (this run's PRs, dropped buckets, deferred items, suggested FP additions), then close with a single bold, inline link to the tracking issue. That closing link is the handoff: clicking through opens straight onto the grouped PR list (the first thing the user sees on the issue), so it has to be the last thing in the summary - not buried in a metadata header at the top. Inline the full `https://github.com/<owner>/<repo>/issues/<num>` URL in the markdown link so it's clickable in any chat client.

```markdown
## React Doctor - P PRs opened, score S_before → S_after / 100 when merged

### Opened this run

- [#<num>](https://github.com/<owner>/<repo>/pull/<num>) - `<title>` - <8-12 word value blurb>
- …

### Dropped - validation failed after retry

- `<slug>` - `<plugin>/<rule>` - <one-line why it failed>
- …

### Needs your call - deferred

- `<plugin>/<rule>` - `<path>:<line>` - <one-line why this needs human judgment>
- …

### Candidate false-positives (paste into `.react-doctor/false-positives.md`)

- `<plugin>/<rule>` - <code shape> - <one-line reason from the rule's validation prompt>
- …

<details>
<summary>Scan details</summary>

- Scope: `--diff` against `<base>` _(or "full scan")_
- Category filter: `<category-flags>` _(or "all categories")_
- Diagnostics: N scanned, F suppressed (A static, B validation prompt)

</details>

---

**→ [Review all K open React Doctor PRs in tracking issue #<num>](https://github.com/<owner>/<repo>/issues/<num>)**
```

Either way (working-tree or PR mode), skip any section that would be empty - no `_None_` filler.

---

## Hard rules

- **Working-tree mode**: never commit, stage, or push - the user reviews and commits.
- **PR mode**: only commit and push files React Doctor changed for the current bucket. Never commit unrelated working-tree noise. Push only to the bucket's branch - never to the default branch. Never force-push.
- **PR mode tracking issue**: touch only the single `react-doctor:tracking` issue. Never open a second tracking issue, never close one that still has open PRs, never edit issues you didn't create with this label. Never apply the `react-doctor` or `react-doctor:tracking` label to anything outside this flow.
- Deferral is instance-level and last-resort. Never defer a whole rule/category/file when a safe subset can be fixed.
- Never auto-edit `.react-doctor/false-positives.md` - surface candidates in the summary and let the user paste them in.
- Never touch `package.json` versions or the lockfile unless the fix is "remove unused dependency" (then run the project's install command so the lockfile updates).
- Never edit CI workflow files in `.github/workflows/` - if a project has React Doctor automation there, it's CI's territory, not the local triage agent's.
- Skip every deferred diagnostic (per Step 3's deferral criteria). They appear in the summary; they do not get a fix attempt.
- Follow the project's coding conventions: inline first, resist speculative abstraction.
