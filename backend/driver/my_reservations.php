<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$driver_id = current_user()['id'];
$status = trim($_GET['status'] ?? 'all');
$allowed_statuses = ['all', 'active', 'booked', 'upcoming', 'complete', 'completed', 'cancelled'];
if (!in_array($status, $allowed_statuses, true)) {
    $status = 'all';
}

$today = date('Y-m-d');
$now_time = date('H:i:s');

// Base query
$sql = "
    SELECT r.id, r.driver_id, r.space_id, r.location_id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.discount_amount, 
           r.payment_method, r.payment_status, r.transaction_id, r.fine_amount, r.fine_status, r.fine_handled_at, r.refund_amount, 
           r.cancellation_reason, r.vehicle_plate, r.status, r.otp_code, r.checked_in_at, r.checked_out_at,
           pl.name AS location_name, pl.address AS location_address, pl.price_per_hour, ps.space_code
    FROM reservations r
    LEFT JOIN parking_locations pl ON pl.id = r.location_id
    LEFT JOIN parking_spaces ps ON ps.id = r.space_id
    WHERE r.driver_id = ?
";

if ($status === 'active') {
    $sql .= " AND r.status = 'active'";
} elseif ($status === 'booked') {
    $sql .= " AND r.status = 'booked'";
} elseif ($status === 'upcoming') {
    $sql .= " AND (r.status = 'upcoming' OR (r.status = 'booked' AND (r.reserve_date > '{$today}' OR (r.reserve_date = '{$today}' AND r.start_time > '{$now_time}'))))";
} elseif ($status === 'complete' || $status === 'completed') {
    $sql .= " AND r.status IN ('completed', 'complete')";
} elseif ($status === 'cancelled') {
    $sql .= " AND r.status = 'cancelled'";
}

$sql .= "
    ORDER BY 
        CASE 
            WHEN r.status = 'active' THEN 1
            WHEN r.status = 'booked' THEN 2
            WHEN r.status = 'upcoming' THEN 3
            WHEN r.status IN ('completed', 'complete') THEN 4
            WHEN r.status = 'cancelled' THEN 5
            ELSE 6 
        END ASC,
        r.reserve_date DESC, r.start_time DESC
";

$stmt = mysqli_prepare($conn, $sql);
mysqli_stmt_bind_param($stmt, "i", $driver_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$reservations = [];
while ($row = mysqli_fetch_assoc($result)) {
    $row['total_cost'] = (float) $row['total_cost'];
    $row['discount_amount'] = (float) ($row['discount_amount'] ?? 0);
    $row['fine_amount'] = (float) ($row['fine_amount'] ?? 0);
    $row['fine_status'] = $row['fine_status'] ?? ($row['fine_amount'] > 0 ? 'pending' : 'none');
    $row['refund_amount'] = (float) ($row['refund_amount'] ?? 0);
    $row['location_name'] = $row['location_name'] ?: 'Parking Location';
    $row['space_code'] = $row['space_code'] ?: ('Space #' . (int)$row['space_id']);
    $row['display_status'] = $row['status'];

    monitor_and_sync_overtime($conn, $row);

    $reservations[] = $row;
}
mysqli_stmt_close($stmt);

// Calculate counts per status for tab badges
$counts_stmt = mysqli_prepare($conn, "
    SELECT 
        COUNT(*) AS total_all,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS count_active,
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS count_booked,
        SUM(CASE WHEN (status = 'upcoming' OR (status = 'booked' AND (reserve_date > CURDATE() OR (reserve_date = CURDATE() AND start_time > CURTIME())))) THEN 1 ELSE 0 END) AS count_upcoming,
        SUM(CASE WHEN status IN ('completed', 'complete') THEN 1 ELSE 0 END) AS count_complete,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS count_cancelled
    FROM reservations
    WHERE driver_id = ?
");
mysqli_stmt_bind_param($counts_stmt, "i", $driver_id);
mysqli_stmt_execute($counts_stmt);
$counts_row = mysqli_fetch_assoc(mysqli_stmt_get_result($counts_stmt)) ?: [];
mysqli_stmt_close($counts_stmt);

$counts = [
    'all' => (int) ($counts_row['total_all'] ?? 0),
    'active' => (int) ($counts_row['count_active'] ?? 0),
    'booked' => (int) ($counts_row['count_booked'] ?? 0),
    'upcoming' => (int) ($counts_row['count_upcoming'] ?? 0),
    'complete' => (int) ($counts_row['count_complete'] ?? 0),
    'cancelled' => (int) ($counts_row['count_cancelled'] ?? 0)
];

send_json([
    'success' => true, 
    'reservations' => $reservations,
    'counts' => $counts
]);
