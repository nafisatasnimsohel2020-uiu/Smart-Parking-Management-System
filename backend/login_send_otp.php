<?php
require 'config.php';
require 'otp_helper.php';

$data = json_decode(file_get_contents('php://input'), true);

$email    = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$role     = strtolower(trim($data['role'] ?? ''));

if ($email === '' || $password === '') {
    send_json(['success' => false, 'message' => 'Email and password are required.'], 400);
}

$stmt = mysqli_prepare($conn, "SELECT id, full_name, email, password_hash, role, status FROM users WHERE LOWER(email) = ? LIMIT 1");
if (!$stmt) {
    send_json(['success' => false, 'message' => 'Database error during lookup.'], 500);
}
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($result);
mysqli_stmt_close($stmt);

if (!$user) {
    send_json(['success' => false, 'message' => 'No account found with this email address.'], 401);
}

// Password verification for an existing registered account only
$password_matches = false;
if (password_verify($password, $user['password_hash'])) {
    $password_matches = true;
} elseif ($user['password_hash'] === $password) {
    $password_matches = true;
    $new_hash = password_hash($password, PASSWORD_BCRYPT);
    mysqli_query($conn, "UPDATE users SET password_hash = '{$new_hash}' WHERE id = {$user['id']}");
}
if (!$password_matches) {
    send_json(['success' => false, 'message' => 'Incorrect password. Please use the password from your registered account.'], 401);
}

if ($user['status'] === 'blocked') {
    send_json(['success' => false, 'message' => 'This account has been blocked by the administrator.'], 403);
}
if ($user['status'] === 'pending') {
    send_json(['success' => false, 'message' => 'This account is pending administrator confirmation. An account will be activated only after the admin confirms your registration.'], 403);
}

// The selected role must exactly match the registered account role.
// Validate this BEFORE generating/sending an OTP.
if ($role === 'guest') {
    send_json(['success' => false, 'message' => 'Guest access does not use account login. Please choose the correct account role.'], 403);
}
if (!in_array($role, ['admin', 'manager', 'driver'], true)) {
    send_json(['success' => false, 'message' => 'Please select a valid account role.'], 400);
}
if ($role !== $user['role']) {
    $roleLabels = ['admin' => 'Administrator', 'manager' => 'Parking Manager', 'driver' => 'Driver'];
    $actual = $roleLabels[$user['role']] ?? 'this';
    $selected = $roleLabels[$role] ?? 'selected';
    send_json([
        'success' => false,
        'message' => "You are not a {$selected} account. This email belongs to a {$actual} account. Please select {$actual} to log in."
    ], 403);
}

$otp = generate_otp();
store_otp($conn, $user['email'], $otp, 'login');
deliver_otp($user['email'], $otp);

// Remember who is logging in in session
$_SESSION['pending_login_email'] = $user['email'];

$response = [
    'success'  => true, 
    'message'  => 'OTP sent to ' . $user['email'],
    'email'    => $user['email'],
    'role'     => $user['role'],
    'dev_otp'  => $otp
];

send_json($response);
