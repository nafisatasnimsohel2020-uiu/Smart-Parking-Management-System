<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$data = json_decode(file_get_contents('php://input'), true);

$location_id = (int) ($data['location_id'] ?? 0);
$reserve_date = trim($data['date'] ?? '');
$start_time = trim($data['start_time'] ?? '');
$end_time = trim($data['end_time'] ?? '');
$vehicle_plate = trim($data['vehicle_plate'] ?? '');
$payment_method = trim($data['payment_method'] ?? 'bKash');

$allowed_payments = ['bKash', 'Nagad', 'Rocket', 'Credit/Debit Card', 'Pay on Arrival (Cash)'];
if (!in_array($payment_method, $allowed_payments, true)) {
    $payment_method = 'bKash';
}

if ($location_id <= 0 || $reserve_date === '' || $start_time === '' || $end_time === '') {
    send_json(['success' => false, 'message' => 'Location, date and time are required.'], 400);
}

// Normalize time formats (HH:MM:SS)
if (strlen($start_time) === 5) $start_time .= ':00';
if (strlen($end_time) === 5) $end_time .= ':00';

$curr_date = date('Y-m-d');
$curr_time = date('H:i:s');

if ($reserve_date < $curr_date) {
    send_json(['success' => false, 'message' => 'Reservation date cannot be in the past.'], 400);
}

if ($reserve_date === $curr_date && $end_time <= $curr_time) {
    send_json(['success' => false, 'message' => 'The selected parking slot end time has already passed today. Please pick an upcoming time window.'], 400);
}

// Allow up to 15 minutes grace period for start_time on current date (for selection/payment process)
$grace_start = date('H:i:s', time() - 900);
if ($reserve_date === $curr_date && $start_time < $grace_start) {
    send_json(['success' => false, 'message' => 'Reservation start time cannot be in the past. Please select an upcoming time.'], 400);
}

// If start_time is slightly in the past (within 15 mins) on today, clamp to current time
if ($reserve_date === $curr_date && $start_time < $curr_time) {
    $start_time = $curr_time;
}

// Fetch location price
$stmt = mysqli_prepare($conn, "SELECT price_per_hour FROM parking_locations WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $location_id);
mysqli_stmt_execute($stmt);
$loc = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$loc) {
    send_json(['success' => false, 'message' => 'Location not found.'], 404);
}

$start_ts = strtotime($reserve_date . ' ' . $start_time);
$end_ts = strtotime($reserve_date . ' ' . $end_time);

if ($start_ts === false || $end_ts === false || $end_ts <= $start_ts) {
    send_json(['success' => false, 'message' => 'Invalid date/time range. End time must be after start time.'], 400);
}

$hours = round(($end_ts - $start_ts) / 3600, 2);
$rate = (float) $loc['price_per_hour'];

// Check dynamic pricing rule
$rule_stmt = mysqli_prepare($conn, "SELECT peak_multiplier, peak_start, peak_end, enabled FROM pricing_rules WHERE location_id = ? LIMIT 1");
mysqli_stmt_bind_param($rule_stmt, "i", $location_id);
mysqli_stmt_execute($rule_stmt);
$rule = mysqli_fetch_assoc(mysqli_stmt_get_result($rule_stmt));
mysqli_stmt_close($rule_stmt);

if ($rule && $rule['enabled']) {
    $slot_start = date('H:i:s', $start_ts);
    if ($slot_start >= $rule['peak_start'] && $slot_start <= $rule['peak_end']) {
        $rate = round($rate * (float) $rule['peak_multiplier'], 2);
    }
}

$total_cost = round($hours * $rate, 2);

$curr_user = current_user();
$driver_id = (int)$curr_user['id'];
$driver_email = strtolower($curr_user['email'] ?? '');
$driver_name = strtolower($curr_user['full_name'] ?? '');

// UIU Driver Discount: 25% OFF only for drivers who registered with a valid UIU ID.
// Anyone else (including email/name that merely contains "uiu") pays the normal price.
$uiu_stmt = mysqli_prepare($conn, "SELECT uiu_id FROM users WHERE id = ? LIMIT 1");
mysqli_stmt_bind_param($uiu_stmt, "i", $driver_id);
mysqli_stmt_execute($uiu_stmt);
$uiu_row = mysqli_fetch_assoc(mysqli_stmt_get_result($uiu_stmt));
mysqli_stmt_close($uiu_stmt);
$is_uiu = (bool)preg_match('/^011\d{7}$/', (string)($uiu_row['uiu_id'] ?? ''));
$discount_percent = 0;
$discount_amount = 0.00;
$original_cost = $total_cost;

if ($is_uiu) {
    $discount_percent = 25;
    $discount_amount = round($original_cost * 0.25, 2);
    $total_cost = round($original_cost - $discount_amount, 2);
}

// If driver didn't provide plate, check their saved profile plate
if ($vehicle_plate === '') {
    $u_stmt = mysqli_prepare($conn, "SELECT vehicle_plate FROM users WHERE id = ?");
    mysqli_stmt_bind_param($u_stmt, "i", $driver_id);
    mysqli_stmt_execute($u_stmt);
    $u_res = mysqli_fetch_assoc(mysqli_stmt_get_result($u_stmt));
    mysqli_stmt_close($u_stmt);
    $vehicle_plate = $u_res['vehicle_plate'] ?? '';
} else {
    // Save to user profile if user has no plate yet
    $u_up = mysqli_prepare($conn, "UPDATE users SET vehicle_plate = ? WHERE id = ? AND (vehicle_plate IS NULL OR vehicle_plate = '')");
    mysqli_stmt_bind_param($u_up, "si", $vehicle_plate, $driver_id);
    mysqli_stmt_execute($u_up);
    mysqli_stmt_close($u_up);
}

// Lock and check slot availability for the exact date and time window
mysqli_begin_transaction($conn);

$chosen_space_id = (int) ($data['space_id'] ?? 0);

if ($chosen_space_id > 0) {
    // Driver explicitly selected a spot - ensure it has no conflict in this window
    $stmt = mysqli_prepare(
        $conn,
        "SELECT ps.id, ps.space_code, ps.status 
         FROM parking_spaces ps 
         WHERE ps.id = ? AND ps.location_id = ? AND ps.status != 'maintenance'
           AND ps.id NOT IN (
               SELECT r.space_id 
               FROM reservations r 
               WHERE r.location_id = ? 
                 AND r.reserve_date = ? 
                 AND r.status IN ('booked', 'upcoming', 'active') 
                 AND NOT (r.end_time <= ? OR r.start_time >= ?)
           )
         LIMIT 1 FOR UPDATE"
    );
    mysqli_stmt_bind_param($stmt, "iiisss", $chosen_space_id, $location_id, $location_id, $reserve_date, $start_time, $end_time);
    mysqli_stmt_execute($stmt);
    $space = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    mysqli_stmt_close($stmt);

    if (!$space) {
        mysqli_rollback($conn);
        send_json(['success' => false, 'message' => 'The selected parking slot is already booked for this date and time window. Booking cannot be completed. Please pick a free slot.'], 409);
    }
} else {
    // Auto-pick first available space with no conflict in this time window
    $stmt = mysqli_prepare(
        $conn,
        "SELECT ps.id, ps.space_code, ps.status 
         FROM parking_spaces ps 
         WHERE ps.location_id = ? AND ps.status != 'maintenance'
           AND ps.id NOT IN (
               SELECT r.space_id 
               FROM reservations r 
               WHERE r.location_id = ? 
                 AND r.reserve_date = ? 
                 AND r.status IN ('booked', 'upcoming', 'active') 
                 AND NOT (r.end_time <= ? OR r.start_time >= ?)
           )
         ORDER BY ps.space_code ASC
         LIMIT 1 FOR UPDATE"
    );
    mysqli_stmt_bind_param($stmt, "iisss", $location_id, $location_id, $reserve_date, $start_time, $end_time);
    mysqli_stmt_execute($stmt);
    $space = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
    mysqli_stmt_close($stmt);

    if (!$space) {
        mysqli_rollback($conn);
        send_json(['success' => false, 'message' => 'No parking slots are available for the selected date and time window. Booking cannot be completed.'], 409);
    }
}

// If reservation is for right now/today, mark space reserved in parking_spaces
if ($reserve_date === $curr_date && $start_time <= $curr_time) {
    $sp_up = mysqli_prepare($conn, "UPDATE parking_spaces SET status = 'reserved' WHERE id = ?");
    mysqli_stmt_bind_param($sp_up, "i", $space['id']);
    mysqli_stmt_execute($sp_up);
    mysqli_stmt_close($sp_up);
}

$booking_code = generate_code('R', $conn, 'reservations', 'booking_code');
$otp_code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
$transaction_id = 'TXN-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
$payment_status = ($payment_method === 'Pay on Arrival (Cash)') ? 'pending' : 'paid';

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO reservations
        (booking_code, driver_id, location_id, space_id, vehicle_plate, reserve_date, start_time, end_time, total_cost, discount_amount, payment_method, payment_status, transaction_id, otp_code, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked')"
);
mysqli_stmt_bind_param(
    $stmt,
    "siiissssddssss",
    $booking_code, $driver_id, $location_id, $space['id'], $vehicle_plate, $reserve_date, $start_time, $end_time, $total_cost, $discount_amount, $payment_method, $payment_status, $transaction_id, $otp_code
);

if (!mysqli_stmt_execute($stmt)) {
    mysqli_rollback($conn);
    send_json(['success' => false, 'message' => 'Could not create reservation: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);
mysqli_commit($conn);

send_json([
    'success' => true,
    'message' => 'Reservation confirmed! Status: Booked.' . ($discount_amount > 0 ? ' (UIU Student/Faculty 25% Discount Applied!)' : ''),
    'reservation' => [
        'booking_code'    => $booking_code,
        'space_code'      => $space['space_code'],
        'vehicle_plate'   => $vehicle_plate,
        'reserve_date'    => $reserve_date,
        'start_time'      => $start_time,
        'end_time'        => $end_time,
        'original_cost'   => $original_cost,
        'discount_amount' => $discount_amount,
        'is_uiu_discount' => ($discount_amount > 0),
        'total_cost'      => $total_cost,
        'payment_method'  => $payment_method,
        'payment_status'  => $payment_status,
        'transaction_id'  => $transaction_id,
        'otp_code'        => $otp_code,
        'status'          => 'Booked'
    ],
]);
