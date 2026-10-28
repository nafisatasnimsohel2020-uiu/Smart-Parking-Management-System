

const GUEST_API = "../backend/driver";
const CONTACT_API = "../backend/guest";

async function loadGuestLocations() {
    try {
        const res = await fetch(`${GUEST_API}/get_locations.php`).then(r => r.json());
        if (!res.success || !res.locations) return;

        const locs = res.locations;

        // 1. If on locations.html: render live table
        renderGuestLocationsTable(locs);

        // 2. If on home.html: update live system capacity and availability metrics
        const mLocs = document.getElementById("guestMetricsLocations");
        const mCap = document.getElementById("guestMetricsCapacity");
        const mAvail = document.getElementById("guestMetricsAvailable");

        if (mLocs) mLocs.textContent = `${locs.length} Locations`;
        if (mCap) {
            const totalCap = locs.reduce((acc, l) => acc + (l.total_spaces || 0), 0);
            mCap.textContent = `${totalCap} Spots`;
        }
        if (mAvail) {
            const totalAvail = locs.reduce((acc, l) => acc + (l.available_spaces || 0), 0);
            mAvail.textContent = `${totalAvail} Available`;
        }
    } catch (e) {
        console.error("Could not load guest locations:", e);
    }
}

function renderGuestLocationsTable(locs) {
    const tableBody = document.getElementById("zones-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = locs.map((l) => {
        const nameLower = l.name.toLowerCase();
        const hasEv = nameLower.includes("mirpur") || nameLower.includes("gulshan") || nameLower.includes("uiu");
        const hasBike = true;
        const has247 = !nameLower.includes("dhanmondi");
        const isAvail = l.available_spaces > 0;
        const isUiu = nameLower.includes("uiu");

        return `
          <tr data-ev="${hasEv}" data-bike="${hasBike}" data-247="${has247}">
            <td>
              <strong>${l.name}</strong><br>
              <small style="color: var(--text-muted);">${l.address}</small>
            </td>
            <td>
              <strong>৳ ${l.price_per_hour}</strong> / hr<br>
              <small style="color: ${isAvail ? '#38a169' : '#e53e3e'}; font-weight:600;">${isAvail ? l.available_spaces + ' spots open' : 'Full'}</small>
            </td>
            <td>🚗 Sedan, SUV, 🏍️ Bike</td>
            <td>
              ${isUiu ? '<span class="status-badge paid" style="background:#ebf8ff; color:#2b6cb0; border:1px solid #bee3f8;">🎓 UIU 25% Off</span> ' : ''}
              ${hasEv ? '<span class="status-badge paid">⚡ EV Charger</span> ' : ''}
              <span class="status-badge paid">🎥 CCTV</span>
              ${has247 ? '<span class="status-badge paid">🕒 24/7 Access</span>' : '<span class="status-badge paid">🕒 07:00 - 22:00</span>'}
            </td>
            <td>
              <a href="../admin/login.html" class="btn btn-sm btn-primary">Book Spot &rarr;</a>
            </td>
          </tr>
        `;
    }).join("");
}

// Window global filter for buttons on locations.html
window.filterZones = function(category, element) {
    document.querySelectorAll('.pill-group .btn-pill').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');

    const rows = document.querySelectorAll('#zones-table-body tr');
    rows.forEach(row => {
        if (category === 'all') {
            row.style.display = '';
        } else {
            const matches = row.getAttribute('data-' + category) === 'true';
            row.style.display = matches ? '' : 'none';
        }
    });
};

// Handle guest contact form submission via AJAX
function setupGuestContactForm() {
    const form = document.querySelector(".form-card, form");
    const alertBox = document.getElementById("sent");

    if (!form || !document.getElementById("name")) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const subject = document.getElementById("subject") ? document.getElementById("subject").value.trim() : "Support Inquiry";
        const message = document.getElementById("message").value.trim();

        if (!name || !email || !message) {
            alert("Please fill in your name, email, and message.");
            return;
        }

        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Sending...";
        }

        try {
            const res = await fetch(`${CONTACT_API}/contact.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, subject, message })
            }).then(r => r.json());

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Send Message →";
            }

            if (alertBox) {
                alertBox.style.display = "block";
                if (res.success) {
                    alertBox.style.background = "#dcfce7";
                    alertBox.style.color = "#15803d";
                    alertBox.textContent = `✔ ${res.message || 'Your message has been sent successfully. We will get back to you soon.'}`;
                    form.reset();
                } else {
                    alertBox.style.background = "#fed7d7";
                    alertBox.style.color = "#9b2c2c";
                    alertBox.textContent = `✖ ${res.message || 'Could not send message. Please try again.'}`;
                }
                alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
                alert(res.message);
                if (res.success) form.reset();
            }
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Send Message →";
            }
            if (alertBox) {
                alertBox.style.display = "block";
                alertBox.style.background = "#fed7d7";
                alertBox.style.color = "#9b2c2c";
                alertBox.textContent = "✖ Could not connect to server. Please try again later.";
            }
        }
    });
}

// Quick Search on home.html
function setupGuestHomeSearch() {
    const searchPills = document.querySelectorAll(".top-search-card .pill-group .btn-pill");
    const searchCards = document.querySelectorAll("#search-results .result-card");
    if (searchPills.length === 0 || searchCards.length === 0) return;

    // Default: Show first search result
    const firstCard = document.getElementById("search-mirpur") || searchCards[0];
    if (firstCard) {
        searchCards.forEach(c => c.style.display = "none");
        firstCard.style.display = "block";
    }

    searchPills.forEach(pill => {
        pill.addEventListener("click", (e) => {
            e.preventDefault();
            searchPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const targetId = pill.getAttribute("href").replace("#", "");
            searchCards.forEach(c => c.style.display = "none");
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.style.display = "block";
            }
        });
    });
}

// Init
document.addEventListener("DOMContentLoaded", () => {
    loadGuestLocations();
    setupGuestContactForm();
    setupGuestHomeSearch();

    // Auto-refresh availability and metrics time-to-time
    setInterval(loadGuestLocations, 6000);
});
