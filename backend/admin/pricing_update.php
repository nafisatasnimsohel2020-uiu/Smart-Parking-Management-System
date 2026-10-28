<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$location_id = intval($data['location_id'] ?? 0);
$multiplier  = floatval($data['peak_multiplier'] ?? 1.0);
$peak_start  = trim($data['peak_start'] ?? '08:00:00');
$peak_end    = trim($data['peak_end'] ?? '11:00:00');
$threshold   = intval($data['occupancy_threshold'] ?? 75);
$enabled     = !empty($data['enabled']) ? 1 : 0;

if ($location_id <= 0 || $multiplier < 1.0 || $multiplier > 5.0 || $threshold < 0 || $threshold > 100) {
    send_json(['success' => false, 'message' => 'Valid location, a multiplier between 1.0-5.0 and a 0-100 occupancy threshold are required.'], 400);
}

$stmt = mysqli_prepare($conn, "
    INSERT INTO pricing_rules (location_id, peak_multiplier, peak_start, peak_end, occupancy_threshold, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        peak_multiplier = VALUES(peak_multiplier),
        peak_start = VALUES(peak_start),
        peak_end = VALUES(peak_end),
        occupancy_threshold = VALUES(occupancy_threshold),
        enabled = VALUES(enabled)
");
mysqli_stmt_bind_param($stmt, "idssii", $location_id, $multiplier, $peak_start, $peak_end, $threshold, $enabled);

if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_json(['success' => false, 'message' => 'Could not save pricing rule: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'message' => 'Pricing rule saved.']);
