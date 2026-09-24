# يبني الحزمة ثم يرفعها إلى Serv00 ويفكها وينفّذ serv00_setup.sh
param(
  [Parameter(Mandatory = $true)][string]$Host,
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Domain,
  [string]$Key,
  [string]$Tar = "$PSScriptRoot\..\hakeem-deploy.tar.gz"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

"1/4) بناء حزمة النشر..."
& pwsh -NoProfile -File "$PSScriptRoot\make_deploy.ps1" | Out-Host
if (-not (Test-Path -LiteralPath $Tar)) { throw "الحزمة غير موجودة: $Tar" }

$ssh = @("-o", "StrictHostKeyChecking=no")
if ($Key) { $ssh += @("-i", $Key) }

"2/4) رفع: ${User}@${Host}:hakeem-deploy.tar.gz"
& scp @ssh "$Tar" "${User}@${Host}:hakeem-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "فشل scp" }

"3/4) فك الضغط على الخادم..."
& ssh @ssh "${User}@${Host}" "mkdir -p ~/serv00-app && tar -xzf ~/hakeem-deploy.tar.gz -C ~/serv00-app"

"4/4) تنفيذ الإعداد..."
& ssh @ssh "${User}@${Host}" "bash ~/serv00-app/deploy/serv00_setup.sh '$User' '$Domain'"

""
"تم الرفع والنشر ✓ — افتح: https://$Domain"