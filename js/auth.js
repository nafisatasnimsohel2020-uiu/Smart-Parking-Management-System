
const API_BASE = "../backend"; // this file is loaded from admin/login.html

let selectedRole = "admin"; // admin | manager | driver | guest (Sign In)
let selectedSignUpRole = "driver"; // admin | manager | driver (Sign Up)
const ROLE_MAP = {
    Administrator: "admin",
    "Parking Manager": "manager",
    Driver: "driver",
    Guest: "guest",
};
const REDIRECT_MAP = {
    admin: "admin.html",
    manager: "../manager/index.html",
    driver: "../driver/index.html",
};

async function api(path, body) {
    try {
        const res = await fetch(`${API_BASE}/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // keep the PHP session cookie
            body: JSON.stringify(body || {}),
        });
        const data = await res.json();
        return data;
    } catch (err) {
        console.error(`API Error calling ${path}:`, err);
        return {
            success: false,
            message: "Unable to reach the backend server. Please verify Apache/MySQL is running in XAMPP."
        };
    }
}

function showMsg(boxId, text, type) {
    const box = document.getElementById(boxId);
    box.innerText = text;
    box.className = "msg-box " + (type || "");
}

function selectRole(roleName, element) {
    document.querySelectorAll("#signInCard .role-option").forEach((opt) => opt.classList.remove("selected"));
    element.classList.add("selected");
    selectedRole = ROLE_MAP[roleName] || "driver";

    const step1 = document.getElementById("signInStep1");
    const step2 = document.getElementById("signInStep2");
    const sendOtpBtn = document.getElementById("signInSendOtpBtn");
    const submitBtn = document.getElementById("submitBtn");
    const guestBtn = document.getElementById("guestBtn");
    const msgBox = document.getElementById("signInMsg");

    msgBox.innerText = "";
    msgBox.className = "msg-box";
    step2.style.display = "none";

    if (selectedRole === "guest") {
        step1.style.display = "none";
        sendOtpBtn.style.display = "none";
        submitBtn.style.display = "none";
        guestBtn.style.display = "block";
    } else {
        step1.style.display = "block";
        sendOtpBtn.style.display = "block";
        submitBtn.style.display = "none";
        guestBtn.style.display = "none";
        submitBtn.innerText = `Continue as ${roleName}`;

        // Demo/quick-account login is intentionally disabled for managers.
        // Manager login must always use credentials from a registered account.
        const mgrChips = document.getElementById("quickAccountChips");
        const drvChips = document.getElementById("quickDriverChips");
        if (mgrChips) mgrChips.style.display = "none";
        if (drvChips) drvChips.style.display = "none";

        const emailInput = document.getElementById("signInEmail");
        const passInput = document.getElementById("signInPassword");
        if (emailInput) emailInput.value = "";
        if (passInput) passInput.value = "";
    }
}

let currentLoggedInUser = null;

async function checkLoginActiveSession() {
    try {
        const res = await fetch(`${API_BASE}/check_session.php`, { credentials: "include" }).then(r => r.json());
        if (res.loggedIn && res.user) {
            currentLoggedInUser = res.user;
        }
    } catch (e) {
        // silent
    }
}

async function logoutCurrentSession() {
    try {
        await fetch(`${API_BASE}/logout.php`, { method: "POST", credentials: "include" });
        window.location.reload();
    } catch (e) {
        window.location.reload();
    }
}

async function loadSignUpLocations() {
    const mgrLocSelect = document.getElementById("signUpManagerLocation");
    if (!mgrLocSelect || mgrLocSelect.options.length > 1) return;
    try {
        const res = await fetch(`${API_BASE}/driver/get_locations.php`).then(r => r.json());
        if (res.success && res.locations) {
            mgrLocSelect.innerHTML = `<option value="">-- Select Assigned Parking Area --</option>` +
                res.locations.map(l => `<option value="${l.id}">${l.name} (${l.address})</option>`).join("");
        }
    } catch (err) {
        console.error("Could not load parking locations for manager signup:", err);
    }
}


function selectSignUpRole(role, element) {
    document
        .querySelectorAll("#signUpCard .role-option")
        .forEach((opt) => opt.classList.remove("selected"));
    if (element) element.classList.add("selected");
    selectedSignUpRole = role;

    const submitBtn = document.getElementById("signUpSubmitBtn");
    if (submitBtn) {
        const roleLabel = role === "admin" ? "Administrator" : (role === "manager" ? "Parking Manager" : "Driver");
        submitBtn.textContent = `Create ${roleLabel} Account`;
    }

    // Only Administrator sign-up needs the secret admin access key
    const adminKeyField = document.getElementById("signUpAdminKeyField");
    if (adminKeyField) {
        adminKeyField.style.display = role === "admin" ? "block" : "none";
        if (role !== "admin") {
            const adminKeyInput = document.getElementById("signUpAdminKey");
            if (adminKeyInput) adminKeyInput.value = "";
        }
    }

    // UIU ID is optional (Driver signup only). A valid UIU ID gives the 25% discount;
    // drivers without one can still sign up and simply pay the normal price.
    const uiuGroup = document.getElementById("signUpUiuIdGroup");
    const uiuInput = document.getElementById("signUpUiuId");
    if (uiuGroup) uiuGroup.style.display = role === "driver" ? "block" : "none";
    if (uiuInput) {
        uiuInput.required = false;
        if (role !== "driver") uiuInput.value = "";
    }

    // Parking Manager sign-up requires selecting assigned parking area
    const mgrLocGroup = document.getElementById("signUpManagerLocationGroup");
    if (mgrLocGroup) {
        mgrLocGroup.style.display = role === "manager" ? "block" : "none";
        if (role === "manager") {
            loadSignUpLocations();
        }
    }
}

function continueAsGuest() {
    window.location.href = "../guest/home.html";
}

function toggleAuth(type) {
    const signInCard = document.getElementById("signInCard");
    const signUpCard = document.getElementById("signUpCard");

    if (type === "signup") {
        signInCard.style.display = "none";
        signUpCard.style.display = "block";

        // New accounts default to Driver. The user can explicitly choose Manager/Admin.
        // Do not inherit the Sign-In role, because that can unexpectedly require an
        // administrator access key when the user simply wants to create a Driver account.
        const drvOpt = document.getElementById("signUpRoleDriver") || document.querySelector("#signUpCard .role-option[onclick*='driver']");
        if (drvOpt) selectSignUpRole("driver", drvOpt);
    } else {
        signInCard.style.display = "block";
        signUpCard.style.display = "none";
    }
}

// ---------- SIGN IN ----------
async function sendSignInOTP() {
    const emailInput = document.getElementById("signInEmail");
    const passInput = document.getElementById("signInPassword");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passInput ? passInput.value : "";
    const btn = document.getElementById("signInSendOtpBtn");

    if (!email || !password) {
        showMsg("signInMsg", "Please enter your email and password.", "error");
        return;
    }

    if (btn) btn.disabled = true;
    showMsg("signInMsg", "Checking account & sending OTP...", "");

    const result = await api("login_send_otp.php", { email, password, role: selectedRole });
    if (btn) btn.disabled = false;

    if (!result.success) {
        showMsg("signInMsg", result.message || "Failed to send OTP.", "error");
        return;
    }


    document.getElementById("signInStep1").style.display = "none";
    document.getElementById("signInStep2").style.display = "block";
    if (btn) btn.style.display = "none";

    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
        submitBtn.style.display = "block";
        const roleLabel = selectedRole === "admin" ? "Administrator" : (selectedRole === "manager" ? "Parking Manager" : "Driver");
        submitBtn.innerText = `Continue as ${roleLabel}`;
    }

    const otpInput = document.getElementById("signInOtp");
    if (otpInput) {
        otpInput.value = ""; // User must enter manually
        otpInput.focus();
    }

    const otpNote = result.dev_otp ? ` (Test code: ${result.dev_otp})` : " (Default test code: 1234)";
    showMsg("signInMsg", "OTP sent successfully! Please enter the 4-digit code manually." + otpNote, "success");
}

function backToSignInStep1(e) {
    if (e && e.preventDefault) e.preventDefault();
    document.getElementById("signInStep1").style.display = "block";
    document.getElementById("signInStep2").style.display = "none";
    const sendOtpBtn = document.getElementById("signInSendOtpBtn");
    if (sendOtpBtn) {
        sendOtpBtn.style.display = "block";
        sendOtpBtn.disabled = false;
    }
    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.style.display = "none";
    showMsg("signInMsg", "", "");
}

async function resendSignInOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    const email = document.getElementById("signInEmail").value.trim();
    const password = document.getElementById("signInPassword").value;
    showMsg("signInMsg", "Resending OTP...", "");
    const result = await api("login_send_otp.php", { email, password, role: selectedRole });
    if (!result.success) {
        showMsg("signInMsg", result.message || "Failed to resend OTP.", "error");
        return;
    }
    const otpInput = document.getElementById("signInOtp");
    if (otpInput) {
        otpInput.value = ""; // User enters manually
        otpInput.focus();
    }
    const otpNote = result.dev_otp ? ` (Test code: ${result.dev_otp})` : "";
    showMsg("signInMsg", "New OTP sent! Please enter the 4-digit code manually." + otpNote, "success");
}

async function handleSignIn(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (selectedRole === "guest") {
        continueAsGuest();
        return;
    }

    const step2 = document.getElementById("signInStep2");
    // If user hit Enter while in Step 1, trigger Send OTP instead of premature failure
    if (!step2 || step2.style.display === "none") {
        await sendSignInOTP();
        return;
    }

    const email = document.getElementById("signInEmail").value.trim();
    const otp = document.getElementById("signInOtp").value.trim();
    const submitBtn = document.getElementById("submitBtn");

    if (!otp) {
        showMsg("signInMsg", "Please enter the 4-digit OTP. (Default test code: 1234)", "error");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    showMsg("signInMsg", "Verifying OTP...", "");

    const result = await api("login_verify_otp.php", { otp, email });
    if (submitBtn) submitBtn.disabled = false;

    if (!result.success) {
        showMsg("signInMsg", result.message || "Invalid OTP.", "error");
        return;
    }

    showMsg("signInMsg", "Sign in verified! Redirecting...", "success");

    const targetRole = (result.user && result.user.role) ? result.user.role : selectedRole;
    setTimeout(() => {
        window.location.href = REDIRECT_MAP[targetRole] || "index.html";
    }, 350);
}

// ---------- SIGN UP ----------
async function sendSignUpOTP() {
    const full_name = document.getElementById("signUpName").value.trim();
    const email = document.getElementById("signUpEmail").value.trim();
    const phone = document.getElementById("signUpPhone").value.trim();
    const password = document.getElementById("signUpPassword").value;
    const uiu_id = document.getElementById("signUpUiuId")?.value.trim() || "";
    const adminKeyInput = document.getElementById("signUpAdminKey");
    const admin_key = adminKeyInput ? adminKeyInput.value : "";
    const mgrLocSelect = document.getElementById("signUpManagerLocation");
    const location_id = (selectedSignUpRole === "manager" && mgrLocSelect) ? parseInt(mgrLocSelect.value, 10) : 0;
    const btn = document.getElementById("signUpSendOtpBtn");

    if (!full_name || !email || !phone || !password) {
        showMsg("signUpMsg", "Please fill in all registration fields.", "error");
        return;
    }

    if (password.length < 6) {
        showMsg("signUpMsg", "Password must be at least 6 characters.", "error");
        return;
    }

    if (selectedSignUpRole === "driver" && uiu_id !== "" && !/^011\d{7}$/.test(uiu_id)) {
        showMsg("signUpMsg", "Incorrect UIU ID. Enter 10 digits starting with 011, or leave it empty if you are not from UIU.", "error");
        return;
    }

    if (selectedSignUpRole === "admin" && !admin_key) {
        showMsg("signUpMsg", "Please enter the admin access key.", "error");
        return;
    }

    if (selectedSignUpRole === "manager" && (!location_id || isNaN(location_id) || location_id <= 0)) {
        showMsg("signUpMsg", "Please select an assigned parking area. Every Area Manager must be assigned to an area.", "error");
        return;
    }

    if (btn) btn.disabled = true;
    showMsg("signUpMsg", "Sending verification OTP...", "");

    const result = await api("register_send_otp.php", {
        full_name,
        email,
        phone,
        password,
        uiu_id,
        role: selectedSignUpRole,
        location_id,
        admin_key
    });
    if (btn) btn.disabled = false;

    if (!result.success) {
        showMsg("signUpMsg", result.message || "Failed to send OTP.", "error");
        return;
    }

    document.getElementById("signUpStep1").style.display = "none";
    document.getElementById("signUpStep2").style.display = "block";
    if (btn) btn.style.display = "none";

    const submitBtn = document.getElementById("signUpSubmitBtn");
    if (submitBtn) {
        submitBtn.style.display = "block";
        const roleLabel = selectedSignUpRole === "admin" ? "Administrator" : (selectedSignUpRole === "manager" ? "Parking Manager" : "Driver");
        submitBtn.textContent = `Create ${roleLabel} Account`;
    }

    const otpInput = document.getElementById("signUpOtp");
    if (otpInput) {
        otpInput.value = ""; // User enters manually
        otpInput.focus();
    }

    const otpNote = result.dev_otp ? ` (Test code: ${result.dev_otp})` : " (Default test code: 1234)";
    showMsg("signUpMsg", "OTP sent successfully! Please enter the 4-digit code manually." + otpNote, "success");
}

function backToSignUpStep1(e) {
    if (e && e.preventDefault) e.preventDefault();
    document.getElementById("signUpStep1").style.display = "block";
    document.getElementById("signUpStep2").style.display = "none";
    const sendOtpBtn = document.getElementById("signUpSendOtpBtn");
    if (sendOtpBtn) {
        sendOtpBtn.style.display = "block";
        sendOtpBtn.disabled = false;
    }
    const submitBtn = document.getElementById("signUpSubmitBtn");
    if (submitBtn) submitBtn.style.display = "none";
    showMsg("signUpMsg", "", "");
}

async function resendSignUpOtp(e) {
    if (e && e.preventDefault) e.preventDefault();
    const full_name = document.getElementById("signUpName").value.trim();
    const email = document.getElementById("signUpEmail").value.trim();
    const phone = document.getElementById("signUpPhone").value.trim();
    const password = document.getElementById("signUpPassword").value;
    const uiu_id = document.getElementById("signUpUiuId")?.value.trim() || "";
    const adminKeyInput = document.getElementById("signUpAdminKey");
    const admin_key = adminKeyInput ? adminKeyInput.value : "";
    const mgrLocSelect = document.getElementById("signUpManagerLocation");
    const location_id = (selectedSignUpRole === "manager" && mgrLocSelect) ? parseInt(mgrLocSelect.value, 10) : 0;

    showMsg("signUpMsg", "Resending OTP...", "");
    const result = await api("register_send_otp.php", {
        full_name,
        email,
        phone,
        password,
        uiu_id,
        role: selectedSignUpRole,
        location_id,
        admin_key
    });
    if (!result.success) {
        showMsg("signUpMsg", result.message || "Failed to resend OTP.", "error");
        return;
    }
    const otpInput = document.getElementById("signUpOtp");
    if (otpInput) {
        otpInput.value = ""; // User enters manually
        otpInput.focus();
    }
    const otpNote = result.dev_otp ? ` (Test code: ${result.dev_otp})` : "";
    showMsg("signUpMsg", "New OTP sent! Please enter the 4-digit code manually." + otpNote, "success");
}

async function handleSignUp(e) {
    if (e && e.preventDefault) e.preventDefault();

    const step2 = document.getElementById("signUpStep2");
    // If user hit Enter while in Step 1, trigger Send OTP instead of premature failure
    if (!step2 || step2.style.display === "none") {
        await sendSignUpOTP();
        return;
    }

    const full_name = document.getElementById("signUpName").value.trim();
    const email = document.getElementById("signUpEmail").value.trim();
    const phone = document.getElementById("signUpPhone").value.trim();
    const password = document.getElementById("signUpPassword").value;
    const uiu_id = document.getElementById("signUpUiuId")?.value.trim() || "";
    const otp = document.getElementById("signUpOtp").value.trim();
    const adminKeyInput = document.getElementById("signUpAdminKey");
    const admin_key = adminKeyInput ? adminKeyInput.value : "";
    const mgrLocSelect = document.getElementById("signUpManagerLocation");
    const location_id = (selectedSignUpRole === "manager" && mgrLocSelect) ? parseInt(mgrLocSelect.value, 10) : 0;
    const submitBtn = document.getElementById("signUpSubmitBtn");

    if (!otp) {
        showMsg("signUpMsg", "Please enter the 4-digit OTP code.", "error");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    showMsg("signUpMsg", "Creating account...", "");

    const result = await api("register_verify_otp.php", {
        otp,
        full_name,
        email,
        phone,
        password,
        uiu_id,
        role: selectedSignUpRole,
        location_id,
        admin_key
    });
    if (submitBtn) submitBtn.disabled = false;

    if (!result.success) {
        showMsg("signUpMsg", result.message || "Failed to create account.", "error");
        return;
    }

    if (result.pending_review) {
        showMsg("signUpMsg", result.message || "Registration submitted! Your account will be activated once confirmed by the System Administrator.", "success");
        setTimeout(() => {
            toggleAuth("signin");
            const signInMsg = document.getElementById("signInMsg");
            if (signInMsg) {
                showMsg("signInMsg", "Registration submitted! Your manager account will be active once confirmed by an admin. You can sign in after confirmation.", "success");
            }
        }, 3000);
        return;
    }

    showMsg("signUpMsg", "Account created successfully! Redirecting to dashboard...", "success");

    const targetRole = (result.user && result.user.role) ? result.user.role : selectedSignUpRole;
    setTimeout(() => {
        window.location.href = REDIRECT_MAP[targetRole] || "index.html";
    }, 450);
}

document.addEventListener("DOMContentLoaded", () => {
    checkLoginActiveSession();

    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const mode = urlParams.get("mode") || urlParams.get("action");
    if (mode === "signup" || mode === "register" || hash === "#signup") {
        toggleAuth("signup");
    }

    // Handle Enter key inside OTP inputs to immediately submit
    const signInOtp = document.getElementById("signInOtp");
    if (signInOtp) {
        signInOtp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSignIn(e);
            }
        });
    }

    const signUpOtp = document.getElementById("signUpOtp");
    if (signUpOtp) {
        signUpOtp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSignUp(e);
            }
        });
    }
});
