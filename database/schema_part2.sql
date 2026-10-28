
USE parksmart;


CREATE TABLE IF NOT EXISTS parking_locations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(120)   NOT NULL,
    address        VARCHAR(200)   NOT NULL,
    price_per_hour DECIMAL(10,2) NOT NULL,
    total_spaces   INT            NOT NULL DEFAULT 0,
    rating         DECIMAL(2,1)   NOT NULL DEFAULT 5.0,
    manager_id     INT            NULL,                 -- optional: manager in charge
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS parking_spaces (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT             NOT NULL,
    space_code  VARCHAR(20)     NOT NULL,   -- e.g. A-14
    status      ENUM('free','reserved','occupied','maintenance') NOT NULL DEFAULT 'free',
    UNIQUE KEY uniq_location_space (location_id, space_code),
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- Table: reservations
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    booking_code   VARCHAR(20)     NOT NULL UNIQUE,   -- e.g. R-4821
    driver_id      INT             NOT NULL,
    location_id    INT             NOT NULL,
    space_id       INT             NOT NULL,
    reserve_date   DATE            NOT NULL,
    start_time     TIME            NOT NULL,
    end_time       TIME            NOT NULL,
    total_cost     DECIMAL(10,2)   NOT NULL,
    otp_code       VARCHAR(6)      NOT NULL,           -- shown to driver, used by manager to check in
    status         ENUM('upcoming','active','completed','cancelled') NOT NULL DEFAULT 'upcoming',
    checked_in_at  DATETIME        NULL,
    checked_out_at DATETIME        NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id)    REFERENCES parking_spaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- Table: issue_reports  (driver "Report Issue" page)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_reports (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    report_code  VARCHAR(20)     NOT NULL UNIQUE,   -- e.g. IR-0041
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

-- ----------------------------------------------------------
-- Table: violations  (manager-reported)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS violations (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    violation_code VARCHAR(20)   NOT NULL UNIQUE,   -- e.g. V-0012
    location_id    INT           NOT NULL,
    space_id       INT           NULL,
    vehicle_plate  VARCHAR(30)   NULL,
    description    TEXT          NOT NULL,
    reported_by    INT           NOT NULL,          -- manager's user id
    status         ENUM('open','resolved') NOT NULL DEFAULT 'open',
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (space_id)    REFERENCES parking_spaces(id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- Seed: the 4 demo locations shown in the original frontend mockup
-- ----------------------------------------------------------
INSERT INTO parking_locations (name, address, price_per_hour, total_spaces, rating) VALUES
('Mirpur Parking',    'Mirpur-10, Dhaka',    100.00, 20, 4.8),
('Motijheel Parking', 'Motijheel C/A, Dhaka',200.00, 20, 4.5),
('Dhanmondi Parking', 'Dhanmondi 27, Dhaka', 300.00, 20, 4.3),
('Gulshan Parking',   'Gulshan-2, Dhaka',    250.00, 20, 4.9)
ON DUPLICATE KEY UPDATE name = name;

-- Generate 20 demo spaces (A-01 .. A-20) per location.
-- Uses a numbers helper via a stored routine-free approach (simple INSERT loop via JOIN).
INSERT INTO parking_spaces (location_id, space_code, status)
SELECT pl.id, CONCAT('A-', LPAD(n.n, 2, '0')), 'free'
FROM parking_locations pl, (
    SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
    UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
    UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) n
ON DUPLICATE KEY UPDATE status = status;
