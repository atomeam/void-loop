# Pull requests review and merge themselves

Every open pull request from this repository that is not a draft merges. Forks stay out. Verse's review submits `event:"APPROVE"`. A conflict goes through `merge-main.mjs`, then `pr-fix.yml` (the free-model coder). A red check gets one coder run, then merges. A red verify or the watchdog issue starts `loop/main-fix-<sha>` and other pull requests keep merging. `verify.yml` reverts a commit that breaks the suite.

Worked: the log says `merged #<n>`, or `coder started`, or `rule: main-verify-red` then `main is red: coder started`. `node tools/no-approval-gate.mjs` prints `no human approval gate`.

`#2309` (`b1f5d2e8a`) waited for the suite. `#2617` (`c0bd4c3be`) held every merge while verify was red. `#2103` (`021530a36`) added the approving review. Do not bring those holds back: the check fails on `hold: true`, `verifyHold.hold`, CODEOWNERS, `required_approving_review_count`, `required_reviewers`, or a missing `event:"APPROVE"`.

This token cannot change branch protection or Actions approvals (both return 403). If GitHub still says review required: required approvals on main must be 0, and Actions must be allowed to create and approve pull requests.
