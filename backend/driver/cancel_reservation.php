<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver']);

$data = json_decode(file_get_contents('php://input'), true);
$booking_code = trim($data['booking_code'] ?? '');
$driver_id = current_user()['id'];

if ($booking_code === '') {
    send_json(['success' => false, 'message' => 'Booking code is required.'], 400);
}

$stmt = mysqli_prepare(
    $conn,
    "SELECT id, space_id, status, total_cost, payment_method FROM reservations WHERE booking_code = ? AND driver_id = ? LIMIT 1"
);
mysqli_stmt_bind_param($stmt, "si", $booking_code, $driver_id);
mysqli_stmt_execute($stmt);
$reservation = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$reservation) {
    send_json(['success' => false, 'message' => 'Reservation not found.'], 404);
}

if (!in_array($reservation['status'], ['booked', 'upcoming', 'active'], true)) {
    send_json(['success' => false, 'message' => 'This reservation can no longer be cancelled.'], 409);
}

$cost = (float) ($reservation['total_cost'] ?? 0);
$reason = trim($data['reason'] ?? 'Cancelled by driver');
$payment_method = $reservation['payment_method'] ?? 'bKash';

// Cancellation Fine Policy: 20% penalty fee (minimum ৳50, or full cost if under ৳50)
$fine_amount = round(min($cost, max(50.00, $cost * 0.20)), 2);
$refund_amount = round(max(0.00, $cost - $fine_amount), 2);

mysqli_begin_transaction($conn);

$stmt = mysqli_prepare($conn, "
    UPDATE reservations 
    SET status = 'cancelled', 
        fine_amount = ?, 
        refund_amount = ?, 
        payment_status = 'fine_applied', 
        cancellation_reason = ? 
    WHERE id = ?
");
mysqli_stmt_bind_param($stmt, "ddsi", $fine_amount, $refund_amount, $reason, $reservation['id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

$stmt = mysqli_prepare($conn, "UPDATE parking_spaces SET status = 'free' WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $reservation['space_id']);
mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

mysqli_commit($conn);

send_json([
    'success' => true,
    'message' => "Reservation {$booking_code} cancelled. Cancellation fine of ৳{$fine_amount} applied. Net refund of ৳{$refund_amount} will be processed via {$payment_method}.",
    'booking_code' => $booking_code,
    'fine_amount' => $fine_amount,
    'refund_amount' => $refund_amount,
    'total_cost' => $cost,
    'payment_method' => $payment_method
]);
