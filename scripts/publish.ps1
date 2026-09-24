# يبني النسخة الثابتة ويرفعها إلى GitHub Pages
# الاستخدام: pwsh -File scripts\publish.ps1 [-Message "رسالة"]
param([string]$Message = "update static site")

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

"بناء النسخة الثابتة..."
node scripts/build_static.mjs
if ($LASTEXITCODE -ne 0) { throw "فشل البناء" }

git add -A
git commit -m $Message | Out-Host
git push | Out-Host
"تم النشر ✓"