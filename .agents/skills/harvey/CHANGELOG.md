# Changelog

Notable changes to Harvey. Dates are release dates; the format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely and versions
follow [semver](https://semver.org/), with the caveat that Harvey is pre-1.0 and
minor versions can still change behaviour.

## [Unreleased]

### Added

- **Microsoft 365 mail provider.** Set `channels.email.provider: microsoft` to
  send and read through a Microsoft 365 / Outlook mailbox via Microsoft Graph,
  for domains whose mail lives in Exchange Online (which no longer accepts
  passwords over IMAP). Signs in once with OAuth + PKCE (`harvey microsoft
  auth`; no client secret, no stored password), drafts then sends so the
  Message-ID is known, threads replies with `createReply`, reads the last 7
  days of the inbox without marking anything read, refuses to act as any
  mailbox other than `persona.email`, and holds sending when the inbox can't
  be read. See [docs/microsoft365.md](docs/microsoft365.md).
- **Optional per-recipient compliance check (Precleared).** Set
  `compliance.precleared.enabled: true` with `sender_country: GB` or `US` to
  have each new recipient checked before the first cold email against UK
  PECR, US CAN-SPAM, Canada's CASL, Germany's UWG and France's rules. Any
  verdict but `ok_to_email` fails that outbox item with the rule and the next
  step. If the check can't be made (daily allowance used up, network down, a
  malformed response), cold emails wait for a later cycle while replies still
  go out. One check per address, cached for 30 days; changing the sender
  country, address source or product description triggers a fresh check. The
  receipt id is logged with each send. Native providers only. Off by default.

## [0.3.0] — 2026-10-13

### Added

- **Opt-in Codex brain (ChatGPT plan).** Set `brain.provider: codex` (or pick
  it in `harvey setup`, or `harvey train --provider codex`) to think with the
  Codex CLI on a ChatGPT subscription instead of Claude. Claude remains the
  default and there is no automatic fallback between providers. Each call
  runs a throwaway, isolated `codex app-server` with no tools; Harvey verifies
  the lockdown from Codex's own reports before sending any prompt, aborts on
  any attempted tool use, refuses API-key logins and custom endpoints
  (checked before your login is exposed to Codex), and never changes your own
  Codex settings or login: each call gets a private copy of the login without
  its refresh token, so an expired login must be renewed with Codex itself or
  `codex login`. Requires Codex CLI 0.159.3; other versions are refused. See
  the README section "Using a ChatGPT plan instead (Codex)".
- `brain.model` picks the model for either provider, for Harvey only. For
  Codex use `gpt-5.5` (suggested by `harvey setup`): the verified text-only
  model. Blank auto-selection only picks listed models without code-execution
  tools, and on current ChatGPT accounts there are none; code-mode models are
  refused.
- If Codex can't be used (expired or renewal-due login, unsupported CLI,
  unsafe Codex config, rejected model, plan usage limit), Harvey pauses the
  heartbeat instead of running agents that would fail: replies stay unread
  and unescalated, queued emails wait, and the reason shows in the log,
  `harvey status` and the dashboard. It resumes on its own once the cause is
  fixed. `harvey status --check` runs the same check (no prompt sent) on demand
  and exits non-zero when it fails. The Codex provider supports macOS and
  Linux; it is refused on Windows (use Claude there).

### Changed

- Each heartbeat now sends email after the agents that read and answer
  replies have finished, and native mail providers (Gmail/SMTP) read the
  mailbox every cycle, so a reply always cancels its queued follow-ups before
  that cycle's sends (previously the two could run at the same time, and a
  reply arriving with no open conversation waited for a later cycle). This
  applies to Claude and Codex alike.
- A reply is only recorded once its reply draft (if it needs one) is
  written, so a brain outage part-way never half-records it. If a working
  brain returns no usable draft, the conversation is flagged for a human
  instead of being left open with no answer.
- Usage is tracked per provider. The budget gate, `harvey usage`, `harvey
  status` and the dashboard read and label the active provider's own quota;
  existing usage history is kept and attributed to Claude.

### Fixed

- Dashboard HTML and text assets now use UTF-8 explicitly, fixing Windows
  decoding failures. Regression tests cover HTML, CSS, JavaScript and SVG.

## [0.2.1] — 2026-10-13

A security release. Update if you run Harvey.

### Security

- **Claude now runs with no tools.** Every Claude call used to run with
  `--dangerously-skip-permissions`, and prompts include text Harvey doesn't
  control: prospect email replies and scraped web pages. Instructions hidden
  in that text could make Claude run commands, read or write files, or use
  the operator's connected MCP servers. Calls now run with `--tools ""` and
  `--strict-mcp-config`; Harvey only ever needed text back, so nothing else
  changes. Reported privately by [@hackchang](https://github.com/hackchang).
  If you ran an earlier version with live replies coming in, check the
  account that ran Harvey for unexpected files or activity.

### Fixed

- `harvey run` no longer drops into the setup wizard when the trained config
  lives in `harvey.local.yaml`; the dashboard reads it too.
- A heartbeat cycle is capped at 10 minutes, so one hung agent can't freeze
  Harvey, and quiet hours are re-checked every 5 minutes so a Mac waking from
  sleep resumes on time.
- Sites that only answer on plain HTTP or `www.` are no longer marked
  unreachable.
- Profile and contact backfills rotate through every company instead of
  retrying the same few forever.
- The trainer writes full place names ("Solon, Ohio") and real job titles, so
  discovery doesn't geocode to the wrong city and found contacts aren't
  silently discarded.

### Added

- Contacts are backfilled for companies found without any, from their own team
  pages and, if a key is set, Hunter's named-people search.
- `HUNTER_MONTHLY_SEARCHES` (default 25) sets one Hunter budget shared by every
  domain search.

Thanks to [@sshaw0729-dotcom](https://github.com/sshaw0729-dotcom) for the
fixes above (#2).

## [0.2.0] — 2026-09-13

The release that made Harvey worth running. The previous version could write
and send email but could not reliably find anyone to send it to, and it needed
a paid third-party platform to send at all. Both are fixed.

### Added

- **A prospecting pipeline that works.** Four stages, each independently
  runnable and re-runnable: DISCOVER (who exists) → PROFILE (what they are) →
  ENRICH (who decides) → VERIFY (can you reach them).
- **DISCOVER, with a provider menu.** Four sources behind one adapter
  interface, shown side by side in the dashboard with what each does, what it
  costs, its free tier and which keys it needs. The default — OpenStreetMap —
  needs no account, no card and no key, so the whole pipeline can be run
  before paying anyone. `harvey discover`.
- **Cost discipline in the collector.** Every discovery run estimates before it
  spends, refuses to start over your cap, re-checks the cap between batches,
  reads a kill switch, and flushes observations per batch so a run that dies
  keeps what it learned. `harvey discover --estimate` prints the projection and
  exits.
- **PROFILE.** Free — three HTTP requests per business, no browser, no model
  call. Reads the incumbent agency out of the site footer, ad pixels, missing
  schema, abandoned blogs, open roles and named people. Chained onto DISCOVER
  and run on every heartbeat. `harvey profile`.
- **A signal catalog you confirm.** Harvey knows how to collect 23 signals and
  collects none of them until a human says so. Each shows a plain-language
  description, what it costs, and how many companies already carry it.
  `harvey signals`.
- **The cohort builder.** Pick what a prospect must have and what disqualifies
  them; see the matching companies live. A prospect list is a query you can
  explain, not a file.
- **Native mail providers.** Gmail (REST + OAuth) and any SMTP+IMAP mailbox.
- **The outbox approval ladder.** Every outgoing email waits for approval by
  default (`pending_review → approved → sent`), reviewed one at a time in a
  decisions desk with `A`/`R`/`J`/`K`. A deterministic pre-send gate — no model
  involved — rejects unrendered merge tags, banned phrases, over-length bodies,
  too many links, HTML, undeliverable addresses and recipient mismatches.
- **Bounce handling and a kill switch.** A bounce marks the address invalid,
  cancels that prospect's queued sends, and trips a global pause past a
  configured bounce rate. `harvey sending pause|resume`.
- **Claude usage tracking.** Per-call attribution by agent, task and model, plus
  live subscription-quota gauges read the same way `/usage` does, so Harvey
  throttles itself and leaves headroom for your own interactive work.
  `harvey usage`.
- **CSV export.** `harvey export` writes a sequencer-ready list. Harvey is worth
  running as a list-builder even if you never let it send.
- **A dashboard worth looking at.** Opens on Today — what needs a human — with
  an activity feed and a rail of pipeline figures, collector runs and setup.
  Light and dark are the same design re-tokenised; appearance follows your OS by
  default. Fonts are vendored so it renders with the network off.
- **A Python version guard.** `python3 -m venv` on macOS builds from the system
  3.9, which cannot run Harvey. It now fails immediately with the fix instead of
  surfacing later as an unrelated-looking ImportError.

### Changed

- **The data model.** Every fact Harvey learns is now an observation — a row in
  `observations`, never a column. A new signal needs no migration, re-observing
  over time is a free time series, and confidence and provenance travel with the
  fact. The vocabulary is governed: a database trigger rejects any signal code
  not in `signal_codes`.
- **Email finding is pattern-first.** Harvey derives the domain's address format
  and verifies one candidate rather than brute-forcing name variations, and
  grades every address honestly as `verified` / `risky` / `guess` / `invalid`.
  Only deliverable addresses are ever sent to.
- **The default mail provider** is now `gmail`. Instantly is still supported as
  a legacy option.
- **Discovery depth defaults to 30, not 100.** Google removed
  100-results-per-page in September 2025, so depth 100 is now billed as ten
  pages nearly everywhere — and below rank 30 it is mostly directories.
- **The dashboard's HTML, CSS and JS** are real files in `harvey/web/` instead
  of a 1,500-line string literal in `dashboard.py`. Still no build step.

### Fixed

- **Guessed emails were being reported as verified** whenever the domain merely
  had an MX record. The migration downgrades every legacy `email_verified=1` row
  to `guess`.
- **Cohorts counted the wrong companies.** PROFILE records a false boolean when
  it checks and finds nothing — which is correct — but `cohort()` matched on the
  row existing, so "companies running Google Ads" silently meant "companies we
  checked for Google Ads", which was all of them. Cohorts now read the newest
  observation per company and signal, and require it to be true.
- **Usage tracking counted every Claude session on the machine**, not just
  Harvey's. The transcript reconciler is gone; the ledger contains only rows
  Harvey's own Brain wrote.
- **Page titles were being extracted as people** ("Request Service", "Commercial
  Services"), and titles bled between team members.
- **Confirming a signal before anything had loaded the catalog** reported success
  while changing nothing.
- **The free OSM provider answered unmapped search terms with every registered
  office in the area** — coffee roasters and churches for a roofing query. It now
  refuses the query and names the trades it can search.

### Security

- Test fixtures no longer carry real businesses' phone numbers or street
  addresses.
- `harvey.local.yaml` (gitignored) overrides the tracked `harvey.yaml`, so a
  fork can hold real product configuration without it reaching a public repo.

## [0.1.0]

Initial release: the heartbeat loop, five sub-agents, the skills library, the
website trainer, Instantly-based sending, and the first dashboard.
