# Updates the game and the API on the Windows server to the latest main branch.
# Run in PowerShell as Administrator:  C:\topple\server\deploy.ps1
$ErrorActionPreference = 'Stop'
Set-Location C:\topple
git pull --ff-only
Restart-Service topple
Start-Sleep -Seconds 2
Invoke-RestMethod http://127.0.0.1:8787/api/health
