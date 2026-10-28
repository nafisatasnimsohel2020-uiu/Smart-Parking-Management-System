<?php
require 'config.php';

// Release expired reservations and auto-free spaces
auto_release_expired_spaces($conn);

// Count current stats
$free_spaces = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM parking_spaces WHERE status = 'free'"))['c'] ?? 0);
$reserved_spaces = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM parking_spaces WHERE status = 'reserved'"))['c'] ?? 0);
$occupied_spaces = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM parking_spaces WHERE status = 'occupied'"))['c'] ?? 0);
$active_res = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS c FROM reservations WHERE status IN ('upcoming', 'active')"))['c'] ?? 0);

send_json([
    'success' => true,
    'message' => 'Spaces and reservations synchronized successfully.',
    'server_time' => date('Y-m-d H:i:s'),
    'counts' => [
        'free' => $free_spaces,
        'reserved' => $reserved_spaces,
        'occupied' => $occupied_spaces,
        'active_reservations' => $active_res
    ]
]);
