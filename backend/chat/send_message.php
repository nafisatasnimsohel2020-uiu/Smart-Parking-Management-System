<?php
require '../config.php';
require '../auth_guard.php';

$user = current_user();
if (!$user) {
    send_json(['success' => false, 'message' => 'Please sign in first.'], 401);
}

$data = json_decode(file_get_contents('php://input'), true);

$sender_id = (int)$user['id'];
$receiver_id = (int)($data['receiver_id'] ?? 0);
$message = trim($data['message'] ?? '');

if ($receiver_id <= 0 || $message === '') {
    send_json(['success' => false, 'message' => 'Receiver and message content are required.'], 400);
}

// Check receiver exists
$chk = mysqli_prepare($conn, "SELECT id, full_name, role FROM users WHERE id = ? LIMIT 1");
mysqli_stmt_bind_param($chk, "i", $receiver_id);
mysqli_stmt_execute($chk);
$rec_user = mysqli_fetch_assoc(mysqli_stmt_get_result($chk));
mysqli_stmt_close($chk);

if (!$rec_user) {
    send_json(['success' => false, 'message' => 'Recipient not found.'], 404);
}

$stmt = mysqli_prepare($conn, "INSERT INTO chat_messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, 0)");
mysqli_stmt_bind_param($stmt, "iis", $sender_id, $receiver_id, $message);

if (!mysqli_stmt_execute($stmt)) {
    send_json(['success' => false, 'message' => 'Could not send message.'], 500);
}
$msg_id = mysqli_insert_id($conn);
mysqli_stmt_close($stmt);

send_json([
    'success' => true,
    'message' => 'Message sent.',
    'chat_message' => [
        'id' => $msg_id,
        'sender_id' => $sender_id,
        'receiver_id' => $receiver_id,
        'sender_name' => $user['full_name'],
        'sender_role' => $user['role'],
        'message' => $message,
        'is_me' => true,
        'created_at' => date('Y-m-d H:i:s')
    ]
]);
