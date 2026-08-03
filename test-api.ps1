$body = @{"email"="admin@dunhuang.com"; "password"="admin123"} | ConvertTo-Json
$headers = @{"Content-Type"="application/json"}
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -Headers $headers -Body $body
    Write-Host "Login result:"
    $r | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error:" $_.Exception.Message
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd() | Write-Host
}
