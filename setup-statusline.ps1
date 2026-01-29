$claudeDir = "$env:USERPROFILE\.claude"
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null

# Create status line script
$scriptPath = "$claudeDir\statusline-command.ps1"
@'
$input = $Input | ConvertFrom-Json

$dir = Split-Path $input.workspace.current_dir -Leaf
$gitBranch = ""
$gitStatus = ""

$gitDir = git -C $input.workspace.current_dir rev-parse --git-dir 2>&1 | Select-Object -First 1
if ($gitDir) {
    $branch = git -C $input.workspace.current_dir rev-parse --abbrev-ref HEAD 2>&1 | Select-Object -First 1
    if ($branch) {
        $gitBranch = $branch
        $status = git -C $input.workspace.current_dir --no-optional-locks status --porcelain 2>&1
        if ($status) {
            if ($status -match '^[MADRC]') { $gitStatus += "+" }
            if ($status -match '^.M') { $gitStatus += "*" }
            if ($status -match '^??') { $gitStatus += "%" }
        }
    }
}

$parts = @()
if ($gitBranch) {
    $gitInfo = $gitBranch
    if ($gitStatus) { $gitInfo += "[$gitStatus]" }
    $parts += $gitInfo
}
$parts += $dir

$remaining = $input.context_window.remaining_percentage
if ($remaining) {
    $parts += "$remaining% ctx"
}

$output = $parts -join " | "
Write-Output $output
'@ | Out-File -FilePath $scriptPath -Encoding UTF8

# Update settings
$settingsPath = "$claudeDir\settings.json"
$settings = @{}
if (Test-Path $settingsPath) {
    $settingsObj = Get-Content $settingsPath | ConvertFrom-Json
    $settingsObj.PSObject.Properties | ForEach-Object { $settings[$_.Name] = $_.Value }
}

$settings['statusLine'] = @{
    type = 'command'
    command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
}

($settings | ConvertTo-Json -Depth 10) -replace '"', '\"' | Out-File -FilePath $settingsPath -Encoding UTF8

Write-Host "Status line configured successfully!" -ForegroundColor Green
Write-Host "Script: $scriptPath"
Write-Host "Settings: $settingsPath"
