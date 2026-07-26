[CmdletBinding()]
param(
    [switch]$SkipUpdate,
    [switch]$PrepareOnly,
    [switch]$ForcePrepare
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-ExternalOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $output = @(& $FilePath @ArgumentList)
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return ($output -join [Environment]::NewLine).Trim()
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$ArgumentList,

        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Get-ConfiguredPort {
    $portText = $env:NODE_ZSB_PORT
    if ([string]::IsNullOrWhiteSpace($portText)) {
        return 3000
    }

    $port = 0
    if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw 'NODE_ZSB_PORT must be an integer between 1 and 65535.'
    }
    return $port
}

function Assert-PortAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $listeners = @(Get-NetTCPConnection `
        -State Listen `
        -LocalPort $Port `
        -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
        return
    }

    $processIds = @($listeners |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Sort-Object)
    throw "Port $Port is already listening (PID: $($processIds -join ', ')). Stop the existing service before running this launcher."
}

function Get-Origin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Hostname,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $displayHostname = $Hostname
    if ($displayHostname.Contains(':')) {
        $displayHostname = "[$displayHostname]"
    }
    return "http://${displayHostname}:$Port"
}

try {
    $repositoryRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $PSScriptRoot '..\..')
    )
    Set-Location -LiteralPath $repositoryRoot

    $gitCommand = (Get-Command 'git' -ErrorAction Stop).Source
    $bunCommand = (Get-Command 'bun' -ErrorAction Stop).Source
    $listenHostname = $env:NODE_ZSB_HOST
    if ([string]::IsNullOrWhiteSpace($listenHostname)) {
        $listenHostname = 'localhost'
    } else {
        $listenHostname = $listenHostname.Trim()
    }
    $listenPort = Get-ConfiguredPort
    $origin = Get-Origin -Hostname $listenHostname -Port $listenPort

    Write-Host "[INFO] Repository: $repositoryRoot"
    Write-Host "[INFO] Target:     $origin"
    $bunVersion = Read-ExternalOutput `
        -FilePath $bunCommand `
        -ArgumentList @('--version') `
        -Description 'Reading the Bun version'
    Write-Host "[INFO] Bun:        $bunVersion"

    Assert-PortAvailable -Port $listenPort

    $trackedChanges = @(& $gitCommand status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) {
        throw 'Reading Git status failed.'
    }
    if ($trackedChanges.Count -gt 0) {
        Write-Host ($trackedChanges -join [Environment]::NewLine)
        throw 'Tracked files have local changes. Resolve them before updating or starting the service.'
    }

    $untrackedFiles = @(& $gitCommand status --short --untracked-files=all |
        Where-Object { $_ -like '?? *' })
    if ($LASTEXITCODE -ne 0) {
        throw 'Reading untracked files failed.'
    }
    if ($untrackedFiles.Count -gt 0) {
        Write-Host '[INFO] Preserving untracked server files:'
        Write-Host ($untrackedFiles -join [Environment]::NewLine)
    }

    $branch = Read-ExternalOutput `
        -FilePath $gitCommand `
        -ArgumentList @('symbolic-ref', '--quiet', '--short', 'HEAD') `
        -Description 'Reading the current Git branch'
    $upstream = Read-ExternalOutput `
        -FilePath $gitCommand `
        -ArgumentList @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}') `
        -Description 'Reading the upstream Git branch'
    Write-Host "[INFO] Branch:     $branch -> $upstream"

    $updated = $false
    if (-not $SkipUpdate) {
        Write-Host '[INFO] Checking for remote updates...'
        & $gitCommand fetch --prune
        $fetchExitCode = $LASTEXITCODE
        if ($fetchExitCode -ne 0) {
            Write-Warning "Git fetch failed with exit code $fetchExitCode. The launcher will use the current checkout if it was already prepared."
        } else {
            $headCommit = Read-ExternalOutput `
                -FilePath $gitCommand `
                -ArgumentList @('rev-parse', 'HEAD') `
                -Description 'Reading the current commit'
            $upstreamCommit = Read-ExternalOutput `
                -FilePath $gitCommand `
                -ArgumentList @('rev-parse', '@{u}') `
                -Description 'Reading the upstream commit'

            if ($headCommit -ne $upstreamCommit) {
                $mergeBase = Read-ExternalOutput `
                    -FilePath $gitCommand `
                    -ArgumentList @('merge-base', 'HEAD', '@{u}') `
                    -Description 'Comparing the local and upstream histories'

                if ($mergeBase -eq $headCommit) {
                    $updateCount = Read-ExternalOutput `
                        -FilePath $gitCommand `
                        -ArgumentList @('rev-list', '--count', 'HEAD..@{u}') `
                        -Description 'Counting available updates'
                    Write-Host "[UPDATE] $updateCount commit(s) are available:"
                    Invoke-ExternalCommand `
                        -FilePath $gitCommand `
                        -ArgumentList @('log', '--oneline', '--max-count=20', 'HEAD..@{u}') `
                        -Description 'Displaying available updates'
                    if ([int]$updateCount -gt 20) {
                        Write-Host '[UPDATE] Only the newest 20 commits are shown.'
                    }
                    Invoke-ExternalCommand `
                        -FilePath $gitCommand `
                        -ArgumentList @('merge', '--ff-only', '@{u}') `
                        -Description 'Fast-forwarding the repository'
                    $updated = $true
                } elseif ($mergeBase -eq $upstreamCommit) {
                    throw 'The server branch contains commits that are not on its upstream branch. Push or remove them manually before deployment.'
                } else {
                    throw 'The server branch has diverged from its upstream branch. Resolve the Git history manually before deployment.'
                }
            } else {
                Write-Host '[INFO] The repository is already up to date.'
            }
        }
    } else {
        Write-Host '[INFO] Remote update check was skipped.'
    }

    $currentCommit = Read-ExternalOutput `
        -FilePath $gitCommand `
        -ArgumentList @('rev-parse', 'HEAD') `
        -Description 'Reading the deployment commit'
    $runtimeDirectory = Join-Path $repositoryRoot '.node-zsb-runtime'
    $preparedStatePath = Join-Path $runtimeDirectory 'prepared-state'
    $expectedPreparedState = "$currentCommit`n$bunVersion"
    $preparedState = ''
    if (Test-Path -LiteralPath $preparedStatePath -PathType Leaf) {
        $preparedState = (Get-Content -LiteralPath $preparedStatePath -Raw).Trim()
    }

    $dependenciesPath = Join-Path $repositoryRoot 'node_modules'
    $builtAssetPath = Join-Path $repositoryRoot 'dist\web\app.js'
    $needsPreparation = (
        $ForcePrepare -or
        $updated -or
        $preparedState -ne $expectedPreparedState -or
        -not (Test-Path -LiteralPath $dependenciesPath -PathType Container) -or
        -not (Test-Path -LiteralPath $builtAssetPath -PathType Leaf)
    )

    if ($needsPreparation) {
        Write-Host "[PREPARE] Preparing commit $currentCommit..."
        Invoke-ExternalCommand `
            -FilePath $bunCommand `
            -ArgumentList @('install', '--frozen-lockfile') `
            -Description 'Installing locked dependencies'
        Invoke-ExternalCommand `
            -FilePath $bunCommand `
            -ArgumentList @('run', 'build') `
            -Description 'Building node-zsb'

        $previousSmokeOrigin = $env:NODE_ZSB_SMOKE_ORIGIN
        try {
            $env:NODE_ZSB_HOST = $listenHostname
            $env:NODE_ZSB_PORT = [string]$listenPort
            $env:NODE_ZSB_SMOKE_ORIGIN = $origin
            Invoke-ExternalCommand `
                -FilePath $bunCommand `
                -ArgumentList @('run', 'test:smoke') `
                -Description 'Running the production smoke test'
        } finally {
            $env:NODE_ZSB_SMOKE_ORIGIN = $previousSmokeOrigin
        }

        New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
        Set-Content `
            -LiteralPath $preparedStatePath `
            -Value $expectedPreparedState `
            -Encoding ascii `
            -NoNewline
        Write-Host '[PREPARE] Build and smoke test passed.'
    } else {
        Write-Host "[INFO] Commit $currentCommit is already prepared."
    }

    if ($PrepareOnly) {
        Write-Host '[INFO] Preparation-only run completed.'
        exit 0
    }

    Assert-PortAvailable -Port $listenPort
    $env:NODE_ZSB_HOST = $listenHostname
    $env:NODE_ZSB_PORT = [string]$listenPort
    $env:NODE_ENV = 'production'
    $env:NODE_ZSB_SERVE_DIST = '1'

    Write-Host "[START] Starting node-zsb at $origin"
    Write-Host '[START] Press Ctrl+C to stop the service.'
    & $bunCommand run start
    $serviceExitCode = $LASTEXITCODE
    if ($serviceExitCode -ne 0) {
        throw "node-zsb exited with code $serviceExitCode."
    }
    exit 0
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
