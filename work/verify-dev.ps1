$ErrorActionPreference = 'Stop'
$projectRef = 'ctdffqqbwfdgonflamae'
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines((Join-Path $PSScriptRoot '..\.env.local'))) {
  if ($line -match '^([A-Z0-9_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] }
}
$base = $settings['VITE_SUPABASE_URL'].TrimEnd('/')
$publishableKey = $settings['VITE_SUPABASE_PUBLISHABLE_KEY']
if ($base -ne "https://$projectRef.supabase.co") { throw 'Development URL does not match the expected project' }

$keyJson = npx supabase projects api-keys --reveal --output json --project-ref $projectRef 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Could not load development API key' }
$serviceKey = @(($keyJson | ConvertFrom-Json) | Where-Object { $_.name -eq 'service_role' })[0].api_key
if (-not $serviceKey) { throw 'Development service role key unavailable' }
$adminHeaders = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }
$anonHeaders = @{ apikey = $publishableKey }

function Invoke-DevApi {
  param([string]$Method, [string]$Path, [hashtable]$Headers, $Body)
  $arguments = @{ Uri = "$base$Path"; Method = $Method; Headers = $Headers; TimeoutSec = 30 }
  if ($null -ne $Body) {
    $arguments.ContentType = 'application/json'
    $arguments.Body = $Body | ConvertTo-Json -Depth 8 -Compress
  }
  Invoke-RestMethod @arguments
}

$createdUserIds = [Collections.Generic.List[string]]::new()
$clientId = $null
$firstSession = $null
try {
  $suffix = [Guid]::NewGuid().ToString('N')
  $password = [Guid]::NewGuid().ToString('N') + 'Aa1!'
  $firstEmail = "codex-check-$suffix@example.invalid"
  $secondEmail = "codex-isolation-$suffix@example.invalid"
  $first = Invoke-DevApi 'POST' '/auth/v1/admin/users' $adminHeaders @{ email = $firstEmail; password = $password; email_confirm = $true }
  $createdUserIds.Add([string]$first.id)
  $second = Invoke-DevApi 'POST' '/auth/v1/admin/users' $adminHeaders @{ email = $secondEmail; password = $password; email_confirm = $true }
  $createdUserIds.Add([string]$second.id)
  $firstSession = Invoke-DevApi 'POST' '/auth/v1/token?grant_type=password' $anonHeaders @{ email = $firstEmail; password = $password }
  $secondSession = Invoke-DevApi 'POST' '/auth/v1/token?grant_type=password' $anonHeaders @{ email = $secondEmail; password = $password }
  if (-not $firstSession.access_token -or -not $secondSession.access_token) { throw 'Development sign-in did not return sessions' }
  Write-Output 'email_password_sign_in=PASS'

  $firstHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $($firstSession.access_token)" }
  $secondHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $($secondSession.access_token)" }
  $profiles = Invoke-DevApi 'GET' "/rest/v1/profiles?id=eq.$($first.id)&select=id" $firstHeaders $null
  if ($null -eq $profiles -or @($profiles).Count -ne 1) { throw 'Automatic profile creation failed' }
  Write-Output 'profile_created=PASS'

  $profileUpdateHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $($firstSession.access_token)"; Prefer = 'return=representation' }
  $updatedProfile = @(Invoke-DevApi 'PATCH' "/rest/v1/profiles?id=eq.$($first.id)" $profileUpdateHeaders @{ onboarding_tour_completed = $true })[0]
  if ($updatedProfile.onboarding_tour_completed -ne $true) { throw 'Tour preference did not save' }
  $persistedProfile = @(Invoke-DevApi 'GET' "/rest/v1/profiles?id=eq.$($first.id)&select=onboarding_tour_completed" $firstHeaders $null)[0]
  if ($persistedProfile.onboarding_tour_completed -ne $true) { throw 'Tour preference did not persist' }
  Write-Output 'tour_close_preference_save=PASS'

  $createHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $($firstSession.access_token)"; Prefer = 'return=representation' }
  $createdClient = @(Invoke-DevApi 'POST' '/rest/v1/clients' $createHeaders @{ company_name = 'Temporary development verification'; contact_name = 'Codex check' })[0]
  $clientId = [string]$createdClient.id
  if (-not $clientId) { throw 'Client save did not return an ID' }
  $saved = Invoke-DevApi 'GET' "/rest/v1/clients?id=eq.$clientId&select=id,company_name" $firstHeaders $null
  if ($null -eq $saved -or @($saved).Count -ne 1) { throw 'Client was not readable after saving' }
  Write-Output 'client_save_and_read=PASS'

  $hidden = Invoke-DevApi 'GET' "/rest/v1/clients?id=eq.$clientId&select=id" $secondHeaders $null
  if ($null -ne $hidden -and @($hidden).Count -gt 0) { throw 'User isolation failed: another user can read this client' }
  Write-Output 'per_user_data_isolation=PASS'

  $monday = Invoke-DevApi 'POST' '/functions/v1/mondayOAuth' $firstHeaders @{ action = 'get_status' }
  if ($monday.connected -ne $false) { throw 'Unexpected Monday connection in test account' }
  $mondayUrl = Invoke-DevApi 'POST' '/functions/v1/mondayOAuth' $firstHeaders @{ action = 'get_auth_url'; redirect_uri = 'http://localhost:5173/integrations'; code_verifier = ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')) }
  if (-not $mondayUrl.auth_url -or -not $mondayUrl.state) { throw 'Monday OAuth could not start' }
  $mondayAuthorize = [uri]$mondayUrl.auth_url
  if ($mondayAuthorize.Host -ne 'auth.monday.com' -or $mondayAuthorize.AbsolutePath -ne '/oauth2/authorize' -or -not $mondayAuthorize.Query.Contains('code_challenge_method=S256')) { throw 'Monday OAuth URL is invalid' }
  $mondayParams = [System.Web.HttpUtility]::ParseQueryString($mondayAuthorize.Query)
  if ($mondayParams['redirect_uri'] -ne 'http://localhost:5173/integrations') { throw 'Monday OAuth callback URL is incorrect' }
  Write-Output 'monday_oauth_start=PASS'
  Write-Output "monday_callback=$($mondayParams['redirect_uri'])"
  Write-Output "monday_version_targeted=$([bool]$mondayParams['app_version_id'])"

  $googleUrl = Invoke-DevApi 'POST' '/functions/v1/recallCalendarOAuth' $firstHeaders @{ action = 'get_auth_url'; redirect_uri = 'http://localhost:5173/calendarbots'; state = [Guid]::NewGuid().ToString('N') }
  if (-not $googleUrl.auth_url) { throw 'Google/Recall OAuth could not start' }
  $googleAuthorize = [uri]$googleUrl.auth_url
  if ($googleAuthorize.Host -ne 'accounts.google.com' -or $googleAuthorize.AbsolutePath -ne '/o/oauth2/v2/auth' -or -not $googleAuthorize.Query.Contains('access_type=offline')) { throw 'Google OAuth URL is invalid' }
  Write-Output 'google_recall_oauth_start=PASS'

  $sync = Invoke-DevApi 'POST' '/functions/v1/syncRecallCalls' $firstHeaders @{}
  if ($sync.ok -ne $true -or $sync.calendars -ne 0) { throw 'Recall manual sync endpoint failed for a new account' }
  Write-Output 'recall_manual_sync=PASS'

  Invoke-DevApi 'DELETE' "/rest/v1/clients?id=eq.$clientId" $firstHeaders $null | Out-Null
  $clientId = $null
  Write-Output 'temporary_client_cleanup=PASS'
}
finally {
  if ($clientId -and $firstSession.access_token) {
    try {
      $firstHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $($firstSession.access_token)" }
      Invoke-DevApi 'DELETE' "/rest/v1/clients?id=eq.$clientId" $firstHeaders $null | Out-Null
    } catch { Write-Output 'temporary_client_cleanup=FAILED' }
  }
  foreach ($id in $createdUserIds) {
    try { Invoke-DevApi 'DELETE' "/auth/v1/admin/users/$id" $adminHeaders $null | Out-Null }
    catch { Write-Output 'temporary_user_cleanup=FAILED' }
  }
  if ($createdUserIds.Count -gt 0) { Write-Output 'temporary_test_users_removed=YES' }
}
