<?php
require 'config.php';
require 'otp_helper.php';

$data = json_decode(file_get_contents('php://input'), true);
$otp_code = trim($data['otp'] ?? '');

$email = strtolower(trim($data['email'] ?? ($_SESSION['pending_login_email'] ?? '')));

if ($email === '') {
    send_json(['success' => false, 'message' => 'No login in progress. Please enter your email and request an OTP.'], 400);
}

if ($otp_code === '' || !verify_otp($conn, $email, $otp_code, 'login')) {
    send_json(['success' => false, 'message' => 'Invalid or expired OTP. (Default test OTP: 1234)'], 400);
}

$stmt = mysqli_prepare($conn, "SELECT id, full_name, email, role, location_id, uiu_id FROM users WHERE LOWER(email) = ? LIMIT 1");
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($result);
mysqli_stmt_close($stmt);

if (!$user) {
    send_json(['success' => false, 'message' => 'User not found.'], 404);
}

unset($_SESSION['pending_login_email']);

// Resolve assigned location if user is a manager
$location_id = (int)($user['location_id'] ?? 0);
$location_name = null;
if ($user['role'] === 'manager') {
    if ($location_id > 0) {
        $lres = mysqli_query($conn, "SELECT name FROM parking_locations WHERE id = {$location_id} LIMIT 1");
        if ($lrow = mysqli_fetch_assoc($lres)) {
            $location_name = $lrow['name'];
        }
    } else {
        $lstmt = mysqli_prepare($conn, "SELECT id, name FROM parking_locations WHERE manager_id = ? LIMIT 1");
        if ($lstmt) {
            mysqli_stmt_bind_param($lstmt, "i", $user['id']);
            mysqli_stmt_execute($lstmt);
            $lres = mysqli_stmt_get_result($lstmt);
            if ($loc = mysqli_fetch_assoc($lres)) {
                $location_id = (int)$loc['id'];
                $location_name = $loc['name'];
            }
            mysqli_stmt_close($lstmt);
        }
    }
}

// Log the user in
$_SESSION['user'] = [
    'id'            => $user['id'],
    'full_name'     => $user['full_name'],
    'email'         => $user['email'],
    'role'          => $user['role'],
    'location_id'   => $location_id,
    'location_name' => $location_name,
    'uiu_id'       => $user['uiu_id'] ?? null,
];

send_json([
    'success' => true,
    'message' => 'Login successful.',
    'user'    => $_SESSION['user'],
]);
