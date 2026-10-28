<?php
require '../config.php';
require '../auth_guard.php';

$user = current_user();
if (!$user) {
    send_json(['success' => false, 'message' => 'Please sign in first.'], 401);
}

$my_id = (int)$user['id'];
$my_role = $user['role'];

if ($my_role === 'driver') {
    // Drivers see all facility managers with their assigned location name
    $sql = "SELECT u.id, u.full_name, u.email, u.phone, 'manager' AS role,
                   COALESCE(pl.name, 'Dhaka Facility') AS location_name,
                   (SELECT COUNT(*) FROM chat_messages m WHERE m.sender_id = u.id AND m.receiver_id = {$my_id} AND m.is_read = 0) AS unread_count,
                   (SELECT message FROM chat_messages m WHERE (m.sender_id = u.id AND m.receiver_id = {$my_id}) OR (m.sender_id = {$my_id} AND m.receiver_id = u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM chat_messages m WHERE (m.sender_id = u.id AND m.receiver_id = {$my_id}) OR (m.sender_id = {$my_id} AND m.receiver_id = u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message_time
            FROM users u
            LEFT JOIN parking_locations pl ON (pl.manager_id = u.id OR pl.id = u.location_id)
            WHERE u.role = 'manager' AND u.status = 'active'
            ORDER BY last_message_time DESC, u.full_name ASC";
} else {
    // Area managers see drivers associated with their location or messages
    $manager_loc = get_manager_location_id($conn, $user);
    $where_extra = "";
    if ($manager_loc > 0) {
        $has_local = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM reservations WHERE location_id = {$manager_loc}"))['c'] ?? 0);
        if ($has_local > 0) {
            $where_extra = "AND (
                u.id IN (SELECT driver_id FROM reservations WHERE location_id = {$manager_loc})
                OR u.id IN (SELECT sender_id FROM chat_messages WHERE receiver_id = {$my_id})
                OR u.id IN (SELECT receiver_id FROM chat_messages WHERE sender_id = {$my_id})
            )";
        }
    }

    $sql = "SELECT DISTINCT u.id, u.full_name, u.email, u.phone, COALESCE(u.vehicle_plate, '-') AS vehicle_plate, 'driver' AS role,
                   (SELECT COUNT(*) FROM chat_messages m WHERE m.sender_id = u.id AND m.receiver_id = {$my_id} AND m.is_read = 0) AS unread_count,
                   (SELECT message FROM chat_messages m WHERE (m.sender_id = u.id AND m.receiver_id = {$my_id}) OR (m.sender_id = {$my_id} AND m.receiver_id = u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM chat_messages m WHERE (m.sender_id = u.id AND m.receiver_id = {$my_id}) OR (m.sender_id = {$my_id} AND m.receiver_id = u.id) ORDER BY m.created_at DESC LIMIT 1) AS last_message_time
            FROM users u
            WHERE u.role = 'driver' AND u.status = 'active' {$where_extra}
            ORDER BY last_message_time DESC, u.full_name ASC";
}

$result = mysqli_query($conn, $sql);
$contacts = [];
while ($row = mysqli_fetch_assoc($result)) {
    $row['id'] = (int)$row['id'];
    $row['unread_count'] = (int)$row['unread_count'];
    $contacts[] = $row;
}

send_json(['success' => true, 'contacts' => $contacts]);
