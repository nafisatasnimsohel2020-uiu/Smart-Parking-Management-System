

const MGR_API = "../backend/manager";
const CHAT_API = "../backend/chat";
const ADM_API = "../backend/admin";
const DRV_API = "../backend/driver";

async function mapi(path, method, body) {
    const opts = {
        method: method || "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${MGR_API}/${path}`, opts);
    return res.json();
}

async function mcapi(path, method, body) {
    const opts = {
        method: method || "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${CHAT_API}/${path}`, opts);
    return res.json();
}

function money(n) {
    return "৳" + Number(n || 0).toLocaleString();
}

function getStatusBadge(status, displayStatus) {
    const s = (displayStatus || status || '').toLowerCase();
    let badgeClass = 'booked';
    let label = 'Booked';
    if (s === 'active') {
        badgeClass = 'active';
        label = 'Active';
    } else if (s === 'complete' || s === 'completed') {
        badgeClass = 'complete';
        label = 'Complete';
    } else if (s === 'upcoming') {
        badgeClass = 'upcoming';
        label = 'Upcoming';
    } else if (s === 'cancelled') {
        badgeClass = 'cancelled';
        label = 'Cancelled';
    } else {
        badgeClass = 'booked';
        label = 'Booked';
    }
    return `<span class="badge ${badgeClass}">${label}</span>`;
}

function getPaymentBadge(method, status, txn) {
    const m = method || 'bKash';
    const st = (status || 'paid').toLowerCase();
    let pillClass = 'paid';
    let pillLabel = 'PAID';
    if (st === 'pending') {
        pillClass = 'pending';
        pillLabel = 'PENDING';
    } else if (st === 'fine_applied' || st === 'refunded') {
        pillClass = 'fine';
        pillLabel = st === 'fine_applied' ? 'FINE APPLIED' : 'REFUNDED';
    }
    return `
        <div>
            <b>${m}</b> <span class="pay-pill ${pillClass}">${pillLabel}</span>
            ${txn ? `<br><small style="color:#718096; font-family:monospace; font-size:11px;">${txn}</small>` : ''}
        </div>
    `;
}

// ---------------- 1. OVERVIEW (index.html) ----------------
let overviewReservations = [];
let overviewFilter = 'all';
let overviewSearch = '';
let isOverviewInitialized = false;

async function loadManagerOverview(isSilent = false) {
    const todayTbody = document.getElementById("todayReservationsBody");
    const statsGrid = document.querySelector(".stats-grid-6") || document.querySelector(".stats-grid");
    if (!todayTbody && !statsGrid) return;

    try {
        const res = await mapi("overview.php");
        if (!res.success) return;

        // Manager Profile session info
        if (res.manager) {
            const sideName = document.getElementById("sidebarManagerName");
            const navName = document.getElementById("navManagerName");
            const sideAv = document.getElementById("sidebarAvatar");
            const navAv = document.getElementById("navAvatar");
            const initial = (res.manager.full_name || 'M').charAt(0).toUpperCase();
            if (sideName) sideName.textContent = res.manager.full_name || 'Facility Manager';
            if (navName) navName.textContent = res.manager.full_name || 'Facility Manager';
            if (sideAv) sideAv.textContent = initial;
            if (navAv) navAv.textContent = initial;
        }

        // Subtitle / Location
        const headerTitle = document.getElementById("facilityTitle") || document.querySelector(".page-header-sub h1");
        const headerSub = document.getElementById("facilitySubtitle") || document.querySelector(".page-header-sub p");
        if (headerTitle && res.location) headerTitle.textContent = res.location.name;
        if (headerSub && res.location) headerSub.textContent = `${res.location.address} — Facility Manager Overview`;

        // 6 Metrics Cards
        if (res.metrics) {
            const m = res.metrics;
            const elAvail = document.getElementById("statAvailableSpaces");
            const elFreePct = document.getElementById("statFreePct");
            const elActive = document.getElementById("statActiveTrips");
            const elBooked = document.getElementById("statBookedTrips");
            const elUpcoming = document.getElementById("statUpcomingTrips");
            const elCompleted = document.getElementById("statCompletedTrips");
            const elTodayRev = document.getElementById("statTodayRevenue");
            const elTotalRevDesc = document.getElementById("statTotalRevDesc");

            if (elAvail) elAvail.innerHTML = `${m.available_spaces}<span style="font-size: 14px; color:#718096">/${m.total_spaces}</span>`;
            if (elFreePct) elFreePct.textContent = `${m.free_pct}% capacity available`;
            if (elActive) elActive.textContent = m.active_now;
            if (elBooked) elBooked.textContent = m.booked_trips;
            if (elUpcoming) elUpcoming.textContent = m.upcoming_trips;
            if (elCompleted) elCompleted.textContent = m.completed_trips;
            if (elTodayRev) elTodayRev.textContent = money(m.today_revenue);
            if (elTotalRevDesc) elTotalRevDesc.textContent = `Total: ${money(m.total_revenue)}`;

            // Occupancy bar & legend
            const barOcc = document.getElementById("barOccupied");
            const barRes = document.getElementById("barReserved");
            const barFree = document.getElementById("barFree");
            const occRate = document.getElementById("occupancyRateText");
            const legOcc = document.getElementById("legendOccupied");
            const legRes = document.getElementById("legendReserved");
            const legFree = document.getElementById("legendFree");

            if (barOcc) barOcc.style.width = `${m.occupied_pct}%`;
            if (barRes) barRes.style.width = `${m.reserved_pct}%`;
            if (barFree) barFree.style.width = `${m.free_pct}%`;
            if (occRate) occRate.textContent = `${m.occupied_pct}% Occupied`;
            if (legOcc) legOcc.textContent = `Occupied: ${m.occupied_spaces} (${m.occupied_pct}%)`;
            if (legRes) legRes.textContent = `Booked: ${m.reserved_spaces} (${m.reserved_pct}%)`;
            if (legFree) legFree.textContent = `Available: ${m.available_spaces} (${m.free_pct}%)`;
        }

        // Payment Summary
        if (res.payment_summary) {
            const p = res.payment_summary;
            const elBkash = document.getElementById("payBkash");
            const elNagad = document.getElementById("payNagad");
            const elCard = document.getElementById("payCard");
            const elCash = document.getElementById("payCash");
            const elFines = document.getElementById("finesSummaryText");

            if (elBkash) elBkash.textContent = money(p.bkash);
            if (elNagad) elNagad.textContent = money(p.nagad);
            if (elCard) elCard.textContent = money(p.card);
            if (elCash) elCash.textContent = money(p.cash);
            if (elFines) elFines.textContent = `Fines: ${money(p.fines_collected)}`;
        }

        // Active Overtime monitor
        renderActiveOvertime(res.active_overtime || []);

        // Store reservations
        overviewReservations = res.reservations || [];
        renderOverviewTable();

        // One-time setup for search and filters
        if (!isOverviewInitialized) {
            setupOverviewControls();
            isOverviewInitialized = true;
        }
    } catch (err) {
        console.error("Error loading manager overview:", err);
    }
}

function renderActiveOvertime(items) {
    const container = document.getElementById("activeOvertimeList");
    const countEl = document.getElementById("activeOvertimeCount");
    if (!container) return;

    const list = Array.isArray(items) ? items : [];
    if (countEl) {
        countEl.textContent = `${list.length} Active Overtime`;
        countEl.style.background = list.length ? "#fff5f5" : "#f0fff4";
        countEl.style.color = list.length ? "#c53030" : "#2f855a";
    }

    if (!list.length) {
        container.innerHTML = `<div style="padding:15px; text-align:center; color:#38a169; font-size:12px; background:#f0fff4; border-radius:8px;">✓ No driver is currently in overtime.</div>`;
        return;
    }

    container.innerHTML = list.map(o => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:15px; flex-wrap:wrap; padding:12px 14px; background:#fffafa; border:1px solid #fed7d7; border-radius:8px;">
            <div>
                <div style="font-weight:700; color:#2d3748;">${o.driver_name || 'Unknown Driver'} <span style="color:#c53030; font-size:11px;">• +${o.overtime_minutes || 0} min</span></div>
                <div style="font-size:11px; color:#718096; margin-top:3px;">Booking ${o.booking_code} · Space ${o.space_code || '-'} · Plate ${o.vehicle_plate || '-'}</div>
                <div style="font-size:11px; color:#718096; margin-top:2px;">Scheduled: ${(o.start_time || '').slice(0,5)}–${(o.end_time || '').slice(0,5)}</div>
            </div>
            <div style="text-align:right; min-width:190px;">
                <div style="font-size:12px; font-weight:800; color:#e53e3e;">Fine: ${money(o.overtime_fine || o.fine_amount)}</div>
                <div style="font-size:10px; color:#9b2c2c; font-weight:800; margin-top:3px;">Fine status: ${(o.fine_status || 'pending').toUpperCase()}</div>
                ${o.has_slot_conflict ? `<div style="font-size:10px; color:#991b1b; font-weight:700; margin-top:3px;">⚠ Slot conflict: ${o.conflict_booking_code || 'another booking'}</div>` : ''}
                <button class="btn-primary overtime-handle-btn" data-code="${o.booking_code}" style="margin-top:7px; background:#dc2626; padding:7px 12px; font-size:11px;">Handle Fine & Check-Out</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll('.overtime-handle-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const code = btn.dataset.code;
            if (!confirm(`Handle overtime fine and check-out booking ${code}? The fine will be recorded as handled by you.`)) return;
            btn.disabled = true;
            btn.textContent = 'Processing...';
            const result = await mapi('checkout.php', 'POST', { booking_code: code });
            alert(result.message);
            if (result.success) {
                await loadManagerOverview(true);
                if (typeof loadActiveCheckouts === 'function') loadActiveCheckouts();
            } else {
                btn.disabled = false;
                btn.textContent = 'Handle Fine & Check-Out';
            }
        });
    });
}

function setupOverviewControls() {
    const searchInput = document.getElementById("overviewSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            overviewSearch = e.target.value.trim().toLowerCase();
            renderOverviewTable();
        });
    }

    const filterTabs = document.querySelectorAll("#statusFilterTabs .filter-tab-btn");
    filterTabs.forEach((btn) => {
        btn.addEventListener("click", () => {
            filterTabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            overviewFilter = btn.dataset.filter || "all";
            renderOverviewTable();
        });
    });

    const refreshBtn = document.getElementById("refreshOverviewBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => loadManagerOverview());
    }
}

function renderOverviewTable() {
    const todayTbody = document.getElementById("todayReservationsBody");
    const countText = document.getElementById("tableCountText");
    if (!todayTbody) return;

    let filtered = overviewReservations.filter((r) => {
        const st = (r.status || "").toLowerCase();
        const disp = (r.display_status || "").toLowerCase();

        // Status match
        if (overviewFilter === "booked") {
            if (st !== "booked" && disp !== "booked") return false;
        } else if (overviewFilter === "active") {
            if (st !== "active" && disp !== "active") return false;
        } else if (overviewFilter === "complete") {
            if (st !== "completed" && st !== "complete" && disp !== "complete") return false;
        } else if (overviewFilter === "upcoming") {
            if (st !== "upcoming" && disp !== "upcoming") return false;
        } else if (overviewFilter === "cancelled") {
            if (st !== "cancelled" && disp !== "cancelled") return false;
        }

        // Search match
        if (overviewSearch) {
            const query = overviewSearch;
            const matchCode = (r.booking_code || "").toLowerCase().includes(query);
            const matchDriver = (r.driver_name || "").toLowerCase().includes(query);
            const matchPlate = (r.vehicle_plate || "").toLowerCase().includes(query);
            const matchSpace = (r.space_code || "").toLowerCase().includes(query);
            const matchPay = (r.payment_method || "").toLowerCase().includes(query);
            const matchTxn = (r.transaction_id || "").toLowerCase().includes(query);
            if (!matchCode && !matchDriver && !matchPlate && !matchSpace && !matchPay && !matchTxn) {
                return false;
            }
        }
        return true;
    });

    if (countText) {
        countText.textContent = `Showing ${filtered.length} of ${overviewReservations.length} reservations`;
    }

    if (filtered.length === 0) {
        todayTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:25px; color:#718096;">No ${overviewFilter === 'all' ? '' : overviewFilter} reservations found.</td></tr>`;
        return;
    }

    todayTbody.innerHTML = filtered.map((r) => {
        const disp = (r.display_status || r.status || '').toLowerCase();
        const isAwaitingCheckin = disp === 'booked' || disp === 'upcoming';
        const isActive = disp === 'active';

        return `
            <tr>
                <td><a href="#" class="view-booking-link" data-code="${r.booking_code}" style="color: #6b46c1; text-decoration: none; font-weight:700;">${r.booking_code}</a></td>
                <td><b>${r.driver_name}</b>${r.driver_phone ? `<br><small style="color:#718096;">${r.driver_phone}</small>` : ''}</td>
                <td><b>${r.vehicle_plate || '-'}</b></td>
                <td><span style="font-weight:700; color:#2b6cb0;">${r.space_code}</span></td>
                <td>${r.reserve_date}<br><small style="color:#718096;">${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}</small></td>
                <td>${getPaymentBadge(r.payment_method, r.payment_status, r.transaction_id)}</td>
                <td>
                    <b>${money(r.total_cost)}</b>
                    ${r.fine_amount > 0 ? `<br><small style="color:#e53e3e; font-weight:600;">Fine: ${money(r.fine_amount)}</small>` : ''}
                    ${r.discount_amount > 0 ? `<br><small style="color:#2b6cb0; font-weight:600;">🎓 25% Off</small>` : ''}
                </td>
                <td>
                    ${getStatusBadge(r.status, r.display_status)}
                    ${r.is_overtime ? `<br><span style="display:inline-block; margin-top:3px; padding:2px 6px; font-size:10px; font-weight:700; color:#fff; background:#e53e3e; border-radius:4px;">⚠️ Overtime +${r.overtime_minutes}m</span>` : ''}
                    ${r.has_slot_conflict ? `<br><span style="display:inline-block; margin-top:2px; padding:2px 6px; font-size:10px; font-weight:700; color:#fff; background:#991b1b; border-radius:4px;">🚨 Conflict #${r.conflict_booking_code}</span>` : ''}
                </td>
                <td style="text-align: right;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="action-btn-sm btn-detail btn-open-modal" data-code="${r.booking_code}">Details</button>
                        ${isAwaitingCheckin ? `<button class="action-btn-sm btn-checkin btn-quick-checkin" data-code="${r.booking_code}">Check In</button>` : ''}
                        ${isActive ? `<button class="action-btn-sm btn-complete btn-quick-checkout" data-code="${r.booking_code}">Complete</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    wireReservationRowActions(todayTbody, filtered, () => loadManagerOverview());
}

function wireReservationRowActions(container, reservationsList, refreshCallback) {
    // 1. View Booking Details
    container.querySelectorAll(".view-booking-link, .btn-open-modal").forEach((el) => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            const code = el.dataset.code;
            const reservation = reservationsList.find(r => r.booking_code === code);
            if (reservation) {
                openBookingDetailModal(reservation, refreshCallback);
            }
        });
    });

    // 2. Quick Check-In (Manual OTP Entry)
    container.querySelectorAll(".btn-quick-checkin").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const code = btn.dataset.code;
            const otp = prompt(`Enter 4-digit driver OTP code for booking ${code}:`);
            if (!otp || !otp.trim()) return;

            btn.disabled = true;
            btn.textContent = "Checking in...";
            const res = await mapi("checkin.php", "POST", { booking_code: code, otp: otp.trim() });
            alert(res.message);
            if (res.success && typeof refreshCallback === "function") {
                refreshCallback();
            } else {
                btn.disabled = false;
                btn.textContent = "Check In";
            }
        });
    });

    // 3. Quick Complete (Check-Out)
    container.querySelectorAll(".btn-quick-checkout").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const code = btn.dataset.code;
            const confirmed = confirm(`Complete trip for booking ${code}? Vehicle will be checked out and space freed.`);
            if (!confirmed) return;

            btn.disabled = true;
            btn.textContent = "Completing...";
            const res = await mapi("checkout.php", "POST", { booking_code: code });
            alert(res.message);
            if (res.success && typeof refreshCallback === "function") {
                refreshCallback();
            } else {
                btn.disabled = false;
                btn.textContent = "Complete";
            }
        });
    });
}

function openBookingDetailModal(r, refreshCallback) {
    const modal = document.getElementById("overviewBookingModal");
    if (!modal) return;

    const codeEl = document.getElementById("modalBookingCode");
    const subEl = document.getElementById("modalBookingSub");
    const bodyEl = document.getElementById("modalBookingBody");
    const actionsEl = document.getElementById("modalBookingActions");

    if (codeEl) codeEl.textContent = `Booking #${r.booking_code}`;
    if (subEl) subEl.textContent = `${r.location_name || 'Parking Facility'} · Space ${r.space_code}`;

    const disp = (r.display_status || r.status || '').toLowerCase();
    const isAwaitingCheckin = disp === 'booked' || disp === 'upcoming';
    const isActive = disp === 'active';

    if (bodyEl) {
        bodyEl.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; font-size: 13px;">
                <div style="background:#f7fafc; padding:12px; border-radius:8px; border:1px solid #edf2f7;">
                    <span style="color:#718096; font-size:11px; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Driver Details</span>
                    <p style="margin:0 0 2px 0; font-weight:700; color:#1a202c; font-size:14px;">${r.driver_name}</p>
                    <p style="margin:0 0 2px 0; color:#4a5568;">Phone: <b>${r.driver_phone || 'N/A'}</b></p>
                    <p style="margin:0; color:#4a5568;">Plate: <b>${r.vehicle_plate || 'N/A'}</b></p>
                </div>
                <div style="background:#f7fafc; padding:12px; border-radius:8px; border:1px solid #edf2f7;">
                    <span style="color:#718096; font-size:11px; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Assigned Space</span>
                    <p style="margin:0 0 2px 0; font-weight:800; color:#2b6cb0; font-size:20px;">Space ${r.space_code}</p>
                    <p style="margin:0; color:#718096; font-size:12px;">${r.location_name || 'Parking Facility'}</p>
                </div>
            </div>

            <div style="background:#f7fafc; padding:14px; border-radius:8px; border:1px solid #edf2f7; margin-bottom:14px; font-size:13px;">
                <span style="color:#718096; font-size:11px; text-transform:uppercase; font-weight:700; display:block; margin-bottom:8px;">Trip Schedule & Live Status</span>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#718096;">Date & Slot:</span>
                    <span style="font-weight:600; color:#2d3748;">${r.reserve_date} (${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)})</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; align-items:center;">
                    <span style="color:#718096;">Trip Status:</span>
                    ${getStatusBadge(r.status, r.display_status)}
                </div>
                ${r.otp_code ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; align-items:center;">
                    <span style="color:#718096;">Check-In OTP:</span>
                    <span style="font-weight:800; color:#319795; font-size:16px; letter-spacing:2px; background:#e6fffa; padding:2px 8px; border-radius:4px; border:1px solid #b2f5ea;">${r.otp_code}</span>
                </div>` : ''}
                ${r.checked_in_at ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#718096;">Checked In:</span>
                    <span style="color:#2d3748;">${new Date(r.checked_in_at).toLocaleString()}</span>
                </div>` : ''}
                ${r.checked_out_at ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#718096;">Checked Out:</span>
                    <span style="color:#2d3748;">${new Date(r.checked_out_at).toLocaleString()}</span>
                </div>` : ''}
                ${r.is_overtime ? `
                <div style="background:#fff5f5; border:1px solid #feb2b2; border-radius:6px; padding:10px; margin-top:8px; color:#c53030;">
                    <strong style="display:flex; align-items:center; gap:6px;">⚠️ Overtime Alert! (Trip Active)</strong>
                    <p style="margin:4px 0 0 0; font-size:12px;">This trip has exceeded scheduled duration by <b>${r.overtime_minutes} min</b>. Status remains Active until checked out. Fine of <b>${money(r.overtime_fine || r.fine_amount)}</b> added based on extra time used.</p>
                    ${r.has_slot_conflict ? `
                    <div style="margin-top:8px; padding:6px 10px; background:#fed7d7; border-radius:4px; color:#742a2a; font-size:11px; font-weight:700;">
                        🚨 Slot Conflict Detected! Another booking <b>#${r.conflict_booking_code}</b> is scheduled for this bay right now. An automated violation has been registered in the system, and a slot-blocking penalty was imposed.
                    </div>` : ''}
                </div>` : ''}
            </div>

            <div style="background:#f7fafc; padding:14px; border-radius:8px; border:1px solid #edf2f7; font-size:13px;">
                <span style="color:#718096; font-size:11px; text-transform:uppercase; font-weight:700; display:block; margin-bottom:8px;">Payment & Financial Details</span>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; align-items:center;">
                    <span style="color:#718096;">Payment Method:</span>
                    <span style="font-weight:700; color:#2d3748;">${r.payment_method || 'bKash'} <span class="pay-pill ${r.payment_status || 'paid'}">${(r.payment_status || 'PAID').toUpperCase()}</span></span>
                </div>
                ${r.transaction_id ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#718096;">Transaction ID:</span>
                    <span style="font-family:monospace; font-weight:700; color:#2d3748;">${r.transaction_id}</span>
                </div>` : ''}
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:#718096;">Booking Amount:</span>
                    <span style="font-weight:800; color:#2d3748; font-size:15px;">${money(r.total_cost)}</span>
                </div>
                ${r.discount_amount > 0 ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#2b6cb0;">
                    <span>UIU Student Discount (25%):</span>
                    <span style="font-weight:700;">-${money(r.discount_amount)}</span>
                </div>` : ''}
                ${r.status === 'cancelled' || disp === 'cancelled' ? `
                <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#e53e3e;">
                        <span>Cancellation Fine Applied (20%):</span>
                        <span style="font-weight:700;">+${money(r.fine_amount)}</span>
                        <small style="color:#c53030; font-weight:700; margin-left:6px;">${(r.fine_status || 'pending').toUpperCase()}</small>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#38a169;">
                        <span>Net Refund Amount:</span>
                        <span style="font-weight:700;">${money(r.refund_amount)}</span>
                    </div>
                    ${r.cancellation_reason ? `
                    <div style="margin-top:6px; font-size:12px; color:#718096;">
                        Cancellation Reason: <i>"${r.cancellation_reason}"</i>
                    </div>` : ''}
                </div>` : ''}
            </div>
        `;
    }

    if (actionsEl) {
        actionsEl.innerHTML = `
            <button id="closeBookingModalActionBtn" class="action-btn-sm btn-detail" style="padding: 8px 16px; font-size: 13px;">Close</button>
            ${isAwaitingCheckin ? `<button id="modalActionCheckin" class="action-btn-sm btn-checkin" style="padding: 8px 16px; font-size: 13px;">✓ Verify Check-In</button>` : ''}
            ${isActive ? `<button id="modalActionCheckout" class="action-btn-sm btn-complete" style="padding: 8px 16px; font-size: 13px;">✓ Complete Trip</button>` : ''}
        `;

        const closeBtn = document.getElementById("closeBookingModalActionBtn");
        if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";

        const chkInBtn = document.getElementById("modalActionCheckin");
        if (chkInBtn) {
            chkInBtn.onclick = async () => {
                const otp = prompt(`Enter 4-digit driver OTP for booking ${r.booking_code}:`);
                if (!otp || !otp.trim()) return;

                chkInBtn.disabled = true;
                chkInBtn.textContent = "Checking in...";
                const res = await mapi("checkin.php", "POST", { booking_code: r.booking_code, otp: otp.trim() });
                alert(res.message);
                if (res.success) {
                    modal.style.display = "none";
                    if (typeof refreshCallback === "function") refreshCallback();
                } else {
                    chkInBtn.disabled = false;
                    chkInBtn.textContent = "✓ Verify Check-In";
                }
            };
        }

        const chkOutBtn = document.getElementById("modalActionCheckout");
        if (chkOutBtn) {
            chkOutBtn.onclick = async () => {
                const confirmed = confirm(`Complete trip for booking ${r.booking_code}? Vehicle will be checked out and space freed.`);
                if (!confirmed) return;
                chkOutBtn.disabled = true;
                chkOutBtn.textContent = "Completing...";
                const res = await mapi("checkout.php", "POST", { booking_code: r.booking_code });
                alert(res.message);
                if (res.success) {
                    modal.style.display = "none";
                    if (typeof refreshCallback === "function") refreshCallback();
                } else {
                    chkOutBtn.disabled = false;
                    chkOutBtn.textContent = "✓ Complete Trip";
                }
            };
        }
    }

    const modalCloseX = document.getElementById("closeBookingModalBtn");
    if (modalCloseX) modalCloseX.onclick = () => modal.style.display = "none";

    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };

    modal.style.display = "flex";
}

// ---------------- 2. CHECK-IN & CHECK-OUT (checkin.html) ----------------
async function loadCheckinCheckoutPage() {
    await loadPendingCheckins();
    await loadActiveCheckouts();
    setupQuickVerification();
}

async function loadPendingCheckins() {
    const container = document.getElementById("pendingCheckinsList");
    if (!container) return;

    const result = await mapi("pending_checkins.php");
    if (!result.success) return;

    if (result.pending.length === 0) {
        container.innerHTML = "<div class=\"data-table-container\" style=\"color:#718096; padding:20px;\">No pending check-ins right now.</div>";
        return;
    }

    container.innerHTML = result.pending.map((p) => `
        <div class="data-table-container" style="margin-bottom: 15px; border-left: 4px solid #319795;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <span class="badge upcoming" style="background:#edf2f7; color:#2d3748;">${p.reserve_date === new Date().toISOString().slice(0,10) ? 'Awaiting Arrival' : 'Upcoming Booking'}</span>
                    <h4 style="margin-top: 5px;">${p.driver_name}</h4>
                    <p style="font-size: 12px; color: #718096;">${p.location_name} · Space <b>${p.space_code}</b> · Date: <b>${p.reserve_date}</b> · Time: ${p.start_time.slice(0,5)} – ${p.end_time.slice(0,5)}</p>
                    <p style="font-size: 12px; color: #718096; margin-top:4px;">Booking: <b>${p.booking_code}</b> · Vehicle: <b>${p.driver_plate || '-'}</b></p>
                </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="text" class="search-input booking-code" value="${p.booking_code}" readonly style="flex: 0.8; font-weight:600; background:#f7fafc;">
                <input type="text" class="search-input otp-input" placeholder="Enter driver 4-digit OTP" style="flex: 1;" maxlength="6">
                <button class="btn-primary verify-btn" data-code="${p.booking_code}" style="background:#319795;">Verify Check-In</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".verify-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const card = btn.closest(".data-table-container");
            const otp = card.querySelector(".otp-input").value.trim();
            if (!otp) {
                alert("Please enter the driver's OTP code.");
                return;
            }
            btn.disabled = true;
            btn.textContent = "Verifying...";
            const result = await mapi("checkin.php", "POST", { booking_code: btn.dataset.code, otp });
            alert(result.message);
            if (result.success) {
                loadPendingCheckins();
                loadActiveCheckouts();
            } else {
                btn.disabled = false;
                btn.textContent = "Verify Check-In";
            }
        });
    });
}

async function loadActiveCheckouts() {
    const container = document.getElementById("activeCheckoutsList");
    if (!container) return;

    const result = await mapi("active_checkins.php");
    if (!result.success) return;

    if (result.active.length === 0) {
        container.innerHTML = "<div class=\"data-table-container\" style=\"color:#718096; padding:20px;\">No vehicles currently checked in.</div>";
        return;
    }

    container.innerHTML = result.active.map((a) => `
        <div class="data-table-container" style="margin-bottom: 15px; border-left: 4px solid ${a.is_overtime ? '#e53e3e' : '#805ad5'}; ${a.is_overtime ? 'background:#fffafa;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap:10px;">
                <div>
                    <span class="badge active" style="background:#38a169; color:#fff;">Parked (Active)</span>
                    ${a.is_overtime ? `<span class="badge" style="background:#e53e3e; color:#fff; margin-left:6px; font-weight:700;">⚠️ Overtime: +${a.overtime_minutes}m (Fine: ৳${a.overtime_fine || a.fine_amount})</span>` : ''}
                    ${a.has_slot_conflict ? `<span class="badge" style="background:#991b1b; color:#fff; margin-left:6px; font-weight:700;">🚨 Conflict: Blocking #${a.conflict_booking_code}</span>` : ''}
                    <h4 style="margin-top: 5px;">${a.driver_name} ${a.vehicle_plate !== '-' ? `(Plate: <b>${a.vehicle_plate}</b>)` : ''}</h4>
                    <p style="font-size: 12px; color: #718096;">${a.location_name} · Space <b>${a.space_code}</b> · Scheduled: ${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)} · Checked in: ${a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : a.start_time.slice(0,5)}</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-primary checkout-btn" data-code="${a.booking_code}" style="background:${a.is_overtime ? '#dc2626' : '#805ad5'}; padding:8px 16px;">Verify & Check-Out</button>
                </div>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".checkout-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const code = btn.dataset.code;
            if (!confirm(`Confirm check-out for vehicle ${code}? Space will be marked free.`)) return;
            btn.disabled = true;
            btn.textContent = "Checking out...";
            const result = await mapi("checkout.php", "POST", { booking_code: code });
            alert(result.message);
            if (result.success) {
                loadPendingCheckins();
                loadActiveCheckouts();
            } else {
                btn.disabled = false;
                btn.textContent = "Verify & Check-Out";
            }
        });
    });
}

function setupQuickVerification() {
    const inBtn = document.getElementById("quickCheckinBtn");
    const outBtn = document.getElementById("quickCheckoutBtn");
    const codeInput = document.getElementById("quickBookingCode");
    const otpInput = document.getElementById("quickOtpCode");

    if (inBtn && codeInput && otpInput) {
        inBtn.addEventListener("click", async () => {
            const booking_code = codeInput.value.trim();
            const otp = otpInput.value.trim();
            if (!booking_code || !otp) {
                alert("Please enter both Booking ID and OTP.");
                return;
            }
            const res = await mapi("checkin.php", "POST", { booking_code, otp });
            alert(res.message);
            if (res.success) {
                codeInput.value = "";
                otpInput.value = "";
                loadPendingCheckins();
                loadActiveCheckouts();
            }
        });
    }

    if (outBtn && codeInput && otpInput) {
        outBtn.addEventListener("click", async () => {
            const booking_code = codeInput.value.trim();
            const otp = otpInput.value.trim();
            if (!booking_code) {
                alert("Please enter Booking ID.");
                return;
            }
            const res = await mapi("checkout.php", "POST", { booking_code, otp });
            alert(res.message);
            if (res.success) {
                codeInput.value = "";
                otpInput.value = "";
                loadPendingCheckins();
                loadActiveCheckouts();
            }
        });
    }
}

// ---------------- 3. SPACE MAP (spacemap.html) ----------------
const STATUS_CLASS = { free: "space-free", occupied: "space-occupied", reserved: "space-reserved", maintenance: "space-blocked" };
const STATUS_LABEL = { free: "Free", occupied: "Occupied", reserved: "Booked (Reserved)", maintenance: "Blocked" };

// A driver actively using a space is shown RED. Once the scheduled parking
// time has ended, the visual space status returns to GREEN automatically.
// The reservation itself remains available to the overtime monitor so the
// manager can still see/apply overtime fine until checkout.
function getSpaceVisualState(space) {
    const reservationStatus = String(space?.reservation_status || '').toLowerCase();
    const hasReservation = !!(space && space.reserve_date && space.start_time && space.end_time && reservationStatus);

    if (hasReservation) {
        const start = new Date(`${space.reserve_date}T${(space.start_time || '00:00:00').slice(0, 8)}`);
        let end = new Date(`${space.reserve_date}T${(space.end_time || '00:00:00').slice(0, 8)}`);
        if (end < start) end.setDate(end.getDate() + 1);
        const now = new Date();

        // The visual reservation window ends at the scheduled end time.
        // After that moment the bay MUST turn GREEN automatically in the map,
        // even if the driver has not checked out yet. The reservation remains
        // active in the database so overtime minutes/fine can still be tracked
        // and the manager can complete the checkout later.
        if (reservationStatus === 'active') {
            if (now >= end) {
                return {
                    key: 'free',
                    label: `Free · Overtime monitoring (+${Math.max(1, Math.ceil((now - end) / 60000))}m)`,
                    active: false,
                    ended: true,
                    overtime: true
                };
            }
            return {
                key: 'occupied',
                label: 'Reserved / Occupied',
                active: true,
                ended: false,
                overtime: false
            };
        }

        // A booked/upcoming reservation is RED exactly during its scheduled time.
        if (now >= start && now < end) {
            return { key: 'occupied', label: 'Reserved / Occupied', active: true, ended: false, overtime: false };
        }

        // Future reservation remains visibly reserved (BLUE) until its start time.
        if (now < start) {
            return { key: 'reserved', label: 'Booked (Reserved)', active: false, ended: false, overtime: false };
        }

        // Scheduled time passed without check-in: the bay is available again.
        return { key: 'free', label: 'Free (Time Ended)', active: false, ended: true, overtime: false };
    }

    return {
        key: space?.status || 'free',
        label: STATUS_LABEL[space?.status] || space?.status || 'Free',
        active: false,
        ended: false,
        overtime: false
    };
}

let currentSpaceLocationId = 1;
let currentSpaceFilter = "all";
let currentLoadedSpaces = [];
let activeSelectedSpace = null;

async function loadSpaceMap() {
    const grid = document.getElementById("spaceGrid");
    const locSelect = document.getElementById("spaceLocationSelect");
    if (!grid) return;

    // Setup filter buttons
    const filterAll = document.getElementById("filterAllSpaces");
    const filterFree = document.getElementById("filterFreeSpaces");
    const filterBooked = document.getElementById("filterBookedSpaces");

    function setFilterActive(btn, filter) {
        [filterAll, filterFree, filterBooked].forEach(b => {
            if (b) {
                b.style.background = "#edf2f7";
                b.style.color = "#2d3748";
            }
        });
        if (btn) {
            btn.style.background = "#319795";
            btn.style.color = "#fff";
        }
        currentSpaceFilter = filter;
        renderFilteredSpaces();
    }

    if (filterAll) filterAll.addEventListener("click", () => setFilterActive(filterAll, "all"));
    if (filterFree) filterFree.addEventListener("click", () => setFilterActive(filterFree, "free"));
    if (filterBooked) filterBooked.addEventListener("click", () => setFilterActive(filterBooked, "booked"));

    // Modal Close logic
    const modal = document.getElementById("spaceDetailModal");
    const closeBtn = document.getElementById("closeSpaceModalBtn");
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.style.display = "none");
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.style.display = "none";
        });
    }

    // Modal Action Buttons
    const btnFree = document.getElementById("btnSetFree");
    const btnOccupied = document.getElementById("btnSetOccupied");
    const btnBlocked = document.getElementById("btnSetBlocked");

    async function changeActiveSpaceStatus(newStatus) {
        if (!activeSelectedSpace) return;
        const res = await mapi("update_space_status.php", "POST", {
            space_id: activeSelectedSpace.id,
            status: newStatus
        });
        if (res.success) {
            if (modal) modal.style.display = "none";
            refreshSpaceGrid();
        } else {
            alert(res.message || "Failed to update space.");
        }
    }

    if (btnFree) btnFree.addEventListener("click", () => changeActiveSpaceStatus("free"));
    if (btnOccupied) btnOccupied.addEventListener("click", () => changeActiveSpaceStatus("occupied"));
    if (btnBlocked) btnBlocked.addEventListener("click", () => changeActiveSpaceStatus("maintenance"));

    // Load locations for dropdown (strictly scoped to assigned facility for managers)
    if (locSelect) {
        try {
            const checkRes = await fetch("../backend/check_session.php", { credentials: "include" }).then(r => r.json());
            const user = checkRes.user;
            const isManager = user && user.role === 'manager';

            if (isManager && user.location_id) {
                currentSpaceLocationId = user.location_id;
                locSelect.innerHTML = `<option value="${user.location_id}">Assigned: ${user.location_name || 'My Facility'}</option>`;
                locSelect.disabled = true;
                locSelect.style.background = "#f7fafc";
                locSelect.style.cursor = "default";
                const sub = document.getElementById("spaceMapSubtitle");
                if (sub) sub.textContent = `Live space map for ${user.location_name || 'your assigned facility'}. Click any space to view details or change status.`;
            } else {
                // Admin can view all facilities
                const locRes = await fetch(`${DRV_API}/get_locations.php`).then(r => r.json());
                if (locRes.success && locRes.locations.length > 0) {
                    locSelect.innerHTML = locRes.locations.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
                    currentSpaceLocationId = locRes.locations[0].id;

                    locSelect.addEventListener("change", () => {
                        currentSpaceLocationId = parseInt(locSelect.value, 10);
                        refreshSpaceGrid();
                    });
                }
            }
        } catch (e) {
            console.error("Could not initialize space map location", e);
        }
    }

    refreshSpaceGrid();
}

function renderFilteredSpaces() {
    const grid = document.getElementById("spaceGrid");
    if (!grid) return;

    let list = currentLoadedSpaces;
    if (currentSpaceFilter === "free") {
        list = list.filter(s => getSpaceVisualState(s).key === "free");
    } else if (currentSpaceFilter === "booked") {
        list = list.filter(s => {
            const visual = getSpaceVisualState(s);
            return visual.key === "reserved" || visual.key === "occupied";
        });
    }

    if (list.length === 0) {
        grid.innerHTML = `<p style="padding:20px; color:#718096; width:100%;">No parking spaces match the selected filter.</p>`;
        return;
    }

    grid.innerHTML = list.map((s) => {
        const visual = getSpaceVisualState(s);
        let tooltip = `Space ${s.space_code} - Status: ${visual.label}`;
        if (s.driver_name) {
            tooltip += ` | Driver: ${s.driver_name} (Plate: ${s.vehicle_plate || 'N/A'})`;
        }
        if (visual.active) {
            tooltip += ` | Active parking until ${s.end_time.slice(0,5)}`;
        } else if (visual.ended) {
            tooltip += ` | Scheduled time ended${visual.overtime ? ' | Overtime fine active until checkout' : ''}`;
        }
        return `
            <div class="space-box ${STATUS_CLASS[visual.key]}" data-id="${s.id}" data-status="${visual.key}" data-code="${s.space_code}" title="${tooltip}">${s.space_code.split('-')[1] || s.space_code}</div>
        `;
    }).join("");

    grid.querySelectorAll(".space-box").forEach((box) => {
        box.addEventListener("click", () => {
            const spaceId = parseInt(box.dataset.id, 10);
            const space = currentLoadedSpaces.find(s => s.id === spaceId);
            if (!space) return;

            openSpaceDetailsModal(space);
        });
    });
}

function openSpaceDetailsModal(space) {
    activeSelectedSpace = space;
    const modal = document.getElementById("spaceDetailModal");
    const title = document.getElementById("modalSpaceCode");
    const content = document.getElementById("modalSpaceContent");
    if (!modal || !title || !content) return;

    title.textContent = `Parking Bay ${space.space_code}`;

    const visual = getSpaceVisualState(space);
    let statusBadgeColor = "#38a169";
    if (visual.key === "reserved") statusBadgeColor = "#3182ce";
    else if (visual.key === "occupied") statusBadgeColor = "#e53e3e";
    else if (visual.key === "maintenance") statusBadgeColor = "#718096";

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:12px; color:#718096;">Current Bay Status:</span>
            <span style="background:${statusBadgeColor}; color:#fff; font-size:11px; font-weight:700; padding:3px 10px; border-radius:12px; text-transform:uppercase;">${visual.label}</span>
        </div>
    `;

    if (space.driver_name || space.booking_code) {
        html += `
            <div style="background:#f7fafc; padding:12px 14px; border-radius:10px; border:1px solid #e2e8f0; font-size:13px; line-height:1.6;">
                <div style="margin-bottom:6px;"><strong style="color:#2d3748;">Driver:</strong> ${space.driver_name || 'N/A'}</div>
                <div style="margin-bottom:6px;"><strong style="color:#2d3748;">Phone:</strong> ${space.driver_phone || 'N/A'}</div>
                <div style="margin-bottom:6px;"><strong style="color:#2d3748;">Vehicle Plate:</strong> <span style="background:#edf2f7; padding:2px 6px; border-radius:4px; font-family:monospace; font-weight:600;">${space.vehicle_plate || 'N/A'}</span></div>
                <div style="margin-bottom:6px;"><strong style="color:#2d3748;">Booking Ref:</strong> <span style="color:#6b46c1; font-weight:700;">${space.booking_code || 'N/A'}</span></div>
                <div><strong style="color:#2d3748;">Time Window:</strong> ${space.start_time ? space.start_time.slice(0,5) + ' – ' + space.end_time.slice(0,5) : 'N/A'} (${space.reserve_date || 'Today'})</div>
            </div>
            <p style="font-size:12px; color:#718096; margin-top:10px;">Click <b>"✓ Free Space"</b> below to release this spot immediately.</p>
        `;
    } else if (visual.ended && space.driver_name) {
        html += `
            <div style="background:#f0fff4; border:1px solid #c6f6d5; padding:14px; border-radius:10px; color:#22543d;">
                <p style="margin:0; font-weight:600;">✓ Scheduled time ended</p>
                <p style="margin:4px 0 0 0; font-size:12px;">This space turns green automatically when the scheduled time ends. If the driver is still checked in, overtime monitoring/fine calculation remains active.</p>
            </div>
        `;
    } else if (space.status === "free") {
        html += `
            <div style="background:#f0fff4; border:1px solid #c6f6d5; padding:14px; border-radius:10px; color:#22543d;">
                <p style="margin:0; font-weight:600;">✓ This space is Free</p>
                <p style="margin:4px 0 0 0; font-size:12px;">Available for instant online reservation by drivers.</p>
            </div>
        `;
    } else {
        html += `
            <div style="background:#f7fafc; border:1px solid #e2e8f0; padding:14px; border-radius:10px; color:#4a5568;">
                <p style="margin:0; font-weight:600;">Status: ${STATUS_LABEL[space.status] || space.status}</p>
                <p style="margin:4px 0 0 0; font-size:12px;">You can free or change this space status using the buttons below.</p>
            </div>
        `;
    }

    content.innerHTML = html;
    modal.style.display = "flex";
}

async function refreshSpaceGrid() {
    const grid = document.getElementById("spaceGrid");
    if (!grid) return;

    const result = await mapi(`spacemap.php?location_id=${currentSpaceLocationId}`);
    if (!result.success) return;

    currentLoadedSpaces = result.spaces || [];

    const legend = document.getElementById("spaceLegend");
    if (legend) {
        const visualCounts = { free: 0, reserved: 0, occupied: 0, maintenance: 0 };
        currentLoadedSpaces.forEach(s => {
            const v = getSpaceVisualState(s);
            if (visualCounts[v.key] !== undefined) visualCounts[v.key]++;
        });
        legend.innerHTML = `
            <span><span class="space-box space-free" style="display:inline-flex; width:14px; height:14px; vertical-align:middle; margin-right:4px;"></span> Free (${visualCounts.free})</span>
            <span><span class="space-box space-reserved" style="display:inline-flex; width:14px; height:14px; vertical-align:middle; margin-right:4px;"></span> Future Reserved (${visualCounts.reserved})</span>
            <span><span class="space-box space-occupied" style="display:inline-flex; width:14px; height:14px; vertical-align:middle; margin-right:4px;"></span> Reserved / Occupied (${visualCounts.occupied})</span>
            <span><span class="space-box space-blocked" style="display:inline-flex; width:14px; height:14px; vertical-align:middle; margin-right:4px;"></span> Blocked (${visualCounts.maintenance})</span>
        `;
    }

    renderFilteredSpaces();
}

// ---------------- 4. VIOLATIONS (violations.html) ----------------
async function loadViolations() {
    const list = document.getElementById("violationsList");
    if (!list) return;

    const result = await mapi("violations_list.php");
    if (!result.success) return;

    if (result.violations.length === 0) {
        list.innerHTML = "<div class=\"data-table-container\" style=\"padding:20px; color:#718096;\">No violations recorded.</div>";
        return;
    }

    list.innerHTML = result.violations.map((v) => {
        const isOpen = v.status === "open";
        return `
        <div class="data-table-container" style="margin-bottom: 15px; border-left: 4px solid ${isOpen ? '#e53e3e' : '#38a169'};">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span class="badge ${v.status}" style="${isOpen ? 'background:#fed7d7; color:#9b2c2c;' : 'background:#c6f6d5; color:#22543d;'}">${v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span>
                    <h4 style="margin: 8px 0 4px 0;">${v.violation_code} — ${v.category_name}</h4>
                    <p style="font-size: 12px; color: #718096;">
                        ${v.vehicle_plate ? 'Plate <b>' + v.vehicle_plate + '</b> · ' : ''}
                        ${v.location_name}
                        ${v.space_code ? ' · Space <b>' + v.space_code + '</b>' : ''} · 
                        Fine: <b>৳${v.fine_amount}</b> · 
                        ${new Date(v.created_at).toLocaleString()}
                    </p>
                    <p style="font-size: 13px; font-style: italic; margin-top: 8px; color: #4a5568;">"${v.description}"</p>
                </div>
                ${isOpen ? `
                    <div style="text-align: right; align-self: center;">
                        <button class="btn-primary resolve-btn" style="background:#38a169; padding:8px 16px;" data-code="${v.violation_code}">✓ Resolve</button>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join("");

    list.querySelectorAll(".resolve-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const result = await mapi("resolve_violation.php", "POST", { violation_code: btn.dataset.code });
            if (result.success) loadViolations();
        });
    });
}

async function setupViolationReportForm() {
    const reportBtn = document.getElementById("reportViolationBtn");
    const modal = document.getElementById("violationModal");
    const closeBtn = document.getElementById("closeVioModalBtn");
    const form = document.getElementById("violationForm");

    if (!reportBtn || !modal) return;

    reportBtn.addEventListener("click", async () => {
        modal.classList.remove("hidden");
        // Populate locations (scoped for managers)
        const locSelect = document.getElementById("vioLocationSelect");
        if (locSelect) {
            try {
                const sRes = await fetch("../backend/check_session.php", { credentials: "include" }).then(r => r.json());
                const u = sRes.user;
                if (u && u.role === 'manager' && u.location_id) {
                    locSelect.innerHTML = `<option value="${u.location_id}">${u.location_name || 'My Facility'}</option>`;
                    locSelect.disabled = true;
                    locSelect.style.background = "#f7fafc";
                } else if (locSelect.options.length === 0) {
                    const locRes = await fetch(`${DRV_API}/get_locations.php`).then(r => r.json());
                    if (locRes.success) {
                        locSelect.innerHTML = locRes.locations.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
                    }
                }
            } catch (err) {
                console.error("Could not load violation locations", err);
            }
        }
        // Populate categories
        const catSelect = document.getElementById("vioCategorySelect");
        if (catSelect && catSelect.options.length === 0) {
            const catRes = await fetch(`${ADM_API}/violation_categories.php`, { credentials: "include" }).then(r => r.json());
            if (catRes.success) {
                catSelect.innerHTML = catRes.categories.map(c => `<option value="${c.id}">${c.name} (Fine: ৳${c.fine_amount})</option>`).join("");
            }
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
    });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            let location_id = parseInt(document.getElementById("vioLocationSelect").value, 10);
            if (!location_id || isNaN(location_id)) {
                const sRes = await fetch("../backend/check_session.php", { credentials: "include" }).then(r => r.json());
                if (sRes.user && sRes.user.location_id) location_id = sRes.user.location_id;
            }
            const category_id = parseInt(document.getElementById("vioCategorySelect").value, 10);
            const vehicle_plate = document.getElementById("vioPlate").value.trim();
            const description = document.getElementById("vioDescription").value.trim();

            const result = await mapi("report_violation.php", "POST", {
                location_id, category_id, vehicle_plate, description
            });

            alert(result.message);
            if (result.success) {
                form.reset();
                modal.classList.add("hidden");
                loadViolations();
            }
        });
    }
}

// ---------------- 5. AREA REPORTS (reports.html) ----------------
async function loadManagerReports() {
    const sub = document.getElementById("areaReportSubtitle");
    const dlBtn = document.getElementById("downloadAreaReportBtn");
    if (!sub && !dlBtn) return;

    if (dlBtn) {
        dlBtn.addEventListener("click", () => {
            window.location.href = `${MGR_API}/area_report_pdf.php`;
        });
    }

    const res = await mapi("reports_data.php");
    if (!res.success) return;

    if (sub && res.location) {
        sub.textContent = `${res.location.name} — performance analytics`;
    }

    const revEl = document.getElementById("repWeeklyRevenue");
    const countEl = document.getElementById("repWeeklyReservations");
    const peakDayEl = document.getElementById("repPeakDay");
    const peakAmtEl = document.getElementById("repPeakAmount");
    const occEl = document.getElementById("repAvgOccupancy");

    if (revEl) revEl.textContent = money(res.weekly_revenue);
    if (countEl) countEl.textContent = res.weekly_reservations;
    if (peakDayEl) peakDayEl.textContent = res.peak_day;
    if (peakAmtEl) peakAmtEl.textContent = money(res.peak_amount);
    if (occEl) occEl.textContent = res.avg_occupancy + "%";

    // Daily bars
    const barsContainer = document.getElementById("dailyRevenueBars");
    if (barsContainer && res.daily) {
        const max = Math.max(1, ...res.daily.map(d => d.revenue));
        barsContainer.innerHTML = res.daily.map(d => {
            const pct = Math.max(15, Math.round((d.revenue / max) * 100));
            return `
                <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
                    <span style="font-size:10px; color:#718096; margin-bottom:4px;">${money(d.revenue)}</span>
                    <div style="width: 42px; background: #319795; height: ${pct}%; border-radius: 4px 4px 0 0; text-align: center; color: white; font-size: 11px; font-weight:600; padding-top:4px;">${d.day}</div>
                </div>
            `;
        }).join("");
    }
}

// ---------------- 6. RESERVATIONS LIST (6 pages) ----------------
async function loadReservationsList() {
    const tbody = document.getElementById("reservationsTableBody");
    if (!tbody) return;

    const file = window.location.pathname.split("/").pop();
    let status = "all";
    if (file.includes("booked")) status = "booked";
    else if (file.includes("active")) status = "active";
    else if (file.includes("upcoming")) status = "upcoming";
    else if (file.includes("completed")) status = "completed";
    else if (file.includes("cancelled")) status = "cancelled";

    let currentList = [];

    const fetchReservations = async (searchTerm = "") => {
        let url = `reservations_list.php?status=${status}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

        const result = await mapi(url);
        if (!result.success) return;

        currentList = result.reservations || [];

        const headerSub = document.querySelector(".page-header-sub p");
        if (headerSub && currentList.length > 0) {
            headerSub.textContent = `${currentList[0].location_name} — ${status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} bookings`;
        }

        if (currentList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:#718096;">No ${status === 'all' ? '' : status} reservations found.</td></tr>`;
            const countText = document.querySelector(".data-table-container p[style*='margin-top: 15px']");
            if (countText) countText.textContent = `0 reservations found`;
            return;
        }

        const isCancelledPage = status === "cancelled" || file.includes("cancelled");

        tbody.innerHTML = currentList.map((r) => {
            const hours = Math.max(1, Math.round((new Date(`2000-01-01T${r.end_time}`) - new Date(`2000-01-01T${r.start_time}`)) / 3600000));
            const disp = (r.display_status || r.status || '').toLowerCase();
            const isAwaitingCheckin = disp === 'booked' || disp === 'upcoming';
            const isActive = disp === 'active';

            return `
            <tr>
                <td><a href="#" class="view-booking-link" data-code="${r.booking_code}" style="color: #6b46c1; text-decoration: none; font-weight:700;">${r.booking_code}</a></td>
                <td><b>${r.driver_name}</b>${r.driver_phone ? `<br><small style="color:#718096;">${r.driver_phone}</small>` : ''}</td>
                <td><b>${r.vehicle_plate || '-'}</b></td>
                <td><span style="font-weight:700; color:#2b6cb0;">${r.space_code}</span></td>
                <td>${r.reserve_date}</td>
                <td>${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)} <small style="color:#a0aec0;">(${hours}h)</small></td>
                <td>${getPaymentBadge(r.payment_method, r.payment_status, r.transaction_id)}</td>
                <td>
                    ${isCancelledPage ? `
                        Fine: <b style="color:#e53e3e;">${money(r.fine_amount)}</b><br><small style="color:#38a169; font-weight:600;">Refund: ${money(r.refund_amount)}</small>
                    ` : `
                        <b>${money(r.total_cost)}</b>
                        ${r.fine_amount > 0 ? `<br><small style="color:#e53e3e; font-weight:600;">Fine: ${money(r.fine_amount)}</small>` : ''}
                        ${Number(r.discount_amount) > 0 ? ' <br><small style="color:#2b6cb0; font-weight:600;">🎓 UIU 25% Off</small>' : ''}
                    `}
                </td>
                <td>
                    ${getStatusBadge(r.status, r.display_status)}
                    ${r.is_overtime ? `<br><span style="display:inline-block; margin-top:3px; padding:2px 6px; font-size:10px; font-weight:700; color:#fff; background:#e53e3e; border-radius:4px;">⚠️ Overtime +${r.overtime_minutes}m</span>` : ''}
                    ${r.has_slot_conflict ? `<br><span style="display:inline-block; margin-top:2px; padding:2px 6px; font-size:10px; font-weight:700; color:#fff; background:#991b1b; border-radius:4px;">🚨 Conflict #${r.conflict_booking_code}</span>` : ''}
                </td>
                <td style="text-align: right;">
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button class="action-btn-sm btn-detail btn-open-modal" data-code="${r.booking_code}">Details</button>
                        ${isAwaitingCheckin ? `<button class="action-btn-sm btn-checkin btn-quick-checkin" data-code="${r.booking_code}">Check In</button>` : ''}
                        ${isActive ? `<button class="action-btn-sm btn-complete btn-quick-checkout" data-code="${r.booking_code}">Complete</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join("");

        const countText = document.querySelector(".data-table-container p[style*='margin-top: 15px']");
        if (countText) {
            countText.textContent = `${currentList.length} reservations found`;
        }

        wireReservationRowActions(tbody, currentList, () => fetchReservations(searchInput ? searchInput.value.trim() : ""));
    };

    const searchInput = document.querySelector(".table-header-row .search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            fetchReservations(e.target.value.trim());
        });
    }

    fetchReservations();
}

// ---------------- 7. DRIVER CHAT (chat.html) ----------------
let activeChatDriverId = null;
let managerChatPoll = null;

async function loadManagerChat() {
    const contactsListEl = document.getElementById("managerChatContactsList");
    const sendBtn = document.getElementById("managerChatSendBtn");
    const input = document.getElementById("managerChatInput");

    if (!contactsListEl) return;

    const res = await mcapi("get_contacts.php");
    if (!res.success || res.contacts.length === 0) {
        contactsListEl.innerHTML = `<div style="padding:15px; color:#718096; font-size:12px;">No active driver chats yet.</div>`;
        return;
    }

    const drivers = res.contacts;
    activeChatDriverId = drivers[0].id;

    renderDriverContacts(drivers);
    loadMessagesForSelectedDriver();

    if (sendBtn && input) {
        const doSend = async () => {
            const text = input.value.trim();
            if (!text || !activeChatDriverId) return;
            input.value = "";

            const sendRes = await mcapi("send_message.php", "POST", {
                receiver_id: activeChatDriverId,
                message: text
            });
            if (sendRes.success) {
                loadMessagesForSelectedDriver();
            }
        };

        sendBtn.addEventListener("click", doSend);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                doSend();
            }
        });
    }

    if (managerChatPoll) clearInterval(managerChatPoll);
    managerChatPoll = setInterval(loadMessagesForSelectedDriver, 3000);
}

function renderDriverContacts(drivers) {
    const listEl = document.getElementById("managerChatContactsList");
    if (!listEl) return;

    listEl.innerHTML = drivers.map((d) => `
        <div class="chat-contact-item" data-id="${d.id}" style="padding: 14px; border-bottom: 1px solid #edf2f7; cursor: pointer; ${d.id === activeChatDriverId ? 'background:#fff; border-left:4px solid #319795;' : 'background:#f8fafc;'}">
            <b>${d.full_name}</b> ${d.vehicle_plate !== '-' ? `<span style="font-size:11px; color:#718096;">(${d.vehicle_plate})</span>` : ''}
            <span style="font-size: 11px; color:#a0aec0; float:right;">${d.last_message_time ? new Date(d.last_message_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
            <p style="font-size: 12px; color: #718096; margin-top: 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.last_message || 'Start chatting with driver...'}</p>
            ${d.unread_count > 0 ? `<span style="background:#e53e3e; color:#fff; border-radius:10px; padding:1px 6px; font-size:10px; font-weight:700;">${d.unread_count} new</span>` : ''}
        </div>
    `).join("");

    listEl.querySelectorAll(".chat-contact-item").forEach(item => {
        item.addEventListener("click", () => {
            activeChatDriverId = parseInt(item.dataset.id, 10);
            renderDriverContacts(drivers);
            loadMessagesForSelectedDriver();
        });
    });
}

async function loadMessagesForSelectedDriver() {
    if (!activeChatDriverId) return;

    const header = document.getElementById("managerChatHeader");
    const container = document.getElementById("managerChatMessages");
    if (!container) return;

    const res = await mcapi(`get_messages.php?contact_id=${activeChatDriverId}`);
    if (!res.success) return;

    const activeItem = document.querySelector(`.chat-contact-item[data-id="${activeChatDriverId}"] b`);
    if (header && activeItem) {
        header.textContent = `Chatting with: ${activeItem.textContent}`;
    }

    if (res.messages.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#a0aec0; margin-top:30px;">No messages yet. Send a message to assist the driver.</p>`;
        return;
    }

    container.innerHTML = res.messages.map(m => {
        if (m.is_me) {
            return `
                <div style="align-self: flex-end; background: #319795; color: white; padding: 10px 14px; border-radius: 8px; max-width: 65%; font-size: 13px;">
                    ${m.message}
                </div>
            `;
        } else {
            return `
                <div style="align-self: flex-start; background: #edf2f7; color: #2d3748; padding: 10px 14px; border-radius: 8px; max-width: 65%; font-size: 13px;">
                    <b>${m.sender_name}:</b> ${m.message}
                </div>
            `;
        }
    }).join("");

    container.scrollTop = container.scrollHeight;
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof initSessionGuard === "function") {
        await initSessionGuard(["manager", "admin"]);
    }

    loadManagerOverview();
    loadCheckinCheckoutPage();
    loadSpaceMap();
    loadViolations();
    setupViolationReportForm();
    loadManagerReports();
    loadReservationsList();
    loadManagerChat();

    // Periodic live sync (time-to-time and daily-to-daily auto-free updates)
    // 1. Auto-refresh Space Map every 4s to reflect auto-freed spots immediately
    if (document.getElementById("spaceGrid")) {
        setInterval(() => {
            const modal = document.getElementById("spaceDetailModal");
            if (!modal || modal.style.display === "none") {
                refreshSpaceGrid();
            }
        }, 4000);
    }

    // 2. Auto-refresh Check-In / Check-Out lists every 5s
    if (document.getElementById("pendingCheckinsList")) {
        setInterval(() => {
            loadPendingCheckins();
            loadActiveCheckouts();
        }, 5000);
    }

    // 3. Auto-refresh Overview stats every 6s
    if (document.getElementById("todayReservationsBody")) {
        setInterval(() => {
            const searchInput = document.getElementById("overviewSearchInput");
            if (!searchInput || !searchInput.value.trim()) {
                loadManagerOverview(true);
            }
        }, 6000);
    }

    // 4. Auto-refresh Reservations list every 5s
    if (document.getElementById("reservationsTableBody")) {
        setInterval(() => {
            const searchInput = document.querySelector(".table-header-row .search-input");
            if (!searchInput || !searchInput.value.trim()) {
                loadReservationsList();
            }
        }, 5000);
    }
});
