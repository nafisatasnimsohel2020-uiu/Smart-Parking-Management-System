<?php
require '../config.php';

// Total parking locations
$loc_res = mysqli_query($conn, "SELECT COUNT(*) AS c, COALESCE(SUM(total_spaces), 0) AS spaces, AVG(rating) AS avg_rating FROM parking_locations");
$loc_row = mysqli_fetch_assoc($loc_res);

// Active drivers
$driver_res = mysqli_query($conn, "SELECT COUNT(*) AS c FROM users WHERE role = 'driver' AND status = 'active'");
$driver_row = mysqli_fetch_assoc($driver_res);

// Prefer the real average from individual driver ratings when any exist;
// otherwise fall back to each location's own rating column (seeded default).
$real_avg_res = mysqli_query($conn, "SELECT AVG(rating) AS avg_rating, COUNT(*) AS c FROM ratings");
$real_avg_row = mysqli_fetch_assoc($real_avg_res);

$avg_rating = ($real_avg_row && (int)$real_avg_row['c'] > 0)
    ? (float) $real_avg_row['avg_rating']
    : (float) ($loc_row['avg_rating'] ?? 0);

send_json([
    'success' => true,
    'stats' => [
        'total_locations' => (int) ($loc_row['c'] ?? 0),
        'total_spaces'    => (int) ($loc_row['spaces'] ?? 0),
        'active_drivers'  => (int) ($driver_row['c'] ?? 0),
        'avg_rating'      => round($avg_rating, 1),
    ]
]);
