# One deploy for everyone: sync void.html copies, test, deploy, then commit + push the whole Loop to GitHub (private atomeam/void-loop).
# Usage: powershell -File tools\deploy.ps1 "what changed"
param([string]$msg = "deploy")
$ErrorActionPreference = "Continue"
$loop = Split-Path $PSScriptRoot -Parent
$site = Join-Path $loop "void-live-deploy"
Copy-Item "$loop\void.html" "$site\index.html" -Force
Copy-Item "$loop\void.html" "$site\void.html" -Force
Copy-Item "$loop\void.html" "C:\Users\adamm\a-to-mind.com\index.html" -Force
if (Test-Path "$loop\tools\test_void.mjs") {
  Push-Location $loop; node tools\test_void.mjs; $ok = $LASTEXITCODE; Pop-Location
  if ($ok -ne 0) { Write-Host "tests failed, not deploying"; exit 1 }
}
Push-Location $site
$out = & "C:\Users\adamm\a-to-mind.com\node_modules\.bin\wrangler.cmd" pages deploy . --project-name=a-to-mind --commit-dirty=true 2>&1 | Select-Object -Last 1
$out
Pop-Location
if ("$out" -notmatch 'Deployment complete') { Write-Host 'deploy failed'; exit 1 }
Push-Location $loop
git add -A; git commit -q -m $msg; git push -q origin main 2>&1 | Out-Null
git log -1 --format="pushed %h %s"
Pop-Location
