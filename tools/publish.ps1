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
    [switch]$Draft,      # 목록에 안 띄우고 /record/{id} 직링크로만 (기본은 --live)
    [string[]]$Only = @() # 이 id 들만 올린다. 실패한 것만 다시 돌릴 때
)

Set-Location (Join-Path $PSScriptRoot "..")
$env:PYTHONIOENCODING = "utf-8"
# PowerShell 은 네이티브 명령의 stdout 을 [Console]::OutputEncoding 으로 디코딩한다.
# 한국어 윈도우 기본값은 CP949 라 파이썬의 UTF-8 출력이 '臾댁빞??' 처럼 깨진다.
# 보내는 데이터와는 무관한 표시 문제지만, 로그를 읽을 수 없게 되므로 맞춰준다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$log = Join-Path (Get-Location) "publish.log"

if ($NewToken) {
    Write-Host "· 새 관리자 토큰 발급 -> Modal 시크릿 mimic-admin 덮어쓰기"
    $tok = -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
    modal secret create mimic-admin ADMIN_TOKEN=$tok --force
    if (-not $?) { Write-Host "x 시크릿 저장 실패 - 여기서 멈춘다"; exit 1 }
    $env:MIMIC_ADMIN_TOKEN = $tok
    Remove-Variable tok
    # 시크릿은 컨테이너가 뜰 때 읽힌다. 떠 있던 컨테이너는 옛 토큰을 들고 있어서
    # 바로 올리면 403 이 난다. 스케일다운(300초)을 기다리는 건 추측이고, 재배포는
    # 컨테이너를 전부 갈아치우므로 즉시 확정된다. 이미지가 캐시돼 있어 몇 초면 끝난다.
    Write-Host "· 새 토큰을 바로 물리려고 재배포한다 (컨테이너 교체)"
    modal deploy modal_app.py | Out-Null
    if (-not $?) { Write-Host "x 재배포 실패 - 여기서 멈춘다"; exit 1 }
}
elseif (-not $env:MIMIC_ADMIN_TOKEN) {
    # Read-Host 로 받으면 PowerShell 히스토리에 안 남는다.
    $env:MIMIC_ADMIN_TOKEN = Read-Host "mimic-admin 의 ADMIN_TOKEN (모르면 Ctrl+C 후 -NewToken 으로)"
}

# -u: 파이프로 넘기면 파이썬 출력이 블록 버퍼링된다. 그대로 두면 명령이 다
# 끝날 때까지 로그 파일이 생기지도 않아서, 진행 중인지 멈춘 건지 알 수가 없다.
$cmdArgs = @("-u", "tools/ingest.py", "publish-all")   # $args 는 자동 변수라 쓰면 안 된다
if (-not $Draft) { $cmdArgs += "--live" }
if ($Only.Count -gt 0) { $cmdArgs += "--only"; $cmdArgs += $Only }

Write-Host ""
# 네이티브 exe 의 stderr 를 그대로 파이프하면 PS 5.1 이 ErrorRecord 로 감싼다.
# 문자열로 펴서 콘솔과 로그에 같이 흘린다.
$ErrorActionPreference = "Continue"
& python @cmdArgs 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log
$uploaded = $?

# 목록 순서는 곧 콘텐츠 결정이다(memes[0] 이 홈 히어로). admin_add 는 append 라
# 하나라도 실패하면, 또 일부만 다시 올리면 순서가 어긋난다. 레지스트리 순서를
# 통째로 다시 박는다.
if ($uploaded) {
    Write-Host "`n· 카탈로그 순서 맞추기"
    & python -u tools/ingest.py push-catalog 2>&1 | ForEach-Object { $_.ToString() } |
        Tee-Object -FilePath $log -Append
}

Write-Host ""
Write-Host "전체 출력: $log"
# powershell -File 로 부르면 이건 자식 프로세스다. 여기서 만든 $env: 는 부모 창으로
# 돌아가지 않는다. "토큰이 창에 남아 있다"고 안내했다가 매번 다시 헤맸다.
Write-Host "실패한 게 있으면 그것만 다시:"
Write-Host "  powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -NewToken -Only id1,id2"
