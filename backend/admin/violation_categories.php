<?php
require '../config.php';
require '../auth_guard.php';
require_role(['admin', 'manager']);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sql = "SELECT vc.id, vc.name, vc.fine_amount, vc.description, vc.created_at,
                   (SELECT COUNT(*) FROM violations v WHERE v.category_id = vc.id) AS violation_count
            FROM violation_categories vc
            ORDER BY vc.name ASC";
    $res = mysqli_query($conn, $sql);
    $categories = [];
    while ($row = mysqli_fetch_assoc($res)) {
        $row['id'] = (int)$row['id'];
        $row['fine_amount'] = (float)$row['fine_amount'];
        $row['violation_count'] = (int)$row['violation_count'];
        $categories[] = $row;
    }
    send_json(['success' => true, 'categories' => $categories]);
}

// Admin only for modifying categories
require_role(['admin']);

$data = json_decode(file_get_contents('php://input'), true);
$action = trim($data['action'] ?? 'create');

if ($action === 'create') {
    $name = trim($data['name'] ?? '');
    $fine_amount = (float)($data['fine_amount'] ?? 500);
    $description = trim($data['description'] ?? '');

    if ($name === '') {
        send_json(['success' => false, 'message' => 'Category name is required.'], 400);
    }

    $stmt = mysqli_prepare($conn, "INSERT INTO violation_categories (name, fine_amount, description) VALUES (?, ?, ?)");
    mysqli_stmt_bind_param($stmt, "sds", $name, $fine_amount, $description);
    if (!mysqli_stmt_execute($stmt)) {
        send_json(['success' => false, 'message' => 'Category already exists or error: ' . mysqli_error($conn)], 400);
    }
    $id = mysqli_insert_id($conn);
    mysqli_stmt_close($stmt);

    send_json(['success' => true, 'message' => 'Violation category created.', 'id' => $id]);
}

if ($action === 'update') {
    $id = (int)($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $fine_amount = (float)($data['fine_amount'] ?? 500);
    $description = trim($data['description'] ?? '');

    if ($id <= 0 || $name === '') {
        send_json(['success' => false, 'message' => 'ID and name are required.'], 400);
    }

    $stmt = mysqli_prepare($conn, "UPDATE violation_categories SET name = ?, fine_amount = ?, description = ? WHERE id = ?");
    mysqli_stmt_bind_param($stmt, "sdsi", $name, $fine_amount, $description, $id);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);

    send_json(['success' => true, 'message' => 'Category updated successfully.']);
}

if ($action === 'delete') {
    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) {
        send_json(['success' => false, 'message' => 'ID is required.'], 400);
    }

    $stmt = mysqli_prepare($conn, "DELETE FROM violation_categories WHERE id = ?");
    mysqli_stmt_bind_param($stmt, "i", $id);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);

    send_json(['success' => true, 'message' => 'Category deleted.']);
}

send_json(['success' => false, 'message' => 'Invalid action.'], 400);
