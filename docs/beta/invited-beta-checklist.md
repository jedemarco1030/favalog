# Invited-beta evaluation session

A short moderated session for a handful of people the owner invites
personally. This document is only a script and a template. It does **not**
authorize contacting anyone, sending invitations, or adding analytics or
behavioral tracking. Each of those needs separate owner approval.

## Release gate (2026-09-30)

**Do not invite participants yet.** Post-merge source `1c076a3` passed the
retry-free first-list and fixture journeys, but likes did not execute on that
baseline. [PR #22 CI 36760089274](https://github.com/jedemarco1030/favalog/actions/runs/36760089274)
now executes likes and following feed successfully on application source
`76bb608`; the historical startup conflict did not recur on this attempt.
That run failed configured fixtures (one failure, one flaky test, five retry
attempts and seven cascade skips). Source `5847189` fixes the incorrect fixture
slug assertion and streamed duplicate-save result; its
[CI 36763709617](https://github.com/jedemarco1030/favalog/actions/runs/36763709617)
completed successfully: 1,574 unit/component tests, 34 retry-free fixtures,
20 retry-free first-list repetitions, eight provider-layout scenarios, and
executed likes/feed. Configured Explore has 15 passes/one paid-semantic skip;
default no-env has 44 passes/six intentional skips; explicit no-env has five
passes/no skips. No revised-source E2E retries or flaky outcomes were recorded.
The demonstration-separation follow-up still needs final documentation/capture-branch CI,
owner migration/deployment approval, new post-merge main CI, and explicit owner
accessibility/operational acceptance.
Use the browser-only steps in the
[release checklist](../mvp1-release-checklist.md). No gate has been silently
deferred. Games support keyword discovery/search; do not promise RAWG live
semantic search. Production Home portfolio screenshots are real baseline
captures, not acceptance evidence for this follow-up.

## Before the session

- Use the production deployment (<https://favalog.vercel.app>).
- The participant uses their own new account. Don't share test accounts.
- Tell the participant that nothing is recorded beyond the notes you write by
  hand, and that they can stop at any time.
- Don't coach. If they're stuck for about 2 minutes, note it and move on.

## Tasks

1. **Discover without searching.** "Find something you'd like to watch, read,
   or play without typing anything."
2. **Search for a known title.** "Find a specific movie, book, or game you
   already know."
3. **Save to an existing list.** First create one list together, then ask:
   "Add that title to your list."
4. **Create a new list and save.** "Save a different title to a new list
   with a name of your choice."
5. **Find a related title.** "From that title's page, find something
   connected to it."
6. **Return and locate saved content.** "Close the tab, come back, and
   find what you saved."

## Feedback template (one per participant)

```text
Participant: P_  (no names or contact details)   Date:        Device/browser:

Task | Completed? (yes / with help / no) | Time (approx) | Where they hesitated or got confused
1 Discover     |   |   |
2 Search       |   |   |
3 Save existing|   |   |
4 New list     |   |   |
5 Related      |   |   |
6 Return       |   |   |

Perceived value (1–5): "How useful would this be to you?"      Why:
Most confusing moment:
One thing they'd change:
Would they use it again? (yes / maybe / no)
Bugs seen (steps, URL, screenshot if they offer one):
```

## After the session

- Store notes privately. Don't commit participant notes to the repository.
- Summarize patterns as issues without identifying anyone.
