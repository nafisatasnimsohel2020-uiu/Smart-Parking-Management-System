<?php
require '../config.php';
require '../auth_guard.php';

$user = current_user();
if (!$user) {
    send_json(['success' => false, 'message' => 'Please sign in first.'], 401);
}

$my_id = (int)$user['id'];
$contact_id = (int)($_GET['contact_id'] ?? 0);

if ($contact_id <= 0) {
    send_json(['success' => false, 'message' => 'Contact ID is required.'], 400);
}

// Mark messages from this contact as read
$up = mysqli_prepare($conn, "UPDATE chat_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?");
mysqli_stmt_bind_param($up, "ii", $contact_id, $my_id);
mysqli_stmt_execute($up);
mysqli_stmt_close($up);

// Fetch conversation
$stmt = mysqli_prepare(
    $conn,
    "SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
            u.full_name AS sender_name, u.role AS sender_role
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE (m.sender_id = ? AND m.receiver_id = ?)
        OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC"
);
mysqli_stmt_bind_param($stmt, "iiii", $my_id, $contact_id, $contact_id, $my_id);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);

$messages = [];
while ($row = mysqli_fetch_assoc($res)) {
    $row['id'] = (int)$row['id'];
    $row['sender_id'] = (int)$row['sender_id'];
    $row['receiver_id'] = (int)$row['receiver_id'];
    $row['is_me'] = ($row['sender_id'] === $my_id);
    $messages[] = $row;
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'messages' => $messages]);
