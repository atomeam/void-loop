# Pull requests review and merge themselves

Every open pull request from this repository that is not a draft merges. Forks stay out. Verse's review submits `event:"APPROVE"`. A conflict or a red check goes to `pr-fix.yml`, then merges. A red verify or the watchdog issue starts `loop/main-fix-<sha>` and other pull requests keep merging.

`#2309` (`b1f5d2e8a`) waited for the suite. `#2617` (`c0bd4c3be`) held every merge while verify was red. `#2103` (`021530a36`) added the approving review. `node tools/no-approval-gate.mjs` fails if those holds come back. Branch protection and Actions approvals both return 403 here: required approvals on main must be 0, and Actions must be allowed to approve pull requests.
