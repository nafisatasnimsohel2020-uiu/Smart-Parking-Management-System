<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$ytd = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS reservations
    FROM reservations
    WHERE status IN ('active','completed') AND YEAR(reserve_date) = YEAR(CURDATE())
"));

$violations_total = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS c FROM violations WHERE YEAR(created_at) = YEAR(CURDATE())
"))['c'];

$monthly = [];
$result = mysqli_query($conn, "
    SELECT DATE_FORMAT(reserve_date, '%Y-%m') AS ym, DATE_FORMAT(reserve_date, '%b') AS label,
           COALESCE(SUM(total_cost),0) AS revenue, COUNT(*) AS reservations
    FROM reservations
    WHERE status IN ('active','completed') AND reserve_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym, label
    ORDER BY ym
");
while ($row = mysqli_fetch_assoc($result)) {
    $monthly[] = $row;
}

$by_location = [];
$result = mysqli_query($conn, "
    SELECT pl.name,
           COALESCE(SUM(CASE WHEN r.status IN ('active','completed')
                              AND MONTH(r.reserve_date) = MONTH(CURDATE())
                              AND YEAR(r.reserve_date) = YEAR(CURDATE())
                         THEN r.total_cost ELSE 0 END), 0) AS revenue
    FROM parking_locations pl
    LEFT JOIN reservations r ON r.location_id = pl.id
    GROUP BY pl.id, pl.name
    ORDER BY revenue DESC
");
while ($row = mysqli_fetch_assoc($result)) {
    $by_location[] = $row;
}

$violations_trend = [];
$result = mysqli_query($conn, "
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, DATE_FORMAT(created_at, '%b') AS label, COUNT(*) AS count
    FROM violations
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym, label
    ORDER BY ym
");
while ($row = mysqli_fetch_assoc($result)) {
    $violations_trend[] = $row;
}

$months_counted = max(count($monthly), 1);
$avg_monthly_revenue = round($ytd['revenue'] / $months_counted, 2);

send_json([
    'success' => true,
    'ytd_revenue' => (float) $ytd['revenue'],
    'ytd_reservations' => (int) $ytd['reservations'],
    'avg_monthly_revenue' => $avg_monthly_revenue,
    'total_violations' => (int) $violations_total,
    'monthly' => $monthly,
    'revenue_by_location' => $by_location,
    'violations_trend' => $violations_trend,
]);
