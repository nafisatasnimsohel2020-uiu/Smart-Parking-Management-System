<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$data = json_decode(file_get_contents('php://input'), true);

$category = trim($data['category'] ?? '');
$location_id = !empty($data['location_id']) ? (int) $data['location_id'] : null;
$booking_code = trim($data['booking_code'] ?? '') ?: null;
$description = trim($data['description'] ?? '');
$driver_id = current_user()['id'];

if ($category === '' || $description === '') {
    send_json(['success' => false, 'message' => 'Category and description are required.'], 400);
}

$report_code = generate_code('IR', $conn, 'issue_reports', 'report_code');

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO issue_reports (report_code, driver_id, category, location_id, booking_code, description)
     VALUES (?, ?, ?, ?, ?, ?)"
);
mysqli_stmt_bind_param($stmt, "sisiss", $report_code, $driver_id, $category, $location_id, $booking_code, $description);

if (!mysqli_stmt_execute($stmt)) {
    send_json(['success' => false, 'message' => 'Could not submit report: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'message' => 'Report submitted.', 'report_code' => $report_code]);
