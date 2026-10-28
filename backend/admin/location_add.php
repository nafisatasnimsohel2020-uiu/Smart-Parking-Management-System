<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$name         = trim($data['name'] ?? '');
$address      = trim($data['address'] ?? '');
$price        = floatval($data['price_per_hour'] ?? 0);
$total_spaces = intval($data['total_spaces'] ?? 0);
$manager_id   = (isset($data['manager_id']) && $data['manager_id'] !== '') ? intval($data['manager_id']) : null;

if ($name === '' || $address === '' || $price <= 0 || $total_spaces <= 0 || $total_spaces > 500) {
    send_json(['success' => false, 'message' => 'Name, address, a positive price and 1-500 spaces are required.'], 400);
}

mysqli_begin_transaction($conn);

$stmt = mysqli_prepare($conn, "INSERT INTO parking_locations (name, address, price_per_hour, total_spaces, manager_id) VALUES (?, ?, ?, ?, ?)");
mysqli_stmt_bind_param($stmt, "ssdii", $name, $address, $price, $total_spaces, $manager_id);

if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    mysqli_rollback($conn);
    send_json(['success' => false, 'message' => 'Could not add location: ' . mysqli_error($conn)], 500);
}
$location_id = mysqli_insert_id($conn);
mysqli_stmt_close($stmt);

$stmt2 = mysqli_prepare($conn, "INSERT INTO parking_spaces (location_id, space_code, status) VALUES (?, ?, 'free')");
for ($i = 1; $i <= $total_spaces; $i++) {
    $code = 'A-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
    mysqli_stmt_bind_param($stmt2, "is", $location_id, $code);
    if (!mysqli_stmt_execute($stmt2)) {
        mysqli_stmt_close($stmt2);
        mysqli_rollback($conn);
        send_json(['success' => false, 'message' => 'Could not create parking spaces: ' . mysqli_error($conn)], 500);
    }
}
mysqli_stmt_close($stmt2);
if ($manager_id) {
    mysqli_query($conn, "UPDATE users SET location_id = {$location_id} WHERE id = {$manager_id}");
}
mysqli_commit($conn);

send_json(['success' => true, 'message' => 'Location added.', 'location_id' => $location_id]);
