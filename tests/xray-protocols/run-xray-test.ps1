<#
.SYNOPSIS
    Runs an xray-core config file with portable path resolution.

.DESCRIPTION
    Reads an xray-core JSON config, replaces ${PROJECT_ROOT} placeholders with
    the actual project root path, writes to a temp file, and runs xray-core.
    Works on any machine because absolute machine-specific paths are replaced
    with portable placeholders in the config files.

    Since xray-core runs as a long-lived server, this script starts it in the
    background, verifies it booted successfully (process stays alive), then
    terminates it cleanly.

.PARAMETER ConfigPath
    Path to the xray-core JSON config file (required).

.PARAMETER XrayPath
    Path to xray.exe. Defaults to C:\Users\miner\Downloads\Xray-windows-64 (2)\xray.exe.

.PARAMETER ProjectRoot
    Explicit project root. If not provided, auto-detected by walking up from
    the config file looking for .git directory or package.json.

.PARAMETER BootTimeoutSec
    Seconds to wait for xray to boot (default: 5).

.EXAMPLE
    .\run-xray-test.ps1 -ConfigPath .\18-trojan-xhttp.json

.EXAMPLE
    .\run-xray-test.ps1 -ConfigPath .\20-hysteria2.json -XrayPath "D:\tools\xray.exe"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [string]$XrayPath = "C:\Users\miner\Downloads\Xray-windows-64 (2)\xray.exe",

    [string]$ProjectRoot = "",

    [int]$BootTimeoutSec = 5
)

# Resolve config to absolute path
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    Write-Host "ERROR: Config file not found: $ConfigPath" -ForegroundColor Red
    exit 1
}
$resolvedConfig = Resolve-Path -LiteralPath $ConfigPath
$configDir = Split-Path -Parent $resolvedConfig

# Resolve xray.exe
if (-not (Test-Path -LiteralPath $XrayPath -PathType Leaf)) {
    Write-Host "ERROR: xray.exe not found at: $XrayPath" -ForegroundColor Red
    exit 1
}
$resolvedXray = Resolve-Path -LiteralPath $XrayPath

# Determine project root
if ($ProjectRoot) {
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        Write-Host "ERROR: ProjectRoot directory not found: $ProjectRoot" -ForegroundColor Red
        exit 1
    }
    $root = Resolve-Path -LiteralPath $ProjectRoot
}
else {
    # Walk up from config directory looking for project markers
    $dir = $configDir
    $found = $false
    while ($dir) {
        if ((Test-Path (Join-Path $dir ".git") -PathType Container) -or
            (Test-Path (Join-Path $dir "package.json") -PathType Leaf)) {
            $root = $dir
            $found = $true
            break
        }
        $parent = Split-Path -Parent $dir
        if ($parent -eq $dir) { break }  # reached root
        $dir = $parent
    }
    if (-not $found) {
        Write-Host "ERROR: Could not auto-detect project root (no .git or package.json found)." -ForegroundColor Red
        Write-Host "Use -ProjectRoot to specify explicitly." -ForegroundColor Yellow
        exit 1
    }
}

$rootForward = $root.Replace('\', '/')

Write-Host "Config      : $resolvedConfig" -ForegroundColor Cyan
Write-Host "Xray        : $resolvedXray" -ForegroundColor Cyan
Write-Host "ProjectRoot : $root" -ForegroundColor Cyan
Write-Host ""

# Read config and replace placeholder
$config = Get-Content $resolvedConfig -Raw
$config = $config -replace '\$\{PROJECT_ROOT\}', $rootForward

# Write to a temp file (UTF-8 without BOM)
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
[System.IO.File]::WriteAllText($tempFile, $config, [System.Text.UTF8Encoding]::new($false))

# Prepare log output path
$logsDir = Join-Path $configDir "logs"
if (-not (Test-Path -LiteralPath $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}
$configName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedConfig)
$logName = $configName + "-test.log"
$logPath = Join-Path $logsDir $logName

$cleanup = {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

try {
    Write-Host "Starting xray-core with config: $(Split-Path -Leaf $resolvedConfig)" -ForegroundColor Yellow
    Write-Host "(xray runs as a server; will be stopped after $BootTimeoutSec sec verification)" -ForegroundColor DarkGray
    Write-Host "----------------------------------------" -ForegroundColor DarkGray

    # Start xray in background, redirecting both stdout and stderr to log
    $procInfo = New-Object System.Diagnostics.ProcessStartInfo
    $procInfo.FileName = $resolvedXray
    $procInfo.Arguments = "run -c `"$tempFile`""
    $procInfo.UseShellExecute = $false
    $procInfo.RedirectStandardOutput = $true
    $procInfo.RedirectStandardError = $true
    $procInfo.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $procInfo
    $proc.Start() | Out-Null

    # Read stderr asynchronously (xray outputs boot info there)
    $stderrBuilder = New-Object System.Text.StringBuilder
    $stderrEvent = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
        $event.MessageData.AppendLine($EventArgs.Data)
    } -MessageData $stderrBuilder
    $proc.BeginErrorReadLine()

    # Read stdout
    $stdoutBuilder = New-Object System.Text.StringBuilder
    $stdoutEvent = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
        $event.MessageData.AppendLine($EventArgs.Data)
    } -MessageData $stdoutBuilder
    $proc.BeginOutputReadLine()

    # Wait briefly for boot
    $booted = $proc.WaitForExit($BootTimeoutSec * 1000)

    # Unregister events
    Unregister-Event -SourceIdentifier $stderrEvent.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $stdoutEvent.Name -ErrorAction SilentlyContinue

    if (-not $booted) {
        # Process still running = boot succeeded
        Write-Host "xray-core is running (PID: $($proc.Id)) - config is valid!" -ForegroundColor Green
        Write-Host "Stopping xray-core..." -ForegroundColor Yellow
        $proc.Kill()
        $proc.WaitForExit(5000) | Out-Null

        # Save stderr output (contains boot info like "Configuration OK")
        $stderr = $stderrBuilder.ToString()
        $stdout = $stdoutBuilder.ToString()
        $combined = $stdout + "`r`n" + $stderr
        $combined | Out-File $logPath -Encoding utf8

        Write-Host "Log saved  : $logPath" -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor DarkGray
        Write-Host $combined
        Write-Host ""
        Write-Host "PASS: xray-core started successfully (exit after shutdown: $($proc.ExitCode))" -ForegroundColor Green
        & $cleanup
        exit 0
    }
    else {
        # Process exited = boot failed, capture output
        $stderr = $stderrBuilder.ToString()
        $stdout = $stdoutBuilder.ToString()
        $combined = $stdout + "`r`n" + $stderr
        $combined | Out-File $logPath -Encoding utf8

        Write-Host "Log saved  : $logPath" -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor DarkGray
        Write-Host $combined
        Write-Host ""
        Write-Host "FAIL: xray-core exited with code $($proc.ExitCode)" -ForegroundColor Red
        & $cleanup
        exit 1
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    & $cleanup
    exit 1
}
