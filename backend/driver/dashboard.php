<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$driver_id = current_user()['id'];

// 1. Current active or next upcoming reservation
$active_stmt = mysqli_prepare(
    $conn,
    "SELECT r.id, r.space_id, r.location_id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.discount_amount, r.fine_amount,
            r.payment_method, r.payment_status, r.transaction_id, r.vehicle_plate, r.otp_code, r.status,
            pl.name AS location_name, pl.address, pl.price_per_hour, ps.space_code
     FROM reservations r
     JOIN parking_locations pl ON pl.id = r.location_id
     JOIN parking_spaces ps ON ps.id = r.space_id
     WHERE r.driver_id = ? AND r.status IN ('active', 'upcoming', 'booked')
     ORDER BY CASE WHEN r.status = 'active' THEN 0 ELSE 1 END, r.reserve_date ASC, r.start_time ASC
     LIMIT 1"
);
mysqli_stmt_bind_param($active_stmt, "i", $driver_id);
mysqli_stmt_execute($active_stmt);
$active_res = mysqli_fetch_assoc(mysqli_stmt_get_result($active_stmt));
if ($active_res) {
    $active_res['total_cost'] = (float) $active_res['total_cost'];
    $active_res['discount_amount'] = (float) ($active_res['discount_amount'] ?? 0);
    $active_res['fine_amount'] = (float) ($active_res['fine_amount'] ?? 0);
    monitor_and_sync_overtime($conn, $active_res);
}
mysqli_stmt_close($active_stmt);

// 2. Statistics
$stats_stmt = mysqli_prepare(
    $conn,
    "SELECT 
        COUNT(*) AS total_reservations,
        COALESCE(SUM(CASE WHEN status IN ('completed', 'complete') THEN TIMESTAMPDIFF(MINUTE, CONCAT(reserve_date,' ',start_time), CONCAT(reserve_date,' ',end_time))/60 ELSE 0 END), 0) AS hours_parked,
        COUNT(DISTINCT location_id) AS locations_used
     FROM reservations
     WHERE driver_id = ?"
);
mysqli_stmt_bind_param($stats_stmt, "i", $driver_id);
mysqli_stmt_execute($stats_stmt);
$stats = mysqli_fetch_assoc(mysqli_stmt_get_result($stats_stmt));
mysqli_stmt_close($stats_stmt);

// 3. Recent activity list
$act_stmt = mysqli_prepare(
    $conn,
    "SELECT r.booking_code, r.status, r.reserve_date, r.start_time, r.end_time, r.created_at,
            pl.name AS location_name, ps.space_code
     FROM reservations r
     JOIN parking_locations pl ON pl.id = r.location_id
     JOIN parking_spaces ps ON ps.id = r.space_id
     WHERE r.driver_id = ?
     ORDER BY r.created_at DESC
     LIMIT 5"
);
mysqli_stmt_bind_param($act_stmt, "i", $driver_id);
mysqli_stmt_execute($act_stmt);
$act_res = mysqli_stmt_get_result($act_stmt);
$recent_activity = [];
while ($row = mysqli_fetch_assoc($act_res)) {
    $recent_activity[] = $row;
}
mysqli_stmt_close($act_stmt);

send_json([
    'success' => true,
    'driver' => current_user(),
    'active_reservation' => $active_res,
    'stats' => [
        'total_reservations' => (int) $stats['total_reservations'],
        'hours_parked' => round((float) $stats['hours_parked'], 1),
        'locations_used' => (int) $stats['locations_used'],
        'avg_rating' => 4.8
    ],
    'recent_activity' => $recent_activity
]);
