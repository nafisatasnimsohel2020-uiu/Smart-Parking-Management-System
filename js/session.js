

async function initSessionGuard(allowedRoles) {
    try {
        const res = await fetch("../backend/check_session.php", { credentials: "include" });
        const data = await res.json();

        if (!data.loggedIn) {
            window.location.href = "../admin/login.html";
            return null;
        }

        const user = data.user;
        window.currentUser = user;
        if (allowedRoles && !allowedRoles.includes(user.role)) {
            // Wrong role trying to access page - redirect to proper dashboard
            const redirectMap = {
                admin: "../admin/admin.html",
                manager: "../manager/index.html",
                driver: "../driver/index.html",
            };
            window.location.href = redirectMap[user.role] || "../admin/login.html";
            return null;
        }

        // Dynamically update UI with logged-in user profile
        updateUserProfileUI(user);

        // Attach real logout handler to all logout buttons
        setupLogoutButtons();

        return user;
    } catch (err) {
        console.error("Session check error:", err);
        return null;
    }
}

function updateUserProfileUI(user) {
    if (!user) return;

    // Get initials
    const parts = (user.full_name || "User").trim().split(" ");
    const initials = parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();

    // 1. Sidebar user-info
    document.querySelectorAll(".user-info h4, .user-badge strong, .user-name").forEach(el => {
        el.textContent = user.full_name;
    });

    if (user.role === 'manager' && user.location_name) {
        document.querySelectorAll(".user-info p").forEach(el => {
            el.textContent = `${user.location_name} Manager`;
        });
    }

    // 2. Avatar badges
    document.querySelectorAll(".avatar, .avatar-sm").forEach(el => {
        el.textContent = initials;
    });

    // 3. Top-bar profile pills
    document.querySelectorAll(".profile-pill, .top-user").forEach(el => {
        const locLabel = (user.role === 'manager' && user.location_name) ? ` <span style="font-size:11px; opacity:0.8; font-weight:normal;">(${user.location_name})</span>` : '';
        el.innerHTML = `<div class="avatar-sm" style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:#e2e8f0; font-size:11px; font-weight:700; color:#2d3748; margin-right:6px;">${initials}</div> ${user.full_name}${locLabel}`;
    });
}

function setupLogoutButtons() {
    document.querySelectorAll(".logout-btn, .sidebar-logout").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await fetch("../backend/logout.php", {
                    method: "POST",
                    credentials: "include"
                });
            } catch (err) {
                console.error("Logout failed:", err);
            }
            window.location.href = "../admin/login.html";
        });
    });
}
