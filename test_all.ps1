$ErrorActionPreference = "Stop"

Write-Host "=== 1. GUEST TESTS ==="
$gLocs = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/driver/get_locations.php" -Method GET
Write-Host "Guest Locations Count: $($gLocs.locations.Count)"

$contactBody = @{ name = "Visitor Guest"; email = "guest@example.com"; subject = "EV Charging Query"; message = "Do you have fast EV chargers at Dhanmondi?" } | ConvertTo-Json
$gContact = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/guest/contact.php" -Method POST -ContentType "application/json" -Body $contactBody
Write-Host "Guest Contact Result: $($gContact.success) - $($gContact.message)"

Write-Host "`n=== 2. DRIVER AUTH & ACTIONS ==="
$sessionD = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sendBodyD = @{ email = "driver@parksmart.io"; password = "123456"; role = "driver" } | ConvertTo-Json
$sendOtpD = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/login_send_otp.php" -Method POST -WebSession $sessionD -ContentType "application/json" -Body $sendBodyD

$verifyBodyD = @{ otp = "$($sendOtpD.dev_otp)" } | ConvertTo-Json
$verifyOtpD = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/login_verify_otp.php" -Method POST -WebSession $sessionD -ContentType "application/json" -Body $verifyBodyD
Write-Host "Driver Login: $($verifyOtpD.success) - Welcome $($verifyOtpD.user.full_name)"

$dash = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/driver/dashboard.php" -Method GET -WebSession $sessionD
Write-Host "Driver Dashboard Active Bookings: $($dash.stats.active_bookings), Total: $($dash.stats.total_bookings)"

$code = $dash.history[0].booking_code
$receipt = Invoke-WebRequest -Uri "http://localhost/parksmart/backend/driver/download_receipt.php?booking_code=$code" -Method GET -WebSession $sessionD
Write-Host "Driver Receipt for ${code}: Content-Type=$($receipt.Headers['Content-Type']) Length=$($receipt.Content.Length) bytes"

Write-Host "`n=== 3. MANAGER AUTH & ACTIONS ==="
$sessionM = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sendBodyM = @{ email = "manager@parksmart.io"; password = "123456"; role = "manager" } | ConvertTo-Json
$sendOtpM = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/login_send_otp.php" -Method POST -WebSession $sessionM -ContentType "application/json" -Body $sendBodyM

$verifyBodyM = @{ otp = "$($sendOtpM.dev_otp)" } | ConvertTo-Json
$verifyOtpM = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/login_verify_otp.php" -Method POST -WebSession $sessionM -ContentType "application/json" -Body $verifyBodyM
Write-Host "Manager Login: $($verifyOtpM.success) - Welcome $($verifyOtpM.user.full_name)"

$overview = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/manager/overview.php" -Method GET -WebSession $sessionM
Write-Host "Manager Facility: $($overview.location.name), Total Spaces: $($overview.metrics.total_spaces), Today Revenue: $($overview.metrics.today_revenue) BDT"

$spacemap = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/manager/spacemap.php" -Method GET -WebSession $sessionM
Write-Host "Manager Spacemap: $($spacemap.spaces.Count) spaces loaded. Free: $($spacemap.counts.free), Occupied: $($spacemap.counts.occupied)"

$repData = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/manager/reports_data.php" -Method GET -WebSession $sessionM
Write-Host "Manager Reports: Weekly Revenue=$($repData.weekly_revenue), Daily Data Points=$($repData.daily.Count)"

$areaPdf = Invoke-WebRequest -Uri "http://localhost/parksmart/backend/manager/area_report_pdf.php" -Method GET -WebSession $sessionM
Write-Host "Manager Area Report PDF: Content-Type=$($areaPdf.Headers['Content-Type']) Length=$($areaPdf.Content.Length) bytes"

$mContacts = Invoke-RestMethod -Uri "http://localhost/parksmart/backend/chat/get_contacts.php" -Method GET -WebSession $sessionM
Write-Host "Manager Live Chat Contacts: $($mContacts.contacts.Count) drivers available for messaging"

Write-Host "`n=== ALL TESTS PASSED SUCCESSFULLY! ==="
