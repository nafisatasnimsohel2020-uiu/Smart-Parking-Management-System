
CREATE DATABASE IF NOT EXISTS parksmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE parksmart;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(120)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    phone         VARCHAR(20)         NOT NULL UNIQUE,
    uiu_id        VARCHAR(10)         NULL,
    vehicle_plate VARCHAR(30)         NULL,
    password_hash VARCHAR(255)        NOT NULL,
    role          ENUM('admin','manager','driver') NOT NULL DEFAULT 'driver',
    status        ENUM('active','pending','blocked') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. OTPs table
CREATE TABLE IF NOT EXISTS otps (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    identifier  VARCHAR(150)        NOT NULL,
    otp_code    VARCHAR(6)          NOT NULL,
    purpose     ENUM('signup','login') NOT NULL,
    is_used     TINYINT(1)          NOT NULL DEFAULT 0,
    expires_at  DATETIME            NOT NULL,
    created_at  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_identifier_purpose (identifier, purpose)
) ENGINE=InnoDB;

-- 3. Parking Locations
CREATE TABLE IF NOT EXISTS parking_locations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(120)   NOT NULL,
    address        VARCHAR(200)   NOT NULL,
    price_per_hour DECIMAL(10,2) NOT NULL,
    total_spaces   INT            NOT NULL DEFAULT 0,
    rating         DECIMAL(2,1)   NOT NULL DEFAULT 5.0,
    manager_id     INT            NULL,
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Parking Spaces
CREATE TABLE IF NOT EXISTS parking_spaces (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT             NOT NULL,
    space_code  VARCHAR(20)     NOT NULL,
    status      ENUM('free','reserved','occupied','maintenance') NOT NULL DEFAULT 'free',
    UNIQUE KEY uniq_location_space (location_id, space_code),
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Pricing Rules
CREATE TABLE IF NOT EXISTS pricing_rules (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    location_id         INT           NOT NULL UNIQUE,
    peak_multiplier     DECIMAL(3,2)  NOT NULL DEFAULT 1.25,
    peak_start          TIME          NOT NULL DEFAULT '08:00:00',
    peak_end            TIME          NOT NULL DEFAULT '11:00:00',
    occupancy_threshold INT           NOT NULL DEFAULT 75,
    enabled             TINYINT(1)    NOT NULL DEFAULT 1,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    booking_code   VARCHAR(20)     NOT NULL UNIQUE,
    driver_id      INT             NOT NULL,
    location_id    INT             NOT NULL,
    space_id       INT             NOT NULL,
    vehicle_plate  VARCHAR(30)     NULL,
    reserve_date   DATE            NOT NULL,
    start_time     TIME            NOT NULL,
    end_time       TIME            NOT NULL,
    total_cost     DECIMAL(10,2)   NOT NULL,
    discount_amount DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50)     NOT NULL DEFAULT 'bKash',
    payment_status ENUM('paid', 'pending', 'refunded', 'fine_applied') NOT NULL DEFAULT 'paid',
    transaction_id VARCHAR(60)     NULL,
    fine_amount    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    fine_status    ENUM('none','pending','collected','waived') NOT NULL DEFAULT 'none',
    fine_handled_at DATETIME NULL,
    fine_handled_by INT NULL,
    refund_amount  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    cancellation_reason VARCHAR(255) NULL,
    otp_code       VARCHAR(6)      NOT NULL,
    status         ENUM('booked','upcoming','active','complete','completed','cancelled') NOT NULL DEFAULT 'booked',
    checked_in_at  DATETIME        NULL,
    checked_out_at DATETIME        NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id)    REFERENCES parking_spaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6b. Ratings (Driver rates a location after a completed trip)
CREATE TABLE IF NOT EXISTS ratings (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT             NOT NULL UNIQUE,
    driver_id      INT             NOT NULL,
    location_id    INT             NOT NULL,
    rating         TINYINT         NOT NULL,
    comment        VARCHAR(255)    NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id)      REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id)    REFERENCES parking_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Issue Reports (Driver report issue)
CREATE TABLE IF NOT EXISTS issue_reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    report_code  VARCHAR(20)     NOT NULL UNIQUE,
    driver_id    INT             NOT NULL,
    category     VARCHAR(150)    NOT NULL,
    location_id  INT             NULL,
    booking_code VARCHAR(20)     NULL,
    description  TEXT            NOT NULL,
    status       ENUM('submitted','under_review','resolved') NOT NULL DEFAULT 'submitted',
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Violation Categories
CREATE TABLE IF NOT EXISTS violation_categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL UNIQUE,
    fine_amount DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    description VARCHAR(255)  NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 9. Violations
CREATE TABLE IF NOT EXISTS violations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    violation_code VARCHAR(20)   NOT NULL UNIQUE,
    location_id    INT           NOT NULL,
    space_id       INT           NULL,
    category_id    INT           NULL,
    vehicle_plate  VARCHAR(30)   NULL,
    description    TEXT          NOT NULL,
    fine_amount    DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    reported_by    INT           NOT NULL,
    status         ENUM('open','resolved') NOT NULL DEFAULT 'open',
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id)    REFERENCES parking_spaces(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES violation_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Chat Messages (Driver <-> Manager)
CREATE TABLE IF NOT EXISTS chat_messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sender_id   INT       NOT NULL,
    receiver_id INT       NOT NULL,
    message     TEXT      NOT NULL,
    is_read     TINYINT(1) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Contact Messages (Guest inquiries)
CREATE TABLE IF NOT EXISTS contact_messages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    subject    VARCHAR(200) NOT NULL,
    message    TEXT         NOT NULL,
    status     ENUM('new','read','replied') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;



INSERT INTO users (id, full_name, email, phone, vehicle_plate, password_hash, role, status) VALUES
(1, 'System Admin', 'admin@parksmart.io', '+8801000000000', NULL, '$2y$10$b3sfUycTQjwZcIk.dSRX0.fEk1H84.ghAyKxo6J/nZfh1vGcnmksq', 'admin', 'active'),
(2, 'Shamsil Arefin', 'manager@parksmart.io', '+8801700000001', NULL, '$2y$10$b3sfUycTQjwZcIk.dSRX0.fEk1H84.ghAyKxo6J/nZfh1vGcnmksq', 'manager', 'active'),
(3, 'Prityonti Roy', 'prityonti@parksmart.io', '+8801700000002', NULL, '$2y$10$b3sfUycTQjwZcIk.dSRX0.fEk1H84.ghAyKxo6J/nZfh1vGcnmksq', 'manager', 'active'),
(4, 'Sharmila Shikder', 'driver@parksmart.io', '+8801710000001', 'DHA-GA-1122', '$2y$10$b3sfUycTQjwZcIk.dSRX0.fEk1H84.ghAyKxo6J/nZfh1vGcnmksq', 'driver', 'active'),
(5, 'Razit Haque', 'razit@parksmart.io', '+8801710000002', 'DHA-CHA-4821', '$2y$10$b3sfUycTQjwZcIk.dSRX0.fEk1H84.ghAyKxo6J/nZfh1vGcnmksq', 'driver', 'active')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

INSERT INTO parking_locations (id, name, address, price_per_hour, total_spaces, rating, manager_id) VALUES
(1, 'Mirpur Parking',    'Mirpur-10, Dhaka',    100.00, 20, 4.8, 2),
(2, 'Motijheel Parking', 'Motijheel C/A, Dhaka',200.00, 20, 4.5, 3),
(3, 'Dhanmondi Parking', 'Dhanmondi 27, Dhaka', 300.00, 20, 4.3, NULL),
(4, 'Gulshan Parking',   'Gulshan-2, Dhaka',    250.00, 20, 4.9, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name), price_per_hour = VALUES(price_per_hour), manager_id = VALUES(manager_id);

-- Generate spaces
INSERT INTO parking_spaces (location_id, space_code, status)
SELECT pl.id, CONCAT('A-', LPAD(n.n, 2, '0')), 'free'
FROM parking_locations pl, (
    SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
    UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
    UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) n
ON DUPLICATE KEY UPDATE status = status;

-- Pricing rules
INSERT INTO pricing_rules (location_id, peak_multiplier, peak_start, peak_end, occupancy_threshold, enabled) VALUES
(1, 1.25, '08:00:00', '11:00:00', 75, 1),
(2, 1.30, '09:00:00', '12:00:00', 80, 1)
ON DUPLICATE KEY UPDATE peak_multiplier = VALUES(peak_multiplier);

-- Violation Categories
INSERT INTO violation_categories (id, name, fine_amount, description) VALUES
(1, 'Unauthorized Parking', 500.00, 'Parking without a valid active reservation or booking code'),
(2, 'Overstayed Time Limit', 300.00, 'Parked past the booked checkout time without extension'),
(3, 'Blocking Emergency Lane', 1000.00, 'Vehicle parked obstructing fire exit or driveway'),
(4, 'Improper Space Alignment', 200.00, 'Occupying two spots or parked across marking lines')
ON DUPLICATE KEY UPDATE name = VALUES(name), fine_amount = VALUES(fine_amount);

-- Sample Reservations
INSERT INTO reservations (id, booking_code, driver_id, location_id, space_id, vehicle_plate, reserve_date, start_time, end_time, total_cost, otp_code, status, checked_in_at, checked_out_at) VALUES
(1, 'R-4821', 4, 1, 14, 'DHA-GA-1122', CURDATE(), '09:00:00', '12:00:00', 300.00, '7842', 'active', NOW(), NULL),
(2, 'R-4822', 5, 1, 7, 'DHA-CHA-4821', CURDATE(), '13:00:00', '15:00:00', 200.00, '3195', 'upcoming', NULL, NULL),
(3, 'R-4819', 4, 2, 23, 'DHA-GA-1122', DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:00:00', '13:00:00', 600.00, '9912', 'completed', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 21 HOUR)),
(4, 'R-4815', 5, 1, 3, 'DHA-CHA-4821', DATE_SUB(CURDATE(), INTERVAL 2 DAY), '14:00:00', '16:00:00', 200.00, '1284', 'completed', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 46 HOUR)),
(5, 'R-4810', 4, 3, 45, 'DHA-GA-1122', DATE_SUB(CURDATE(), INTERVAL 3 DAY), '11:00:00', '12:00:00', 300.00, '5541', 'cancelled', NULL, NULL)
ON DUPLICATE KEY UPDATE booking_code = VALUES(booking_code);

-- Update space 14 status to occupied
UPDATE parking_spaces SET status = 'occupied' WHERE location_id = 1 AND space_code = 'A-14';
UPDATE parking_spaces SET status = 'reserved' WHERE location_id = 1 AND space_code = 'A-07';

-- Sample Violations
INSERT INTO violations (id, violation_code, location_id, space_id, category_id, vehicle_plate, description, fine_amount, reported_by, status) VALUES
(1, 'V-1001', 1, 14, 2, 'DHA-METRO-1122', 'Vehicle stayed 45 minutes beyond reservation end time.', 300.00, 2, 'open'),
(2, 'V-1002', 1, NULL, 3, 'DHA-GA-9988', 'Parked directly in front of the exit barrier gate.', 1000.00, 2, 'open'),
(3, 'V-1003', 2, 25, 1, 'DHA-CHA-5541', 'No reservation found for this vehicle in space A-05.', 500.00, 3, 'resolved')
ON DUPLICATE KEY UPDATE violation_code = VALUES(violation_code);

-- Sample Chat Messages
INSERT INTO chat_messages (id, sender_id, receiver_id, message, is_read, created_at) VALUES
(1, 4, 2, 'Hello Shamsil, is space A-14 accessible right now? I am near the gate.', 1, DATE_SUB(NOW(), INTERVAL 20 MINUTE)),
(2, 2, 4, 'Hi Sharmila! Yes, gate 1 is open, please proceed to A-14.', 1, DATE_SUB(NOW(), INTERVAL 18 MINUTE)),
(3, 4, 2, 'Thanks! Verified with OTP 7842.', 1, DATE_SUB(NOW(), INTERVAL 15 MINUTE))
ON DUPLICATE KEY UPDATE id = id;
