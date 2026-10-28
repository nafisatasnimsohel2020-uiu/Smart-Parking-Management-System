<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$data = json_decode(file_get_contents('php://input'), true);

$location_id = (int) ($data['location_id'] ?? 0);
$space_id = !empty($data['space_id']) ? (int) $data['space_id'] : null;
$category_id = !empty($data['category_id']) ? (int) $data['category_id'] : null;
$vehicle_plate = trim($data['vehicle_plate'] ?? '') ?: null;
$description = trim($data['description'] ?? '');
$fine_amount = isset($data['fine_amount']) ? (float)$data['fine_amount'] : 500.00;
$user = current_user();
$manager_id = $user['id'];
if ($user['role'] === 'manager') {
    $mgr_loc = get_manager_location_id($conn, $user);
    if ($mgr_loc <= 0) {
        send_json(['success' => false, 'message' => 'No parking area assigned to your manager account.'], 403);
    }
    $location_id = $mgr_loc;
}

if ($location_id <= 0 || $description === '') {
    send_json(['success' => false, 'message' => 'Location and description are required.'], 400);
}

// If category_id provided and no custom fine passed, get category fine
if ($category_id > 0 && !isset($data['fine_amount'])) {
    $c_stmt = mysqli_prepare($conn, "SELECT fine_amount FROM violation_categories WHERE id = ?");
    mysqli_stmt_bind_param($c_stmt, "i", $category_id);
    mysqli_stmt_execute($c_stmt);
    $c_row = mysqli_fetch_assoc(mysqli_stmt_get_result($c_stmt));
    mysqli_stmt_close($c_stmt);
    if ($c_row) {
        $fine_amount = (float)$c_row['fine_amount'];
    }
}

$violation_code = generate_code('V', $conn, 'violations', 'violation_code');

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO violations (violation_code, location_id, space_id, category_id, vehicle_plate, description, fine_amount, reported_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')"
);
mysqli_stmt_bind_param($stmt, "siiissdi", $violation_code, $location_id, $space_id, $category_id, $vehicle_plate, $description, $fine_amount, $manager_id);

if (!mysqli_stmt_execute($stmt)) {
    send_json(['success' => false, 'message' => 'Could not save violation: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);

send_json(['success' => true, 'message' => 'Violation reported successfully.', 'violation_code' => $violation_code]);
