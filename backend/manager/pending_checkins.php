<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$user = current_user();
$manager_loc_id = get_manager_location_id($conn, $user);

$sql = "SELECT r.booking_code, r.reserve_date, r.start_time, r.end_time, r.vehicle_plate, r.status, u.full_name AS driver_name, COALESCE(r.vehicle_plate, u.vehicle_plate, '-') AS driver_plate, ps.space_code, pl.name AS location_name
        FROM reservations r
        JOIN users u ON u.id = r.driver_id
        JOIN parking_spaces ps ON ps.id = r.space_id
        JOIN parking_locations pl ON pl.id = r.location_id
        WHERE r.status IN ('upcoming', 'booked') AND r.reserve_date >= CURDATE()";

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

$sql .= " ORDER BY r.start_time ASC";

$result = mysqli_query($conn, $sql);
$pending = [];
while ($row = mysqli_fetch_assoc($result)) {
    $pending[] = $row;
}

send_json(['success' => true, 'pending' => $pending]);
