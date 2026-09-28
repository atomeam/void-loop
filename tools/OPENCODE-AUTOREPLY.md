# OpenCode auto-reply

Goal: when a share URL arrives, post the brief into that session without manual paste.

## One-time setup on Victus
1. Run OpenCode with a **fixed** server port so Grok/scripts can reach it:
   - `opencode serve --port 4096` (headless), or
   - start TUI with `opencode --port 4096` (if your build supports it)
2. Keep that process up while agents run.

## Send a role brief
```powershell
cd C:\Users\adamm\a-to-mind-loop
pwsh .\tools\opencode-autoreply.ps1 -ShareUrl https://opncd.ai/share/XXXX -Role Prove -Async
```
Roles: Ship | Polish | Prove | Chooser | Salvage

Custom text:
```powershell
pwsh .\tools\opencode-autoreply.ps1 -ShareUrl https://opncd.ai/share/XXXX -MessagePath .\brief.txt -Async
```

## Grok loop
1. Adam drops share link in chat (or inbox).
2. Grok fetches share → slug/session → builds brief from STANDING/growth.
3. Grok runs this script on Victus (or POSTs the same JSON itself).
4. Session gets the message; Adam no longer pastes.

## Limits
- Public share page is read-only; write path is **local** OpenCode HTTP API only.
- Server must be running and able to see that session id.
- Move session to `a-to-mind-loop` so AGENTS.md here applies (not hold).
