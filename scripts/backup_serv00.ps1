# نسخ احتياطي خارجي لبيانات Serv00 (data/ + studies/) إلى جهازك
# الاستخدام: pwsh -File scripts\backup_serv00.ps1 -Host sX.serv00.com -User USER -Domain USER.serv00.net [-Key path]
param(
  [Parameter(Mandatory = $true)][string]$Host,
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Domain,
  [string]$Key,
  [string]$OutDir = "$PSScriptRoot\..\backups\serv00"
)

$ErrorActionPreference = "Stop"
$bk = Join-Path (Split-Path -Parent $PSScriptRoot) "backups\serv00"
New-Item -ItemType Directory -Force -Path $bk | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$base = "domains/$Domain/public_nodejs"

$ssh = @("-o", "StrictHostKeyChecking=no", "-r")
if ($Key) { $ssh += @("-i", $Key) }

"squill نسخ data/ و studies/ من ${User}@${Host} ..."
& scp @ssh "${User}@${Host}:$base/data"     "$bk\${stamp}-data"
if ($LASTEXITCODE -ne 0) { throw "فشل نسخ data" }
& scp @ssh "${User}@${Host}:$base/studies"  "$bk\${stamp}-studies"
if ($LASTEXITCODE -ne 0) { throw "فشل نسخ studies" }

"اكتمل ✓ — النتائج:"
Get-ChildItem -LiteralPath "$bk\${stamp}-*" -Directory | ForEach-Object { "  $($_.FullName)" }
""
"لإنشاء نسخة احتياطية دورية على ويندوز أضف مهمة مجدولة تشغّل:"
"  pwsh -File $($PSScriptRoot)\backup_serv00.ps1 -Host '$Host' -User '$User' -Domain '$Domain'"