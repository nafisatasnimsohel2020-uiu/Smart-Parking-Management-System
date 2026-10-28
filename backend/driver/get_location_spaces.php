<?php
require '../config.php';
require '../auth_guard.php';
require_role(['driver', 'manager', 'admin']);

$location_id = (int) ($_GET['location_id'] ?? 0);

if ($location_id <= 0) {
    send_json(['success' => false, 'message' => 'Valid location_id required.'], 400);
}

$date = trim($_GET['date'] ?? '');
$start_time = trim($_GET['start_time'] ?? '');
$end_time = trim($_GET['end_time'] ?? '');

$has_time_filter = ($date !== '' && $start_time !== '' && $end_time !== '');

// Normalize time formats (HH:MM:SS)
if ($has_time_filter) {
    if (strlen($start_time) === 5) $start_time .= ':00';
    if (strlen($end_time) === 5) $end_time .= ':00';
}

if ($has_time_filter) {
    $curr_date = date('Y-m-d');
    $curr_time = date('H:i:s');

    if ($end_time <= $start_time) {
        send_json([
            'success' => true,
            'has_free_slot' => false,
            'available_slots' => 0,
            'total_slots' => 0,
            'message' => 'End time must be after start time.',
            'spaces' => []
        ]);
    }

    if ($date < $curr_date || ($date === $curr_date && $end_time <= $curr_time)) {
        $sp_stmt = mysqli_prepare($conn, "SELECT id, space_code, status FROM parking_spaces WHERE location_id = ? ORDER BY space_code ASC");
        mysqli_stmt_bind_param($sp_stmt, "i", $location_id);
        mysqli_stmt_execute($sp_stmt);
        $sp_res = mysqli_stmt_get_result($sp_stmt);
        $past_spaces = [];
        while ($sp_r = mysqli_fetch_assoc($sp_res)) {
            $sp_r['id'] = (int) $sp_r['id'];
            $sp_r['is_free'] = 0;
            $sp_r['display_status'] = 'Past Time';
            $past_spaces[] = $sp_r;
        }
        mysqli_stmt_close($sp_stmt);

        send_json([
            'success' => true,
            'has_free_slot' => false,
            'is_past' => true,
            'available_slots' => 0,
            'total_slots' => count($past_spaces),
            'message' => 'The selected date or time has already passed today. Please pick an upcoming time window.',
            'spaces' => $past_spaces,
            'counts' => ['free' => 0, 'booked' => count($past_spaces), 'occupied' => 0, 'maintenance' => 0, 'total' => count($past_spaces)]
        ]);
    }

    // Query spaces along with conflict status for the requested date and time window
    $sql = "
        SELECT 
            ps.id, 
            ps.space_code, 
            ps.status AS base_status,
            COALESCE(SUM(
                CASE 
                    WHEN r.id IS NOT NULL 
                         AND r.reserve_date = ? 
                         AND r.status IN ('booked', 'upcoming', 'active') 
                         AND NOT (r.end_time <= ? OR r.start_time >= ?)
                    THEN 1 
                    ELSE 0 
                END
            ), 0) AS conflict_count
        FROM parking_spaces ps
        LEFT JOIN reservations r ON r.space_id = ps.id
        WHERE ps.location_id = ?
        GROUP BY ps.id, ps.space_code, ps.status
        ORDER BY ps.space_code ASC
    ";

    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "sssi", $date, $start_time, $end_time, $location_id);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    $spaces = [];
    $counts = ['free' => 0, 'booked' => 0, 'occupied' => 0, 'maintenance' => 0, 'total' => 0];

    while ($row = mysqli_fetch_assoc($result)) {
        $row['id'] = (int) $row['id'];
        $conflict = (int) $row['conflict_count'];
        $base_status = $row['base_status'];

        if ($base_status === 'maintenance') {
            $row['is_free'] = 0;
            $row['display_status'] = 'Blocked';
            $counts['maintenance']++;
        } elseif ($conflict > 0 || ($date === $curr_date && $start_time <= $curr_time && $base_status === 'occupied')) {
            $row['is_free'] = 0;
            $row['display_status'] = ($base_status === 'occupied') ? 'Occupied' : 'Booked';
            $counts['booked']++;
        } else {
            $row['is_free'] = 1;
            $row['display_status'] = 'Free';
            $counts['free']++;
        }

        $counts['total']++;
        unset($row['conflict_count']);
        unset($row['base_status']);
        $spaces[] = $row;
    }
    mysqli_stmt_close($stmt);
} else {
    // Fallback: current real-time space status
    $sql = "
        SELECT 
            ps.id, 
            ps.space_code, 
            ps.status,
            (CASE WHEN ps.status = 'free' THEN 1 ELSE 0 END) AS is_free
        FROM parking_spaces ps
        WHERE ps.location_id = ?
        ORDER BY ps.space_code ASC
    ";

    $stmt = mysqli_prepare($conn, $sql);
    mysqli_stmt_bind_param($stmt, "i", $location_id);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    $spaces = [];
    $counts = ['free' => 0, 'booked' => 0, 'occupied' => 0, 'maintenance' => 0, 'total' => 0];

    while ($row = mysqli_fetch_assoc($result)) {
        $row['id'] = (int) $row['id'];
        $row['is_free'] = (int) $row['is_free'];
        
        if ($row['status'] === 'free') {
            $row['display_status'] = 'Free';
            $counts['free']++;
        } elseif ($row['status'] === 'reserved') {
            $row['display_status'] = 'Booked';
            $counts['booked']++;
        } elseif ($row['status'] === 'occupied') {
            $row['display_status'] = 'Occupied';
            $counts['occupied']++;
        } else {
            $row['display_status'] = 'Blocked';
            $counts['maintenance']++;
        }

        $counts['total']++;
        $spaces[] = $row;
    }
    mysqli_stmt_close($stmt);
}

send_json([
    'success' => true,
    'location_id' => $location_id,
    'date' => $date,
    'start_time' => $start_time,
    'end_time' => $end_time,
    'has_free_slot' => ($counts['free'] > 0),
    'available_slots' => $counts['free'],
    'total_slots' => $counts['total'],
    'spaces' => $spaces,
    'counts' => $counts
]);
