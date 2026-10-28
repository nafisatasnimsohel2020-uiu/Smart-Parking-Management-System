<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

function scalar($conn, $sql) {
    $row = mysqli_fetch_assoc(mysqli_query($conn, $sql));
    return $row ? array_values($row)[0] : 0;
}

$revenue_this_month = scalar($conn, "
    SELECT COALESCE(SUM(total_cost),0) FROM reservations
    WHERE status IN ('active','completed')
      AND MONTH(reserve_date) = MONTH(CURDATE()) AND YEAR(reserve_date) = YEAR(CURDATE())
");

$active_reservations = scalar($conn, "SELECT COUNT(*) FROM reservations WHERE status = 'active'");
$registered_drivers  = scalar($conn, "SELECT COUNT(*) FROM users WHERE role = 'driver'");
$locations_count     = scalar($conn, "SELECT COUNT(*) FROM parking_locations");
$open_violations     = scalar($conn, "SELECT COUNT(*) FROM violations WHERE status = 'open'");

$occ = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS total, SUM(status != 'free') AS occupied FROM parking_spaces
"));
$avg_occupancy = ($occ && $occ['total'] > 0) ? round(($occ['occupied'] / $occ['total']) * 100) : 0;

$recent = [];
$result = mysqli_query($conn, "
    SELECT r.booking_code, u.full_name AS driver_name, pl.name AS location_name, ps.space_code,
           r.start_time, r.end_time, r.status, r.total_cost, r.discount_amount
    FROM reservations r
    JOIN users u ON u.id = r.driver_id
    JOIN parking_locations pl ON pl.id = r.location_id
    JOIN parking_spaces ps ON ps.id = r.space_id
    ORDER BY r.created_at DESC
    LIMIT 10
");
while ($row = mysqli_fetch_assoc($result)) {
    $recent[] = $row;
}

send_json([
    'success' => true,
    'metrics' => [
        'revenue_this_month'  => (float) $revenue_this_month,
        'active_reservations' => (int) $active_reservations,
        'registered_drivers'  => (int) $registered_drivers,
        'parking_locations'   => (int) $locations_count,
        'open_violations'     => (int) $open_violations,
        'avg_occupancy'       => (int) $avg_occupancy,
    ],
    'recent_reservations' => $recent,
]);
