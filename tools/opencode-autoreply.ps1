# OpenCode auto-reply (Victus)
# Requires OpenCode server on fixed port, e.g.:
#   opencode serve --port 4096
#   OR start TUI: opencode --port 4096
# Usage:
#   pwsh tools\opencode-autoreply.ps1 -ShareUrl https://opncd.ai/share/XXXX -Role Ship
#   pwsh tools\opencode-autoreply.ps1 -ShareUrl https://opncd.ai/share/XXXX -MessagePath brief.txt -Async

param(
  [Parameter(Mandatory=$true)][string]$ShareUrl,
  [string]$Server = "http://127.0.0.1:4096",
  [string]$MessagePath,
  [ValidateSet("Ship","Polish","Prove","Chooser","Salvage","Custom")][string]$Role = "Custom",
  [string]$PolishSkill = "clock",
  [switch]$Async
)

$ErrorActionPreference = "Stop"

function Get-ShareMeta([string]$url) {
  $tmp = Join-Path $env:TEMP ("oc-share-" + [guid]::NewGuid().ToString() + ".html")
  & curl.exe -sL --max-time 45 $url -o $tmp
  if (-not (Test-Path $tmp)) { throw "Failed to fetch share: $url" }
  $html = Get-Content -Raw $tmp
  $sid = [regex]::Match($html, 'sessionID:"([^"]+)"').Groups[1].Value
  $slug = [regex]::Match($html, 'slug:"([^"]+)"').Groups[1].Value
  if (-not $sid) { throw "No sessionID in share HTML" }
  return [pscustomobject]@{ SessionId = $sid; Slug = $slug }
}

function New-RoleBrief([string]$slug, [string]$role, [string]$polishSkill) {
  $base = @"
You are $slug. Work in C:\Users\adamm\a-to-mind-loop. Read AGENTS.md and the top of domains\void.frontier.md first (the one build order since 2026-10-11). hold\AGENTS.md does not govern this folder.

Public face: blank Void only (void.html -> https://a-to-mind.com). No homepage, scoreboard, Gumroad, or business Domains on the public face.

"@
  switch ($role) {
    "Ship" {
      return $base + @"
Your role: Ship. Claim the next unclaimed step on domains\void.frontier.md (a one-line claim PR). If .void-lock is free, take it, implement that step with >=30% pattern reuse, preserve every existing mount*, sync deploy folders, run wrangler pages deploy --project-name=a-to-mind from void-live-deploy ONLY if you hold the Ship claim, verify apex, clear lock, update growth Have/Next, append domains\void.agents.log.md.
"@
    }
    "Polish" {
      return $base + @"
Your role: Polish ($polishSkill). Do not Ship/deploy. If .void-lock held, Prove only. Else widen freer English / small ops for $polishSkill; keep other mounts intact; do not wrangler deploy.
"@
    }
    "Prove" {
      return $base + @"
Your role: Prove. Do not edit void.html. Curl https://a-to-mind.com, check mounts, append Pass/Fail under domains\void.surface-qa.md Attempts only. Append a line to domains\void.agents.log.md.
"@
    }
    "Chooser" {
      return $base + @"
Your role: Chooser. Check domains\void.frontier.md against the live void.html inventory + AutoSalvage hits and add what is missing there (void.growth.md is frozen history). Do not edit void.html. Do not deploy.
"@
    }
    "Salvage" {
      return $base + @"
Your role: Salvage scout. Run AutoSalvage / victus ingest reads; add what it finds to domains\void.frontier.md as one-line targets (the salvage shelf, docs\SALVAGE.md, once cleanup step 3 builds it). Do not edit void.html. Do not deploy.
"@
    }
    default { throw "Custom role needs -MessagePath" }
  }
}

$health = & curl.exe -s -m 3 "$Server/global/health"
if (-not $health) {
  Write-Host "OpenCode server not reachable at $Server"
  Write-Host "Start: opencode serve --port 4096"
  Write-Host "Or relaunch TUI with: opencode --port 4096"
  exit 2
}

$meta = Get-ShareMeta $ShareUrl
Write-Host ("slug={0} session={1}" -f $meta.Slug, $meta.SessionId)

if ($MessagePath) {
  $text = Get-Content -Raw $MessagePath
} else {
  $text = New-RoleBrief -slug $meta.Slug -role $Role -polishSkill $PolishSkill
}

$payload = @{ parts = @(@{ type = "text"; text = $text }) } | ConvertTo-Json -Depth 6
$tmpJson = Join-Path $env:TEMP ("opencode-autoreply-" + $meta.Slug + ".json")
[System.IO.File]::WriteAllText($tmpJson, $payload)

$endpoint = if ($Async) {
  "$Server/session/$($meta.SessionId)/prompt_async"
} else {
  "$Server/session/$($meta.SessionId)/message"
}

Write-Host "POST $endpoint"
& curl.exe -s -m 180 -X POST $endpoint -H "Content-Type: application/json" --data-binary "@$tmpJson"
Write-Host ""
Write-Host "sent"
