<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$user_id      = intval($data['user_id'] ?? 0);
$new_password = (string)($data['new_password'] ?? '');

if ($user_id <= 0) {
    send_json(['success' => false, 'message' => 'A valid user_id is required.'], 400);
}
if (strlen($new_password) < 6) {
    send_json(['success' => false, 'message' => 'Password must be at least 6 characters.'], 400);
}

// Only the bcrypt hash is ever stored; the plain password is never saved.
$hash = password_hash($new_password, PASSWORD_BCRYPT);
$stmt = mysqli_prepare($conn, "UPDATE users SET password_hash = ? WHERE id = ? AND role IN ('driver', 'manager')");
mysqli_stmt_bind_param($stmt, "si", $hash, $user_id);
mysqli_stmt_execute($stmt);
$changed = mysqli_stmt_affected_rows($stmt);
mysqli_stmt_close($stmt);

if ($changed < 1) {
    send_json(['success' => false, 'message' => 'User not found.'], 404);
}

send_json(['success' => true, 'message' => 'Password reset successfully.']);
