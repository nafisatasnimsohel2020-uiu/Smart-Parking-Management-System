

const ADM_API = "../backend/admin";
const MGR_API = "../backend/manager";

async function api(base, path, method, body) {
    const opts = {
        method: method || "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${base}/${path}`, opts);
    return res.json();
}
const admApi = (path, method, body) => api(ADM_API, path, method, body);
const mgrApi = (path, method, body) => api(MGR_API, path, method, body);

function money(n) {
    return "৳" + Number(n || 0).toLocaleString();
}
function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function statusBadge(status) {
    const map = {
        active: "badge-available", completed: "badge-completed", upcoming: "badge-upcoming",
        cancelled: "badge-full", pending: "badge-tag-orange custom-badge", blocked: "badge-full",
        open: "badge-status open", resolved: "badge-status resolved",
    };
    const cls = map[status] || "badge-completed";
    return `<span class="${cls}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

// ---------------- PENDING MANAGER APPROVALS (Overview) ----------------
async function loadPendingManagerApprovals() {
    const card = document.getElementById("pendingManagerApprovalsCard");
    const tbody = document.getElementById("pendingManagerApprovalsBody");
    const badge = document.getElementById("pendingManagerCountBadge");
    if (!card || !tbody) return;

    const result = await admApi("users_list.php?role=manager", "GET");
    if (!result.success) return;

    const pending = result.users.filter((u) => u.status === "pending");

    if (pending.length === 0) {
        card.style.display = "none";
        tbody.innerHTML = "";
        return;
    }

    card.style.display = "block";
    if (badge) badge.textContent = pending.length;

    tbody.innerHTML = pending.map((u) => `
        <tr>
            <td><strong>${u.full_name}</strong></td>
            <td>${u.email}</td>
            <td>${u.phone || "-"}</td>
            <td>${fmtDate(u.created_at)}</td>
            <td>
                <button class="btn-action-success mr-4 ov-approve-btn" data-id="${u.id}">✓ Approve</button>
                <button class="btn-action-danger ov-reject-btn" data-id="${u.id}">✕ Reject</button>
            </td>
        </tr>`).join("");

    tbody.querySelectorAll(".ov-approve-btn").forEach((btn) => {
        btn.addEventListener("click", () => approvePendingManager(btn.dataset.id, "active"));
    });
    tbody.querySelectorAll(".ov-reject-btn").forEach((btn) => {
        btn.addEventListener("click", () => approvePendingManager(btn.dataset.id, "blocked"));
    });
}

async function approvePendingManager(user_id, status) {
    const result = await admApi("update_user_status.php", "POST", { user_id: parseInt(user_id, 10), status });
    if (!result.success) {
        alert(result.message);
        return;
    }
    loadPendingManagerApprovals();
    // Keep the User Management > Managers table in sync if it's currently shown
    if (typeof currentUserRole !== "undefined" && currentUserRole === "manager") {
        loadUsers("manager");
    }
}

// ---------------- OVERVIEW ----------------
async function loadOverview() {
    const grid = document.querySelector("#tab-overview .overview-metrics-grid");
    if (!grid) return;
    const result = await admApi("overview.php");
    if (!result.success) return;

    const m = result.metrics;
    const vals = grid.querySelectorAll(".ov-value");
    if (vals[0]) vals[0].textContent = money(m.revenue_this_month);
    if (vals[1]) vals[1].textContent = m.active_reservations;
    if (vals[2]) vals[2].textContent = m.registered_drivers;
    if (vals[3]) vals[3].textContent = m.parking_locations;
    if (vals[4]) vals[4].textContent = m.open_violations;
    if (vals[5]) vals[5].textContent = m.avg_occupancy + "%";

    const tbody = document.getElementById("recentReservationsBody");
    if (!tbody) return;
    tbody.innerHTML = result.recent_reservations.map((r) => `
        <tr>
            <td><strong class="purple-text">${r.booking_code}</strong></td>
            <td>${r.driver_name}</td>
            <td>${r.location_name}</td>
            <td class="purple-text">${r.space_code}</td>
            <td>${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}</td>
            <td>${statusBadge(r.status)}</td>
            <td><strong>${money(r.total_cost)}</strong>${Number(r.discount_amount) > 0 ? ' <br><small style="color:#2b6cb0; font-weight:600;">🎓 UIU 25% Off</small>' : ''}</td>
        </tr>
    `).join("") || `<tr><td colspan="7">No reservations yet.</td></tr>`;
}

// ---------------- PARKING LOCATIONS ----------------
let cachedManagers = [];

async function loadManagersForDropdown() {
    const result = await admApi("managers_list.php");
    if (result.success) cachedManagers = result.managers;
}

async function loadLocations() {
    const container = document.querySelector("#tab-parking-locations .location-list");
    const countText = document.querySelector("#tab-parking-locations .page-header p");
    if (!container) return;

    const result = await admApi("locations_list.php");
    if (!result.success) return;

    if (countText) countText.textContent = `${result.locations.length} locations in the system`;

    container.innerHTML = result.locations.map((loc) => `
        <div class="location-card" data-id="${loc.id}">
            <div class="card-top">
                <div class="location-info">
                    <div class="loc-icon"><i class="fa-solid fa-location-dot"></i></div>
                    <div class="loc-details">
                        <h3>${loc.name} <span class="badge badge-active">Active</span></h3>
                        <p>${loc.address}</p>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-loc-btn"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete delete-loc-btn"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div class="card-stats">
                <div class="stat-item"><span class="stat-label">Spaces</span><span class="stat-value">${loc.occupied_spaces} / ${loc.space_count}</span></div>
                <div class="stat-item"><span class="stat-label">Rate</span><span class="stat-value rate">৳${loc.price_per_hour}/hr</span></div>
                <div class="stat-item"><span class="stat-label">Manager</span><span class="stat-value">${loc.manager_name || "Unassigned"}</span></div>
                <div class="stat-item flex-grow">
                    <span class="stat-label">Occupancy</span>
                    <div class="progress-section">
                        <div class="progress-bar-bg"><div class="progress-bar-fill ${loc.occupancy_pct >= 95 ? "bg-red" : "bg-teal"}" style="width:${loc.occupancy_pct}%"></div></div>
                        <div class="progress-text ${loc.occupancy_pct >= 95 ? "text-red" : ""}">${loc.occupancy_pct}% occupied</div>
                    </div>
                </div>
            </div>
        </div>
    `).join("") || `<p class="sub-text">No parking locations yet.</p>`;

    container.querySelectorAll(".edit-loc-btn").forEach((btn) => {
        btn.addEventListener("click", () => editLocation(btn.closest(".location-card").dataset.id, result.locations));
    });
    container.querySelectorAll(".delete-loc-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteLocation(btn.closest(".location-card").dataset.id));
    });
}

function pickManagerId(promptLabel, currentId) {
    if (cachedManagers.length === 0) return currentId || null;
    const options = cachedManagers.map((m) => `${m.id} = ${m.full_name}`).join("\n");
    const input = prompt(`${promptLabel}\n\n${options}\n\nEnter a manager ID, or leave blank for none:`, currentId || "");
    if (input === null) return currentId || null;
    return input.trim() === "" ? null : parseInt(input.trim(), 10);
}

async function addLocationFlow() {
    const name = prompt("Location name:");
    if (!name) return;
    const address = prompt("Address:");
    if (!address) return;
    const price_per_hour = parseFloat(prompt("Price per hour (৳):", "100"));
    const total_spaces = parseInt(prompt("Total spaces to create:", "20"), 10);
    if (!price_per_hour || !total_spaces) { alert("Price and space count must be valid numbers."); return; }
    const manager_id = pickManagerId("Assign a manager to this location:", null);

    const result = await admApi("location_add.php", "POST", { name, address, price_per_hour, total_spaces, manager_id });
    alert(result.message);
    if (result.success) loadLocations();
}

async function editLocation(id, locations) {
    const loc = locations.find((l) => String(l.id) === String(id));
    if (!loc) return;
    const name = prompt("Location name:", loc.name);
    if (!name) return;
    const address = prompt("Address:", loc.address);
    if (!address) return;
    const price_per_hour = parseFloat(prompt("Price per hour (৳):", loc.price_per_hour));
    if (!price_per_hour) { alert("Price must be a valid number."); return; }
    const manager_id = pickManagerId("Assign a manager to this location:", loc.manager_id);

    const result = await admApi("location_update.php", "POST", { id: parseInt(id, 10), name, address, price_per_hour, manager_id });
    alert(result.message);
    if (result.success) loadLocations();
}

async function deleteLocation(id) {
    if (!confirm("Delete this location? This also removes its spaces, reservations and violations.")) return;
    const result = await admApi("location_delete.php", "POST", { id: parseInt(id, 10) });
    alert(result.message);
    if (result.success) loadLocations();
}

function setupLocationsTab() {
    const addBtn = document.querySelector("#tab-parking-locations .btn-add");
    if (addBtn) addBtn.addEventListener("click", addLocationFlow);
}

// ---------------- USER MANAGEMENT ----------------
let currentUserRole = "driver";

async function loadUsers(role) {
    currentUserRole = role || currentUserRole;
    const tbody = document.getElementById("userManagementBody");
    if (!tbody) return;

    const result = await admApi(`users_list.php?role=${currentUserRole}`);
    if (!result.success) return;

    const driverBtn = document.getElementById("filterDriversBtn");
    const managerBtn = document.getElementById("filterManagersBtn");
    const adminBtn = document.getElementById("filterAdminsBtn");

    if (driverBtn) driverBtn.textContent = `Drivers (${result.counts.driver || 0})`;
    if (managerBtn) managerBtn.textContent = `Managers (${result.counts.manager || 0})`;
    if (adminBtn) adminBtn.textContent = `Admins (${result.counts.admin || 0})`;

    [driverBtn, managerBtn, adminBtn].forEach(b => {
        if (b) {
            b.classList.remove("btn-teal-full");
            b.classList.add("btn-outline");
        }
    });
    if (currentUserRole === "driver" && driverBtn) {
        driverBtn.classList.add("btn-teal-full");
        driverBtn.classList.remove("btn-outline");
    } else if (currentUserRole === "manager" && managerBtn) {
        managerBtn.classList.add("btn-teal-full");
        managerBtn.classList.remove("btn-outline");
    } else if (currentUserRole === "admin" && adminBtn) {
        adminBtn.classList.add("btn-teal-full");
        adminBtn.classList.remove("btn-outline");
    }

    const thead = tbody.closest("table").querySelector("thead tr");
    if (thead) {
        if (currentUserRole === "driver") {
            thead.innerHTML = `<th>DRIVER</th><th>PLATE</th><th>RESERVATIONS</th><th>PASSWORD</th><th>JOINED</th><th>STATUS</th><th>ACTIONS</th>`;
        } else if (currentUserRole === "manager") {
            thead.innerHTML = `<th>MANAGER</th><th>ASSIGNED FACILITY</th><th>MANAGED</th><th>PASSWORD</th><th>JOINED</th><th>STATUS</th><th>ACTIONS</th>`;
        } else {
            thead.innerHTML = `<th>ADMINISTRATOR</th><th>PHONE</th><th>ROLE LEVEL</th><th>PASSWORD</th><th>JOINED</th><th>STATUS</th><th>ACTIONS</th>`;
        }
    }

    tbody.innerHTML = result.users.map((u) => {
        let col2 = `<span class="sub-text">-</span>`;
        let col3 = `<span class="sub-text">-</span>`;

        if (currentUserRole === "driver") {
            col2 = `<span class="purple-text">${u.vehicle_plate || "-"}</span>`;
            col3 = u.reservation_count;
        } else if (currentUserRole === "manager") {
            col2 = `<strong style="color:#0d9488;">${u.location_name || 'Unassigned'}</strong>`;
            col3 = u.managed_locations;
        } else if (currentUserRole === "admin") {
            col2 = `<span>${u.phone || '-'}</span>`;
            col3 = `<span class="badge-tag-blue">Super Admin</span>`;
        }

        // Plain passwords are never stored (only a bcrypt hash), so they cannot be displayed.
        // Show whether a password is set and let the admin set a new one.
        const pwdCell = u.password_set
            ? `<span title="Stored securely as a bcrypt hash" style="letter-spacing:2px;">••••••••</span>${currentUserRole !== "admin" ? `<br><button class="btn-outline sm-text reset-pwd-btn" data-id="${u.id}" data-name="${u.full_name}" style="margin-top:4px;">Reset</button>` : ""}`
            : `<span class="sub-text">Not set</span>${currentUserRole !== "admin" ? `<br><button class="btn-outline sm-text reset-pwd-btn" data-id="${u.id}" data-name="${u.full_name}" style="margin-top:4px;">Set</button>` : ""}`;
        const uiuLine = currentUserRole === "driver"
            ? `<br><span class="sub-text">${u.uiu_id ? `UIU ID: ${u.uiu_id} · 25% off` : "Non-UIU · no discount"}</span>`
            : "";

        const isCurrentAdmin = (window.currentUser && (parseInt(u.id, 10) === parseInt(window.currentUser.id, 10) || (u.email && window.currentUser.email && u.email.toLowerCase() === window.currentUser.email.toLowerCase())));

        let actions = "";
        if (isCurrentAdmin) {
            actions = `<span class="badge-tag-blue" style="font-size:11px; padding:4px 8px; border-radius:12px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:600;">Current Admin (Protected)</span>`;
        } else if (u.status === "pending") {
            actions = `<button class="btn-action-success mr-4 approve-btn" data-id="${u.id}">✓ Approve</button>
                       <button class="btn-action-danger suspend-btn" data-id="${u.id}">✕ Suspend</button>`;
        } else if (u.status === "blocked") {
            actions = `<button class="btn-outline sm-text reactivate-btn" data-id="${u.id}">Reactivate</button>`;
        } else {
            actions = `<button class="btn-action-danger suspend-btn" data-id="${u.id}">✕ Suspend</button>`;
        }

        return `
        <tr>
            <td><strong>${u.full_name}</strong><br><span class="sub-text">${u.email}</span>${uiuLine}</td>
            <td>${col2}</td>
            <td>${col3}</td>
            <td>${pwdCell}</td>
            <td>${fmtDate(u.created_at)}</td>
            <td>${statusBadge(u.status === "active" ? "active" : u.status === "pending" ? "pending" : "blocked")}</td>
            <td>${actions}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="7">No ${currentUserRole} accounts found.</td></tr>`;

    tbody.querySelectorAll(".approve-btn, .reactivate-btn").forEach((btn) => {
        btn.addEventListener("click", () => setUserStatus(btn.dataset.id, "active"));
    });
    tbody.querySelectorAll(".suspend-btn").forEach((btn) => {
        btn.addEventListener("click", () => setUserStatus(btn.dataset.id, "blocked"));
    });
    tbody.querySelectorAll(".reset-pwd-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const pwd = prompt(`Enter a new password for ${btn.dataset.name} (min 6 characters):`);
            if (pwd === null) return;
            if (pwd.length < 6) { alert("Password must be at least 6 characters."); return; }
            const r = await admApi("reset_password.php", "POST", { user_id: parseInt(btn.dataset.id, 10), new_password: pwd });
            alert(r.message);
            if (r.success) loadUsers(currentUserRole);
        });
    });
}

async function setUserStatus(user_id, status) {
    if (window.currentUser && parseInt(user_id, 10) === parseInt(window.currentUser.id, 10)) {
        alert("Action Denied: You cannot suspend or modify the status of your own administrator account.");
        return;
    }
    const result = await admApi("update_user_status.php", "POST", { user_id: parseInt(user_id, 10), status });
    if (result.success) loadUsers(currentUserRole);
    else alert(result.message);
}

function setupUserManagementTab() {
    const driverBtn = document.getElementById("filterDriversBtn");
    const managerBtn = document.getElementById("filterManagersBtn");
    const adminBtn = document.getElementById("filterAdminsBtn");

    if (driverBtn) driverBtn.addEventListener("click", () => loadUsers("driver"));
    if (managerBtn) managerBtn.addEventListener("click", () => loadUsers("manager"));
    if (adminBtn) adminBtn.addEventListener("click", () => loadUsers("admin"));

    // Setup Create Account Modal
    const modal = document.getElementById("createUserModal");
    const openBtn = document.getElementById("openCreateUserModalBtn");
    const closeBtn = document.getElementById("closeCreateUserModalBtn");
    const cancelBtn = document.getElementById("cancelCreateUserBtn");
    const form = document.getElementById("createUserForm");
    const roleSelect = document.getElementById("newUserRole");
    const mgrLocGroup = document.getElementById("newUserManagerLocationGroup");
    const mgrLocSelect = document.getElementById("newUserManagerLocation");
    const plateGroup = document.getElementById("newUserPlateGroup");

    if (openBtn && modal) {
        openBtn.addEventListener("click", async () => {
            modal.style.display = "flex";
            if (roleSelect) {
                roleSelect.value = currentUserRole || "driver";
                toggleRoleFields(roleSelect.value);
            }
            if (mgrLocSelect && mgrLocSelect.options.length <= 1) {
                const locRes = await fetch(`${API_BASE}/driver/get_locations.php`).then(r => r.json());
                if (locRes.success) {
                    mgrLocSelect.innerHTML = `<option value="0">-- Select Facility Assignment --</option>` +
                        locRes.locations.map(l => `<option value="${l.id}">${l.name} (${l.address})</option>`).join("");
                }
            }
        });
    }

    function toggleRoleFields(role) {
        if (mgrLocGroup) mgrLocGroup.style.display = (role === "manager") ? "block" : "none";
        if (plateGroup) plateGroup.style.display = (role === "driver") ? "block" : "none";
    }

    if (roleSelect) {
        roleSelect.addEventListener("change", (e) => toggleRoleFields(e.target.value));
    }

    const closeModal = () => {
        if (modal) modal.style.display = "none";
        if (form) form.reset();
    };

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const role = roleSelect ? roleSelect.value : "driver";
            const full_name = document.getElementById("newUserName").value.trim();
            const email = document.getElementById("newUserEmail").value.trim();
            const phone = document.getElementById("newUserPhone").value.trim();
            const password = document.getElementById("newUserPassword").value;
            const vehicle_plate = document.getElementById("newUserPlate") ? document.getElementById("newUserPlate").value.trim() : "";
            const location_id = (role === "manager" && mgrLocSelect) ? parseInt(mgrLocSelect.value, 10) : 0;

            if (role === "manager" && (!location_id || isNaN(location_id) || location_id <= 0)) {
                alert("Please select an assigned parking facility for this Area Manager.\nEvery Area Manager must be assigned to an area when their account is created.");
                if (mgrLocSelect) mgrLocSelect.focus();
                return;
            }

            const res = await admApi("user_create.php", "POST", {
                role, full_name, email, phone, password, vehicle_plate, location_id
            });

            alert(res.message);
            if (res.success) {
                closeModal();
                loadUsers(role);
            }
        });
    }
}

// ---------------- DYNAMIC PRICING ----------------
async function loadPricing() {
    const grid = document.querySelector("#tab-dynamic-pricing .pricing-grid");
    if (!grid) return;
    const result = await admApi("pricing_list.php");
    if (!result.success) return;

    grid.innerHTML = result.pricing.map((p) => {
        const surged = (p.price_per_hour * p.peak_multiplier).toFixed(2);
        const badge = p.is_default
            ? `<span class="badge-tag-orange custom-badge">Not configured</span>`
            : (p.enabled ? `<span class="badge-available">Enabled</span>` : `<span class="badge-full">Disabled</span>`);
        return `
        <div class="admin-card mb-0" data-id="${p.location_id}">
            <div class="page-head mb-0-8">
                <h3 class="card-title">${p.name}</h3>
                ${badge}
            </div>
            <div class="pricing-info-list">
                <div class="info-row"><span class="sub-text">Base Rate:</span><strong>৳${p.price_per_hour} / hr</strong></div>
                <div class="info-row"><span class="sub-text">Peak Surge Multiplier:</span><strong class="purple-text">${p.peak_multiplier}x (৳${surged} / hr)</strong></div>
                <div class="info-row"><span class="sub-text">Peak Hours Window:</span><span>${p.peak_start.slice(0,5)} – ${p.peak_end.slice(0,5)}</span></div>
                <div class="info-row"><span class="sub-text">Occupancy Threshold:</span><span>> ${p.occupancy_threshold}% Capacity</span></div>
                <button class="btn-outline edit-rule-btn">Edit Pricing Rules</button>
            </div>
        </div>`;
    }).join("") || `<p class="sub-text">No parking locations yet.</p>`;

    grid.querySelectorAll(".edit-rule-btn").forEach((btn) => {
        btn.addEventListener("click", () => editPricing(btn.closest(".admin-card").dataset.id, result.pricing));
    });
}

async function editPricing(location_id, pricing) {
    const p = pricing.find((r) => String(r.location_id) === String(location_id));
    if (!p) return;
    const peak_multiplier = parseFloat(prompt("Peak surge multiplier (e.g. 1.25):", p.peak_multiplier));
    if (!peak_multiplier) { alert("Multiplier must be a valid number."); return; }
    const peak_start = prompt("Peak hours start (HH:MM, 24h):", p.peak_start.slice(0, 5)) + ":00";
    const peak_end = prompt("Peak hours end (HH:MM, 24h):", p.peak_end.slice(0, 5)) + ":00";
    const occupancy_threshold = parseInt(prompt("Occupancy threshold (%):", p.occupancy_threshold), 10);
    const enabled = confirm("Click OK to enable this rule, Cancel to disable it.");

    const result = await admApi("pricing_update.php", "POST", {
        location_id: parseInt(location_id, 10), peak_multiplier, peak_start, peak_end, occupancy_threshold, enabled,
    });
    alert(result.message);
    if (result.success) loadPricing();
}

function setupPricingTab() {
    const addBtn = document.querySelector("#tab-dynamic-pricing .pricing-head-btn");
    if (addBtn) addBtn.addEventListener("click", () => alert("Each parking location already has one editable pricing rule — use \"Edit Pricing Rules\" on its card."));
}

// ---------------- SYSTEM REPORTS ----------------
let revenueChart, violationsChart;

async function loadReports() {
    const cards = document.querySelectorAll("#tab-system-reports .sys-card-val");
    if (cards.length === 0) return;
    const result = await admApi("reports_summary.php");
    if (!result.success) return;

    if (cards[0]) cards[0].textContent = money(result.ytd_revenue) + "";
    if (cards[1]) cards[1].textContent = result.ytd_reservations.toLocaleString();
    if (cards[2]) cards[2].textContent = money(result.avg_monthly_revenue);
    if (cards[3]) cards[3].textContent = result.total_violations;

    const labels = result.monthly.map((m) => m.label);
    const revenueData = result.monthly.map((m) => Number(m.revenue));
    const reservationData = result.monthly.map((m) => Number(m.reservations));

    const ctxRev = document.getElementById("monthlyRevenueChart");
    if (ctxRev) {
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(ctxRev.getContext("2d"), {
            type: "bar",
            data: {
                labels,
                datasets: [
                    { label: "revenue (৳)", data: revenueData, backgroundColor: "#0d9488", borderRadius: 4, barPercentage: 0.6 },
                    { label: "reservations", data: reservationData, backgroundColor: "#a855f7", borderRadius: 4, barPercentage: 0.6 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: "#f1f5f9" } } },
            },
        });
    }

    const vLabels = result.violations_trend.map((v) => v.label);
    const vData = result.violations_trend.map((v) => Number(v.count));
    const ctxVio = document.getElementById("violationsTrendChart");
    if (ctxVio) {
        if (violationsChart) violationsChart.destroy();
        violationsChart = new Chart(ctxVio.getContext("2d"), {
            type: "line",
            data: { labels: vLabels, datasets: [{ label: "Violations", data: vData, borderColor: "#ef4444", backgroundColor: "#ef4444", tension: 0.4, pointRadius: 4, pointBackgroundColor: "#ef4444" }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { min: 0, grid: { color: "#f1f5f9" } } } },
        });
    }

    const locList = document.querySelector("#tab-system-reports .location-progress-list");
    if (locList) {
        const max = Math.max(1, ...result.revenue_by_location.map((l) => Number(l.revenue)));
        locList.innerHTML = result.revenue_by_location.map((l) => `
            <div>
                <div class="loc-progress-info"><span class="loc-name">${l.name}</span><span class="loc-val">${Number(l.revenue).toLocaleString()}</span></div>
                <div class="bar-bg"><div class="bar-fill" style="width:${Math.round((l.revenue / max) * 100)}%"></div></div>
            </div>
        `).join("") || `<p class="sub-text">No revenue recorded yet.</p>`;
    }

    // "Available Reports" -> one real, downloadable PDF per recent month
    // (each is generated on the fly by backend/admin/download_report.php)
    const reportsList = document.getElementById("availableReportsList");
    if (reportsList) {
        const months = [...result.monthly].reverse(); // most recent first
        const items = months.map((m) => ({
            name: `${m.label} - Monthly Revenue Report`,
            meta: `${Number(m.reservations)} reservations · ${money(m.revenue)}`,
            href: `${ADM_API}/download_report.php?type=revenue&month=${m.ym}`,
        }));
        const currentYm = new Date().toISOString().slice(0, 7);
        items.push({
            name: `Violations Report - ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}`,
            meta: `${result.total_violations} recorded this year`,
            href: `${ADM_API}/download_report.php?type=violations&month=${currentYm}`,
        });

        reportsList.innerHTML = items.map((it) => `
            <div class="report-item">
                <div class="report-info">
                    <i class="fa-regular fa-file-lines report-icon"></i>
                    <div>
                        <strong class="report-name">${it.name}</strong>
                        <p class="report-meta">${it.meta}</p>
                    </div>
                </div>
                <a class="pdf-btn" style="text-decoration:none;" href="${it.href}"><i class="fa-solid fa-download"></i> PDF</a>
            </div>
        `).join("") || `<p class="sub-text">No reports available yet.</p>`;
    }
}

function setupReportsTab() {
    const btn = document.getElementById("downloadFullReportBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = `${ADM_API}/download_report.php?type=summary`;
        });
    }
}

// ---------------- VIOLATIONS ----------------
async function loadViolationCategories() {
    const grid = document.querySelector("#tab-violations .vio-categories-grid");
    if (!grid) return;

    const res = await admApi("violation_categories.php");
    if (!res.success) return;

    grid.innerHTML = res.categories.map(c => `
        <div class="vio-cat-card" data-id="${c.id}">
            <div class="vio-cat-top">
                <strong>${c.name}</strong>
                <span class="badge-level ${c.fine_amount >= 500 ? 'critical' : 'medium'}">${c.fine_amount >= 500 ? 'CRITICAL' : 'STANDARD'}</span>
            </div>
            <div class="vio-cat-bottom">
                <span class="sub-text">Fine: <strong class="fine-amt">৳${c.fine_amount}</strong></span>
                <span class="case-cnt">${c.violation_count} cases</span>
            </div>
        </div>
    `).join("");
}

function setupViolationCategoriesTab() {
    const addBtn = document.querySelector("#tab-violations .btn-add-cat");
    if (!addBtn) return;

    addBtn.addEventListener("click", async () => {
        const name = prompt("Violation Category Name:");
        if (!name) return;
        const fine_amount = prompt("Fine Amount (৳):", "500");
        if (!fine_amount) return;
        const description = prompt("Category Description (optional):", "") || "";

        const res = await admApi("violation_categories.php", "POST", {
            action: "create",
            name,
            fine_amount: parseFloat(fine_amount),
            description
        });
        alert(res.message);
        if (res.success) {
            loadViolationCategories();
        }
    });
}

async function loadAdminViolations() {
    const tbody = document.querySelector("#tab-violations .vio-table tbody");
    if (!tbody) return;
    const result = await mgrApi("violations_list.php");
    if (!result.success) return;

    const openBadge = document.querySelector("#tab-violations .badge-open");
    const openCount = result.violations.filter((v) => v.status === "open").length;
    if (openBadge) openBadge.textContent = `${openCount} open`;

    tbody.innerHTML = result.violations.map((v) => `
        <tr>
            <td class="purple-text"><b>${v.violation_code}</b></td>
            <td><strong>${v.vehicle_plate || "Unknown"}</strong><br>${v.vehicle_plate ? `<span class="purple-text plate-code">${v.vehicle_plate}</span>` : ""}</td>
            <td>${v.location_name}</td>
            <td><strong>${v.category_name || "General"}</strong><br><small style="color:#718096;">${v.description}</small></td>
            <td>${fmtDate(v.created_at)}</td>
            <td class="danger-text"><b>৳${v.fine_amount || 500}</b></td>
            <td>${statusBadge(v.status)}</td>
            <td>${v.status === "open" ? `<button class="btn-resolve" data-code="${v.violation_code}">✓ Resolve</button>` : ""}</td>
        </tr>
    `).join("") || `<tr><td colspan="8">No violations recorded.</td></tr>`;

    tbody.querySelectorAll(".btn-resolve").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const result = await mgrApi("resolve_violation.php", "POST", { violation_code: btn.dataset.code });
            if (result.success) loadAdminViolations();
            else alert(result.message);
        });
    });
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof initSessionGuard === "function") {
        await initSessionGuard(["admin"]);
    }

    await loadManagersForDropdown();
    loadOverview();
    loadPendingManagerApprovals();
    loadLocations();
    setupLocationsTab();
    loadUsers("driver");
    setupUserManagementTab();
    loadPricing();
    setupPricingTab();
    loadReports();
    setupReportsTab();
    loadViolationCategories();
    setupViolationCategoriesTab();
    loadAdminViolations();

    // Auto-refresh overview stats and recent reservations every 6s
    if (document.getElementById("recentReservationsBody")) {
        setInterval(loadOverview, 6000);
        setInterval(loadPendingManagerApprovals, 6000);
    }
});
