<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);

$full_name     = trim($data['full_name'] ?? '');
$email         = strtolower(trim($data['email'] ?? ''));
$phone         = trim($data['phone'] ?? '');
$password      = $data['password'] ?? '';
$role          = trim($data['role'] ?? 'driver');
$location_id   = (int) ($data['location_id'] ?? 0);
$vehicle_plate = strtoupper(trim($data['vehicle_plate'] ?? ''));

if ($full_name === '' || $email === '' || $phone === '' || $password === '') {
    send_json(['success' => false, 'message' => 'Full Name, Email, Phone, and Password are required.'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_json(['success' => false, 'message' => 'Please provide a valid email address.'], 400);
}

if (strlen($password) < 6) {
    send_json(['success' => false, 'message' => 'Password must be at least 6 characters.'], 400);
}

if (!in_array($role, ['admin', 'manager', 'driver'], true)) {
    $role = 'driver';
}

if ($role === 'manager') {
    if ($location_id <= 0) {
        send_json(['success' => false, 'message' => 'Please select an assigned parking area. Every Area Manager must be assigned to an area when created.'], 400);
    }
    $loc_chk = mysqli_query($conn, "SELECT id, name FROM parking_locations WHERE id = {$location_id} LIMIT 1");
    if (!mysqli_fetch_assoc($loc_chk)) {
        send_json(['success' => false, 'message' => 'The selected parking facility does not exist.'], 400);
    }
}

// Check email and phone uniqueness
$chk = mysqli_prepare($conn, "SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1");
mysqli_stmt_bind_param($chk, "ss", $email, $phone);
mysqli_stmt_execute($chk);
mysqli_stmt_store_result($chk);
if (mysqli_stmt_num_rows($chk) > 0) {
    mysqli_stmt_close($chk);
    send_json(['success' => false, 'message' => 'A user with this email or phone number already exists.'], 409);
}
mysqli_stmt_close($chk);

$hash = password_hash($password, PASSWORD_BCRYPT);
$mgr_loc = ($role === 'manager' && $location_id > 0) ? $location_id : null;
$plate = ($role === 'driver' && $vehicle_plate !== '') ? $vehicle_plate : null;

mysqli_begin_transaction($conn);

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO users (full_name, email, phone, vehicle_plate, password_hash, role, location_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')"
);
mysqli_stmt_bind_param($stmt, "ssssssi", $full_name, $email, $phone, $plate, $hash, $role, $mgr_loc);

if (!mysqli_stmt_execute($stmt)) {
    mysqli_rollback($conn);
    send_json(['success' => false, 'message' => 'Database error: ' . mysqli_error($conn)], 500);
}

$new_id = mysqli_insert_id($conn);
mysqli_stmt_close($stmt);

// If manager was assigned to a location, link that location to this manager
if ($role === 'manager' && $location_id > 0) {
    $up_loc = mysqli_prepare($conn, "UPDATE parking_locations SET manager_id = ? WHERE id = ?");
    mysqli_stmt_bind_param($up_loc, "ii", $new_id, $location_id);
    mysqli_stmt_execute($up_loc);
    mysqli_stmt_close($up_loc);
}

mysqli_commit($conn);

send_json([
    'success' => true,
    'message' => "Successfully created new {$role} account for {$full_name}.",
    'user' => [
        'id' => $new_id,
        'full_name' => $full_name,
        'email' => $email,
        'role' => $role
    ]
]);
