<?php
require 'config.php';

$_SESSION = [];
session_destroy();

send_json(['success' => true, 'message' => 'Logged out.']);
