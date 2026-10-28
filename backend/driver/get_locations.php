<?php
require '../config.php';

// Publicly accessible so Guests and Drivers can both view live parking availability and rates
$sql = "SELECT
            pl.id, pl.name, pl.address, pl.price_per_hour, pl.total_spaces, pl.rating,
            (SELECT COUNT(*) FROM parking_spaces ps WHERE ps.location_id = pl.id AND ps.status = 'free') AS available_spaces,
            (SELECT COUNT(*) FROM parking_spaces ps WHERE ps.location_id = pl.id AND ps.status = 'occupied') AS occupied_spaces
        FROM parking_locations pl
        ORDER BY LOWER(TRIM(pl.name)), pl.id";

$result = mysqli_query($conn, $sql);
$locations = [];
$seen_location_names = [];

while ($row = mysqli_fetch_assoc($result)) {
    $row['id'] = (int) $row['id'];
    $row['price_per_hour'] = (float) $row['price_per_hour'];
    $row['total_spaces'] = (int) $row['total_spaces'];
    $row['available_spaces'] = (int) $row['available_spaces'];
    $row['occupied_spaces'] = (int) $row['occupied_spaces'];
    $row['rating'] = (float) $row['rating'];
    // Defensive de-duplication by normalized location name for older databases.
    $norm_name = strtolower(trim($row['name']));
    if (isset($seen_location_names[$norm_name])) { continue; }
    $seen_location_names[$norm_name] = true;
    $locations[] = $row;
}

send_json(['success' => true, 'locations' => $locations]);
