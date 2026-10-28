<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$sql = "
    SELECT pl.id, pl.name, pl.address, pl.price_per_hour, pl.total_spaces, pl.rating, pl.manager_id,
           u.full_name AS manager_name,
           (SELECT COUNT(*) FROM parking_spaces ps WHERE ps.location_id = pl.id) AS space_count,
           (SELECT COUNT(*) FROM parking_spaces ps WHERE ps.location_id = pl.id AND ps.status != 'free') AS occupied_spaces
    FROM parking_locations pl
    LEFT JOIN users u ON u.id = pl.manager_id
    ORDER BY pl.name
";
$result = mysqli_query($conn, $sql);
$locations = [];
while ($row = mysqli_fetch_assoc($result)) {
    $row['occupancy_pct'] = $row['space_count'] > 0
        ? round(($row['occupied_spaces'] / $row['space_count']) * 100)
        : 0;
    $locations[] = $row;
}

send_json(['success' => true, 'locations' => $locations]);
