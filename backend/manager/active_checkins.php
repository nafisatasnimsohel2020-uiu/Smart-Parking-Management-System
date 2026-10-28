<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$user = current_user();
$user_id = $user['id'];
$manager_loc_id = get_manager_location_id($conn, $user);

$sql = "SELECT r.id, r.space_id, r.location_id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.checked_in_at, r.otp_code, r.fine_amount, r.status,
               u.full_name AS driver_name, COALESCE(r.vehicle_plate, u.vehicle_plate, '-') AS vehicle_plate,
               ps.space_code, pl.name AS location_name, pl.price_per_hour
        FROM reservations r
        JOIN users u ON u.id = r.driver_id
        JOIN parking_spaces ps ON ps.id = r.space_id
        JOIN parking_locations pl ON pl.id = r.location_id
        WHERE r.status = 'active'";

if ($user['role'] === 'manager') {
    if ($manager_loc_id <= 0) {
        send_json(['success' => false, 'message' => 'No parking area assigned to your manager account.'], 403);
    }
    $sql .= " AND r.location_id = {$manager_loc_id}";
} elseif (!empty($_GET['location_id'])) {
    $loc_id = (int)$_GET['location_id'];
    if ($loc_id > 0) {
        $sql .= " AND r.location_id = {$loc_id}";
    }
}
$sql .= " ORDER BY r.checked_in_at DESC";

$result = mysqli_query($conn, $sql);
$active = [];

while ($row = mysqli_fetch_assoc($result)) {
    $row['fine_amount'] = (float)($row['fine_amount'] ?? 0);
    monitor_and_sync_overtime($conn, $row);
    $active[] = $row;
}

send_json(['success' => true, 'active' => $active]);
