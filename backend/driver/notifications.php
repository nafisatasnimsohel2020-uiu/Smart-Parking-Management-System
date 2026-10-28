<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$user = current_user();
$driver_id = (int)$user['id'];

// POST: mark read
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? 'mark_all_read';
    
    if ($action === 'mark_read') {
        $notif_id = (int)($data['id'] ?? 0);
        if ($notif_id > 0) {
            mysqli_query($conn, "UPDATE notifications SET is_read = 1 WHERE id = {$notif_id} AND user_id = {$driver_id}");
        }
    } else {
        mysqli_query($conn, "UPDATE notifications SET is_read = 1 WHERE user_id = {$driver_id}");
    }
    
    send_json(['success' => true]);
}

// GET: fetch notifications
$limit = 20;
$query = "
    SELECT id, reservation_id, booking_code, title, message, type, is_read, created_at
    FROM notifications
    WHERE user_id = {$driver_id}
    ORDER BY id DESC
    LIMIT {$limit}
";
$res = mysqli_query($conn, $query);
$notifications = [];
$unread_count = 0;

if ($res) {
    while ($row = mysqli_fetch_assoc($res)) {
        if ((int)$row['is_read'] === 0) {
            $unread_count++;
        }
        $row['time_ago'] = date('M d, h:i A', strtotime($row['created_at']));
        $notifications[] = $row;
    }
}

send_json([
    'success' => true,
    'unread_count' => $unread_count,
    'notifications' => $notifications
]);
