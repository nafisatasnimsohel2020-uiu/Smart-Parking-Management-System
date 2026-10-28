<?php

require '../config.php';
require '../auth_guard.php';
require_role(['admin']);

$result = mysqli_query($conn, "
    SELECT id, full_name, email FROM users
    WHERE role = 'manager' AND status = 'active'
    ORDER BY full_name
");
$managers = [];
while ($row = mysqli_fetch_assoc($result)) {
    $managers[] = $row;
}

send_json(['success' => true, 'managers' => $managers]);
