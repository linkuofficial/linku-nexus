param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$WebhookUrl = $env:ALERT_WEBHOOK_URL,
    [string]$AdminApiKey = $env:ADMIN_API_KEY
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

Write-Output "[smoke] base_url=$BaseUrl"

# 1) Health check
$health = Invoke-RestMethod -Method GET -Uri "$BaseUrl/api/health"
Assert-True ($health.status -eq "ok") "Health check failed: expected status=ok"
Write-Output "[smoke] health=ok"

# 2) Metrics endpoint includes required counters
$metrics = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$BaseUrl/api/metrics"
Assert-True ($metrics.StatusCode -eq 200) "Metrics endpoint failed: expected status 200"
$metricsBody = $metrics.Content

foreach ($required in @(
    "nodus_http_5xx_total",
    "nodus_http_latency_p95_ms",
    "nodus_admin_trigger_events"
)) {
    Assert-True ($metricsBody.Contains($required)) "Metrics missing required key: $required"
}
Write-Output "[smoke] metrics=ok"

# 3) Trigger admin event and confirm metric path moved
$headers = @{}
if (-not [string]::IsNullOrWhiteSpace($AdminApiKey)) {
    $headers["X-Admin-Key"] = $AdminApiKey
}

$payload = @{
    phase = 2
    domain = "MAT"
    subdomain = "calculus"
    batch_size = 1
    batches = 1
    structured = $true
    critique = $true
} | ConvertTo-Json

try {
    $trigger = Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$BaseUrl/api/admin/generate/trigger" -Headers $headers -ContentType "application/json" -Body $payload
    Assert-True ($trigger.StatusCode -eq 200) "Admin trigger failed: expected status 200, got $($trigger.StatusCode)"

    $metricsAfter = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$BaseUrl/api/metrics"
    $minuteLine = ($metricsAfter.Content -split "`n" | Where-Object { $_ -match 'nodus_admin_trigger_events\{window="minute"\}' } | Select-Object -First 1)
    Assert-True (-not [string]::IsNullOrWhiteSpace($minuteLine)) "Missing minute admin trigger metric"

    $minuteMatch = [regex]::Match($minuteLine, '(\d+)$')
    Assert-True ($minuteMatch.Success) "Could not parse minute admin trigger metric value"
    $minuteCount = [int]$minuteMatch.Groups[1].Value
    Assert-True ($minuteCount -ge 1) "Expected minute admin trigger count >= 1, got $minuteCount"
    Write-Output "[smoke] admin_trigger_metric_minute=$minuteCount"
}
catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
        throw
    }

    $statusCode = [int]$response.StatusCode
    $bodyText = ""
    if ($_.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
        $bodyText = $_.ErrorDetails.Message
    }
    try {
        if ([string]::IsNullOrWhiteSpace($bodyText)) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $bodyText = $reader.ReadToEnd()
            $reader.Dispose()
        }
    }
    catch {
        if ([string]::IsNullOrWhiteSpace($bodyText)) {
            $bodyText = ""
        }
    }

    if ($statusCode -eq 403 -and $bodyText.Contains("Admin generation is disabled in production")) {
        Write-Output "[smoke] admin_trigger_metric_minute=skipped (generation disabled in production)"
    }
    else {
        throw
    }
}

# 4) Optional webhook reachability check
if (-not [string]::IsNullOrWhiteSpace($WebhookUrl)) {
    $probe = @{ text = "nodus smoke notification $(Get-Date -Format o)" } | ConvertTo-Json
    $hook = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $WebhookUrl -ContentType "application/json" -Body $probe
    Assert-True ($hook.StatusCode -ge 200 -and $hook.StatusCode -lt 300) "Webhook probe failed: status $($hook.StatusCode)"
    Write-Output "[smoke] webhook_probe_status=$($hook.StatusCode)"
}
else {
    Write-Output "[smoke] webhook_probe=skipped (ALERT_WEBHOOK_URL not set)"
}

Write-Output "[smoke] result=PASS"