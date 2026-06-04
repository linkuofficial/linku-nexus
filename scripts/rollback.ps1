param(
    [Parameter(Mandatory = $false)]
    [string]$Image = "",
    [string]$Container = "nodus",
    [int]$Port = 8000,
    [Alias("env-file")]
    [string]$EnvFile = ".env",
    [Alias("dry-run")]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Fail {
    param([string]$Message)
    throw $Message
}

if ([string]::IsNullOrWhiteSpace($Image)) {
    Fail "Missing required argument: --image <previous-image-tag>"
}

if (-not $DryRun) {
    $dockerExists = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerExists) {
        Fail "Docker command not found in PATH"
    }
}

$commands = @(
    "docker ps -a --format `"{{.Names}}`"",
    "docker rm -f $Container",
    "docker run -d --name $Container --restart unless-stopped -p ${Port}:8000 --env-file $EnvFile $Image"
)

Write-Output "[rollback] image=$Image container=$Container port=$Port env_file=$EnvFile dry_run=$DryRun"

if ($DryRun) {
    Write-Output "[rollback] planned steps:"
    Write-Output "1. Check whether target container exists"
    Write-Output "2. Remove current container if present"
    Write-Output "3. Start previous stable image"
    Write-Output "[rollback] command: docker rm -f $Container"
    Write-Output "[rollback] command: docker run -d --name $Container --restart unless-stopped -p ${Port}:8000 --env-file $EnvFile $Image"
    Write-Output "[rollback] result=DRY_RUN"
    exit 0
}

$existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $Container }
if ($existing) {
    Write-Output "[rollback] removing existing container=$Container"
    docker rm -f $Container | Out-Null
}

Write-Output "[rollback] starting image=$Image"
docker run -d --name $Container --restart unless-stopped -p ${Port}:8000 --env-file $EnvFile $Image | Out-Null

Write-Output "[rollback] result=PASS"
