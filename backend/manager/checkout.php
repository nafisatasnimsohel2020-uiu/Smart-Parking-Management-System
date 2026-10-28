<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$data = json_decode(file_get_contents('php://input'), true);
$booking_code = trim($data['booking_code'] ?? '');
$otp = trim($data['otp'] ?? '');

if ($booking_code === '') {
    send_json(['success' => false, 'message' => 'Booking code is required.'], 400);
}

$stmt = mysqli_prepare($conn, "
    SELECT r.id, r.driver_id, r.space_id, r.location_id, r.otp_code, r.status, r.reserve_date, r.start_time, r.end_time, r.fine_amount, r.fine_status,
           r.booking_code, r.vehicle_plate,
           ps.space_code, pl.price_per_hour
    FROM reservations r
    JOIN parking_locations pl ON pl.id = r.location_id
    JOIN parking_spaces ps ON ps.id = r.space_id
    WHERE r.booking_code = ? 
    LIMIT 1
");
mysqli_stmt_bind_param($stmt, "s", $booking_code);
mysqli_stmt_execute($stmt);
$reservation = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$reservation) {
    send_json(['success' => false, 'message' => 'Booking not found.'], 404);
}

// Facility isolation: manager can only check out vehicles in their own assigned facility
$user = current_user();
if ($user['role'] === 'manager') {
    $mgr_loc = get_manager_location_id($conn, $user);
    if ($mgr_loc <= 0 || (int)$reservation['location_id'] !== $mgr_loc) {
        send_json(['success' => false, 'message' => 'Access Denied: This vehicle is parked in another facility or you have no assigned facility.'], 403);
    }
}

if ($reservation['status'] !== 'active') {
    send_json(['success' => false, 'message' => 'This booking is not currently active.'], 409);
}

if ($otp !== '' && $otp !== $reservation['otp_code']) {
    send_json(['success' => false, 'message' => 'Incorrect OTP code.'], 400);
}

$now_ts = time();
$checkout_data = finalize_checkout_overtime($conn, $reservation, $now_ts);
$is_overtime = $checkout_data['is_overtime'];
$overtime_minutes = $checkout_data['overtime_minutes'];
$final_fine = $checkout_data['final_fine'];
$checkout_msg = $checkout_data['checkout_msg'];
$has_conflict = $checkout_data['has_conflict'];

mysqli_begin_transaction($conn);

$p_stat = $final_fine > 0 ? 'fine_applied' : 'paid';
$manager_id = (int)current_user()['id'];
$f_status = $final_fine > 0 ? 'collected' : 'none';
$stmt = mysqli_prepare($conn, "UPDATE reservations SET status = 'completed', checked_out_at = NOW(), fine_amount = ?, payment_status = ?, fine_status = ?, fine_handled_at = CASE WHEN ? > 0 THEN NOW() ELSE fine_handled_at END, fine_handled_by = CASE WHEN ? > 0 THEN ? ELSE fine_handled_by END WHERE id = ?");
mysqli_stmt_bind_param($stmt, "dssiiii", $final_fine, $p_stat, $f_status, $final_fine, $final_fine, $manager_id, $reservation['id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

$stmt = mysqli_prepare($conn, "UPDATE parking_spaces SET status = 'free' WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $reservation['space_id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

mysqli_commit($conn);

send_json([
    'success' => true,
    'message' => $checkout_msg,
    'is_overtime' => $is_overtime,
    'overtime_minutes' => $overtime_minutes,
    'fine_amount' => $final_fine,
    'fine_status' => $f_status,
    'has_conflict' => $has_conflict
]);
