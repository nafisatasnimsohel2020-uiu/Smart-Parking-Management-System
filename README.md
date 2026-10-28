# ParkSmart — Login/Signup Backend Setup

Stack: **PHP (procedural, mysqli)** server + **MySQL** database + **JavaScript** (fetch) on the frontend.

## 1. Folder layout added

```
backend/      -> PHP API endpoints
database/     -> schema.sql (run this in MySQL)
js/auth.js    -> frontend logic, calls the PHP endpoints
admin/login.html -> updated to use js/auth.js (this is the shared login page for all roles)
```

## 2. Setup (XAMPP / WAMP / LAMP)

1. Copy this whole project folder into your server's web root
   (e.g. `htdocs/parksmart` for XAMPP).
2. Start Apache + MySQL.
3. Open phpMyAdmin (or the `mysql` CLI) and run `database/schema.sql`.
   This creates the `parksmart` database with `users` and `otps` tables.
4. Edit `backend/config.php` and set your MySQL credentials
   (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`) if they differ from the defaults.
5. Create your first account:
   - Open `http://localhost/parksmart/admin/login.html`
   - Click **Sign Up**, fill the form, click **Send OTP**.
   - Since no real SMS/Email provider is connected yet, the OTP is shown
     directly on screen (labelled "Dev OTP") and also written to your
     PHP error log — this is only for development.
   - Enter that OTP to finish creating the account.
6. Sign in with the same email/password, pick a role, and complete the OTP step.

## 3. Roles

`users.role` can be `admin`, `manager`, or `driver`. Guests do not need an
account — the "Guest" option on the login page skips straight to
`guest/home.html`.

## 4. What's real vs. simulated

- Passwords: hashed with `password_hash()` / verified with `password_verify()` — real.
- Sessions: real PHP sessions (`$_SESSION`), checked via `backend/check_session.php`.
- OTP delivery: **simulated**. `backend/otp_helper.php` → `deliver_otp()` currently
  just logs the OTP. Before going live, plug in a real SMS gateway or mailer there,
  and remove the `dev_otp` field from the API responses.

## 5. Endpoints

| Endpoint | Purpose |
|---|---|
| `backend/register_send_otp.php` | Validate signup fields, send OTP |
| `backend/register_verify_otp.php` | Verify OTP, create the user |
| `backend/login_send_otp.php` | Check email/password/role, send OTP |
| `backend/login_verify_otp.php` | Verify OTP, start session |
| `backend/check_session.php` | Ask "am I logged in?" |
| `backend/logout.php` | Destroy the session |

## 6. Part 2 — Driver + Manager modules

After Auth, run `database/schema_part2.sql` (after `schema.sql`). It adds:

- `parking_locations`, `parking_spaces` — seeded with the 4 demo locations
  (Mirpur, Motijheel, Dhanmondi, Gulshan), 20 spaces each.
- `reservations` — booking_code, OTP, status (upcoming/active/completed/cancelled).
- `issue_reports` — driver "Report Issue" submissions.
- `violations` — manager-reported violations.

### Driver pages now wired (via `js/driver.js`)
| Page | Backend endpoint(s) |
|---|---|
| `driver/find-parking.html` | `driver/get_locations.php`, `driver/create_reservation.php` |
| `driver/my-reservations.html` | `driver/my_reservations.php`, `driver/cancel_reservation.php` |
| `driver/parking-history.html` | `driver/parking_history.php` |
| `driver/report-issue.html` | `driver/report_issue.php`, `driver/my_reports.php` |

Reserving a space picks any free space at that location automatically and
returns a booking code + 4-digit OTP (the OTP is shown in an alert — a manager
uses it to check the driver in).

### Manager pages now wired (via `js/manager.js`)
| Page | Backend endpoint(s) |
|---|---|
| `manager/checkin.html` | `manager/pending_checkins.php`, `manager/checkin.php` |
| `manager/spacemap.html` | `manager/spacemap.php`, `manager/update_space_status.php` (click a space to cycle its status) |
| `manager/violations.html` | `manager/violations_list.php`, `manager/report_violation.php`, `manager/resolve_violation.php` |
| `manager/reservations-active/upcoming/completed/cancelled/all.html` | `manager/reservations_list.php?status=...` |

Notes / simplifications made to keep this shippable:
- "Report Violation" uses simple browser `prompt()` dialogs for location ID /
  plate / description — functional, but you'll want a proper modal form later.
- Reservations don't currently store a vehicle plate (the driver reservation
  form never collected one), so the PLATE column shows "-". Add a `plate`
  field to `create_reservation.php` + the frontend form if you need it.
- No page currently redirects to login if the session is missing — every
  protected endpoint DOES check the session (`require_role(...)` in
  `backend/auth_guard.php`) and will refuse the request, but the HTML pages
  themselves don't auto-redirect yet.

## 7. Part 3 — Admin module

After Part 2, run `database/schema_part3.sql`. It adds:

- `users.status` gains a `pending` value (for approving new signups) and
  a `vehicle_plate` column (shown in the admin User Management table).
- `pricing_rules` — one optional surge-pricing rule per parking location.

### Admin pages now wired (via `js/admin.js`)
| Page section | Backend endpoint(s) |
|---|---|
| Overview | `admin/overview.php` |
| Parking Locations | `admin/locations_list.php`, `admin/location_add.php`, `admin/location_update.php`, `admin/location_delete.php`, `admin/managers_list.php` |
| User Management | `admin/users_list.php?role=driver\|manager`, `admin/update_user_status.php` |
| Dynamic Pricing | `admin/pricing_list.php`, `admin/pricing_update.php` |
| System Reports | `admin/reports_summary.php` (feeds both Chart.js charts + the revenue-by-location bars) |
| Violations | reuses `manager/violations_list.php` / `manager/resolve_violation.php` — both already accept the `admin` role |

Notes / simplifications made to keep this shippable (same spirit as Part 2):
- Add/Edit Location and Edit Pricing Rule use `prompt()` dialogs, matching
  the pattern already used for "Report Violation" in `js/manager.js`.
- Editing a location does not resize its space count, to avoid orphaning
  active reservations — delete and recreate the location if you need a
  different total.
- The "Violation Categories" cards and "Add Category" button on the
  Violations tab are illustrative only — the `violations` table has no
  category/fine columns, so they aren't backed by the database yet. The
  "Active Violations" table below them IS real and fully wired.
- New signups still default to `active` status (registration flow
  unchanged); `pending` is available for you to set manually or to wire
  into registration later if you want an approval-required signup flow.
- `vehicle_plate` is a new, optional column — nothing currently writes
  it (the driver signup/reservation forms never collected a plate), so
  it shows "-" until you add a form for it.

## 8. Completed Modules & Features

- **Area Manager Isolation**: Mirpur, Dhanmondi, UIU Campus, Motijheel, and Gulshan facility managers are strictly separated. Each area manager only sees, checks in, checks out, and reports violations for their own designated facility.
- **Auto-Free Spaces & Daily Expiry**: Parking spaces automatically reset to `free` when their reservation window lapses (`reserve_date < CURDATE() OR (reserve_date = CURDATE() AND end_time <= CURTIME())`). Real-time background auto-release runs on every request and time-to-time / daily-to-daily.
- **UIU Driver 25% Discount**: Drivers with `@uiu.ac.bd` email or UIU affiliation automatically receive a 25% discount across all facilities (e.g. UIU Campus rate ৳30/hr becomes ৳22.50/hr). Discount savings are clearly displayed in reservation modal, driver dashboard, active bookings, PDF receipts, history, and manager reservation lists.
- **Space Map & Bay Indicators**: Interactive Space Map displays live bay occupancy (Green = Free, Yellow = Booked/Reserved, Red = Occupied, Gray = Blocked). Managers can click any stall to inspect driver details or manually release/block stalls.
- **Driver Self-Service & Check-In**: Drivers can check in or check out directly using their 4-digit OTP code, cancel upcoming bookings (which immediately re-frees the spot), or present their OTP to the on-site area manager.
- **Guest Portal**: Public visitors can browse live capacity and open space metrics across Dhaka, filter zones by EV charging / bike / 24-7 access, view UIU rates, and submit contact support requests without needing an account.
- **Driver ↔ Manager Chat**: Real-time messaging between drivers and area facility managers with unread badges and 3s live polling.
- **Design & Theme**: All original responsive layouts, styling, color palettes, and typography were preserved.
