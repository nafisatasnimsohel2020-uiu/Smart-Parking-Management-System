<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$driver_id = current_user()['id'];

$stmt = mysqli_prepare(
    $conn,
    "SELECT r.id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.discount_amount,
            r.payment_method, r.payment_status, r.transaction_id, r.fine_amount, r.refund_amount, r.cancellation_reason,
            r.vehicle_plate, r.checked_in_at, r.checked_out_at, r.status,
            pl.name AS location_name, ps.space_code,
            rt.rating AS my_rating
     FROM reservations r
     JOIN parking_locations pl ON pl.id = r.location_id
     JOIN parking_spaces ps ON ps.id = r.space_id
     LEFT JOIN ratings rt ON rt.reservation_id = r.id
     WHERE r.driver_id = ? AND r.status IN ('completed', 'complete', 'cancelled')
     ORDER BY r.reserve_date DESC, r.start_time DESC"
);
mysqli_stmt_bind_param($stmt, "i", $driver_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$history = [];
while ($row = mysqli_fetch_assoc($result)) {
    $row['total_cost'] = (float) $row['total_cost'];
    $row['discount_amount'] = (float) ($row['discount_amount'] ?? 0);
    $row['fine_amount'] = (float) ($row['fine_amount'] ?? 0);
    $row['refund_amount'] = (float) ($row['refund_amount'] ?? 0);
    $row['my_rating'] = isset($row['my_rating']) && $row['my_rating'] !== null ? (int) $row['my_rating'] : null;
    
    // Status display: "Complete" after trip finishes
    if (in_array($row['status'], ['completed', 'complete'], true)) {
        $row['display_status'] = 'Complete';
    } else {
        $row['display_status'] = 'Cancelled';
    }

    $history[] = $row;
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'history' => $history]);
