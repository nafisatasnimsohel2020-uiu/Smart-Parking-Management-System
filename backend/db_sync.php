<?php


if (!isset($conn) || !$conn) {
    return;
}


mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(30) NULL,
        uiu_id VARCHAR(10) NULL,
        vehicle_plate VARCHAR(30) NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'driver') NOT NULL DEFAULT 'driver',
        location_id INT NULL,
        status ENUM('active', 'pending', 'blocked') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS parking_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address VARCHAR(255) NOT NULL,
        price_per_hour DECIMAL(8,2) NOT NULL DEFAULT 100.00,
        total_spaces INT NOT NULL DEFAULT 20,
        rating DECIMAL(3,2) NOT NULL DEFAULT 4.80,
        manager_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS parking_spaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT NOT NULL,
        space_code VARCHAR(20) NOT NULL,
        status ENUM('free', 'reserved', 'occupied', 'maintenance') NOT NULL DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_loc (location_id),
        UNIQUE KEY uq_loc_space (location_id, space_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_code VARCHAR(30) NOT NULL UNIQUE,
        driver_id INT NOT NULL,
        location_id INT NOT NULL,
        space_id INT NOT NULL,
        vehicle_plate VARCHAR(30) NULL,
        reserve_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        total_cost DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'bKash',
        payment_status ENUM('paid', 'pending', 'refunded', 'fine_applied') NOT NULL DEFAULT 'paid',
        transaction_id VARCHAR(60) NULL,
        fine_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        refund_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        cancellation_reason VARCHAR(255) NULL,
        otp_code VARCHAR(10) NOT NULL,
        status ENUM('booked', 'upcoming', 'active', 'complete', 'completed', 'cancelled') NOT NULL DEFAULT 'booked',
        checked_in_at DATETIME NULL,
        checked_out_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_res_driver (driver_id),
        INDEX idx_res_loc (location_id),
        INDEX idx_res_space (space_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS violation_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        fine_amount DECIMAL(8,2) NOT NULL DEFAULT 500.00,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS violations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        violation_code VARCHAR(30) NOT NULL UNIQUE,
        location_id INT NOT NULL,
        space_id INT NULL,
        category_id INT NULL,
        vehicle_plate VARCHAR(30) NULL,
        description TEXT NOT NULL,
        fine_amount DECIMAL(8,2) NOT NULL DEFAULT 500.00,
        reported_by INT NOT NULL,
        status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_vio_loc (location_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS pricing_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT NOT NULL UNIQUE,
        peak_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.25,
        peak_start TIME NOT NULL DEFAULT '08:00:00',
        peak_end TIME NOT NULL DEFAULT '18:00:00',
        occupancy_threshold INT NOT NULL DEFAULT 80,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(100) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        is_used TINYINT(1) NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_id (identifier, purpose)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS issue_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_code VARCHAR(30) NOT NULL UNIQUE,
        driver_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        location_id INT NULL,
        booking_code VARCHAR(50) NULL,
        description TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'submitted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        subject VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_send (sender_id),
        INDEX idx_chat_recv (receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reservation_id INT NOT NULL UNIQUE,
        driver_id INT NOT NULL,
        location_id INT NOT NULL,
        rating TINYINT NOT NULL,
        comment VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rating_loc (location_id),
        INDEX idx_rating_driver (driver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

mysqli_query($conn, "
    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reservation_id INT NULL,
        booking_code VARCHAR(30) NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'warning', 'overtime', 'checkout', 'fine') NOT NULL DEFAULT 'info',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_user (user_id),
        INDEX idx_notif_read (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
");

/**
 * Adds a column to a table if it's missing -- protects installs where
 * the table was first created before this column existed in the
 * CREATE TABLE IF NOT EXISTS above (that statement is a no-op once the
 * table already exists, so new columns never appear on their own).
 * This is what was causing "Unknown column '...' in 'field list'".
 */
function ensure_column($conn, $table, $column, $add_definition) {
    $check = mysqli_query($conn, "SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
    if ($check && mysqli_num_rows($check) === 0) {
        mysqli_query($conn, "ALTER TABLE `{$table}` ADD COLUMN {$add_definition}");
    }
}

ensure_column($conn, 'users', 'location_id', 'location_id INT NULL');
ensure_column($conn, 'users', 'uiu_id', 'uiu_id VARCHAR(10) NULL');
ensure_column($conn, 'users', 'vehicle_plate', 'vehicle_plate VARCHAR(30) NULL');
$uiu_idx = mysqli_query($conn, "SHOW INDEX FROM users WHERE Key_name = 'uq_users_uiu_id'");
if ($uiu_idx && mysqli_num_rows($uiu_idx) === 0) { mysqli_query($conn, "ALTER TABLE users ADD UNIQUE KEY uq_users_uiu_id (uiu_id)"); }
ensure_column($conn, 'reservations', 'discount_amount', 'discount_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00');
ensure_column($conn, 'reservations', 'vehicle_plate', 'vehicle_plate VARCHAR(30) NULL');
ensure_column($conn, 'reservations', 'payment_method', "payment_method VARCHAR(50) NOT NULL DEFAULT 'bKash'");
ensure_column($conn, 'reservations', 'payment_status', "payment_status ENUM('paid', 'pending', 'refunded', 'fine_applied') NOT NULL DEFAULT 'paid'");
ensure_column($conn, 'reservations', 'transaction_id', "transaction_id VARCHAR(60) NULL");
ensure_column($conn, 'reservations', 'fine_amount', "fine_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00");
ensure_column($conn, 'reservations', 'fine_status', "fine_status ENUM('none','pending','collected','waived') NOT NULL DEFAULT 'none'");
ensure_column($conn, 'reservations', 'fine_handled_at', 'fine_handled_at DATETIME NULL');
ensure_column($conn, 'reservations', 'fine_handled_by', 'fine_handled_by INT NULL');
ensure_column($conn, 'reservations', 'refund_amount', "refund_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00");
ensure_column($conn, 'reservations', 'cancellation_reason', "cancellation_reason VARCHAR(255) NULL");
ensure_column($conn, 'violations', 'space_id', 'space_id INT NULL');
ensure_column($conn, 'violations', 'category_id', 'category_id INT NULL');
ensure_column($conn, 'violations', 'fine_amount', 'fine_amount DECIMAL(8,2) NOT NULL DEFAULT 500.00');
ensure_column($conn, 'violations', 'reported_by', 'reported_by INT NOT NULL DEFAULT 1');
ensure_column($conn, 'parking_locations', 'rating', 'rating DECIMAL(3,2) NOT NULL DEFAULT 4.80');
ensure_column($conn, 'parking_locations', 'manager_id', 'manager_id INT NULL');

// Check if reservations.status column supports 'booked' and 'complete'
$col_res_status = mysqli_query($conn, "SHOW COLUMNS FROM reservations LIKE 'status'");
if ($r_row = mysqli_fetch_assoc($col_res_status)) {
    if (strpos($r_row['Type'], "'booked'") === false || strpos($r_row['Type'], "'complete'") === false) {
        mysqli_query($conn, "ALTER TABLE reservations MODIFY COLUMN status ENUM('booked','upcoming','active','complete','completed','cancelled') NOT NULL DEFAULT 'booked'");
    }
}

// Check if the users.status column already allows 'pending' (older
// installs may only have 'active'/'blocked') -- this is a MODIFY, not
// an ADD, so it needs its own check rather than ensure_column().
$col_status = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'status'");
if ($row = mysqli_fetch_assoc($col_status)) {
    if (strpos($row['Type'], "'pending'") === false) {
        mysqli_query($conn, "ALTER TABLE users MODIFY COLUMN status ENUM('active','pending','blocked') NOT NULL DEFAULT 'active'");
    }
}

// ---------------- SEED CORE USERS ----------------
$default_hash = password_hash('123456', PASSWORD_BCRYPT);

$users_to_seed = [
    [
        'email' => 'admin@parksmart.io',
        'full_name' => 'System Administrator',
        'phone' => '+8801700000001',
        'vehicle_plate' => null,
        'role' => 'admin',
        'status' => 'active'
    ],
    [
        'email' => 'driver@parksmart.io',
        'full_name' => 'Rahim Chowdhury (Driver)',
        'phone' => '+8801788888888',
        'vehicle_plate' => 'DHA-GA-11-2233',
        'role' => 'driver',
        'status' => 'active'
    ],
    [
        'email' => 'uiu.student@uiu.ac.bd',
        'full_name' => 'Sabbir Hossain (UIU Student)',
        'phone' => '+8801799999999',
        'vehicle_plate' => 'DHA-METRO-HA-5521',
        'role' => 'driver',
        'status' => 'active'
    ]
];

foreach ($users_to_seed as $u) {
    $chk = mysqli_query($conn, "SELECT id FROM users WHERE email = '" . mysqli_real_escape_string($conn, $u['email']) . "' LIMIT 1");
    if ($chk && mysqli_num_rows($chk) === 0) {
        $ins = mysqli_prepare($conn, "INSERT INTO users (full_name, email, phone, vehicle_plate, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($ins, "sssssss", $u['full_name'], $u['email'], $u['phone'], $u['vehicle_plate'], $default_hash, $u['role'], $u['status']);
        mysqli_stmt_execute($ins);
        mysqli_stmt_close($ins);
    } else {
        // Ensure active and password valid
        mysqli_query($conn, "UPDATE users SET password_hash = '{$default_hash}', status = 'active', role = '{$u['role']}' WHERE email = '" . mysqli_real_escape_string($conn, $u['email']) . "'");
    }
}

// Existing installations may already contain the old demo manager accounts.
// Disable those demo accounts so Manager login is available only to accounts
// that have gone through the real registration/approval flow.
$demo_manager_emails = [
    'manager@parksmart.io',
    'mirpur.manager@parksmart.io',
    'dhanmondi.manager@parksmart.io',
    'uiu.manager@parksmart.io',
    'prityonti@parksmart.io',
    'motijheel.manager@parksmart.io',
    'gulshan.manager@parksmart.io'
];
$demo_manager_email_sql = implode(',', array_map(function($e) use ($conn) {
    return "'" . mysqli_real_escape_string($conn, $e) . "'";
}, $demo_manager_emails));
mysqli_query($conn, "UPDATE users SET status = 'blocked' WHERE email IN ({$demo_manager_email_sql}) AND role = 'manager'");
mysqli_query($conn, "UPDATE parking_locations SET manager_id = NULL WHERE manager_id IN (SELECT id FROM users WHERE email IN ({$demo_manager_email_sql}) AND role = 'manager')");

// ---------------- SEED LOCATIONS ----------------
$locations_to_seed = [
    [
        'key' => 'mirpur',
        'name' => 'Mirpur Parking',
        'address' => '123/4 Zoo Road, Section 10, Mirpur, Dhaka',
        'price_per_hour' => 100.00,
        'total_spaces' => 20,
        'rating' => 4.80,
        'manager_email' => 'manager@parksmart.io'
    ],
    [
        'key' => 'motijheel',
        'name' => 'Motijheel Commercial Parking',
        'address' => 'Dilkusha Commercial Area, Motijheel, Dhaka',
        'price_per_hour' => 200.00,
        'total_spaces' => 20,
        'rating' => 4.50,
        'manager_email' => 'prityonti@parksmart.io'
    ],
    [
        'key' => 'dhanmondi',
        'name' => 'Dhanmondi Parking',
        'address' => 'Road 27, Dhanmondi, Dhaka',
        'price_per_hour' => 300.00,
        'total_spaces' => 20,
        'rating' => 4.30,
        'manager_email' => 'dhanmondi.manager@parksmart.io'
    ],
    [
        'key' => 'gulshan',
        'name' => 'Gulshan Commercial Zone',
        'address' => 'Road 45, Gulshan-2, Dhaka',
        'price_per_hour' => 250.00,
        'total_spaces' => 20,
        'rating' => 4.90,
        'manager_email' => 'gulshan.manager@parksmart.io'
    ],
    [
        'key' => 'uiu',
        'name' => 'UIU Campus Smart Parking',
        'address' => 'United International University, Madani Avenue, Badda, Dhaka-1212',
        'price_per_hour' => 30.00,
        'total_spaces' => 30,
        'rating' => 4.95,
        'manager_email' => 'uiu.manager@parksmart.io'
    ]
];

foreach ($locations_to_seed as $loc) {
    // Lookup manager id
    $m_id = null;
    $m_res = mysqli_query($conn, "SELECT id FROM users WHERE email = '{$loc['manager_email']}' LIMIT 1");
    if ($m_row = mysqli_fetch_assoc($m_res)) {
        $m_id = (int)$m_row['id'];
    }

    // Check if location exists by name prefix
    $chk_loc = mysqli_query($conn, "SELECT id, manager_id FROM parking_locations WHERE name LIKE '%{$loc['name']}%' OR name LIKE '%" . explode(' ', $loc['name'])[0] . "%' LIMIT 1");
    $loc_id = 0;
    if ($loc_row = mysqli_fetch_assoc($chk_loc)) {
        $loc_id = (int)$loc_row['id'];
        // Update manager assignment and details
        if ($m_id) {
            mysqli_query($conn, "UPDATE parking_locations SET manager_id = {$m_id}, price_per_hour = {$loc['price_per_hour']}, total_spaces = {$loc['total_spaces']}, rating = {$loc['rating']} WHERE id = {$loc_id}");
            mysqli_query($conn, "UPDATE users SET location_id = {$loc_id} WHERE id = {$m_id}");
        }
    } else {
        $ins_loc = mysqli_prepare($conn, "INSERT INTO parking_locations (name, address, price_per_hour, total_spaces, rating, manager_id) VALUES (?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($ins_loc, "ssdddi", $loc['name'], $loc['address'], $loc['price_per_hour'], $loc['total_spaces'], $loc['rating'], $m_id);
        mysqli_stmt_execute($ins_loc);
        $loc_id = mysqli_insert_id($conn);
        mysqli_stmt_close($ins_loc);

        if ($m_id && $loc_id > 0) {
            mysqli_query($conn, "UPDATE users SET location_id = {$loc_id} WHERE id = {$m_id}");
        }
    }

    // Ensure spaces exist for this location
    if ($loc_id > 0) {
        $sp_cnt_res = mysqli_query($conn, "SELECT COUNT(*) AS c FROM parking_spaces WHERE location_id = {$loc_id}");
        $sp_cnt = (int)(mysqli_fetch_assoc($sp_cnt_res)['c'] ?? 0);
        $target_cnt = $loc['total_spaces'];

        if ($sp_cnt < $target_cnt) {
            $prefix = ($loc['key'] === 'uiu') ? 'UIU-' : strtoupper(substr($loc['key'], 0, 1)) . '-';
            for ($i = 1; $i <= $target_cnt; $i++) {
                $code = $prefix . str_pad((string)$i, 2, '0', STR_PAD_LEFT);
                mysqli_query($conn, "INSERT IGNORE INTO parking_spaces (location_id, space_code, status) VALUES ({$loc_id}, '{$code}', 'free')");
            }
        }

        // Ensure dynamic pricing rule exists
        mysqli_query($conn, "
            INSERT IGNORE INTO pricing_rules (location_id, peak_multiplier, peak_start, peak_end, occupancy_threshold, enabled)
            VALUES ({$loc_id}, 1.25, '08:00:00', '18:00:00', 80, 1)
        ");
    }
}

// ---------------- CLEAN DUPLICATE PARKING LOCATIONS ----------------
// Keep the oldest location for each normalized name and safely merge references
// from duplicate rows before deleting them. This prevents duplicate names from
// appearing in Driver, Manager and Admin location selectors.
$dup_res = mysqli_query($conn, "SELECT LOWER(TRIM(name)) AS normalized_name, COUNT(*) AS cnt FROM parking_locations GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1");
if ($dup_res) {
    while ($dup = mysqli_fetch_assoc($dup_res)) {
        $norm = mysqli_real_escape_string($conn, $dup['normalized_name']);
        $rows = mysqli_query($conn, "SELECT id, manager_id FROM parking_locations WHERE LOWER(TRIM(name)) = '{$norm}' ORDER BY id ASC");
        $locations = [];
        while ($r = mysqli_fetch_assoc($rows)) { $locations[] = $r; }
        if (count($locations) < 2) continue;
        $keep_id = (int)$locations[0]['id'];
        foreach (array_slice($locations, 1) as $dup_loc) {
            $old_id = (int)$dup_loc['id'];
            // Move users and location-level records to the keeper.
            mysqli_query($conn, "UPDATE users SET location_id = {$keep_id} WHERE location_id = {$old_id}");
            mysqli_query($conn, "UPDATE parking_locations SET manager_id = COALESCE(manager_id, " . ((int)$dup_loc['manager_id']) . ") WHERE id = {$keep_id} AND manager_id IS NULL");
            mysqli_query($conn, "UPDATE reservations SET location_id = {$keep_id} WHERE location_id = {$old_id}");
            mysqli_query($conn, "UPDATE violations SET location_id = {$keep_id} WHERE location_id = {$old_id}");
            mysqli_query($conn, "UPDATE ratings SET location_id = {$keep_id} WHERE location_id = {$old_id}");
            mysqli_query($conn, "UPDATE issue_reports SET location_id = {$keep_id} WHERE location_id = {$old_id}");
            mysqli_query($conn, "UPDATE pricing_rules SET location_id = {$keep_id} WHERE location_id = {$old_id}");

            // Parking spaces can have the same code in both locations. Re-point
            // reservations to the keeper's matching space before removing duplicates.
            $sp = mysqli_query($conn, "SELECT id, space_code FROM parking_spaces WHERE location_id = {$old_id}");
            while ($sr = mysqli_fetch_assoc($sp)) {
                $old_space = (int)$sr['id'];
                $code = mysqli_real_escape_string($conn, $sr['space_code']);
                $keeper_sp = mysqli_query($conn, "SELECT id FROM parking_spaces WHERE location_id = {$keep_id} AND space_code = '{$code}' LIMIT 1");
                if ($ks = mysqli_fetch_assoc($keeper_sp)) {
                    $new_space = (int)$ks['id'];
                    mysqli_query($conn, "UPDATE reservations SET space_id = {$new_space} WHERE space_id = {$old_space}");
                    mysqli_query($conn, "UPDATE violations SET space_id = {$new_space} WHERE space_id = {$old_space}");
                    mysqli_query($conn, "DELETE FROM parking_spaces WHERE id = {$old_space}");
                } else {
                    mysqli_query($conn, "UPDATE parking_spaces SET location_id = {$keep_id} WHERE id = {$old_space}");
                }
            }
            // If the duplicate had a pricing rule and keeper did not, preserve it.
            mysqli_query($conn, "DELETE FROM pricing_rules WHERE location_id = {$old_id}");
            mysqli_query($conn, "DELETE FROM parking_locations WHERE id = {$old_id}");
        }
    }
}

// ---------------- SEED VIOLATION CATEGORIES ----------------
$categories_to_seed = [
    ['Unauthorized Parking', 500.00, 'Parked in a reserved stall or staff area without authorization.'],
    ['Overstay Beyond Booking Window', 300.00, 'Exceeded scheduled reservation time by more than 30 minutes.'],
    ['Double Parking / Line Obstruction', 400.00, 'Straddling parking bay divider lines or blocking driveway lanes.'],
    ['Unauthorized EV Stall Usage', 800.00, 'Non-electric vehicle parked in active EV charging stall.'],
];
foreach ($categories_to_seed as $cat) {
    $c_chk = mysqli_query($conn, "SELECT id FROM violation_categories WHERE name = '{$cat[0]}' LIMIT 1");
    if ($c_chk && mysqli_num_rows($c_chk) === 0) {
        $c_ins = mysqli_prepare($conn, "INSERT INTO violation_categories (name, fine_amount, description) VALUES (?, ?, ?)");
        mysqli_stmt_bind_param($c_ins, "sds", $cat[0], $cat[1], $cat[2]);
        mysqli_stmt_execute($c_ins);
        mysqli_stmt_close($c_ins);
    }
}

// ---------------- SEED REALISTIC RESERVATIONS FOR AREA MANAGERS ----------------
// If reservations table has fewer than 5 records, add realistic active/upcoming bookings per location
$res_total_check = mysqli_query($conn, "SELECT COUNT(*) AS c FROM reservations");
$res_total = $res_total_check ? (int)(mysqli_fetch_assoc($res_total_check)['c'] ?? 0) : 0;
if ($res_total < 5) {
    // Get drivers
    $driver1_id = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT id FROM users WHERE email = 'driver@parksmart.io' LIMIT 1"))['id'] ?? 1);
    $driver2_id = (int)(mysqli_fetch_assoc(mysqli_query($conn, "SELECT id FROM users WHERE email = 'uiu.student@uiu.ac.bd' LIMIT 1"))['id'] ?? $driver1_id);

    // Fetch all locations
    $all_locs_res = mysqli_query($conn, "SELECT id, name, price_per_hour FROM parking_locations ORDER BY id ASC");
    $loc_list = [];
    while ($lr = mysqli_fetch_assoc($all_locs_res)) {
        $loc_list[] = $lr;
    }

    $b_counter = 1001;
    foreach ($loc_list as $l) {
        $lid = (int)$l['id'];
        $rate = (float)$l['price_per_hour'];

        // Get two spaces for this location
        $sp_res = mysqli_query($conn, "SELECT id, space_code FROM parking_spaces WHERE location_id = {$lid} ORDER BY id ASC LIMIT 2");
        $sp_rows = [];
        while ($sr = mysqli_fetch_assoc($sp_res)) {
            $sp_rows[] = $sr;
        }

        if (count($sp_rows) >= 2) {
            // Space 1: Active check-in
            $sp1 = $sp_rows[0];
            $bcode1 = "R-" . $b_counter++;
            $drv = (strpos(strtolower($l['name']), 'uiu') !== false) ? $driver2_id : $driver1_id;
            $plate = ($drv === $driver2_id) ? 'DHA-METRO-HA-5521' : 'DHA-GA-11-2233';

            $txn1 = "TXN-" . rand(100000, 999999);
            $txn2 = "TXN-" . rand(100000, 999999);
            mysqli_query($conn, "UPDATE parking_spaces SET status = 'occupied' WHERE id = {$sp1['id']}");
            mysqli_query($conn, "
                INSERT IGNORE INTO reservations 
                    (booking_code, driver_id, location_id, space_id, vehicle_plate, reserve_date, start_time, end_time, total_cost, payment_method, payment_status, transaction_id, otp_code, status, checked_in_at)
                VALUES 
                    ('{$bcode1}', {$drv}, {$lid}, {$sp1['id']}, '{$plate}', CURDATE(), '09:00:00', '13:00:00', " . ($rate * 4) . ", 'bKash', 'paid', '{$txn1}', '1234', 'active', NOW())
            ");

            // Space 2: Booked / Upcoming reservation
            $sp2 = $sp_rows[1];
            $bcode2 = "R-" . $b_counter++;
            mysqli_query($conn, "UPDATE parking_spaces SET status = 'reserved' WHERE id = {$sp2['id']}");
            mysqli_query($conn, "
                INSERT IGNORE INTO reservations 
                    (booking_code, driver_id, location_id, space_id, vehicle_plate, reserve_date, start_time, end_time, total_cost, payment_method, payment_status, transaction_id, otp_code, status)
                VALUES 
                    ('{$bcode2}', {$drv}, {$lid}, {$sp2['id']}, '{$plate}', CURDATE(), '14:00:00', '17:00:00', " . ($rate * 3) . ", 'Nagad', 'paid', '{$txn2}', '5678', 'booked')
            ");

            // Add one sample violation for this location
            $vcode = "V-" . rand(1000, 9999);
            mysqli_query($conn, "
                INSERT IGNORE INTO violations (violation_code, location_id, space_id, category_id, vehicle_plate, description, fine_amount, reported_by, status)
                VALUES ('{$vcode}', {$lid}, {$sp1['id']}, 1, 'DHA-LA-99-0011', 'Vehicle parked across demarcation lines without valid authorization.', 500.00, 1, 'open')
            ");
        }
    }
}

/**
 * Auto-frees parking spaces and auto-completes reservations whose time window has expired.
 * Updates time-to-time and daily-to-daily to keep all facilities accurate.
 */
function auto_release_expired_spaces($conn) {
    if (!$conn) return;

    // 1. Auto-complete bookings that were never checked in.
    // Checked-in active reservations remain active after scheduled end so the manager can check them out and finalize overtime fine.
    mysqli_query($conn, "
        UPDATE reservations 
        SET status = 'completed', 
            checked_out_at = COALESCE(checked_out_at, NOW())
        WHERE status IN ('booked', 'upcoming')
          AND (
              reserve_date < CURDATE() 
              OR (reserve_date = CURDATE() AND end_time <= CURTIME())
          )
    ");

    // 2. Auto-free spaces: Any space marked 'reserved' or 'occupied'
    // that no longer has an ongoing active, booked, or upcoming reservation covering right now
    mysqli_query($conn, "
        UPDATE parking_spaces ps
        SET ps.status = 'free'
        WHERE ps.status IN ('reserved', 'occupied')
          AND ps.id NOT IN (
              SELECT DISTINCT r.space_id 
              FROM reservations r 
              WHERE r.status IN ('booked', 'upcoming', 'active')
                AND r.reserve_date = CURDATE()
                AND r.start_time <= CURTIME()
                AND r.end_time > CURTIME()
          )
    ");
}

// Automatically execute auto-release on every request
auto_release_expired_spaces($conn);
