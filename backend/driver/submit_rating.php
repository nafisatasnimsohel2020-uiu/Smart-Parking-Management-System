<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$driver_id = current_user()['id'];

$data = json_decode(file_get_contents('php://input'), true);
if (!$data && !empty($_POST)) {
    $data = $_POST;
}

$reservation_id = (int)($data['reservation_id'] ?? 0);
$rating         = (int)($data['rating'] ?? 0);
$comment        = trim($data['comment'] ?? '');

if ($reservation_id <= 0) {
    send_json(['success' => false, 'message' => 'Invalid reservation.'], 400);
}
if ($rating < 1 || $rating > 5) {
    send_json(['success' => false, 'message' => 'Rating must be between 1 and 5.'], 400);
}

// Make sure this reservation belongs to the driver and is actually completed
$stmt = mysqli_prepare(
    $conn,
    "SELECT id, location_id, status FROM reservations WHERE id = ? AND driver_id = ? LIMIT 1"
);
mysqli_stmt_bind_param($stmt, "ii", $reservation_id, $driver_id);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$reservation = mysqli_fetch_assoc($res);
mysqli_stmt_close($stmt);

if (!$reservation) {
    send_json(['success' => false, 'message' => 'Reservation not found.'], 404);
}
if (!in_array($reservation['status'], ['completed', 'complete'], true)) {
    send_json(['success' => false, 'message' => 'You can only rate completed trips.'], 400);
}

$location_id = (int)$reservation['location_id'];

// One rating per reservation: insert, or update if the driver already rated it
$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO ratings (reservation_id, driver_id, location_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)"
);
mysqli_stmt_bind_param($stmt, "iiiis", $reservation_id, $driver_id, $location_id, $rating, $comment);
if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_json(['success' => false, 'message' => 'Could not save rating: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);

// Recalculate this location's average rating from all real driver ratings
mysqli_query($conn, "
    UPDATE parking_locations pl
    SET pl.rating = (
        SELECT ROUND(AVG(rt.rating), 2) FROM ratings rt WHERE rt.location_id = {$location_id}
    )
    WHERE pl.id = {$location_id}
");

send_json(['success' => true, 'message' => 'Thanks for rating your experience!']);
