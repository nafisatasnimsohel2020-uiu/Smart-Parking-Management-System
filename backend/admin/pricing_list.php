<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$sql = "
    SELECT pl.id AS location_id, pl.name, pl.price_per_hour,
           pr.peak_multiplier, pr.peak_start, pr.peak_end, pr.occupancy_threshold, pr.enabled
    FROM parking_locations pl
    LEFT JOIN pricing_rules pr ON pr.location_id = pl.id
    ORDER BY pl.name
";
$result = mysqli_query($conn, $sql);
$rows = [];
while ($row = mysqli_fetch_assoc($result)) {
    if ($row['peak_multiplier'] === null) {
        $row['peak_multiplier']      = '1.25';
        $row['peak_start']           = '08:00:00';
        $row['peak_end']             = '11:00:00';
        $row['occupancy_threshold']  = 75;
        $row['enabled']              = 1;
        $row['is_default']           = true;
    } else {
        $row['is_default'] = false;
    }
    $rows[] = $row;
}

send_json(['success' => true, 'pricing' => $rows]);
