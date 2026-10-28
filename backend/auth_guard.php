<?php


function require_role($allowed_roles) {
    if (!isset($_SESSION['user'])) {
        send_json(['success' => false, 'message' => 'Please sign in first.'], 401);
    }
    if (!in_array($_SESSION['user']['role'], $allowed_roles, true)) {
        send_json(['success' => false, 'message' => 'You are not allowed to do that.'], 403);
    }
}

function current_user() {
    return $_SESSION['user'] ?? null;
}

/**
 * Returns the assigned parking location ID for the current manager.
 * For admins, returns 0 (unrestricted).
 * For managers, guarantees strict segregation to their facility.
 */
function get_manager_location_id($conn, $user = null) {
    if (!$user) {
        $user = current_user();
    }
    if (!$user) {
        return 0;
    }
    if ($user['role'] === 'admin') {
        return 0; // Admin is unrestricted across all facilities
    }

    if (!empty($_SESSION['user']['location_id'])) {
        return (int)$_SESSION['user']['location_id'];
    }

    // Lookup parking_locations table by manager_id
    $stmt = mysqli_prepare($conn, "SELECT id, name FROM parking_locations WHERE manager_id = ? LIMIT 1");
    if ($stmt) {
        mysqli_stmt_bind_param($stmt, "i", $user['id']);
        mysqli_stmt_execute($stmt);
        $res = mysqli_stmt_get_result($stmt);
        if ($loc = mysqli_fetch_assoc($res)) {
            $_SESSION['user']['location_id'] = (int)$loc['id'];
            $_SESSION['user']['location_name'] = $loc['name'];
            mysqli_stmt_close($stmt);
            return (int)$loc['id'];
        }
        mysqli_stmt_close($stmt);
    }

    // Check users table location_id column
    $u_res = mysqli_query($conn, "SELECT location_id FROM users WHERE id = " . (int)$user['id'] . " LIMIT 1");
    if ($u_row = mysqli_fetch_assoc($u_res)) {
        if (!empty($u_row['location_id'])) {
            $_SESSION['user']['location_id'] = (int)$u_row['location_id'];
            return (int)$u_row['location_id'];
        }
    }

    return 0;
}

function generate_code($prefix, $conn, $table, $column) {
    // e.g. R-0001, IR-0001, V-0001 - based on row count, retried on collision
    do {
        $number = str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        $code = $prefix . '-' . $number;
        $stmt = mysqli_prepare($conn, "SELECT id FROM {$table} WHERE {$column} = ? LIMIT 1");
        mysqli_stmt_bind_param($stmt, "s", $code);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_store_result($stmt);
        $exists = mysqli_stmt_num_rows($stmt) > 0;
        mysqli_stmt_close($stmt);
    } while ($exists);

    return $code;
}
