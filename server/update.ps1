# Installs the latest version from GitHub (main branch) if there is one.
# Runs every 2 minutes as the scheduled task "Topple update" (created by install.ps1),
# and can also be run by hand in PowerShell as Administrator.
param(
  [string]$AppDir  = 'C:\inetpub\wwwroot\topple',
  [string]$DataDir = 'C:\inetpub\topple-data',
  [int]$Port       = 8787
)
# Native git output on stderr must not abort the script (Windows PowerShell 5.1),
# so exit codes are checked explicitly instead.
$ErrorActionPreference = 'Continue'
$log = Join-Path $DataDir 'update.log'
function Log($msg) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" -Encoding UTF8 }

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = 'C:\Program Files\Git\cmd\git.exe' }
Set-Location $AppDir

& $git fetch --quiet origin main *> $null
if ($LASTEXITCODE -ne 0) { Log 'git fetch nije uspio (nema interneta ili GitHub nije dostupan).'; exit 1 }
$local  = (& $git rev-parse HEAD).Trim()
$remote = (& $git rev-parse origin/main).Trim()
if ($local -eq $remote) { exit 0 }  # nothing new

Log "Nova verzija: $($local.Substring(0,7)) -> $($remote.Substring(0,7))"
# The server copy is never edited by hand (data lives in $DataDir), so match GitHub exactly.
& $git reset --hard --quiet origin/main *> $null
if ($LASTEXITCODE -ne 0) { Log 'git reset nije uspio.'; exit 1 }
try {
  Restart-Service topple -ErrorAction Stop
  Start-Sleep -Seconds 2
  Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -ErrorAction Stop | Out-Null
  Log "Instalirano $($remote.Substring(0,7)): $((& $git log -1 --format=%s).Trim())"
} catch {
  Log "UPOZORENJE: API se ne javlja nakon ažuriranja. Pogledaj $(Join-Path $DataDir 'api.log')."
  exit 1
}
