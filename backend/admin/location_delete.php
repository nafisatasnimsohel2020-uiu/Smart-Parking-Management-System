<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$id = intval($data['id'] ?? 0);

if ($id <= 0) {
    send_json(['success' => false, 'message' => 'Valid location id is required.'], 400);
}

$stmt = mysqli_prepare($conn, "DELETE FROM parking_locations WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);
$changed = mysqli_stmt_affected_rows($stmt);
mysqli_stmt_close($stmt);

if ($changed === 0) {
    send_json(['success' => false, 'message' => 'Location not found.'], 404);
}

send_json(['success' => true, 'message' => 'Location deleted.']);
