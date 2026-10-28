<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$data = json_decode(file_get_contents('php://input'), true);

$action = trim($data['action'] ?? ''); // 'checkin' | 'checkout'
$booking_code = trim($data['booking_code'] ?? '');
$otp = trim($data['otp'] ?? '');
$driver_id = current_user()['id'];

if ($booking_code === '' || !in_array($action, ['checkin', 'checkout', 'extend'], true)) {
    send_json(['success' => false, 'message' => 'Invalid request parameters.'], 400);
}

$stmt = mysqli_prepare($conn, "
    SELECT r.id, r.space_id, r.location_id, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.otp_code, r.status,
           pl.price_per_hour
    FROM reservations r
    JOIN parking_locations pl ON pl.id = r.location_id
    WHERE r.booking_code = ? AND r.driver_id = ? 
    LIMIT 1
");
mysqli_stmt_bind_param($stmt, "si", $booking_code, $driver_id);
mysqli_stmt_execute($stmt);
$res = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$res) {
    send_json(['success' => false, 'message' => 'Reservation not found.'], 404);
}

if ($action === 'checkin' || $action === 'checkout') {
    send_json([
        'success' => false,
        'message' => 'Action Denied: Check-in and check-out must be verified by the area parking manager at the gate. Drivers cannot self check-in or self check-out.'
    ], 403);
}

if ($action === 'extend') {
    if (!in_array($res['status'], ['active', 'booked', 'upcoming'], true)) {
        send_json(['success' => false, 'message' => 'Only active or booked reservations can be extended.'], 400);
    }

    $hours_to_add = (int) ($data['hours'] ?? 1);
    if ($hours_to_add <= 0 || $hours_to_add > 6) $hours_to_add = 1;

    $current_end_ts = strtotime($res['reserve_date'] . ' ' . $res['end_time']);
    $new_end_ts = $current_end_ts + ($hours_to_add * 3600);
    $new_end_time = date('H:i:s', $new_end_ts);

    // Check if slot has a conflicting reservation during this extended window
    $check_stmt = mysqli_prepare($conn, "
        SELECT id FROM reservations 
        WHERE space_id = ? 
          AND reserve_date = ? 
          AND id != ? 
          AND status IN ('booked', 'upcoming', 'active')
          AND NOT (end_time <= ? OR start_time >= ?)
        LIMIT 1
    ");
    mysqli_stmt_bind_param($check_stmt, "isiss", $res['space_id'], $res['reserve_date'], $res['id'], $res['end_time'], $new_end_time);
    mysqli_stmt_execute($check_stmt);
    $conflict = mysqli_fetch_assoc(mysqli_stmt_get_result($check_stmt));
    mysqli_stmt_close($check_stmt);

    if ($conflict) {
        send_json(['success' => false, 'message' => 'Extension unavailable: another vehicle has booked this slot right after your session.'], 409);
    }

    $additional_cost = round($hours_to_add * (float)$res['price_per_hour'], 2);
    $new_total_cost = round((float)$res['total_cost'] + $additional_cost, 2);

    $up_ext = mysqli_prepare($conn, "UPDATE reservations SET end_time = ?, total_cost = ? WHERE id = ?");
    mysqli_stmt_bind_param($up_ext, "sdi", $new_end_time, $new_total_cost, $res['id']);
    mysqli_stmt_execute($up_ext);
    mysqli_stmt_close($up_ext);

    send_json([
        'success' => true,
        'message' => "Reservation extended by {$hours_to_add}h! New end time: " . substr($new_end_time, 0, 5) . " (Total: ৳{$new_total_cost}).",
        'new_end_time' => $new_end_time,
        'new_total_cost' => $new_total_cost
    ]);
}
