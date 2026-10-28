<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$data = json_decode(file_get_contents('php://input'), true);
$booking_code = trim($data['booking_code'] ?? '');
$otp_code = trim($data['otp'] ?? '');

if ($booking_code === '' || $otp_code === '') {
    send_json(['success' => false, 'message' => 'Booking code and OTP are required.'], 400);
}

$stmt = mysqli_prepare(
    $conn,
    "SELECT id, space_id, location_id, otp_code, status FROM reservations WHERE booking_code = ? LIMIT 1"
);
mysqli_stmt_bind_param($stmt, "s", $booking_code);
mysqli_stmt_execute($stmt);
$reservation = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$reservation) {
    send_json(['success' => false, 'message' => 'Booking not found.'], 404);
}

// Facility isolation: manager can only check in vehicles for their own assigned facility
$user = current_user();
if ($user['role'] === 'manager') {
    $mgr_loc = get_manager_location_id($conn, $user);
    if ($mgr_loc <= 0 || (int)$reservation['location_id'] !== $mgr_loc) {
        send_json(['success' => false, 'message' => 'Access Denied: This booking is for a different parking area or you have no assigned facility.'], 403);
    }
}

if (!in_array($reservation['status'], ['upcoming', 'booked'], true)) {
    send_json(['success' => false, 'message' => 'This booking is not awaiting check-in.'], 409);
}

if ($otp_code !== '' && $reservation['otp_code'] !== $otp_code) {
    send_json(['success' => false, 'message' => 'Incorrect OTP code.'], 400);
}

mysqli_begin_transaction($conn);

$stmt = mysqli_prepare($conn, "UPDATE reservations SET status = 'active', checked_in_at = NOW() WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $reservation['id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

// Mark space occupied
$stmt = mysqli_prepare($conn, "UPDATE parking_spaces SET status = 'occupied' WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $reservation['space_id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

mysqli_commit($conn);

send_json(['success' => true, 'message' => 'Checked in successfully! Space marked occupied.']);
