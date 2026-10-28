<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver', 'manager', 'admin']);
require '../pdf_helper.php';

$booking_code = trim($_GET['booking_code'] ?? '');
if ($booking_code === '') {
    die('Booking code is required.');
}

$user = current_user();

$sql = "SELECT r.*, u.full_name AS driver_name, u.email AS driver_email, u.phone AS driver_phone,
               pl.name AS location_name, pl.address AS location_address, pl.price_per_hour,
               ps.space_code
        FROM reservations r
        JOIN users u ON u.id = r.driver_id
        JOIN parking_locations pl ON pl.id = r.location_id
        JOIN parking_spaces ps ON ps.id = r.space_id
        WHERE r.booking_code = ? LIMIT 1";

$stmt = mysqli_prepare($conn, $sql);
mysqli_stmt_bind_param($stmt, "s", $booking_code);
mysqli_stmt_execute($stmt);
$res = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
mysqli_stmt_close($stmt);

if (!$res) {
    die('Reservation not found.');
}

// Drivers can only download their own receipts
if ($user['role'] === 'driver' && (int)$res['driver_id'] !== (int)$user['id']) {
    die('Access denied.');
}

function tk($n) {
    return 'Tk ' . number_format((float) $n, 2);
}

$hours = round((strtotime("2000-01-01 {$res['end_time']}") - strtotime("2000-01-01 {$res['start_time']}")) / 3600, 1);

$disp_status = strtoupper($res['status']);
if (in_array(strtolower($res['status']), ['completed', 'complete'], true)) {
    $disp_status = 'COMPLETE';
}

$lines = [
    "============================================================",
    "               PARKSMART OFFICIAL PARKING RECEIPT           ",
    "============================================================",
    "",
    "RECEIPT DETAILS",
    "  Receipt / Booking No : " . $res['booking_code'],
    "  Date of Issue        : " . date('F j, Y, g:i A'),
    "  Trip Status          : " . $disp_status,
    "  Security OTP Code    : " . $res['otp_code'],
    "",
    "PAYMENT & TRANSACTION DETAILS",
    "  Payment Method       : " . ($res['payment_method'] ?: 'bKash'),
    "  Transaction ID       : " . ($res['transaction_id'] ?: 'TXN-OFFLINE'),
    "  Payment Status       : " . strtoupper($res['payment_status'] ?: 'PAID'),
    "",
    "CUSTOMER & VEHICLE INFORMATION",
    "  Driver Name          : " . $res['driver_name'],
    "  Contact Phone        : " . $res['driver_phone'],
    "  Vehicle Plate        : " . ($res['vehicle_plate'] ?: 'Not Registered'),
    "",
    "PARKING FACILITY & SPACE",
    "  Facility             : " . $res['location_name'],
    "  Address              : " . $res['location_address'],
    "  Allocated Space      : " . $res['space_code'],
    "",
    "SCHEDULE & TIMING",
    "  Reservation Date     : " . date('l, F j, Y', strtotime($res['reserve_date'])),
    "  Reserved Hours       : " . substr($res['start_time'], 0, 5) . " - " . substr($res['end_time'], 0, 5) . " ({$hours} hours)",
    "  Checked In           : " . ($res['checked_in_at'] ? date('M j, Y g:i A', strtotime($res['checked_in_at'])) : 'Pending'),
    "  Checked Out          : " . ($res['checked_out_at'] ? date('M j, Y g:i A', strtotime($res['checked_out_at'])) : 'Pending'),
    "",
    "BILLING BREAKDOWN",
    "  Standard Rate        : " . tk($res['price_per_hour']) . " / hour",
    "  Duration             : " . $hours . " hours",
    ((!empty($res['discount_amount']) && (float)$res['discount_amount'] > 0) ? "  Gross Subtotal       : " . tk((float)$res['total_cost'] + (float)$res['discount_amount']) : null),
    ((!empty($res['discount_amount']) && (float)$res['discount_amount'] > 0) ? "  UIU Driver Discount  : -" . tk($res['discount_amount']) . " (25% Student/Faculty Priority)" : null),
    "  TOTAL AMOUNT PAID    : " . tk($res['total_cost']),
    ((!empty($res['fine_amount']) && (float)$res['fine_amount'] > 0) ? "  Cancellation Fine    : -" . tk($res['fine_amount']) . " (20% Cancellation Penalty)" : null),
    ((!empty($res['refund_amount']) && (float)$res['refund_amount'] > 0) ? "  NET REFUND PROCESSED : " . tk($res['refund_amount']) : null),
    "",
    "============================================================",
    "  Thank you for choosing ParkSmart! Have a safe journey.   ",
    "  Support Hotline: +880 1710 051803  |  support@parksmart.io",
    "============================================================"
];

$clean_lines = array_values(array_filter($lines, function($l) { return $l !== null; }));
send_pdf_download($conn, "ParkSmart-Receipt-{$booking_code}.pdf", "ParkSmart Parking Receipt - {$booking_code}", $clean_lines);
