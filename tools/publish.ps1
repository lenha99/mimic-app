<#
    기준 음성 전체를 프로덕션에 올린다 (Windows 개발 머신용).

        powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -NewToken
        powershell -ExecutionPolicy Bypass -File tools\publish.ps1
        powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -Draft

    왜 스크립트인가: id 를 나열하는 셸 반복문을 콘솔에 붙여넣다가 줄이 잘려
    'dolphin','bap_meokgo' 가 'dolphinmeokgo' 로 합쳐진 적이 있다. 붙여넣을
    길이가 짧아야 안 깨진다. 출력도 publish.log 에 남긴다 — 콘솔 출력을 다시
    붙여넣는 것보다 파일을 읽는 게 안전하다.

    -NewToken 은 관리자 토큰을 새로 발급해 Modal 시크릿 mimic-admin 을 덮어쓴다.
    Modal 은 시크릿 값을 다시 꺼내주지 않으므로, 값을 잃어버렸으면 이 방법뿐이다.
    이 토큰은 여기서만 쓰니 갈아끼워도 다른 데 영향이 없다.
#>
param(
    [switch]$NewToken,   # 토큰을 새로 발급해 시크릿을 덮어쓴다
    [switch]$Draft       # 목록에 안 띄우고 /record/{id} 직링크로만 (기본은 --live)
)

Set-Location (Join-Path $PSScriptRoot "..")
$env:PYTHONIOENCODING = "utf-8"
$log = Join-Path (Get-Location) "publish.log"

if ($NewToken) {
    Write-Host "· 새 관리자 토큰 발급 -> Modal 시크릿 mimic-admin 덮어쓰기"
    $tok = -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
    modal secret create mimic-admin ADMIN_TOKEN=$tok --force
    if (-not $?) { Write-Host "x 시크릿 저장 실패 - 여기서 멈춘다"; exit 1 }
    $env:MIMIC_ADMIN_TOKEN = $tok
    Remove-Variable tok
    # 시크릿은 컨테이너가 뜰 때 읽힌다. 떠 있던 컨테이너는 옛 토큰을 들고 있어서
    # 바로 올리면 403 이 난다. 스케일다운(scaledown_window=300)을 기다린다.
    Write-Host "· 떠 있는 컨테이너가 새 토큰을 집게 6분 기다린다 (scaledown 300초)"
    Start-Sleep -Seconds 360
}
elseif (-not $env:MIMIC_ADMIN_TOKEN) {
    # Read-Host 로 받으면 PowerShell 히스토리에 안 남는다.
    $env:MIMIC_ADMIN_TOKEN = Read-Host "mimic-admin 의 ADMIN_TOKEN (모르면 Ctrl+C 후 -NewToken 으로)"
}

$cmdArgs = @("tools/ingest.py", "publish-all")   # $args 는 자동 변수라 쓰면 안 된다
if (-not $Draft) { $cmdArgs += "--live" }

Write-Host ""
# 네이티브 exe 의 stderr 를 그대로 파이프하면 PS 5.1 이 ErrorRecord 로 감싼다.
# 문자열로 펴서 콘솔과 로그에 같이 흘린다.
$ErrorActionPreference = "Continue"
& python @cmdArgs 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log

Write-Host ""
Write-Host "전체 출력: $log"
Write-Host "토큰은 이 창에 남아 있다. 다시 돌리려면:  python tools/ingest.py publish-all --live"
