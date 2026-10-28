<?php

header('Content-Type: text/plain');

if (!isset($_GET['password']) || trim($_GET['password']) === '') {
    echo "Usage: generate_hash.php?password=YourPassword123";
    exit();
}

echo password_hash($_GET['password'], PASSWORD_DEFAULT);
