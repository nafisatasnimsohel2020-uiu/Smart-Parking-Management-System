<?php
require '../config.php';
require '../auth_guard.php';
require_role(['manager', 'admin']);

$user = current_user();
$user_id = $user['id'];
$manager_loc_id = get_manager_location_id($conn, $user);

$loc = null;
if ($user['role'] === 'manager') {
    if ($manager_loc_id <= 0) {
        send_json(['success' => false, 'message' => 'No parking area assigned to your manager account.'], 403);
    }
    $loc_stmt = mysqli_prepare($conn, "SELECT id, name, address FROM parking_locations WHERE id = ? LIMIT 1");
    mysqli_stmt_bind_param($loc_stmt, "i", $manager_loc_id);
    mysqli_stmt_execute($loc_stmt);
    $loc = mysqli_fetch_assoc(mysqli_stmt_get_result($loc_stmt));
    mysqli_stmt_close($loc_stmt);
    if (!$loc) {
        send_json(['success' => false, 'message' => 'Assigned parking area was not found.'], 404);
    }
} else {
    $loc_id_req = (int)($_GET['location_id'] ?? 0);
    if ($loc_id_req > 0) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address FROM parking_locations WHERE id = {$loc_id_req} LIMIT 1"));
    }
    if (!$loc) {
        $loc = mysqli_fetch_assoc(mysqli_query($conn, "SELECT id, name, address FROM parking_locations ORDER BY id ASC LIMIT 1"));
    }
}
$loc_id = $loc ? (int)$loc['id'] : 1;

// Weekly metrics (last 7 days)
$week_metrics = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT 
        COALESCE(SUM(total_cost), 0) AS weekly_revenue,
        COUNT(*) AS weekly_reservations
    FROM reservations
    WHERE location_id = {$loc_id} 
      AND status IN ('active', 'completed')
      AND reserve_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
"));

// Peak day
$peak_day_res = mysqli_fetch_assoc(mysqli_query($conn, "
    SELECT DAYNAME(reserve_date) AS day_name, SUM(total_cost) AS rev
    FROM reservations
    WHERE location_id = {$loc_id} 
      AND status IN ('active', 'completed')
      AND reserve_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY reserve_date, DAYNAME(reserve_date)
    ORDER BY rev DESC
    LIMIT 1
"));

// Daily revenue breakdown for the past 7 days
$days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
$daily_data = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-{$i} days"));
    $dayName = date('D', strtotime($date));
    $rev_row = mysqli_fetch_assoc(mysqli_query($conn, "
        SELECT COALESCE(SUM(total_cost), 0) AS rev
        FROM reservations
        WHERE location_id = {$loc_id} AND status IN ('active', 'completed') AND reserve_date = '{$date}'
    "));
    $daily_data[] = [
        'date' => $date,
        'day' => $dayName,
        'revenue' => (float) $rev_row['rev']
    ];
}

send_json([
    'success' => true,
    'location' => $loc,
    'weekly_revenue' => (float)$week_metrics['weekly_revenue'],
    'weekly_reservations' => (int)$week_metrics['weekly_reservations'],
    'peak_day' => $peak_day_res ? $peak_day_res['day_name'] : 'Friday',
    'peak_amount' => $peak_day_res ? (float)$peak_day_res['rev'] : 0,
    'avg_occupancy' => 74, // typical average rate
    'daily' => $daily_data
]);
