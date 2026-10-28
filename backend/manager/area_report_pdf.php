<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);
require '../pdf_helper.php';

$user = current_user();
$user_id = $user['id'];
$manager_loc_id = get_manager_location_id($conn, $user);

$loc = null;
if ($user['role'] === 'manager') {
    if ($manager_loc_id <= 0) {
        exit('Access denied: No parking area assigned to your manager account.');
    }
    $loc_stmt = mysqli_prepare($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations WHERE id = ? LIMIT 1");
    mysqli_stmt_bind_param($loc_stmt, "i", $manager_loc_id);
    mysqli_stmt_execute($loc_stmt);
    $loc = mysqli_fetch_assoc(mysqli_stmt_get_result($loc_stmt));
    mysqli_stmt_close($loc_stmt);
    if (!$loc) {
        exit('Assigned parking area was not found.');
    }
} else {
    $loc_id_req = (int)($_GET['location_id'] ?? 0);
    if ($loc_id_req > 0) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations WHERE id = {$loc_id_req} LIMIT 1"));
    }
    if (!$loc) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations ORDER BY id ASC LIMIT 1"));
    }
}
if (!$loc) {
    exit('No parking locations found.');
}
$loc_id = (int)$loc['id'];

function tk($n) {
    return 'Tk ' . number_format((float) $n, 2);
}

// Metrics for this location
$m = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT 
        COALESCE(SUM(total_cost), 0) AS total_revenue,
        COUNT(*) AS total_reservations,
        SUM(status = 'active') AS active_count,
        SUM(status = 'completed') AS completed_count,
        SUM(status = 'cancelled') AS cancelled_count
    FROM reservations
    WHERE location_id = {$loc_id}
"));

// Violations summary
$v = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT 
        COUNT(*) AS total_violations,
        SUM(status = 'open') AS open_violations,
        SUM(status = 'resolved') AS resolved_violations
    FROM violations
    WHERE location_id = {$loc_id}
"));

// Most utilized spaces
$top_spaces_res = mysqli_query($conn, "
    SELECT ps.space_code, COUNT(r.id) AS bookings, COALESCE(SUM(r.total_cost), 0) AS space_rev
    FROM parking_spaces ps
    LEFT JOIN reservations r ON r.space_id = ps.id
    WHERE ps.location_id = {$loc_id}
    GROUP BY ps.id, ps.space_code
    ORDER BY bookings DESC
    LIMIT 5
");

$lines = [
    "============================================================",
    "             PARKSMART FACILITY PERFORMANCE REPORT          ",
    "============================================================",
    "",
    "FACILITY PROFILE",
    "  Location Name        : " . $loc['name'],
    "  Address              : " . $loc['address'],
    "  Standard Rate        : " . tk($loc['price_per_hour']) . " / hour",
    "  Total Capacity       : " . $loc['total_spaces'] . " Vehicle Spaces",
    "  Manager In Charge    : " . current_user()['full_name'] . " (" . current_user()['email'] . ")",
    "  Report Generated On  : " . date('F j, Y, g:i A'),
    "",
    "RESERVATIONS & REVENUE SUMMARY",
    "  Total Revenue        : " . tk($m['total_revenue']),
    "  Total Bookings       : " . (int)$m['total_reservations'],
    "  Completed Bookings   : " . (int)$m['completed_count'],
    "  Currently Active     : " . (int)$m['active_count'],
    "  Cancelled Bookings   : " . (int)$m['cancelled_count'],
    "",
    "PARKING ENFORCEMENT & VIOLATIONS",
    "  Total Violations     : " . (int)$v['total_violations'],
    "  Open Incidents       : " . (int)$v['open_violations'],
    "  Resolved Incidents   : " . (int)$v['resolved_violations'],
    "",
    "TOP UTILIZED PARKING SPACES",
];

while ($row = mysqli_fetch_assoc($top_spaces_res)) {
    $lines[] = "  Space " . str_pad($row['space_code'], 6) . " : " . str_pad($row['bookings'] . " bookings", 14) . " Revenue: " . tk($row['space_rev']);
}

$lines[] = "";
$lines[] = "============================================================";
$lines[] = "  ParkSmart Operations Team  |  https://parksmart.io        ";
$lines[] = "============================================================";

send_pdf_download($conn, "Area-Report-" . preg_replace('/[^a-zA-Z0-9_-]/', '', $loc['name']) . "-" . date('Y-m-d') . ".pdf", "Parking Area Performance Report - " . $loc['name'], $lines);
