

const API = "../backend/driver";
const CHAT_API = "../backend/chat";

async function dapi(path, method, body) {
    const opts = {
        method: method || "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}/${path}`, opts);
    return res.json();
}

async function capi(path, method, body) {
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

// ---------------- 1. DRIVER DASHBOARD (index.html) ----------------
async function loadDriverDashboard() {
    const activeContainer = document.querySelector(".active-card");
    const statsGrid = document.querySelector(".stats-grid");
    const activityList = document.querySelector(".activity-list");

    if (!activeContainer && !statsGrid) return;

    const result = await dapi("dashboard.php");
    if (!result.success) return;

    // Active, Booked, or Upcoming reservation
    if (activeContainer) {
        const ar = result.active_reservation;
        if (ar) {
            const isActive = (ar.display_status === "Active" || ar.status === "active");
            const isBooked = (ar.display_status === "Booked" || ar.status === "booked");
            const isUpcoming = (ar.display_status === "Upcoming" || ar.status === "upcoming");
            
            let badgeBg = isActive ? "#c6f6d5" : (isBooked ? "#e0e7ff" : "#bee3f8");
            let badgeColor = isActive ? "#22543d" : (isBooked ? "#3730a3" : "#2b6cb0");
            let badgeTxt = isActive ? (ar.is_overtime ? `Active · Overtime (+${ar.overtime_minutes}m)` : "Active (Trip In Progress)") : (isBooked ? "Booked" : "Upcoming");
            
            let timeSub = `Date: ${ar.reserve_date} · ${ar.start_time.slice(0,5)} – ${ar.end_time.slice(0,5)}`;
            let footerLeft = `Booking: <strong>${ar.booking_code}</strong> · Payment: <strong>${ar.payment_method || 'bKash'}</strong> <span style="color:#16a34a; font-weight:700;">(${(ar.payment_status || 'paid').toUpperCase()})</span>`;

            activeContainer.innerHTML = `
                <div class="active-header">
                    <h3>Current Trip Status</h3>
                    <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:700; padding:4px 12px; border-radius:12px;">${badgeTxt}</span>
                </div>
                <div class="active-body">
                    <div class="parking-info">
                        <h2>${ar.location_name} — Space ${ar.space_code}</h2>
                        <div class="time-info">${timeSub} ${ar.vehicle_plate ? `· Plate: <b>${ar.vehicle_plate}</b>` : ''}</div>
                    </div>
                    <div class="otp-box">
                        <span class="otp-label">Security OTP</span>
                        <span class="otp-code">${ar.otp_code}</span>
                    </div>
                </div>
                ${ar.is_overtime ? `
                <div style="background:#fff5f5; border:1px solid #feb2b2; border-left:4px solid #e53e3e; border-radius:6px; padding:10px 14px; margin: 10px 0; color:#c53030; font-size:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="font-size:13px;"><i class="fa-solid fa-triangle-exclamation"></i> OVERTIME EXCEEDED: +${ar.overtime_minutes} mins</strong>
                        ${ar.has_slot_conflict ? `
                            <p style="margin:2px 0 0 0; font-weight:700; color:#9b2c2c;">🚨 Violation Recorded: Another booking (#${ar.conflict_booking_code}) is scheduled for this slot! Slot blocking fine applied.</p>
                        ` : `
                            <p style="margin:2px 0 0 0; color:#742a2a;">Without a check-out by the manager, your booking status remains <strong>ACTIVE</strong> and an overtime fine is being incurred based on duration used. <em>Only the manager can perform the check-out.</em></p>
                        `}
                    </div>
                    <span style="background:#e53e3e; color:#fff; font-weight:700; padding:6px 12px; border-radius:6px; font-size:13px;">Fine: +৳${ar.fine_amount || ar.overtime_fine}</span>
                </div>` : ''}
                <div class="active-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>${footerLeft} ${ar.discount_amount > 0 ? '<span class="badge" style="background:#ebf8ff; color:#2b6cb0; font-size:11px; margin-left:6px;">🎓 UIU 25% Off</span>' : ''}</div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span>Total: <strong>${money(ar.total_cost)}</strong></span>
                        <a href="my-reservations.html" style="padding:6px 12px; background:#319795; color:#fff; text-decoration:none; border-radius:6px; font-size:12px; font-weight:600;">Manage Booking &rarr;</a>
                    </div>
                </div>
            `;
        } else {
            activeContainer.innerHTML = `
                <div class="active-header">
                    <h3>Current Booking</h3>
                    <span class="badge" style="background:#cbd5e0; color:#4a5568;">None</span>
                </div>
                <div class="active-body" style="padding: 24px 0;">
                    <div class="parking-info">
                        <h2>No Active Reservation</h2>
                        <div class="time-info">Need a spot? Reserve your parking space in seconds.</div>
                    </div>
                    <div>
                        <a href="find-parking.html" class="reserve-btn" style="display:inline-block; text-decoration:none; padding:10px 18px; border-radius:6px; background:#319795; color:#fff; font-weight:600;">Find Parking &rarr;</a>
                    </div>
                </div>
            `;
        }
    }

    // Quick Stats
    if (statsGrid && result.stats) {
        const s = result.stats;
        const vals = statsGrid.querySelectorAll(".stat-value");
        if (vals[0]) vals[0].textContent = s.total_reservations;
        if (vals[1]) vals[1].textContent = s.hours_parked + "h";
        if (vals[2]) vals[2].textContent = s.locations_used;
        if (vals[3]) vals[3].textContent = s.avg_rating + " ★";
    }

    // Recent Activity
    if (activityList && result.recent_activity) {
        if (result.recent_activity.length === 0) {
            activityList.innerHTML = `<li style="padding:12px; color:#718096;">No recent activity yet. Start by reserving a parking space!</li>`;
        } else {
            activityList.innerHTML = result.recent_activity.map(it => {
                const isActive = it.status === "active";
                return `
                    <li>
                        <span class="bullet ${isActive ? 'active-bullet' : ''}"></span>
                        <div>
                            <p>${it.status.charAt(0).toUpperCase() + it.status.slice(1)} - ${it.location_name} · ${it.space_code}</p>
                            <span class="activity-time">${it.reserve_date} · ${it.start_time.slice(0,5)}</span>
                        </div>
                    </li>
                `;
            }).join("");
        }
    }
}

// ---------------- 2. FIND PARKING (find-parking.html) ----------------
let allLocations = [];
let modalLocation = null;

async function loadLocations() {
    const grid = document.getElementById("parkingGrid");
    if (!grid) return;

    const result = await dapi("get_locations.php");
    if (!result.success) return;

    allLocations = result.locations;
    renderParkingGrid(allLocations);

    // Search bar functionality
    const searchInput = document.querySelector(".search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allLocations.filter(loc =>
                loc.name.toLowerCase().includes(query) ||
                loc.address.toLowerCase().includes(query)
            );
            renderParkingGrid(filtered);
        });
    }
}

function renderParkingGrid(locations) {
    const grid = document.getElementById("parkingGrid");
    if (!grid) return;

    if (locations.length === 0) {
        grid.innerHTML = `<p style="padding:20px; color:#718096; grid-column: 1 / -1;">No parking locations match your search.</p>`;
        return;
    }

    grid.innerHTML = locations.map((loc) => {
        const pct = loc.total_spaces ? Math.round((loc.available_spaces / loc.total_spaces) * 100) : 0;
        const isFull = loc.available_spaces === 0;

        return `
        <div class="parking-card" data-id="${loc.id}">
            <div class="parking-card-header">
                <h3>${loc.name}</h3>
                <span class="rating-val">★ ${loc.rating}</span>
            </div>
            <p class="location-detail">${loc.address}</p>
            <p class="availability-detail">Availability: <strong>${loc.available_spaces} of ${loc.total_spaces}</strong> spaces available (${pct}% free)</p>
            <div class="card-footer">
                <span class="rate-badge">৳${loc.price_per_hour}/hr</span>
                ${isFull 
                    ? `<button class="reserve-btn" disabled style="background:#cbd5e0; cursor:not-allowed;">Full</button>` 
                    : `<button class="reserve-btn" data-id="${loc.id}">Reserve a Space</button>`}
            </div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".reserve-btn:not([disabled])").forEach((btn) => {
        btn.addEventListener("click", () => openReserveModal(parseInt(btn.dataset.id, 10)));
    });
}

function isCurrentUserUiu() {
    const u = window.currentUser;
    if (!u) return false;
    return /^011\d{7}$/.test(String(u.uiu_id || "").trim());
}

function computeCost() {
    if (!modalLocation) return;
    const dateInput = document.getElementById("resDate");
    const startInput = document.getElementById("resStart");
    const endInput = document.getElementById("resEnd");
    const modalCost = document.getElementById("modalCost");
    const modalCostDetails = document.getElementById("modalCostDetails");
    const uiuBadge = document.getElementById("uiuDiscountBadge");

    if (!dateInput || !startInput || !endInput || !modalCost) return;
    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;

    if (!date || !start || !end) return;
    const startTs = new Date(`${date}T${start}`);
    const endTs = new Date(`${date}T${end}`);
    const hours = (endTs - startTs) / 3600000;

    if (hours <= 0) {
        modalCost.textContent = "৳0";
        if (modalCostDetails) modalCostDetails.textContent = "End time must be after start time";
        if (uiuBadge) uiuBadge.style.display = "none";
        return;
    }

    const grossCost = Math.round(hours * modalLocation.price_per_hour);
    const hasUiuDiscount = isCurrentUserUiu();

    if (hasUiuDiscount) {
        const discount = Math.round(grossCost * 0.25);
        const netCost = Math.max(0, grossCost - discount);
        modalCost.innerHTML = `${money(netCost)} <span style="font-size:13px; color:#a0aec0; text-decoration:line-through; font-weight:normal; margin-left:6px;">${money(grossCost)}</span>`;
        if (modalCostDetails) {
            modalCostDetails.innerHTML = `<span style="color:#2b6cb0; font-weight:600;">🎓 25% UIU Community Discount applied</span> (Save ${money(discount)}) · ${hours.toFixed(1)}h at ৳${modalLocation.price_per_hour}/hr`;
        }
        if (uiuBadge) uiuBadge.style.display = "block";
    } else {
        modalCost.textContent = money(grossCost);
        if (modalCostDetails) {
            modalCostDetails.textContent = `Based on ${hours.toFixed(1)} hours at ৳${modalLocation.price_per_hour}/hr`;
        }
        if (uiuBadge) uiuBadge.style.display = "none";
    }
}

let selectedDriverSpaceId = null;
let driverModalPoll = null;

async function loadDriverLocationSpaces(locationId, keepSelection = false) {
    const spaceGrid = document.getElementById("driverSpaceGrid");
    const spaceLabel = document.getElementById("selectedSpaceLabel");
    const banner = document.getElementById("slotAvailabilityBanner");
    const bannerIcon = document.getElementById("slotAvailabilityIcon");
    const bannerText = document.getElementById("slotAvailabilityText");
    const confirmBtn = document.getElementById("confirmReserveBtn");
    if (!spaceGrid) return;

    const date = document.getElementById("resDate") ? document.getElementById("resDate").value : "";
    const start = document.getElementById("resStart") ? document.getElementById("resStart").value : "";
    const end = document.getElementById("resEnd") ? document.getElementById("resEnd").value : "";

    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const localToday = `${localYear}-${localMonth}-${localDay}`;
    const pad = (n) => String(n).padStart(2, '0');
    const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // 1. Check if date is in past
    if (date && date < localToday) {
        if (banner && bannerText && bannerIcon) {
            banner.style.background = "#fef2f2";
            banner.style.border = "1px solid #fecaca";
            banner.style.color = "#991b1b";
            bannerIcon.textContent = "✕";
            bannerText.textContent = "Reservation date cannot be in the past. Please select today or a future date.";
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Invalid Date";
            confirmBtn.style.background = "#cbd5e0";
            confirmBtn.style.cursor = "not-allowed";
        }
        spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#991b1b; font-size:12px; padding:10px;">Cannot book for past date.</div>`;
        return;
    }

    // 2. Check end time vs start time
    if (start && end && end <= start) {
        if (banner && bannerText && bannerIcon) {
            banner.style.background = "#fef2f2";
            banner.style.border = "1px solid #fecaca";
            banner.style.color = "#991b1b";
            bannerIcon.textContent = "✕";
            bannerText.textContent = "End time must be after start time. Please adjust your time slot.";
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Invalid Time Slot";
            confirmBtn.style.background = "#cbd5e0";
            confirmBtn.style.cursor = "not-allowed";
        }
        spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#991b1b; font-size:12px; padding:10px;">End time must be after start time.</div>`;
        return;
    }

    // 3. Check if today and end time is in past
    if (date === localToday && end && end <= currentTimeStr) {
        if (banner && bannerText && bannerIcon) {
            banner.style.background = "#fef2f2";
            banner.style.border = "1px solid #fecaca";
            banner.style.color = "#991b1b";
            bannerIcon.textContent = "✕";
            bannerText.textContent = "This time slot has already passed today. Please pick an upcoming time window.";
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Time Passed";
            confirmBtn.style.background = "#cbd5e0";
            confirmBtn.style.cursor = "not-allowed";
        }
        spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#991b1b; font-size:12px; padding:10px;">Selected time has already passed today.</div>`;
        return;
    }

    if (!keepSelection) {
        selectedDriverSpaceId = null;
        if (spaceLabel) spaceLabel.textContent = "Checking slots...";
        spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#718096; font-size:12px; padding:10px;">Checking slot availability...</div>`;
    }

    try {
        let url = `get_location_spaces.php?location_id=${locationId}`;
        if (date && start && end) {
            url += `&date=${encodeURIComponent(date)}&start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`;
        }

        const res = await dapi(url);
        if (!res.success || !res.spaces || res.spaces.length === 0) {
            spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#e53e3e; font-size:12px; padding:10px;">${res.message || 'No parking spaces configured for this facility.'}</div>`;
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "Slot Unavailable";
                confirmBtn.style.background = "#cbd5e0";
                confirmBtn.style.cursor = "not-allowed";
            }
            return;
        }

        // Update Availability Banner
        if (banner && bannerText && bannerIcon) {
            if (res.has_free_slot) {
                banner.style.background = "#f0fdf4";
                banner.style.border = "1px solid #bbf7d0";
                banner.style.color = "#166534";
                bannerIcon.textContent = "✓";
                bannerText.textContent = `Available: ${res.available_slots} of ${res.total_slots} slots free for selected time window`;
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Confirm Reservation";
                    confirmBtn.style.background = "#4318ff";
                    confirmBtn.style.cursor = "pointer";
                }
            } else {
                banner.style.background = "#fef2f2";
                banner.style.border = "1px solid #fecaca";
                banner.style.color = "#991b1b";
                bannerIcon.textContent = "✕";
                bannerText.textContent = res.message || "No slots available for this time window. Booking cannot be made.";
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = "Slot Unavailable - Pick Another Time";
                    confirmBtn.style.background = "#cbd5e0";
                    confirmBtn.style.cursor = "not-allowed";
                }
            }
        }

        spaceGrid.innerHTML = res.spaces.map(s => {
            const isSelected = (selectedDriverSpaceId === s.id);
            if (s.is_free) {
                return `<div class="driver-space-item free ${isSelected ? 'selected' : ''}" data-id="${s.id}" data-code="${s.space_code}" title="Space ${s.space_code} - Free for this slot">
                    <span>${s.space_code}</span>
                    <span style="font-size:9px; font-weight:normal; opacity:0.85;">Free</span>
                </div>`;
            } else {
                return `<div class="driver-space-item booked" data-id="${s.id}" data-code="${s.space_code}" title="Space ${s.space_code} - ${s.display_status}" style="cursor:not-allowed; opacity:1;">
                    <span>${s.space_code}</span>
                    <span style="font-size:9px; font-weight:normal; opacity:0.85;">${s.display_status}</span>
                </div>`;
            }
        }).join("");

        // Select free space
        const stillSelected = selectedDriverSpaceId ? res.spaces.find(s => s.id === selectedDriverSpaceId && s.is_free) : null;
        if (!stillSelected) {
            const firstFree = spaceGrid.querySelector(".driver-space-item.free");
            if (firstFree && res.has_free_slot) {
                firstFree.classList.add("selected");
                selectedDriverSpaceId = parseInt(firstFree.dataset.id, 10);
                if (spaceLabel) spaceLabel.textContent = `Selected: ${firstFree.dataset.code} (Free)`;
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Confirm Reservation";
                    confirmBtn.style.background = "#4318ff";
                    confirmBtn.style.cursor = "pointer";
                }
            } else {
                selectedDriverSpaceId = null;
                if (spaceLabel) spaceLabel.textContent = "No slots free for this time";
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = "Slot Unavailable";
                    confirmBtn.style.background = "#cbd5e0";
                    confirmBtn.style.cursor = "not-allowed";
                }
            }
        } else {
            if (spaceLabel) spaceLabel.textContent = `Selected: ${stillSelected.space_code} (Free)`;
        }

        // Allow driver to click any free space to select it
        spaceGrid.querySelectorAll(".driver-space-item.free").forEach(item => {
            item.addEventListener("click", () => {
                spaceGrid.querySelectorAll(".driver-space-item.free").forEach(el => el.classList.remove("selected"));
                item.classList.add("selected");
                selectedDriverSpaceId = parseInt(item.dataset.id, 10);
                if (spaceLabel) spaceLabel.textContent = `Selected: ${item.dataset.code} (Free)`;
                if (confirmBtn && res.has_free_slot) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Confirm Reservation";
                    confirmBtn.style.background = "#4318ff";
                    confirmBtn.style.cursor = "pointer";
                }
            });
        });
    } catch (e) {
        console.error("Error loading spaces", e);
        if (!keepSelection) {
            spaceGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#e53e3e; font-size:12px; padding:10px;">Could not check availability.</div>`;
        }
    }
}

function openReserveModal(locationId) {
    modalLocation = allLocations.find((l) => l.id === locationId);
    if (!modalLocation) return;

    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const localToday = `${localYear}-${localMonth}-${localDay}`;

    const dateInput = document.getElementById("resDate");
    const startInput = document.getElementById("resStart");
    const endInput = document.getElementById("resEnd");

    if (dateInput) {
        dateInput.min = localToday;
        if (!dateInput.value || dateInput.value < localToday) {
            dateInput.value = localToday;
        }
    }

    // Set intelligent upcoming time defaults
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    let startH = currentHour + 1;
    let endH = startH + 2;

    if (startH >= 23) {
        // Late at night: advance to tomorrow
        const tomorrow = new Date(now.getTime() + 86400000);
        const tomYear = tomorrow.getFullYear();
        const tomMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tomDay = String(tomorrow.getDate()).padStart(2, '0');
        if (dateInput) dateInput.value = `${tomYear}-${tomMonth}-${tomDay}`;
        startH = 9;
        endH = 12;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const defaultStartStr = `${pad(startH)}:00`;
    const defaultEndStr = `${pad(Math.min(23, endH))}:00`;

    if (startInput) {
        const isSelectedDateToday = dateInput && dateInput.value === localToday;
        const currentTimeStr = `${pad(currentHour)}:${pad(currentMin)}`;
        if (!startInput.value || (isSelectedDateToday && startInput.value < currentTimeStr)) {
            startInput.value = defaultStartStr;
        }
    }

    if (endInput) {
        if (!endInput.value || (startInput && endInput.value <= startInput.value)) {
            endInput.value = defaultEndStr;
        }
    }

    document.getElementById("modalSubtitle").textContent = `${modalLocation.name} · ৳${modalLocation.price_per_hour}/hr`;
    computeCost();
    loadDriverLocationSpaces(locationId);
    document.getElementById("modalOverlay").classList.remove("hidden");

    // Real-time polling while modal is open
    if (driverModalPoll) clearInterval(driverModalPoll);
    driverModalPoll = setInterval(() => {
        const modal = document.getElementById("modalOverlay");
        if (modal && !modal.classList.contains("hidden") && modalLocation) {
            loadDriverLocationSpaces(modalLocation.id, true);
        } else {
            clearInterval(driverModalPoll);
        }
    }, 5000);
}

function setupModal() {
    const modal = document.getElementById("modalOverlay");
    if (!modal) return;

    const closeModal = () => {
        modal.classList.add("hidden");
        if (driverModalPoll) clearInterval(driverModalPoll);
    };

    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // When date or time changes, recompute cost AND recheck live slot availability!
    ["resDate", "resStart", "resEnd"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            const triggerCheck = () => {
                computeCost();
                if (modalLocation) {
                    loadDriverLocationSpaces(modalLocation.id);
                }
            };
            el.addEventListener("change", triggerCheck);
            el.addEventListener("input", triggerCheck);
        }
    });

    const confirmBtn = document.getElementById("confirmReserveBtn");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!modalLocation) return;
            const date = document.getElementById("resDate").value;
            const start_time = document.getElementById("resStart").value;
            const end_time = document.getElementById("resEnd").value;
            const plateInput = document.getElementById("resPlate");
            const vehicle_plate = plateInput ? plateInput.value.trim() : "";
            const payMethodInput = document.getElementById("resPaymentMethod");
            const payment_method = payMethodInput ? payMethodInput.value : "bKash";

            if (!selectedDriverSpaceId) {
                alert("Please select an available free space or pick another time window.");
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = "Reserving...";

            const result = await dapi("create_reservation.php", "POST", {
                location_id: modalLocation.id,
                space_id: selectedDriverSpaceId,
                date,
                start_time,
                end_time,
                vehicle_plate,
                payment_method
            });

            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm Reservation";

            if (!result.success) {
                alert(result.message);
                return;
            }

            let confirmMsg = `Reservation Confirmed!\nTrip Status: Booked\n\nBooking Code: ${result.reservation.booking_code}\nReserved Space: ${result.reservation.space_code}\nOTP Code: ${result.reservation.otp_code}\nPayment Method: ${result.reservation.payment_method} (${result.reservation.payment_status.toUpperCase()})\nTransaction ID: ${result.reservation.transaction_id}`;
            if (result.reservation.discount_amount > 0) {
                confirmMsg += `\n\nOriginal Total: ৳${result.reservation.original_cost}\nUIU Discount (25% OFF): -৳${result.reservation.discount_amount}`;
            }
            confirmMsg += `\nTotal Paid: ৳${result.reservation.total_cost}\n\nPresent this OTP code to the parking manager upon check-in.`;
            alert(confirmMsg);
            closeModal();
            loadLocations();
        });
    }
}

// ---------------- 3. MY RESERVATIONS (my-reservations.html) ----------------
let currentCancelBooking = null;
let myReservationsTab = 'all';
let myReservationsSearch = '';
let myReservationsData = [];
let isMyResTabsSetup = false;

async function loadMyReservations() {
    const list = document.getElementById("reservationsList");
    if (!list) return;

    setupCancelModal();

    // Populate sidebar driver profile from session
    if (window.currentUser) {
        const sideName = document.getElementById("sidebarDriverName");
        const sideAvatar = document.getElementById("sidebarDriverAvatar");
        if (sideName) sideName.textContent = window.currentUser.full_name || 'Driver';
        if (sideAvatar) sideAvatar.textContent = (window.currentUser.full_name || 'D').charAt(0).toUpperCase();
    }

    try {
        const result = await dapi(`my_reservations.php?status=${myReservationsTab}`);
        if (!result.success) {
            list.innerHTML = `<div style="padding:24px; text-align:center; background:#fff5f5; border:1px solid #fed7d7; border-radius:16px; color:#9b2c2c;"><strong>Unable to load reservations</strong><p style="margin:8px 0 0; font-size:13px;">${result.message || 'Please refresh and try again.'}</p></div>`;
            return;
        }

        myReservationsData = result.reservations || [];

        // Update tab count badges if available
        if (result.counts) {
            const c = result.counts;
            const elAll = document.getElementById("countAll");
            const elActive = document.getElementById("countActive");
            const elBooked = document.getElementById("countBooked");
            const elUpcoming = document.getElementById("countUpcoming");
            const elComplete = document.getElementById("countComplete");
            const elCancelled = document.getElementById("countCancelled");

            if (elAll) elAll.textContent = c.all;
            if (elActive) elActive.textContent = c.active;
            if (elBooked) elBooked.textContent = c.booked;
            if (elUpcoming) elUpcoming.textContent = c.upcoming;
            if (elComplete) elComplete.textContent = c.complete;
            if (elCancelled) elCancelled.textContent = c.cancelled;
        }

        renderMyReservationsList();

        if (!isMyResTabsSetup) {
            setupMyReservationControls();
            isMyResTabsSetup = true;
        }
    } catch (err) {
        console.error("Error loading my reservations:", err);
        list.innerHTML = `<div style="padding:24px; text-align:center; background:#fff5f5; border:1px solid #fed7d7; border-radius:16px; color:#9b2c2c;"><strong>Could not connect to the reservation server</strong><p style="margin:8px 0 0; font-size:13px;">Please refresh the page or check your login session.</p></div>`;
    }
}

function setupMyReservationControls() {
    const tabs = document.querySelectorAll("#myReservationTabs .filter-tab-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            myReservationsTab = btn.dataset.status || 'all';
            loadMyReservations();
        });
    });

    const searchInput = document.getElementById("myResSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            myReservationsSearch = e.target.value.trim().toLowerCase();
            renderMyReservationsList();
        });
    }
}

function renderMyReservationsList() {
    const list = document.getElementById("reservationsList");
    if (!list) return;

    let filtered = myReservationsData.filter(r => {
        if (!myReservationsSearch) return true;
        const q = myReservationsSearch;
        const code = (r.booking_code || '').toLowerCase();
        const loc = (r.location_name || '').toLowerCase();
        const space = (r.space_code || '').toLowerCase();
        const plate = (r.vehicle_plate || '').toLowerCase();
        const pay = (r.payment_method || '').toLowerCase();
        return code.includes(q) || loc.includes(q) || space.includes(q) || plate.includes(q) || pay.includes(q);
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="padding: 40px 20px; text-align:center; background:#fff; border-radius:16px; border:1px solid #e9edf7;">
                <p style="color:#718096; font-size:15px; margin-bottom:15px;">No ${myReservationsTab === 'all' ? '' : myReservationsTab} reservations found.</p>
                <a href="find-parking.html" class="reserve-btn" style="display:inline-block; text-decoration:none; padding:10px 20px; border-radius:10px; background:#4318ff; color:#fff; font-weight:600; font-size:13px;">Find & Reserve Parking Spot</a>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map((r) => {
        const disp = (r.display_status || r.status || '').toLowerCase();
        const isActive = disp === "active";
        const isBooked = disp === "booked";
        const isUpcoming = disp === "upcoming";
        const isComplete = disp === "complete" || disp === "completed";
        const isCancelled = disp === "cancelled";

        let badgeBg = "#edf2f7";
        let badgeColor = "#4a5568";
        let badgeText = "Booked";

        if (isActive) {
            badgeBg = "#c6f6d5";
            badgeColor = "#22543d";
            badgeText = (r.is_overtime || (r.overtime_minutes && r.overtime_minutes > 0)) ? `Active · Overtime (+${r.overtime_minutes}m)` : "Active (Trip In Progress)";
        } else if (isBooked) {
            badgeBg = "#e0e7ff";
            badgeColor = "#3730a3";
            badgeText = "Booked";
        } else if (isUpcoming) {
            badgeBg = "#fefcbf";
            badgeColor = "#744210";
            badgeText = "Upcoming";
        } else if (isComplete) {
            badgeBg = "#e2e8f0";
            badgeColor = "#4a5568";
            badgeText = "Complete";
        } else if (isCancelled) {
            badgeBg = "#fed7d7";
            badgeColor = "#9b2c2c";
            badgeText = "Cancelled";
        }

        return `
        <div class="reservation-card ${isActive ? 'active-booking-card' : ''}" style="${isBooked ? 'border-left: 4px solid #4318ff;' : (isCancelled ? 'border-left: 4px solid #e53e3e;' : (isComplete ? 'border-left: 4px solid #718096;' : ''))}">
            <div class="reservation-header">
                <h3>Booking ID: ${r.booking_code}</h3>
                <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:700; border-radius:20px; padding:4px 12px; font-size:12px;">${badgeText}</span>
            </div>
            <div class="reservation-body">
                <p class="parking-details"><strong>${r.location_name}</strong> — Space <b style="${isActive ? 'color:#fff;' : 'color:#4318ff;'}">${r.space_code}</b></p>
                <p class="time-details">Date & Time: <strong>${r.reserve_date}</strong> · ${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}</p>
                ${r.vehicle_plate ? `<p style="font-size:12px; opacity:0.85;">Vehicle Plate: <strong>${r.vehicle_plate}</strong></p>` : ''}
                
                ${!isCancelled ? `
                    <p class="price-details">Total Cost: <strong>${money(r.total_cost)}</strong> ${Number(r.discount_amount) > 0 ? `<span class="badge" style="background:#ebf8ff; color:#2b6cb0; font-size:11px; margin-left:6px;">🎓 UIU 25% OFF (-${money(r.discount_amount)})</span>` : ''}</p>
                ` : `
                    <div style="background:#fff5f5; border:1px solid #fed7d7; border-radius:8px; padding:10px 12px; margin: 6px 0; font-size:13px; color:#4a5568;">
                        <div style="display:flex; justify-content:space-between; color:#e53e3e; font-weight:600; margin-bottom:2px;">
                            <span>Cancellation Fine (20% fee):</span>
                            <span>+${money(r.fine_amount)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#22543d; font-weight:700;">
                            <span>Net Refund Amount:</span>
                            <span>${money(r.refund_amount)}</span>
                        </div>
                        ${r.cancellation_reason ? `<div style="font-size:11px; color:#718096; margin-top:4px;">Reason: <i>"${r.cancellation_reason}"</i></div>` : ''}
                    </div>
                `}

                <p style="font-size:12px; opacity:0.9; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    💳 <strong>Payment:</strong> ${r.payment_method || 'bKash'} · <span style="font-weight:700; color:${isActive ? '#86efac' : '#16a34a'};">${(r.payment_status || 'paid').toUpperCase()}</span> 
                    ${r.transaction_id ? `<span style="font-size:11px; opacity:0.8; font-family:monospace;">(TXN: ${r.transaction_id})</span>` : ''}
                </p>

                ${r.checked_in_at ? `<p style="font-size:11px; opacity:0.8; margin-top:2px;">Check-In: ${new Date(r.checked_in_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} ${r.checked_out_at ? `· Check-Out: ${new Date(r.checked_out_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</p>` : ''}
                ${(r.is_overtime || (r.overtime_minutes && r.overtime_minutes > 0) || Number(r.fine_amount || 0) > 0) ? `
                    <div style="background:#fff5f5; border:1px solid #feb2b2; border-left:4px solid #e53e3e; border-radius:8px; padding:10px 14px; margin-top:10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                        <div>
                            <strong style="color:#c53030; font-size:13px;">⚠️ ${r.is_overtime || (r.overtime_minutes && r.overtime_minutes > 0) ? `OVERTIME: +${r.overtime_minutes} mins` : 'FINE APPLIED'}</strong>
                            ${r.is_overtime || (r.overtime_minutes && r.overtime_minutes > 0) ? `<p style="margin:2px 0 0 0; font-size:12px; color:#742a2a;">Scheduled end: <strong>${r.end_time}</strong>. Manager checkout is required to finish the active session.</p>` : ''}
                            ${r.has_slot_conflict ? `
                            <p style="margin:4px 0 0 0; font-size:11px; color:#9b2c2c; background:#fed7d7; padding:3px 8px; border-radius:4px; font-weight:700;">
                                🚨 Slot conflict: Booking #${r.conflict_booking_code} was affected.
                            </p>` : ''}
                        </div>
                        <div style="text-align:right;"><span style="background:#e53e3e; color:#fff; font-weight:700; padding:6px 12px; border-radius:6px; font-size:13px; display:inline-block;">Fine: +৳${r.fine_amount || r.overtime_fine || 0}</span><div style="font-size:10px; color:#9b2c2c; font-weight:800; margin-top:4px;">Fine status: ${(r.fine_status || 'pending').toUpperCase()}</div></div>
                    </div>
                ` : ''}
            </div>

            ${(isActive || isBooked || isUpcoming) ? `
            <div class="otp-container">
                <span class="otp-label">Security OTP Code</span>
                <span class="otp-code">${r.otp_code}</span>
            </div>` : ''}

            <div class="reservation-actions" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top: 10px;">
                ${isBooked || isUpcoming ? `
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px 14px; border-radius:8px; font-size:12px; color:#166534; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-user-shield" style="color:#16a34a;"></i>
                        <span>Check-in verified by Manager: <strong>Show OTP ${r.otp_code}</strong></span>
                    </div>
                    <button class="btn-extend-otp" data-code="${r.booking_code}" style="background:#4a5568; color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">+1h Extend</button>
                    <button class="btn-cancel" data-code="${r.booking_code}" data-cost="${r.total_cost}" data-method="${r.payment_method || 'bKash'}" style="background:#e53e3e; color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">Cancel (Fine Applies)</button>
                ` : ''}
                ${isActive ? `
                    <div style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); padding:8px 14px; border-radius:8px; font-size:12px; color:#ffffff; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-car-side" style="color:#a7f3d0;"></i>
                        <span>Trip Active · Check-out verified by Manager: <strong>Show OTP ${r.otp_code}</strong></span>
                    </div>
                    <button class="btn-extend-otp" data-code="${r.booking_code}" style="background:rgba(255,255,255,0.25); color:#fff; border:1px solid rgba(255,255,255,0.5); padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">+1h Extend</button>
                ` : ''}
                <button class="btn-receipt" data-code="${r.booking_code}" style="${isActive ? 'background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3);' : 'background:#4318ff; color:#fff;'} padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">PDF Receipt</button>
            </div>
        </div>
        `;
    }).join("");

    // Wire actions
    wireDriverReservationActions(list);
}

function wireDriverReservationActions(list) {

    // Driver trip extension (+1h)
    list.querySelectorAll(".btn-extend-otp").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const code = btn.dataset.code;
            if (!confirm(`Extend reservation ${code} by 1 hour? Additional parking charge will apply.`)) return;
            btn.disabled = true;
            btn.textContent = "Extending...";
            const res = await dapi("driver_action.php", "POST", { action: "extend", booking_code: code, hours: 1 });
            alert(res.message);
            if (res.success) {
                loadMyReservations();
            } else {
                btn.disabled = false;
                btn.textContent = "+1h Extend";
            }
        });
    });

    // Receipt download
    list.querySelectorAll(".btn-receipt").forEach((btn) => {
        btn.addEventListener("click", () => {
            window.location.href = `${API}/download_receipt.php?booking_code=${btn.dataset.code}`;
        });
    });

    // Cancel reservation with fine
    list.querySelectorAll(".btn-cancel").forEach((btn) => {
        btn.addEventListener("click", () => {
            const code = btn.dataset.code;
            const cost = parseFloat(btn.dataset.cost || 0);
            const method = btn.dataset.method || "bKash";
            openCancelModal(code, cost, method);
        });
    });
}

function openCancelModal(code, cost, method) {
    const overlay = document.getElementById("cancelModalOverlay");
    const codeEl = document.getElementById("cancelModalCode");
    const totalEl = document.getElementById("cancelModalTotal");
    const fineEl = document.getElementById("cancelModalFine");
    const refundEl = document.getElementById("cancelModalRefund");
    const methodEl = document.getElementById("cancelModalPaymentMethod");

    // 20% fine, minimum ৳50
    const fine = Math.round(Math.min(cost, Math.max(50, cost * 0.20)));
    const refund = Math.max(0, cost - fine);

    currentCancelBooking = { code, fine, refund, cost };

    if (codeEl) codeEl.textContent = code;
    if (totalEl) totalEl.textContent = money(cost);
    if (fineEl) fineEl.textContent = `-` + money(fine);
    if (refundEl) refundEl.textContent = money(refund);
    if (methodEl) methodEl.textContent = method;

    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("hidden");
    } else {
        if (confirm(`Cancel Booking ${code}?\n\nCancellation Fine: ৳${fine} (20% penalty fee)\nNet Refund: ৳${refund} via ${method}\n\nDo you want to proceed?`)) {
            dapi("cancel_reservation.php", "POST", { booking_code: code, reason: "Cancelled by driver" }).then((res) => {
                alert(res.message);
                if (res.success) loadMyReservations();
            });
        }
    }
}

function setupCancelModal() {
    const overlay = document.getElementById("cancelModalOverlay");
    const closeBtn = document.getElementById("closeCancelModalBtn");
    const keepBtn = document.getElementById("cancelModalKeepBtn");
    const confirmBtn = document.getElementById("cancelModalConfirmBtn");

    if (!overlay) return;

    const hide = () => {
        overlay.style.display = "none";
        overlay.classList.add("hidden");
        currentCancelBooking = null;
    };

    if (closeBtn) closeBtn.onclick = hide;
    if (keepBtn) keepBtn.onclick = hide;
    overlay.onclick = (e) => { if (e.target === overlay) hide(); };

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (!currentCancelBooking) return;
            const code = currentCancelBooking.code;
            const reasonInput = document.getElementById("cancelReasonInput");
            const reason = reasonInput ? reasonInput.value.trim() : "Driver cancellation";

            confirmBtn.disabled = true;
            confirmBtn.textContent = "Cancelling...";

            const res = await dapi("cancel_reservation.php", "POST", { booking_code: code, reason });
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm Cancellation";
            hide();
            alert(res.message);
            if (res.success) loadMyReservations();
        };
    }
}

// ---------------- 4. PARKING HISTORY (parking-history.html) ----------------
async function loadParkingHistory() {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    const result = await dapi("parking_history.php");
    if (!result.success) return;

    let totalSpent = 0;
    if (result.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:20px; color:#718096;">No completed or cancelled trips recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = result.history.map((h) => {
        const hours = Math.max(1, Math.round((new Date(`2000-01-01T${h.end_time}`) - new Date(`2000-01-01T${h.start_time}`)) / 3600000));
        const isComplete = (h.display_status === "Complete" || h.status === "completed" || h.status === "complete");
        if (isComplete) totalSpent += h.total_cost;
        return `
        <tr>
            <td class="booking-id"><b>${h.booking_code}</b></td>
            <td>${h.location_name}</td>
            <td><b>${h.space_code}</b></td>
            <td>${h.reserve_date}</td>
            <td>${h.start_time.slice(0,5)}–${h.end_time.slice(0,5)}</td>
            <td>${hours}h</td>
            <td class="amount">${money(h.total_cost)}${Number(h.discount_amount) > 0 ? '<br><small style="color:#2b6cb0; font-size:10px; font-weight:600;">🎓 25% Off</small>' : ''}</td>
            <td>
                <span style="font-size:12px; font-weight:600; color:#2d3748;">${h.payment_method || 'bKash'}</span><br>
                <small style="color:#718096;">TXN: ${h.transaction_id || '-'}</small>
                ${!isComplete && Number(h.fine_amount) > 0 ? `<br><small style="color:#e53e3e; font-weight:600;">Fine: ৳${h.fine_amount} | Refund: ৳${h.refund_amount}</small>` : ''}
            </td>
            <td>
                <span class="badge ${isComplete ? 'completed' : 'cancelled'}" style="${isComplete ? 'background:#c6f6d5; color:#22543d; font-weight:700;' : 'background:#fed7d7; color:#9b2c2c; font-weight:700;'}">
                    ${isComplete ? 'Complete' : 'Cancelled'}
                </span>
            </td>
            <td>
                ${isComplete ? renderRatingCell(h.id, h.my_rating) : '-'}
            </td>
            <td><button class="btn-pdf" data-code="${h.booking_code}" style="cursor:pointer; padding:4px 10px; border-radius:4px; border:1px solid #cbd5e0; background:#edf2f7; font-weight:600;">PDF</button></td>
        </tr>`;
    }).join("");

    const amountEl = document.getElementById("totalSpentAmount");
    if (amountEl) amountEl.textContent = money(totalSpent);

    tbody.querySelectorAll(".btn-pdf").forEach((btn) => {
        btn.addEventListener("click", () => {
            window.location.href = `${API}/download_receipt.php?booking_code=${btn.dataset.code}`;
        });
    });

    tbody.querySelectorAll(".btn-rate-trip").forEach((btn) => {
        btn.addEventListener("click", () => openRatingPrompt(btn.dataset.reservationId));
    });
}

// Small inline "star" rating cell: shows the driver's existing rating, or a Rate button
function renderRatingCell(reservationId, myRating) {
    if (myRating) {
        return `<span style="color:#f6ad55; font-weight:700;">${"★".repeat(myRating)}${"☆".repeat(5 - myRating)}</span>`;
    }
    return `<button class="btn-rate-trip" data-reservation-id="${reservationId}" style="cursor:pointer; padding:4px 10px; border-radius:4px; border:1px solid #0d9488; background:#e6fffa; color:#0d9488; font-weight:600;">Rate ★</button>`;
}

// Ask the driver to pick 1-5 stars (and an optional comment), then submit it
function openRatingPrompt(reservationId) {
    const stars = prompt("Rate your parking experience (1 to 5 stars):", "5");
    if (stars === null) return; // cancelled

    const rating = parseInt(stars, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        alert("Please enter a number from 1 to 5.");
        return;
    }

    const comment = prompt("Add a short comment (optional):", "") || "";

    submitTripRating(reservationId, rating, comment);
}

async function submitTripRating(reservationId, rating, comment) {
    const result = await dapi("submit_rating.php", "POST", {
        reservation_id: parseInt(reservationId, 10),
        rating,
        comment
    });
    if (!result.success) {
        alert(result.message);
        return;
    }
    loadParkingHistory();
}

// ---------------- 5. REPORT ISSUE (report-issue.html) ----------------
async function loadReportIssuePage() {
    const form = document.getElementById("reportForm");
    if (!form) return;

    // populate location dropdown
    const locSelect = document.getElementById("reportLocationId");
    if (locSelect) {
        const locResult = await dapi("get_locations.php");
        if (locResult.success) {
            locSelect.innerHTML = '<option value="">Select location</option>' +
                locResult.locations.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const category = document.getElementById("reportCategory").value;
        const location_id = document.getElementById("reportLocationId").value;
        const booking_code = document.getElementById("reportBookingCode").value.trim();
        const description = document.getElementById("reportDescription").value.trim();

        if (!category || !description) {
            alert("Please choose a category and describe the issue.");
            return;
        }

        const result = await dapi("report_issue.php", "POST", { category, location_id, booking_code, description });
        if (!result.success) { alert(result.message); return; }

        alert(`Report submitted successfully! Code: ${result.report_code}`);
        form.reset();
        loadMyReports();
    });

    loadMyReports();
}

async function loadMyReports() {
    const list = document.getElementById("reportsList");
    if (!list) return;

    const result = await dapi("my_reports.php");
    if (!result.success) return;

    const statusClass = { submitted: "review", under_review: "review", resolved: "resolved" };

    if (result.reports.length === 0) {
        list.innerHTML = `<p style="padding:15px; color:#718096;">No reports submitted yet.</p>`;
        return;
    }

    list.innerHTML = result.reports.map((r) => `
        <div class="report-card">
            <div class="report-header">
                <strong>${r.report_code}</strong>
                <span class="status-badge ${statusClass[r.status] || 'review'}">${r.status.replace('_', ' ')}</span>
            </div>
            <p class="report-desc">${r.category}: ${r.description}</p>
            <div class="report-footer">
                <span>${r.location_name || ''}${r.booking_code ? ' · ' + r.booking_code : ''}</span>
                <span class="report-date">${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    `).join("");
}

// ---------------- 6. CHAT WITH MANAGER (chat.html) ----------------
let activeChatManagerId = null;
let chatPollInterval = null;

async function loadDriverChat() {
    const managerListEl = document.querySelector(".manager-list");
    const chatContainer = document.querySelector(".chat-container");
    if (!managerListEl || !chatContainer) return;

    const res = await capi("get_contacts.php");
    if (!res.success || res.contacts.length === 0) {
        managerListEl.innerHTML = `<li>No managers available at this moment.</li>`;
        return;
    }

    const managers = res.contacts;
    activeChatManagerId = managers[0].id; // Select first manager by default

    renderManagerList(managers);
    loadMessagesForActiveManager();

    // Setup send button and Enter key
    const sendBtn = chatContainer.querySelector(".chat-input-area button");
    const input = chatContainer.querySelector(".chat-input-area input");

    if (sendBtn && input) {
        const doSend = async () => {
            const text = input.value.trim();
            if (!text || !activeChatManagerId) return;
            input.value = "";

            const sendRes = await capi("send_message.php", "POST", {
                receiver_id: activeChatManagerId,
                message: text
            });
            if (sendRes.success) {
                loadMessagesForActiveManager();
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

    // Live polling every 3 seconds
    if (chatPollInterval) clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadMessagesForActiveManager, 3000);
}

function renderManagerList(managers) {
    const managerListEl = document.querySelector(".manager-list");
    if (!managerListEl) return;

    managerListEl.innerHTML = managers.map((m, idx) => `
        <li data-id="${m.id}" style="cursor:pointer; padding:10px; border-radius:6px; margin-bottom:6px; ${m.id === activeChatManagerId ? 'background:#edf2f7; font-weight:600;' : ''}">
            <strong>${m.full_name}</strong> - ${m.location_name || 'Dhaka Facility'}
            <span class="status-badge online" style="margin-left:8px;">Online</span>
            ${m.unread_count > 0 ? `<span style="background:#e53e3e; color:#fff; border-radius:10px; padding:2px 7px; font-size:11px; margin-left:6px;">${m.unread_count} new</span>` : ''}
        </li>
    `).join("");

    managerListEl.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            activeChatManagerId = parseInt(li.dataset.id, 10);
            renderManagerList(managers);
            loadMessagesForActiveManager();
        });
    });
}

async function loadMessagesForActiveManager() {
    if (!activeChatManagerId) return;

    const chatTitle = document.querySelectorAll(".section-title")[1];
    const messagesEl = document.querySelector(".chat-messages");
    if (!messagesEl) return;

    const res = await capi(`get_messages.php?contact_id=${activeChatManagerId}`);
    if (!res.success) return;

    // Update section title with active manager name
    const activeLi = document.querySelector(`.manager-list li[data-id="${activeChatManagerId}"] strong`);
    if (chatTitle && activeLi) {
        chatTitle.textContent = `Chat with ${activeLi.textContent}`;
    }

    if (res.messages.length === 0) {
        messagesEl.innerHTML = `<p style="text-align:center; color:#a0aec0; margin-top:20px;">No messages yet. Send a message to start the conversation!</p>`;
        return;
    }

    messagesEl.innerHTML = res.messages.map(m => {
        if (m.is_me) {
            return `<p class="message user-msg"><strong>You:</strong> ${m.message}</p>`;
        } else {
            return `<p class="message manager-msg"><strong>${m.sender_name}:</strong> ${m.message}</p>`;
        }
    }).join("");

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------------- 8. AUTOMATED NOTIFICATIONS (TIMING & FINES) ----------------
let seenNotifIds = new Set();
let driverNotificationsList = [];

function ensureNotificationModal() {
    if (document.getElementById("driverNotifModal")) return;

    const modalHtml = `
        <div id="driverNotifModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:#fff; border-radius:14px; width:92%; max-width:480px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 15px 35px rgba(0,0,0,0.25); overflow:hidden;">
                <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:18px;">🔔</span>
                        <h3 style="margin:0; font-size:15px; color:#1a202c; font-weight:700;">Timing & Fine Notifications</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="markAllNotifsBtn" style="background:#edf2f7; border:none; color:#2b6cb0; font-size:11px; font-weight:700; cursor:pointer; padding:5px 10px; border-radius:6px;">Mark all read</button>
                        <button id="closeNotifModalBtn" style="background:none; border:none; font-size:22px; color:#718096; cursor:pointer; line-height:1;">&times;</button>
                    </div>
                </div>
                <div id="driverNotifList" style="padding:15px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:10px;">
                    <div style="text-align:center; padding:30px; color:#a0aec0; font-size:13px;">No notifications yet.</div>
                </div>
                <div style="padding:12px 20px; border-top:1px solid #edf2f7; text-align:right; background:#f8fafc;">
                    <button id="closeNotifModalBtn2" style="padding:6px 16px; background:#e2e8f0; color:#4a5568; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Close</button>
                </div>
            </div>
        </div>
        <div id="toastNotificationContainer" style="position:fixed; top:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px; pointer-events:none; max-width:380px; width:92%;"></div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Setup modal event listeners
    const modal = document.getElementById("driverNotifModal");
    const closeBtn = document.getElementById("closeNotifModalBtn");
    const closeBtn2 = document.getElementById("closeNotifModalBtn2");
    const markAllBtn = document.getElementById("markAllNotifsBtn");

    const closeModal = () => {
        if (modal) modal.style.display = "none";
    };

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (closeBtn2) closeBtn2.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener("click", async () => {
            await dapi("notifications.php", "POST", { action: "mark_all_read" });
            loadDriverNotifications(false);
        });
    }

    // Connect any notification button present on page
    document.querySelectorAll("#driverNotifBtn, .notif-btn, .notif-bell-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (modal) modal.style.display = "flex";
            loadDriverNotifications(false);
        });
    });
}

function showTimingToast(title, message, type = "info") {
    const container = document.getElementById("toastNotificationContainer");
    if (!container) return;

    let borderCol = "#3182ce";
    let bgCol = "#ebf8ff";
    let icon = "🔔";

    if (type === "overtime" || type === "fine") {
        borderCol = "#e53e3e";
        bgCol = "#fff5f5";
        icon = "⚠️";
    } else if (type === "warning") {
        borderCol = "#dd6b20";
        bgCol = "#fffaf0";
        icon = "🚨";
    } else if (type === "checkout") {
        borderCol = "#38a169";
        bgCol = "#f0fff4";
        icon = "✅";
    }

    const toast = document.createElement("div");
    toast.style.cssText = `
        background: #fff;
        border: 1px solid #e2e8f0;
        border-left: 5px solid ${borderCol};
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        border-radius: 10px;
        padding: 12px 16px;
        pointer-events: auto;
        cursor: pointer;
        transition: all 0.3s ease;
        animation: fadeIn 0.3s ease;
    `;

    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="display:flex; gap:8px; align-items:flex-start;">
                <span style="font-size:16px;">${icon}</span>
                <div>
                    <h4 style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:#1a202c;">${title}</h4>
                    <p style="margin:0; font-size:12px; color:#4a5568; line-height:1.4;">${message}</p>
                </div>
            </div>
            <span class="toast-close" style="color:#a0aec0; font-size:16px; cursor:pointer; line-height:1;">&times;</span>
        </div>
    `;

    toast.addEventListener("click", () => {
        const modal = document.getElementById("driverNotifModal");
        if (modal) modal.style.display = "flex";
        toast.remove();
    });

    const closeSpan = toast.querySelector(".toast-close");
    if (closeSpan) {
        closeSpan.addEventListener("click", (e) => {
            e.stopPropagation();
            toast.remove();
        });
    }

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }
    }, 7000);
}

async function loadDriverNotifications(allowToast = true) {
    try {
        const res = await dapi("notifications.php");
        if (!res.success) return;

        driverNotificationsList = res.notifications || [];
        const unread = res.unread_count || 0;

        // Update badge counts
        document.querySelectorAll("#notifBadgeCount, .notif-badge").forEach((el) => {
            if (unread > 0) {
                el.style.display = "inline-block";
                el.textContent = unread;
            } else {
                el.style.display = "none";
            }
        });

        // Check for new notifications to toast
        if (allowToast && driverNotificationsList.length > 0) {
            driverNotificationsList.forEach((n) => {
                const nid = Number(n.id);
                if (Number(n.is_read) === 0 && !seenNotifIds.has(nid)) {
                    seenNotifIds.add(nid);
                    showTimingToast(n.title, n.message, n.type);
                }
            });
        }

        // Render in modal
        const listEl = document.getElementById("driverNotifList");
        if (listEl) {
            if (driverNotificationsList.length === 0) {
                listEl.innerHTML = `<div style="text-align:center; padding:35px; color:#a0aec0; font-size:13px;">No notifications yet. You will receive timing alerts and fine details here.</div>`;
            } else {
                listEl.innerHTML = driverNotificationsList.map((n) => {
                    const isUnread = Number(n.is_read) === 0;
                    let borderCol = "#cbd5e0";
                    let bgCol = isUnread ? "#f7fafc" : "#ffffff";
                    let icon = "🔔";

                    if (n.type === "overtime" || n.type === "fine") {
                        borderCol = "#feb2b2";
                        bgCol = isUnread ? "#fff5f5" : "#ffffff";
                        icon = "⚠️";
                    } else if (n.type === "warning") {
                        borderCol = "#fbd38d";
                        bgCol = isUnread ? "#fffaf0" : "#ffffff";
                        icon = "🚨";
                    } else if (n.type === "checkout") {
                        borderCol = "#9ae6b4";
                        bgCol = isUnread ? "#f0fff4" : "#ffffff";
                        icon = "✅";
                    }

                    return `
                        <div style="background:${bgCol}; border:1px solid ${borderCol}; border-radius:10px; padding:12px 14px; position:relative;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                                <div style="display:flex; gap:8px; align-items:flex-start;">
                                    <span style="font-size:15px;">${icon}</span>
                                    <div>
                                        <h4 style="margin:0 0 3px 0; font-size:13px; font-weight:700; color:#2d3748;">
                                            ${n.title}
                                            ${isUnread ? '<span style="display:inline-block; width:6px; height:6px; background:#e53e3e; border-radius:50%; margin-left:4px; vertical-align:middle;"></span>' : ''}
                                        </h4>
                                        <p style="margin:0; font-size:12px; color:#4a5568; line-height:1.4;">${n.message}</p>
                                        <span style="display:inline-block; margin-top:6px; font-size:11px; color:#a0aec0;">${n.time_ago || ''}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join("");
            }
        }
    } catch (err) {
        console.error("Error loading driver notifications:", err);
    }
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Session verification
    if (typeof initSessionGuard === "function") {
        await initSessionGuard(["driver"]);
    }

    // 2. Ensure notification UI is active
    ensureNotificationModal();
    loadDriverNotifications();

    // 3. Load page-specific modules
    loadDriverDashboard();
    loadLocations();
    setupModal();
    loadMyReservations();
    loadParkingHistory();
    loadReportIssuePage();
    loadDriverChat();

    // 4. Periodic real-time auto-refresh (daily/time-to-time sync)
    setInterval(() => loadDriverNotifications(true), 5000);

    if (document.querySelector(".active-card") || document.querySelector(".stats-grid")) {
        setInterval(loadDriverDashboard, 5000);
    }
    if (document.getElementById("parkingGrid")) {
        setInterval(() => {
            const q = document.querySelector(".search-input");
            if (!q || !q.value.trim()) {
                loadLocations();
            }
        }, 5000);
    }
    if (document.getElementById("reservationsList")) {
        setInterval(() => {
            const searchInput = document.getElementById("myResSearchInput");
            const cancelModal = document.getElementById("cancelModalOverlay");
            const isModalOpen = cancelModal && cancelModal.style.display === "flex";
            const isSearching = searchInput && document.activeElement === searchInput;
            if (!isSearching && !isModalOpen) {
                loadMyReservations();
            }
        }, 5000);
    }
});
