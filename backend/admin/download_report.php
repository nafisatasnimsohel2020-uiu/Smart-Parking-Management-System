<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);
require 'pdf_helper.php';

function tk($n) {
    return 'Tk ' . number_format((float) $n, 2);
}

$type  = trim($_GET['type'] ?? 'summary');
$month = trim($_GET['month'] ?? date('Y-m'));
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}
[$year, $mon] = array_map('intval', explode('-', $month));
$monthLabel = date('F Y', mktime(0, 0, 0, $mon, 1, $year));

if ($type === 'revenue') {
    $row = mysqli_fetch_assoc(mysqli_query($conn, "
        SELECT COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS reservations
        FROM reservations
        WHERE status IN ('active','completed') AND YEAR(reserve_date) = {$year} AND MONTH(reserve_date) = {$mon}
    "));

    $lines = [
        "Total Revenue: " . tk($row['revenue']),
        "Total Reservations: " . $row['reservations'],
        "",
        "Revenue by Location:",
    ];

    $result = mysqli_query($conn, "
        SELECT pl.name,
               COALESCE(SUM(CASE WHEN r.status IN ('active','completed')
                                  AND YEAR(r.reserve_date) = {$year} AND MONTH(r.reserve_date) = {$mon}
                             THEN r.total_cost ELSE 0 END), 0) AS revenue,
               COALESCE(SUM(CASE WHEN r.status IN ('active','completed')
                                  AND YEAR(r.reserve_date) = {$year} AND MONTH(r.reserve_date) = {$mon}
                             THEN 1 ELSE 0 END), 0) AS reservations
        FROM parking_locations pl
        LEFT JOIN reservations r ON r.location_id = pl.id
        GROUP BY pl.id, pl.name
        ORDER BY revenue DESC
    ");
    while ($row = mysqli_fetch_assoc($result)) {
        $lines[] = "  - {$row['name']}: " . tk($row['revenue']) . " ({$row['reservations']} reservations)";
    }

    send_pdf_download($conn, "revenue-report-{$month}.pdf", "Monthly Revenue Report - {$monthLabel}", $lines);
}

if ($type === 'violations') {
    $counts = mysqli_fetch_assoc(mysqli_query($conn, "
        SELECT COUNT(*) AS total,
               SUM(status = 'open') AS open_count,
               SUM(status = 'resolved') AS resolved_count
        FROM violations
        WHERE YEAR(created_at) = {$year} AND MONTH(created_at) = {$mon}
    "));

    $lines = [
        "Total Violations: " . (int) $counts['total'],
        "Open: " . (int) $counts['open_count'] . "   Resolved: " . (int) $counts['resolved_count'],
        "",
        "Details:",
    ];

    $result = mysqli_query($conn, "
        SELECT v.violation_code, v.vehicle_plate, v.description, v.status, v.created_at, pl.name AS location_name
        FROM violations v
        JOIN parking_locations pl ON pl.id = v.location_id
        WHERE YEAR(v.created_at) = {$year} AND MONTH(v.created_at) = {$mon}
        ORDER BY v.created_at DESC
    ");
    while ($row = mysqli_fetch_assoc($result)) {
        $plate = $row['vehicle_plate'] ?: 'Unknown';
        $lines[] = "  - {$row['violation_code']} | {$plate} | {$row['location_name']} | "
                 . "{$row['status']} | " . date('M j, Y', strtotime($row['created_at']));
        $lines[] = "      {$row['description']}";
    }

    send_pdf_download($conn, "violations-report-{$month}.pdf", "Violations Report - {$monthLabel}", $lines);
}

// type === 'summary' (the header "Download Report" button): full YTD overview
$ytd = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS reservations
    FROM reservations WHERE status IN ('active','completed') AND YEAR(reserve_date) = YEAR(CURDATE())
"));
$violations_total = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS c FROM violations WHERE YEAR(created_at) = YEAR(CURDATE())
"))['c'];

$lines = [
    "Year-to-date Revenue: " . tk($ytd['revenue']),
    "Year-to-date Reservations: " . $ytd['reservations'],
    "Year-to-date Violations: " . $violations_total,
    "",
    "Monthly Breakdown (last 7 months):",
];
$result = mysqli_query($conn, "
    SELECT DATE_FORMAT(reserve_date, '%b %Y') AS label,
           COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS reservations
    FROM reservations
    WHERE status IN ('active','completed') AND reserve_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(reserve_date, '%Y-%m'), label
    ORDER BY DATE_FORMAT(reserve_date, '%Y-%m')
");
while ($row = mysqli_fetch_assoc($result)) {
    $lines[] = "  - {$row['label']}: " . tk($row['revenue']) . " ({$row['reservations']} reservations)";
}

$lines[] = "";
$lines[] = "Revenue by Location (this month):";
$result = mysqli_query($conn, "
    SELECT pl.name,
           COALESCE(SUM(CASE WHEN r.status IN ('active','completed')
                              AND MONTH(r.reserve_date) = MONTH(CURDATE()) AND YEAR(r.reserve_date) = YEAR(CURDATE())
                         THEN r.total_cost ELSE 0 END), 0) AS revenue
    FROM parking_locations pl
    LEFT JOIN reservations r ON r.location_id = pl.id
    GROUP BY pl.id, pl.name
    ORDER BY revenue DESC
");
while ($row = mysqli_fetch_assoc($result)) {
    $lines[] = "  - {$row['name']}: " . tk($row['revenue']);
}

$lines[] = "";
$lines[] = "Violations Trend (last 7 months):";
$result = mysqli_query($conn, "
    SELECT DATE_FORMAT(created_at, '%b %Y') AS label, COUNT(*) AS count
    FROM violations
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m'), label
    ORDER BY DATE_FORMAT(created_at, '%Y-%m')
");
while ($row = mysqli_fetch_assoc($result)) {
    $lines[] = "  - {$row['label']}: {$row['count']} violations";
}

send_pdf_download($conn, "parksmart-system-report-" . date('Y-m-d') . ".pdf", "ParkSmart System Report - Generated " . date('M j, Y'), $lines);
