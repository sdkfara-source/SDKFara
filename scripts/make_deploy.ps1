# يحزم المشروع (بدون السجلات والسكربتات التطويرية) في hakeem-deploy.tar.gz
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$out = Join-Path $root "hakeem-deploy.tar.gz"

if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { throw "tar.exe غير موجود (يتوفر في ويندوز 10+)"; }

& tar.exe -czf $out `
  --dereference `
  --exclude='server.log' `
  --exclude='server.log.err' `
  --exclude='start.bat' `
  --exclude='scripts' `
  --exclude='data/backups' `
  --exclude='*.tar.gz' `
  .

if ($LASTEXITCODE -ne 0) { throw "فشل الحزم"; }
"تم إنشاء: $out  ($( [math]::Round((Get-Item $out).Length/1MB, 1)) MB)"