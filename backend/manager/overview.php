<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$user = current_user();
$user_id = $user['id'];
$manager_loc_id = get_manager_location_id($conn, $user);

$loc = null;
if ($user['role'] === 'manager') {
    if ($manager_loc_id > 0) {
        $loc_stmt = mysqli_prepare($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations WHERE id = ? LIMIT 1");
        mysqli_stmt_bind_param($loc_stmt, "i", $manager_loc_id);
        mysqli_stmt_execute($loc_stmt);
        $loc = mysqli_fetch_assoc(mysqli_stmt_get_result($loc_stmt));
        mysqli_stmt_close($loc_stmt);
    }
    if (!$loc) {
        send_json(['success' => false, 'message' => 'No parking area has been assigned to your manager account. Please contact an administrator.'], 403);
    }
    $loc_id = (int)$loc['id'];
} else {
    // Admin can specify location_id or default to first
    $loc_id_req = (int)($_GET['location_id'] ?? 0);
    if ($loc_id_req > 0) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations WHERE id = {$loc_id_req} LIMIT 1"));
    }
    if (!$loc) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address, price_per_hour, total_spaces FROM parking_locations ORDER BY id ASC LIMIT 1"));
    }
    $loc_id = $loc ? (int)$loc['id'] : 1;
}

// Space counts
// Availability is reservation-aware: a space with a current/future booking is
// not counted as available even when its base parking_spaces.status is still 'free'.
$spaces_res = mysqli_query($conn, "SELECT status, COUNT(*) as cnt FROM parking_spaces WHERE location_id = {$loc_id} GROUP BY status");
$space_counts = ['free' => 0, 'occupied' => 0, 'reserved' => 0, 'maintenance' => 0];
$total_spaces = 0;
while ($row = mysqli_fetch_assoc($spaces_res)) {
    $space_counts[$row['status']] = (int)$row['cnt'];
    $total_spaces += (int)$row['cnt'];
}
if ($total_spaces === 0) $total_spaces = (int)($loc['total_spaces'] ?? 20);

// Count every unique space that is currently occupied/maintenance/reserved OR
// has a booked/upcoming/active reservation that has not expired. This fixes the
// Overview showing e.g. 20/20 immediately after a reservation is created.
$blocked_sql = mysqli_query($conn, "
    SELECT COUNT(DISTINCT ps.id) AS cnt
    FROM parking_spaces ps
    LEFT JOIN reservations r ON r.space_id = ps.id
        AND r.location_id = {$loc_id}
        AND r.status IN ('booked', 'upcoming', 'active')
        AND (
            r.reserve_date > CURDATE()
            OR (r.reserve_date = CURDATE() AND r.end_time > CURTIME())
        )
    WHERE ps.location_id = {$loc_id}
      AND (ps.status IN ('occupied', 'reserved', 'maintenance') OR r.id IS NOT NULL)
");
$blocked_spaces = (int)(mysqli_fetch_assoc($blocked_sql)['cnt'] ?? 0);
$space_counts['reserved'] = (int)(mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(DISTINCT r.space_id) AS cnt
    FROM reservations r
    WHERE r.location_id = {$loc_id}
      AND r.status IN ('booked', 'upcoming', 'active')
      AND (r.reserve_date > CURDATE() OR (r.reserve_date = CURDATE() AND r.end_time > CURTIME()))
"))['cnt'] ?? 0);
$space_counts['occupied'] = (int)(mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS cnt FROM parking_spaces
    WHERE location_id = {$loc_id} AND status = 'occupied'
"))['cnt'] ?? 0);
$space_counts['maintenance'] = (int)(mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS cnt FROM parking_spaces
    WHERE location_id = {$loc_id} AND status = 'maintenance'
"))['cnt'] ?? 0);
$space_counts['free'] = max(0, $total_spaces - $blocked_spaces);

// Live active overtime monitoring
// Overtime is calculated from the scheduled end time while the reservation
// remains ACTIVE. The helper also persists the latest fine amount.
$active_overtime = [];
$active_overtime_res = mysqli_query($conn, "
    SELECT r.id, r.booking_code, r.driver_id, r.space_id, r.location_id,
           r.reserve_date, r.start_time, r.end_time, r.checked_in_at,
           r.fine_amount, r.status,
           u.full_name AS driver_name,
           COALESCE(r.vehicle_plate, u.vehicle_plate, '-') AS vehicle_plate,
           ps.space_code, pl.name AS location_name, pl.price_per_hour
    FROM reservations r
    JOIN users u ON u.id = r.driver_id
    JOIN parking_spaces ps ON ps.id = r.space_id
    JOIN parking_locations pl ON pl.id = r.location_id
    WHERE r.location_id = {$loc_id} AND r.status = 'active'
    ORDER BY r.checked_in_at ASC
");
if ($active_overtime_res) {
    while ($o_row = mysqli_fetch_assoc($active_overtime_res)) {
        $o_row['fine_amount'] = (float)($o_row['fine_amount'] ?? 0);
        monitor_and_sync_overtime($conn, $o_row);
        if (!empty($o_row['is_overtime'])) {
            $active_overtime[] = $o_row;
        }
    }
}

// Trip counts
$active_res_cnt = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as cnt FROM reservations WHERE location_id = {$loc_id} AND status = 'active'"))['cnt'] ?? 0;
$booked_res_cnt = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as cnt FROM reservations WHERE location_id = {$loc_id} AND status = 'booked'"))['cnt'] ?? 0;
$upcoming_res_cnt = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) as cnt FROM reservations 
    WHERE location_id = {$loc_id} 
      AND status IN ('booked', 'upcoming') 
      AND (reserve_date > CURDATE() OR (reserve_date = CURDATE() AND start_time > CURTIME()))
"))['cnt'] ?? 0;
$completed_res_cnt = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as cnt FROM reservations WHERE location_id = {$loc_id} AND status IN ('completed', 'complete')"))['cnt'] ?? 0;
$cancelled_res_cnt = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) as cnt FROM reservations WHERE location_id = {$loc_id} AND status = 'cancelled'"))['cnt'] ?? 0;

// Revenue & fines
$rev_today_row = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COALESCE(SUM(total_cost), 0) AS revenue
    FROM reservations
    WHERE location_id = {$loc_id} AND status IN ('active', 'completed', 'complete') AND reserve_date = CURDATE()
"));
$today_revenue = (float)$rev_today_row['revenue'];

$rev_total_row = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COALESCE(SUM(total_cost), 0) AS revenue
    FROM reservations
    WHERE location_id = {$loc_id} AND status IN ('active', 'completed', 'complete')
"));
$total_revenue = (float)$rev_total_row['revenue'];

$fines_row = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COALESCE(SUM(fine_amount), 0) AS fines
    FROM reservations
    WHERE location_id = {$loc_id} AND status = 'cancelled'
"));
$cancellation_fines = (float)$fines_row['fines'];

// Open violations
$vio_row = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT COUNT(*) AS cnt FROM violations WHERE location_id = {$loc_id} AND status = 'open'
"));
$open_violations = (int)$vio_row['cnt'];

// Occupancy percentage
$occupied_pct = $total_spaces > 0 ? round(($space_counts['occupied'] / $total_spaces) * 100, 1) : 0;
$reserved_pct = $total_spaces > 0 ? round(($space_counts['reserved'] / $total_spaces) * 100, 1) : 0;
$free_pct = max(0, round(100 - $occupied_pct - $reserved_pct, 1));

// Payment breakdown
$payment_res = mysqli_query($conn, "
    SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'bKash' THEN total_cost ELSE 0 END), 0) AS bkash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Nagad' THEN total_cost ELSE 0 END), 0) AS nagad_total,
        COALESCE(SUM(CASE WHEN payment_method LIKE '%Card%' THEN total_cost ELSE 0 END), 0) AS card_total,
        COALESCE(SUM(CASE WHEN payment_method LIKE '%Cash%' OR payment_method LIKE '%Arrival%' THEN total_cost ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM reservations
    WHERE location_id = {$loc_id}
");
$payments = mysqli_fetch_assoc($payment_res) ?: [];

// Recent & Today's reservations (comprehensive overview)
$today_res = mysqli_query($conn, "
    SELECT r.id, r.space_id, r.location_id, r.booking_code, r.reserve_date, r.start_time, r.end_time, r.total_cost, r.discount_amount,
           r.payment_method, r.payment_status, r.transaction_id, r.fine_amount, r.refund_amount,
           r.status, r.otp_code, r.checked_in_at, r.checked_out_at,
           u.full_name AS driver_name, u.phone AS driver_phone,
           COALESCE(r.vehicle_plate, u.vehicle_plate, '-') AS vehicle_plate,
           ps.space_code, pl.name AS location_name, pl.price_per_hour
    FROM reservations r
    JOIN users u ON u.id = r.driver_id
    JOIN parking_spaces ps ON ps.id = r.space_id
    JOIN parking_locations pl ON pl.id = r.location_id
    WHERE r.location_id = {$loc_id}
    ORDER BY r.reserve_date DESC, r.start_time DESC
    LIMIT 25
");

$reservations = [];

while ($row = mysqli_fetch_assoc($today_res)) {
    $row['total_cost'] = (float)$row['total_cost'];
    $row['discount_amount'] = (float)($row['discount_amount'] ?? 0);
    $row['fine_amount'] = (float)($row['fine_amount'] ?? 0);
    $row['refund_amount'] = (float)($row['refund_amount'] ?? 0);

    monitor_and_sync_overtime($conn, $row);

    $reservations[] = $row;
}

send_json([
    'success' => true,
    'manager' => current_user(),
    'location' => $loc,
    'metrics' => [
        'available_spaces' => $space_counts['free'],
        'total_spaces' => $total_spaces,
        'occupied_spaces' => $space_counts['occupied'],
        'reserved_spaces' => $space_counts['reserved'],
        'active_now' => (int)$active_res_cnt,
        'active_overtime' => count($active_overtime),
        'booked_trips' => (int)$booked_res_cnt,
        'upcoming_trips' => (int)$upcoming_res_cnt,
        'completed_trips' => (int)$completed_res_cnt,
        'cancelled_trips' => (int)$cancelled_res_cnt,
        'today_revenue' => $today_revenue,
        'total_revenue' => $total_revenue,
        'cancellation_fines' => $cancellation_fines,
        'open_violations' => $open_violations,
        'occupied_pct' => $occupied_pct,
        'reserved_pct' => $reserved_pct,
        'free_pct' => $free_pct,
    ],
    'payment_summary' => [
        'bkash' => (float)$payments['bkash_total'],
        'nagad' => (float)$payments['nagad_total'],
        'card' => (float)$payments['card_total'],
        'cash' => (float)$payments['cash_total'],
        'paid_count' => (int)$payments['paid_count'],
        'pending_count' => (int)$payments['pending_count'],
        'fines_collected' => $cancellation_fines,
    ],
    'reservations' => $reservations,
    'active_overtime' => $active_overtime
]);
