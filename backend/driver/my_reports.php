<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$driver_id = current_user()['id'];

$stmt = mysqli_prepare(
    $conn,
    "SELECT ir.report_code, ir.category, ir.status, ir.created_at, ir.booking_code,
            pl.name AS location_name
     FROM issue_reports ir
     LEFT JOIN parking_locations pl ON pl.id = ir.location_id
     WHERE ir.driver_id = ?
     ORDER BY ir.created_at DESC"
);
mysqli_stmt_bind_param($stmt, "i", $driver_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$reports = [];
while ($row = mysqli_fetch_assoc($result)) {
    $reports[] = $row;
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'reports' => $reports]);
