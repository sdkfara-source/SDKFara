# يرصد مجلد الدراسات (G:) ويعيد بناء ونشر موقع Pages تلقائياً عند أي تغيير في ملفات PDF
# التشغيل: pwsh -File scripts\watch_publish.ps1   — يتركه يعمل في نافذة مفتوحة

$watchPath = "G:\My Drive\دراسات"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path -LiteralPath $watchPath)) {
  Write-Host "خطأ: المجلد غير موجود: $watchPath" -ForegroundColor Red
  exit 1
}

function Invoke-Publish {
  Set-Location -LiteralPath $root
  Write-Host ("[" + (Get-Date -Format "HH:mm:ss") + "] تغيير في المجلد — إعادة بناء ونشر...") -ForegroundColor Cyan
  node scripts/build_static.mjs | Out-Host
  if ($LASTEXITCODE -ne 0) { Write-Host "فشل البناء!" -ForegroundColor Red; return }

  git add -A
  $commit = git commit -m ("auto: تحديث المكتبة " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
  if ($LASTEXITCODE -ne 0) {
    Write-Host "لا تغييرات تستحق الدفع." -ForegroundColor DarkGray
    return
  }
  git push
  if ($LASTEXITCODE -eq 0) {
    Write-Host "تم النشر إلى Pages ✓ (سيُلاحَظ التحديث خلال ~دقيقة)" -ForegroundColor Green
  } else {
    Write-Host "فشل الدفع — تحقق من تسجيل دخول GitHub ثم أعد المحاولة." -ForegroundColor Yellow
  }
}

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $watchPath
$watcher.Filter = "*.pdf"
$watcher.IncludeSubdirectories = $false

Write-Host "مراقبة مجلد الدراسات: $watchPath" -ForegroundColor Green
Write-Host "ضع أي ملف PDF فيه وسيُضاف للمكتبة تلقائياً. أغلق هذه النافذة لإيقاف المراقبة." -ForegroundColor DarkGray

while ($true) {
  $res = $watcher.WaitForChanged("Created,Changed,Deleted,Renamed", 60000)
  if ($res.TimedOut) { continue }
  Start-Sleep -Seconds 5
  Invoke-Publish
}