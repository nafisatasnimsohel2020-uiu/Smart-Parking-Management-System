<?php
require 'config.php';
require_once 'auth_guard.php';

if (isset($_SESSION['user'])) {
    $uid = (int)($_SESSION['user']['id'] ?? 0);
    if ($uid > 0) {
        $u_stmt = mysqli_prepare($conn, "SELECT uiu_id FROM users WHERE id = ? LIMIT 1");
        if ($u_stmt) {
            mysqli_stmt_bind_param($u_stmt, 'i', $uid);
            mysqli_stmt_execute($u_stmt);
            $u_row = mysqli_fetch_assoc(mysqli_stmt_get_result($u_stmt));
            $_SESSION['user']['uiu_id'] = $u_row['uiu_id'] ?? null;
            mysqli_stmt_close($u_stmt);
        }
    }
    // If manager, guarantee assigned location and name are synchronized
    if ($_SESSION['user']['role'] === 'manager') {
        $loc_id = get_manager_location_id($conn, $_SESSION['user']);
        if ($loc_id > 0 && empty($_SESSION['user']['location_name'])) {
            $l_res = mysqli_query($conn, "SELECT name FROM parking_locations WHERE id = " . (int)$loc_id . " LIMIT 1");
            if ($l_row = mysqli_fetch_assoc($l_res)) {
                $_SESSION['user']['location_name'] = $l_row['name'];
            }
        }
    }
    send_json(['success' => true, 'loggedIn' => true, 'user' => $_SESSION['user']]);
} else {
    send_json(['success' => true, 'loggedIn' => false]);
}
