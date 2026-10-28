<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$user_id = intval($data['user_id'] ?? 0);
$status  = trim($data['status'] ?? '');

if ($user_id <= 0 || !in_array($status, ['active', 'pending', 'blocked'], true)) {
    send_json(['success' => false, 'message' => 'A valid user_id and status are required.'], 400);
}

// Security: Administrator cannot suspend or change status of their own account
$current_admin = current_user();
if (!empty($current_admin['id']) && $user_id === (int)$current_admin['id']) {
    send_json(['success' => false, 'message' => 'Action Denied: You cannot suspend or modify the status of your own administrator account.'], 403);
}

$stmt = mysqli_prepare($conn, "UPDATE users SET status = ? WHERE id = ? AND role IN ('driver', 'manager')");
mysqli_stmt_bind_param($stmt, "si", $status, $user_id);
mysqli_stmt_execute($stmt);
$changed = mysqli_stmt_affected_rows($stmt);
mysqli_stmt_close($stmt);

if ($changed === 0) {
    // Check if user exists but status was already identical
    $chk_exist = mysqli_query($conn, "SELECT id, role, location_id, status FROM users WHERE id = {$user_id} LIMIT 1");
    $u_row = mysqli_fetch_assoc($chk_exist);
    if (!$u_row) {
        send_json(['success' => false, 'message' => 'User not found.'], 404);
    }
} else {
    $chk_exist = mysqli_query($conn, "SELECT id, role, location_id, status FROM users WHERE id = {$user_id} LIMIT 1");
    $u_row = mysqli_fetch_assoc($chk_exist);
}

// When approving/activating a manager, synchronize facility manager_id
if ($status === 'active' && !empty($u_row) && $u_row['role'] === 'manager' && !empty($u_row['location_id'])) {
    $loc_id = (int)$u_row['location_id'];
    mysqli_query($conn, "UPDATE parking_locations SET manager_id = {$user_id} WHERE id = {$loc_id}");
}

send_json(['success' => true, 'message' => 'User status updated successfully.']);
