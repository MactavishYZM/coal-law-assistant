param([string]$Repository = 'MactavishYZM/coal-law-assistant')
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw '请先安装 Git for Windows，并完成 GitHub 登录。' }
$repoURL = 'https://github.com/' + $Repository + '.git'
$work = Join-Path $env:TEMP ('coal-law-v7-' + [guid]::NewGuid().ToString('N'))
Write-Host ('正在克隆 ' + $Repository)
& git clone --depth 1 $repoURL $work
if ($LASTEXITCODE -ne 0) { throw '克隆失败。请检查网络连接和仓库权限。' }
$files = @('index.html','index-data.json','manifest.webmanifest','sw.js','.nojekyll')
foreach ($file in $files) {
  $src = Join-Path $base $file
  if (Test-Path $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $work $file) -Force }
}
foreach ($folder in @('source','pages','icons')) {
  $dest = Join-Path $work $folder
  if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  Copy-Item -LiteralPath (Join-Path $base $folder) -Destination $dest -Recurse -Force
}
# 旧工作流会重新生成过时 index.html，移除以保留本次高清新索引。
$oldWorkflow = Join-Path $work '.github/workflows/build-pwa.yml'
if (Test-Path $oldWorkflow) { Remove-Item $oldWorkflow -Force }
Push-Location $work
try {
  & git add -A
  & git commit -m 'Update mining regulations with high-resolution PDF sources and corrected page index'
  if ($LASTEXITCODE -ne 0) { throw '提交失败，可能未设置 git user.name / user.email。' }
  & git push origin main
  if ($LASTEXITCODE -ne 0) { throw '推送失败。请先通过 Git Credential Manager 或 gh auth login 登录 GitHub。' }
  Write-Host '更新已推送。GitHub Pages 通常在之后数分钟内完成发布。'
  Write-Host ('网站地址：https://' + $Repository.Split('/')[0].ToLower() + '.github.io/' + $Repository.Split('/')[1] + '/?v=20261008-hires')
} finally { Pop-Location }
