<?php
require '../config.php';

$data = json_decode(file_get_contents('php://input'), true);

// If submitted via standard form POST (form-encoded), handle $_POST too
if (!$data && !empty($_POST)) {
    $data = $_POST;
}

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$subject = trim($data['subject'] ?? '');
$message = trim($data['message'] ?? '');

if ($name === '' || $email === '' || $message === '') {
    send_json(['success' => false, 'message' => 'Please fill in your name, email, and message.'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    send_json(['success' => false, 'message' => 'Please provide a valid email address.'], 400);
}

if ($subject === '') {
    $subject = 'General Support Inquiry';
}

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO contact_messages (name, email, subject, message, status) VALUES (?, ?, ?, ?, 'new')"
);
mysqli_stmt_bind_param($stmt, "ssss", $name, $email, $subject, $message);

if (!mysqli_stmt_execute($stmt)) {
    send_json(['success' => false, 'message' => 'Could not save message: ' . mysqli_error($conn)], 500);
}
mysqli_stmt_close($stmt);

send_json([
    'success' => true,
    'message' => 'Thank you! Your message has been sent successfully. Our support team will contact you shortly.'
]);
