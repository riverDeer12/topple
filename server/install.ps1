# One-time setup of Topple on a Windows server with IIS.
# Creates the IIS site topple.rdd.software (game + /api proxy), the API as a
# Windows service and a scheduled task that installs every new version from
# GitHub (main branch) automatically.
#
# Run in PowerShell as Administrator. Safe to run again: finished steps are skipped.
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# Before running, install: Node.js 22 LTS, Git for Windows, IIS URL Rewrite 2.1,
# IIS Application Request Routing 3.0 and NSSM (see server/README.md).

param(
  [string]$HostName = 'topple.rdd.software',
  [string]$AppDir   = 'C:\inetpub\wwwroot\topple',  # git checkout; IIS serves $AppDir\web
  [string]$DataDir  = 'C:\inetpub\topple-data',     # database, logs, backups (not web-served)
  [string]$Repo     = 'https://github.com/riverDeer12/topple.git',
  [int]$Port        = 8787,
  [string]$GoogleClientId = ''                       # optional, enables "Sign in with Google" (see README)
)
$ErrorActionPreference = 'Stop'
function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "GREŠKA: $msg" -ForegroundColor Red; exit 1 }

# --- 0. Administrator and prerequisites ------------------------------------------
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Fail 'Pokreni PowerShell kao Administrator.' }

Step 'Provjera programa'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Fail 'Node.js nije instaliran (https://nodejs.org, verzija 22 LTS).' }
$nodeVersion = [version]((& $node -v).TrimStart('v'))
if ($nodeVersion -lt [version]'22.5.0') { Fail "Node.js $nodeVersion je prestar, treba 22.5 ili noviji." }
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { Fail 'Git nije instaliran (https://git-scm.com/download/win).' }
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) { Fail 'NSSM nije instaliran: kopiraj win64\nssm.exe u C:\Windows\System32 (https://nssm.cc/download).' }
if (-not (Get-Service W3SVC -ErrorAction SilentlyContinue)) { Fail 'IIS nije instaliran.' }
if (-not (Test-Path "$env:windir\System32\inetsrv\rewrite.dll")) { Fail 'IIS URL Rewrite nije instaliran (https://www.iis.net/downloads/microsoft/url-rewrite).' }
Import-Module WebAdministration
$arr = Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -ErrorAction SilentlyContinue
if (-not $arr) { Fail 'IIS Application Request Routing (ARR) nije instaliran (https://www.iis.net/downloads/microsoft/application-request-routing).' }
Write-Host "Node $nodeVersion, $git, $nssm, IIS + URL Rewrite + ARR: u redu"

# --- 1. ARR proxy on (needed to forward /api/ to the Node service) -------------------
Step 'Uključivanje ARR proxyja'
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True'
Write-Host 'ARR proxy je uključen.'

# --- 2. Code -----------------------------------------------------------------------
Step "Kod u $AppDir"
if (Test-Path (Join-Path $AppDir '.git')) {
  Write-Host 'Repozitorij već postoji, preskačem kloniranje.'
} else {
  if ((Test-Path $AppDir) -and (Get-ChildItem $AppDir -Force | Select-Object -First 1)) { Fail "$AppDir postoji i nije prazan. Isprazni ga ili odaberi drugu mapu (-AppDir)." }
  & $git clone --branch main $Repo $AppDir
  if ($LASTEXITCODE -ne 0) { Fail 'git clone nije uspio.' }
}
# The update task runs as SYSTEM, which git treats as a different owner of the folder.
$safe = $AppDir.Replace('\', '/')
if (-not ((& $git config --system --get-all safe.directory) -contains $safe)) { & $git config --system --add safe.directory $safe }

# --- 3. Data folder ------------------------------------------------------------------
Step "Mapa za podatke $DataDir"
New-Item -ItemType Directory -Force $DataDir | Out-Null
Write-Host 'Baza: ' (Join-Path $DataDir 'topple.db')

# --- 4. API as a Windows service (NSSM) ---------------------------------------------------
Step 'API servis "topple"'
if (-not (Get-Service topple -ErrorAction SilentlyContinue)) {
  & $nssm install topple $node (Join-Path $AppDir 'server\server.js') | Out-Null
}
& $nssm set topple AppDirectory $AppDir | Out-Null
$envVars = @("PORT=$Port", "DB_PATH=$(Join-Path $DataDir 'topple.db')", "ALLOWED_ORIGIN=https://$HostName,https://riverdeer12.github.io")
if ($GoogleClientId) { $envVars += "GOOGLE_CLIENT_ID=$GoogleClientId" }
& $nssm set topple AppEnvironmentExtra @envVars | Out-Null
& $nssm set topple AppStdout (Join-Path $DataDir 'api.log') | Out-Null
& $nssm set topple AppStderr (Join-Path $DataDir 'api.log') | Out-Null
& $nssm set topple AppRotateFiles 1 | Out-Null
& $nssm set topple AppRotateBytes 5000000 | Out-Null
& $nssm set topple Start SERVICE_AUTO_START | Out-Null
Restart-Service topple
Start-Sleep -Seconds 2
try { $h = Invoke-RestMethod "http://127.0.0.1:$Port/api/health"; Write-Host "API radi (danas je $($h.today))." }
catch { Fail "API se ne javlja. Pogledaj $(Join-Path $DataDir 'api.log')." }

# --- 5. IIS app pool and site ---------------------------------------------------------------
Step "IIS stranica $HostName"
$web = Join-Path $AppDir 'web'
if (-not (Test-Path 'IIS:\AppPools\topple')) {
  New-WebAppPool -Name topple | Out-Null
  Set-ItemProperty 'IIS:\AppPools\topple' -Name managedRuntimeVersion -Value ''  # static files only, no .NET
}
if (-not (Test-Path 'IIS:\Sites\topple')) {
  New-Website -Name topple -PhysicalPath $web -HostHeader $HostName -Port 80 -IPAddress '*' -ApplicationPool topple | Out-Null
} else {
  Set-ItemProperty 'IIS:\Sites\topple' -Name physicalPath -Value $web
}
# Let the app pool identity read the game files.
& icacls $web /grant "IIS AppPool\topple:(OI)(CI)RX" /T /Q | Out-Null
Start-Website -Name topple -ErrorAction SilentlyContinue
try {
  $r = Invoke-WebRequest "http://$HostName/api/health" -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
  Write-Host "IIS prosljeđuje /api/: $($r.StatusCode)"
} catch {
  $code = $null
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  if ($code -eq 301) { Write-Host 'IIS radi i preusmjerava na HTTPS (certifikat se dodaje u sljedećem koraku).' }
  elseif ($code) { Write-Host "Upozorenje: IIS je vratio $code. Provjeri da je stranica 'topple' pokrenuta u IIS Manageru." -ForegroundColor Yellow }
  else { Write-Host "Upozorenje: $HostName se ne otvara s ovog servera. Provjeri DNS (A zapis topple -> IP servera)." -ForegroundColor Yellow }
}

# --- 6. Automatic updates every 2 minutes -------------------------------------------------------
Step 'Automatsko ažuriranje (zakazani zadatak "Topple update")'
$update = Join-Path $AppDir 'server\update.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$update`" -AppDir `"$AppDir`" -DataDir `"$DataDir`" -Port $Port"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -StartWhenAvailable
Register-ScheduledTask -TaskName 'Topple update' -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Write-Host "Server svake 2 minute provjerava GitHub. Zapis: $(Join-Path $DataDir 'update.log')"

# --- 7. Daily database backup -------------------------------------------------------------
Step 'Dnevna sigurnosna kopija baze (zakazani zadatak "Topple backup")'
$bAction = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $AppDir 'server\backup.js')`" `"$(Join-Path $DataDir 'topple.db')`""
$bTrigger = New-ScheduledTaskTrigger -Daily -At '04:30'
Register-ScheduledTask -TaskName 'Topple backup' -Action $bAction -Trigger $bTrigger -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Write-Host "Svaki dan u 4:30, kopije u $DataDir (backup-pon.db ... backup-ned.db)."

Write-Host "`nGotovo." -ForegroundColor Green
Write-Host "Sljedeći korak: HTTPS certifikat. Pokreni win-acme (wacs.exe) kao Administrator,"
Write-Host "odaberi N i stranicu '$HostName'. Nakon toga igra radi na https://$HostName"
