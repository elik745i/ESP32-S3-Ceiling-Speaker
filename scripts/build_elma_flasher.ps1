param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $projectRoot '.elma-flasher-build'
$assetRoot = Join-Path $buildRoot 'assets'
$venvRoot = Join-Path $buildRoot 'venv310'
$versionHeader = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'include\version.h')
if ($versionHeader -notmatch '#define APP_VERSION "(\d+\.\d+\.\d+)"') {
    throw 'Unable to read APP_VERSION from include/version.h.'
}
$releaseTag = "v$($Matches[1])"
$assetName = "ELMA-Flasher-$releaseTag"
$releaseRoot = Join-Path $projectRoot "release-assets\$releaseTag"

$requiredFirmwareFiles = @(
    '.pio\build\esp32_notifier\bootloader.bin',
    '.pio\build\esp32_notifier\partitions.bin',
    '.pio\build\esp32s3_notifier\bootloader.bin',
    '.pio\build\esp32s3_notifier\partitions.bin'
)
foreach ($relativePath in $requiredFirmwareFiles) {
    $fullPath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing $relativePath. Build the ESP32 and ESP32-S3 PlatformIO environments first."
    }
}

New-Item -ItemType Directory -Force -Path (Join-Path $assetRoot 'esp32'), (Join-Path $assetRoot 'esp32s3'), $releaseRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot '.pio\build\esp32_notifier\bootloader.bin') -Destination (Join-Path $assetRoot 'esp32\bootloader.bin') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot '.pio\build\esp32_notifier\partitions.bin') -Destination (Join-Path $assetRoot 'esp32\partitions.bin') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot '.pio\build\esp32s3_notifier\bootloader.bin') -Destination (Join-Path $assetRoot 'esp32s3\bootloader.bin') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot '.pio\build\esp32s3_notifier\partitions.bin') -Destination (Join-Path $assetRoot 'esp32s3\partitions.bin') -Force

if (-not (Test-Path -LiteralPath (Join-Path $venvRoot 'Scripts\python.exe'))) {
    $python310 = ''
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $python310 = (& py -3.10 -c 'import sys; print(sys.executable)' 2>$null).Trim()
    }
    if ((-not $python310 -or -not (Test-Path -LiteralPath $python310)) -and (Get-Command python -ErrorAction SilentlyContinue)) {
        $candidate = (& python -c 'import sys, tkinter; print(sys.executable)' 2>$null).Trim()
        if ($LASTEXITCODE -eq 0) {
            $python310 = $candidate
        }
    }
    if (-not $python310 -or -not (Test-Path -LiteralPath $python310)) {
        throw 'Python 3.10 with Tcl/Tk is required to build ELMA Flasher.'
    }
    & $python310 -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Creating the ELMA Flasher Python environment failed with exit code $LASTEXITCODE."
    }
}
$python = Join-Path $venvRoot 'Scripts\python.exe'
if (-not $SkipInstall) {
    & $python -m pip install --disable-pip-version-check --trusted-host pypi.org --trusted-host files.pythonhosted.org -r (Join-Path $projectRoot 'tools\elma_flasher\requirements-build.txt')
    if ($LASTEXITCODE -ne 0) {
        throw "ELMA Flasher build dependency installation failed with exit code $LASTEXITCODE."
    }
}

$iconPath = Join-Path $buildRoot 'ELMA-Flasher.ico'
$iconSource = Join-Path $projectRoot 'web\elma_iot_favicon.ico'
if (-not (Test-Path -LiteralPath $iconSource)) {
    throw 'Missing the approved ELMA IoT icon at web\elma_iot_favicon.ico.'
}
Copy-Item -LiteralPath $iconSource -Destination $iconPath -Force
Copy-Item -LiteralPath $iconSource -Destination (Join-Path $assetRoot 'ELMA-Flasher.ico') -Force

& $python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name $assetName `
    --icon $iconPath `
    --add-data "$assetRoot;assets" `
    --collect-all esptool `
    --hidden-import serial.tools.list_ports `
    --distpath $releaseRoot `
    --workpath (Join-Path $buildRoot 'pyinstaller-work') `
    --specpath (Join-Path $buildRoot 'pyinstaller-spec') `
    (Join-Path $projectRoot 'tools\elma_flasher\elma_flasher.py')
if ($LASTEXITCODE -ne 0) {
    throw "ELMA Flasher packaging failed with exit code $LASTEXITCODE."
}

$exePath = Join-Path $releaseRoot "$assetName.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
    throw "PyInstaller completed without producing $assetName.exe."
}
$hash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
Write-Host "Built $exePath"
Write-Host "SHA256 $hash"
