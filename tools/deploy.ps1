# One deploy for everyone: sync void.html copies, test, deploy, commit + push to GitHub (branch "void" of atomeam/a-to-mind.com).
# Usage: powershell -File tools\deploy.ps1 "what changed"
param([string]$msg = "deploy")
$ErrorActionPreference = "Continue"
$loop = Split-Path $PSScriptRoot -Parent
$site = Join-Path $loop "void-live-deploy"
Copy-Item "$loop\void.html" "$site\index.html" -Force
Copy-Item "$loop\void.html" "$site\void.html" -Force
Copy-Item "$loop\void.html" "C:\Users\adamm\a-to-mind.com\index.html" -Force
# the plan and tools travel with the site so every agent sees one tree
New-Item -ItemType Directory -Force "$site\_loop" | Out-Null
Copy-Item "$loop\STANDING.md", "$loop\domains\void.plan.md", "$loop\domains\void.growth.md", "$loop\domains\void.assimilate.md", "$loop\domains\void.edit-engine.md" "$site\_loop\" -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$site\_loop\tools" | Out-Null
Copy-Item "$loop\tools\*.py", "$loop\tools\*.ps1", "$loop\tools\*.mjs" "$site\_loop\tools\" -Force -ErrorAction SilentlyContinue
if (Test-Path "$loop\tools\test_void.mjs") {
  Push-Location $loop; node tools\test_void.mjs; $ok = $LASTEXITCODE; Pop-Location
  if ($ok -ne 0) { Write-Host "tests failed, not deploying"; exit 1 }
}
Push-Location $site
& "C:\Users\adamm\a-to-mind.com\node_modules\.bin\wrangler.cmd" pages deploy . --project-name=a-to-mind --commit-dirty=true 2>&1 | Select-Object -Last 1
git add -A; git commit -q -m $msg; git push -q origin void 2>&1 | Out-Null
git log -1 --format="pushed %h %s"
Pop-Location

