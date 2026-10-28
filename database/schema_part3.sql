
USE parksmart;


ALTER TABLE users
    MODIFY COLUMN status ENUM('active','pending','blocked') NOT NULL DEFAULT 'active';



ALTER TABLE users
    ADD COLUMN vehicle_plate VARCHAR(30) NULL AFTER phone;

ALTER TABLE users
    ADD COLUMN uiu_id VARCHAR(10) NULL UNIQUE AFTER phone;


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
