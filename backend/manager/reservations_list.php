<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$user_id = current_user()['id'];

// Status filter: all | booked | upcoming | active | completed | complete | cancelled
$status = trim($_GET['status'] ?? 'all');
$allowed = ['all', 'booked', 'upcoming', 'active', 'completed', 'complete', 'cancelled'];
if (!in_array($status, $allowed, true)) {
    $status = 'all';
}

$search = trim($_GET['search'] ?? '');
$user = current_user();
$manager_loc_id = get_manager_location_id($conn, $user);

if ($user['role'] === 'manager') {
    // Strictly isolate area manager to their facility
    if ($manager_loc_id <= 0) {
        send_json(['success' => false, 'message' => 'No parking area has been assigned to your manager account. Please contact an administrator.'], 403);
    }
    $location_id = $manager_loc_id;
} else {
    $location_id = (int)($_GET['location_id'] ?? 0);
}

$sql = "SELECT r.id, r.space_id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.discount_amount,
               r.payment_method, r.payment_status, r.transaction_id, r.fine_amount, r.fine_status, r.fine_handled_at, r.refund_amount, r.cancellation_reason,
               r.status, r.otp_code, r.checked_in_at, r.checked_out_at,
               u.full_name AS driver_name, u.phone AS driver_phone,
               COALESCE(r.vehicle_plate, u.vehicle_plate, '-') AS vehicle_plate,
                pl.name AS location_name, pl.id AS location_id, pl.price_per_hour, ps.space_code
        FROM reservations r
        JOIN users u ON u.id = r.driver_id
        JOIN parking_locations pl ON pl.id = r.location_id
        JOIN parking_spaces ps ON ps.id = r.space_id
        WHERE 1=1";

if ($status === 'booked') {
    $sql .= " AND r.status = 'booked'";
} elseif ($status === 'upcoming') {
    $sql .= " AND (r.status = 'upcoming' OR (r.status = 'booked' AND (r.reserve_date > CURDATE() OR (r.reserve_date = CURDATE() AND r.start_time > CURTIME()))))";
} elseif ($status === 'active') {
    $sql .= " AND r.status = 'active'";
} elseif ($status === 'completed' || $status === 'complete') {
    $sql .= " AND r.status IN ('completed', 'complete')";
} elseif ($status === 'cancelled') {
    $sql .= " AND r.status = 'cancelled'";
}

if ($location_id > 0) {
    $sql .= " AND r.location_id = {$location_id}";
}

if ($search !== '') {
    $s = mysqli_real_escape_string($conn, $search);
    $sql .= " AND (r.booking_code LIKE '%{$s}%' OR u.full_name LIKE '%{$s}%' OR r.vehicle_plate LIKE '%{$s}%' OR ps.space_code LIKE '%{$s}%')";
}

$sql .= " ORDER BY r.reserve_date DESC, r.start_time DESC";

$result = mysqli_query($conn, $sql);
$reservations = [];

while ($row = mysqli_fetch_assoc($result)) {
    $row['total_cost'] = (float) $row['total_cost'];
    $row['discount_amount'] = (float) ($row['discount_amount'] ?? 0);
    $row['fine_amount'] = (float) ($row['fine_amount'] ?? 0);
    $row['fine_status'] = $row['fine_status'] ?? ($row['fine_amount'] > 0 ? 'pending' : 'none');
    $row['refund_amount'] = (float) ($row['refund_amount'] ?? 0);

    monitor_and_sync_overtime($conn, $row);

    $reservations[] = $row;
}

send_json(['success' => true, 'reservations' => $reservations]);
