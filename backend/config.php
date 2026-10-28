<?php

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function parksmart_json_error($message) {
    if (!headers_sent()) {
        header_remove();
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $message]);
    exit();
}

set_exception_handler(function ($e) {
    error_log('Uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    parksmart_json_error($e->getMessage());
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        parksmart_json_error($error['message'] . ' (' . basename($error['file']) . ':' . $error['line'] . ')');
    }
});


// Configure session cookie params for localhost & cross-path resilience
if (session_status() === PHP_SESSION_NONE) {
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 86400 * 7,
            'path' => '/',
            'secure' => false,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    } else {
        session_set_cookie_params(86400 * 7, '/');
    }
    session_start();
}

// Lock PHP and MySQL clocks to Asia/Dhaka (UTC+6) so current time,
// reservation windows, daily resets, and OTPs are perfectly synchronized.
date_default_timezone_set('Asia/Dhaka');

// Dynamic CORS handling compatible with fetch credentials: "include"
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ---- EDIT THESE FOR YOUR SERVER ----
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'parksmart');
// -------------------------------------

// ---- Admin signup protection ----
// Anyone who knows ONE of these secret keys can register a new
// Administrator account through the public sign-up form. Add / remove /
// change values here; only share them with people you trust to be admins.
define('ADMIN_SIGNUP_KEYS', [
    'ADM101',
    'ADM202',
    'ADM303',
]);

/**
 * Returns true if it's OK to let this signup proceed with the given role.
 * Only the 'admin' role is gated; manager/driver are unaffected.
 */
function admin_signup_key_ok($role, $provided_key) {
    if (strtolower(trim($role)) !== 'admin') {
        return true;
    }
    $provided_key = (string)$provided_key;
    foreach (ADMIN_SIGNUP_KEYS as $valid_key) {
        if (hash_equals($valid_key, $provided_key)) {
            return true;
        }
    }
    return false;
}

$conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . mysqli_connect_error()
    ]);
    exit();
}

mysqli_set_charset($conn, 'utf8mb4');

// Synchronize MySQL's NOW(), CURDATE(), and CURTIME() to Asia/Dhaka (+06:00)
mysqli_query($conn, "SET time_zone = '+06:00'");

// Auto-run lightweight schema & area manager sync
require_once __DIR__ . '/db_sync.php';
require_once __DIR__ . '/overtime_helper.php';

/**
 * Small helper to send a JSON response and stop execution.
 */
function send_json($data, $status_code = 200) {
    global $conn;
    http_response_code($status_code);
    echo json_encode($data);
    if (isset($conn)) {
        mysqli_close($conn);
    }
    exit();
}
