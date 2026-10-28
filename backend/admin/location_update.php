<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$id         = intval($data['id'] ?? 0);
$name       = trim($data['name'] ?? '');
$address    = trim($data['address'] ?? '');
$price      = floatval($data['price_per_hour'] ?? 0);
$manager_id = (isset($data['manager_id']) && $data['manager_id'] !== '') ? intval($data['manager_id']) : null;

if ($id <= 0 || $name === '' || $address === '' || $price <= 0) {
    send_json(['success' => false, 'message' => 'Valid id, name, address and price are required.'], 400);
}

$stmt = mysqli_prepare($conn, "UPDATE parking_locations SET name = ?, address = ?, price_per_hour = ?, manager_id = ? WHERE id = ?");
mysqli_stmt_bind_param($stmt, "ssdii", $name, $address, $price, $manager_id, $id);
mysqli_stmt_execute($stmt);
$changed = mysqli_stmt_affected_rows($stmt);
mysqli_stmt_close($stmt);

if ($changed === -1) {
    send_json(['success' => false, 'message' => 'Could not update location: ' . mysqli_error($conn)], 500);
}

if ($manager_id) {
    mysqli_query($conn, "UPDATE users SET location_id = {$id} WHERE id = {$manager_id}");
}

send_json(['success' => true, 'message' => 'Location updated.']);
