

CREATE DATABASE IF NOT EXISTS parksmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parksmart;


CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(120)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    phone         VARCHAR(20)         NOT NULL UNIQUE,
    uiu_id        VARCHAR(10)         NULL,
    password_hash VARCHAR(255)        NOT NULL,
    role          ENUM('admin','manager','driver') NOT NULL DEFAULT 'driver',
    status        ENUM('active','blocked') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otps (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    identifier  VARCHAR(150)        NOT NULL,   -- email used for this OTP
    otp_code    VARCHAR(6)          NOT NULL,
    purpose     ENUM('signup','login') NOT NULL,
    is_used     TINYINT(1)          NOT NULL DEFAULT 0,
    expires_at  DATETIME            NOT NULL,
    created_at  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_identifier_purpose (identifier, purpose)
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- Seed: demo admin account
-- Do NOT paste a plain password here -- MySQL cannot hash it.
-- Steps:
--   1) Open backend/generate_hash.php in the browser once,
--      e.g. http://localhost/backend/generate_hash.php?password=Admin@123
--   2) Copy the printed hash and paste it below, then run this INSERT.
-- ----------------------------------------------------------
-- INSERT INTO users (full_name, email, phone, password_hash, role)
-- VALUES (
--     'System Admin',
--     'admin@parksmart.io',
--     '+8801000000000',
--     'PASTE_GENERATED_HASH_HERE',
--     'admin'
-- );
