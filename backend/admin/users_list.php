<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$role = trim($_GET['role'] ?? 'driver');
if (!in_array($role, ['driver', 'manager', 'admin'], true)) {
    $role = 'driver';
}

if ($role === 'driver') {
    $sql = "
        SELECT u.id, u.full_name, u.email, u.phone, u.uiu_id, u.vehicle_plate, u.status, u.created_at, (LENGTH(u.password_hash) >= 20) AS password_set,
               (SELECT COUNT(*) FROM reservations r WHERE r.driver_id = u.id) AS reservation_count
        FROM users u
        WHERE u.role = 'driver'
        ORDER BY u.created_at DESC
    ";
} else if ($role === 'manager') {
    $sql = "
        SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, (LENGTH(u.password_hash) >= 20) AS password_set, pl.name AS location_name,
               (SELECT COUNT(*) FROM parking_locations pl2 WHERE pl2.manager_id = u.id) AS managed_locations
        FROM users u
        LEFT JOIN parking_locations pl ON pl.id = u.location_id
        WHERE u.role = 'manager'
        ORDER BY u.created_at DESC
    ";
} else {
    $sql = "
        SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, (LENGTH(u.password_hash) >= 20) AS password_set
        FROM users u
        WHERE u.role = 'admin'
        ORDER BY u.created_at DESC
    ";
}

$result = mysqli_query($conn, $sql);
$users = [];
while ($row = mysqli_fetch_assoc($result)) {
    $users[] = $row;
}

$driver_count  = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM users WHERE role = 'driver'"))['c'];
$manager_count = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM users WHERE role = 'manager'"))['c'];
$admin_count   = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM users WHERE role = 'admin'"))['c'];

send_json([
    'success' => true,
    'role' => $role,
    'users' => $users,
    'counts' => [
        'driver' => (int) $driver_count, 
        'manager' => (int) $manager_count,
        'admin' => (int) $admin_count
    ],
]);
