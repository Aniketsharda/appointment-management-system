const API_BASE_URL = "http://localhost:4000/api/superadmin";
const ADMIN_API_BASE_URL = "http://localhost:4000/api/admin"; // shared admin API for slots

let admins = [];
let appointments = [];
let currentAppointmentId = null;

const adminsTable = document.getElementById("adminsTable");
const appointmentsTable = document.getElementById("appointmentsTable");
const adminModal = document.getElementById("adminModal");
const reassignModal = document.getElementById("reassignModal");
const statusModal = document.getElementById("statusModal");
const adminForm = document.getElementById("adminForm");
const adminList = document.getElementById("adminList");
const newSlotId = document.getElementById("newSlotId");
const statusSelect = document.getElementById("statusSelect");
const adminSelect = document.getElementById("adminSelect");
const slotsTableBody = document.querySelector("#slotsTable tbody");
const addSlotBtn = document.getElementById("addSlotBtn");
const startTimeInput = document.getElementById("startTimeInput");
const endTimeInput = document.getElementById("endTimeInput");
const createSlotBtn = document.getElementById("createSlotBtn");

if (addSlotBtn) {
  addSlotBtn.addEventListener("click", () => {
    // Scroll to the create slot form and focus start time
    document
      .getElementById("createSlotBtn")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    startTimeInput?.focus();
    // Auto-fill end time to start + 30 minutes if start set later
  });
}
if (createSlotBtn) {
  createSlotBtn.addEventListener("click", createSlotFromForm);
}
if (adminSelect) {
  adminSelect.addEventListener("change", loadSlots);
}

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Notes modal helpers (matches modal in superadmin.html)
const saNotesModal = document.getElementById("notesModal");
const saNotesModalText = document.getElementById("notesModalText");
const saNotesModalClose = document.getElementById("notesModalClose");

function openSANotesModal(text) {
  if (!saNotesModal || !saNotesModalText) return;
  saNotesModalText.textContent = text || "";
  saNotesModal.style.display = "flex";
}
function closeSANotesModal() {
  if (!saNotesModal) return;
  saNotesModal.style.display = "none";
}
if (saNotesModalClose)
  saNotesModalClose.addEventListener("click", closeSANotesModal);
if (saNotesModal)
  saNotesModal.addEventListener("click", (e) => {
    if (e.target === saNotesModal) closeSANotesModal();
  });

async function loadSlots() {
  try {
    if (!adminSelect || !adminSelect.value) {
      if (slotsTableBody)
        slotsTableBody.innerHTML =
          '<tr><td colspan="4">Select an admin to view slots</td></tr>';
      return;
    }
    const adminId = adminSelect.value;
    // Use admin API shared endpoint; superadmin specifies adminId via query
    const res = await fetch(
      `${ADMIN_API_BASE_URL}/slots?adminId=${encodeURIComponent(adminId)}`,
      {
        headers: authHeaders(),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("Failed to load slots:", res.status, t);
      if (slotsTableBody)
        slotsTableBody.innerHTML = `<tr><td colspan="4">Failed to load slots</td></tr>`;
      return;
    }
    const slots = await res.json();
    if (!Array.isArray(slots) || !slots.length) {
      if (slotsTableBody)
        slotsTableBody.innerHTML = `<tr><td colspan="4">No slots found</td></tr>`;
      return;
    }
    if (!slotsTableBody) return;
    slotsTableBody.innerHTML = "";
    slots.forEach((s) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${safeFormatDateTime(s.startTime)}</td>
        <td>${safeFormatDateTime(s.endTime)}</td>
        <td><span class="badge ${
          s.isAvailable ? "badge-success" : "badge-warning"
        }">${s.isAvailable ? "available" : "booked"}</span></td>
        <td class="action-buttons">
          <button class="btn btn-primary btn-sm" data-action="edit" data-id="${
            s.id
          }"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${
            s.id
          }"><i class="fas fa-trash"></i></button>
        </td>`;
      slotsTableBody.appendChild(tr);
    });

    // Attach row action handlers
    slotsTableBody.querySelectorAll("button[data-action]").forEach((btn) => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "edit") btn.addEventListener("click", () => editSlot(id));
      if (action === "delete")
        btn.addEventListener("click", () => deleteSlot(id));
    });
  } catch (e) {
    console.error("Error loading slots:", e);
    if (slotsTableBody)
      slotsTableBody.innerHTML = `<tr><td colspan="4">Error loading slots</td></tr>`;
  }
}

function safeFormatDateTime(iso) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "N/A";
  // Format as DD/MM/YYYY, HH:MM (no seconds)
  return d.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function renderAdminsTable() {
  const tbody =
    adminsTable?.querySelector("tbody") ||
    document.querySelector("#adminsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  admins.forEach((admin) => {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${admin.id}</td>
        <td>${admin.name || "N/A"}</td>
        <td>${admin.email}</td>
        <td>${admin.mobile || "N/A"}</td>
        <td><span class="badge badge-primary">active</span></td>
        <td class="action-buttons">
          <button class="btn btn-primary btn-sm edit-admin" data-id="${
            admin.id
          }"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm delete-admin" data-id="${
            admin.id
          }"><i class="fas fa-trash"></i></button>
        </td>
      `;
    tbody.appendChild(row);
  });

  document
    .querySelectorAll(".edit-admin")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        openEditAdminModal(e.currentTarget.dataset.id)
      )
    );
  document
    .querySelectorAll(".delete-admin")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        deleteAdmin(e.currentTarget.dataset.id)
      )
    );

  if (admins.length && !tbody.children.length) {
    console.warn("Admins received but not rendered. Sample:", admins[0]);
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">Unable to render admins. Check console for details.</td>`;
    tbody.appendChild(row);
  }
}

function openAddAdminModal() {
  const title = document.getElementById("adminModalTitle");
  const pwdField = document.getElementById("passwordField");
  if (title) title.textContent = "Add New Admin";
  if (pwdField) pwdField.style.display = "block";
  if (adminForm) adminForm.reset();
  const idInput = document.getElementById("adminId");
  if (idInput) idInput.value = "";
  adminModal.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", function () {
  loadAdmins();
  loadAppointments();
  setupEventListeners();
});

setInterval(() => {
  loadAdmins();
  loadAppointments();
  setupEventListeners();
}, 20000);
function setupEventListeners() {
  document
    .getElementById("addAdminBtn")
    .addEventListener("click", openAddAdminModal);
  document
    .querySelectorAll(".close-modal")
    .forEach((btn) => btn.addEventListener("click", closeAllModals));
  document.getElementById("saveAdminBtn").addEventListener("click", saveAdmin);
  document
    .getElementById("confirmReassignBtn")
    .addEventListener("click", reassignAppointment);
  document
    .getElementById("confirmStatusBtn")
    .addEventListener("click", updateAppointmentStatus);
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.addEventListener("click", handleMenuItemClick));
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

async function loadAdmins() {
  try {
    const response = await fetch(`${API_BASE_URL}/getadmins`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const txt = await response.text();
      console.error("Failed to load admins:", response.status, txt);
      alert("Failed to load admins");
      return;
    }
    admins = await response.json();
    console.debug("Admins loaded:", admins.length, admins[0]);
    document.getElementById("totalAdmins").textContent = admins.length;
    renderAdminsTable();
  } catch (error) {
    console.error("Error loading admins:", error);
    alert("Failed to load admins");
  }
}
async function loadAdminsForSlots() {
  try {
    const res = await fetch(`${API_BASE_URL}/getadmins`, {
      headers: authHeaders(),
    });
    const admins = await res.json();
    adminSelect.innerHTML = admins
      .map((a) => `<option value="${a.id}">${a.name} (${a.email})</option>`)
      .join("");
    // Load slots for the initially selected admin
    if (admins.length) {
      loadSlots();
    }
  } catch (err) {
    console.error("Failed to load admins:", err);
  }
}

loadAdminsForSlots();
async function createSlotFromForm() {
  const adminId = adminSelect?.value;
  const startRaw = startTimeInput?.value;
  let endRaw = endTimeInput?.value;
  if (!adminId) return alert("Please select an admin first");
  if (!startRaw) return alert("Please select a start time");
  // If end not provided, auto-calc start + 30 minutes
  if (!endRaw) {
    const startDate = new Date(startRaw);
    if (isNaN(startDate.getTime())) return alert("Invalid start time");
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    endRaw = endDate.toISOString().slice(0, 16);
    if (endTimeInput) endTimeInput.value = endRaw;
  }
  try {
    const res = await fetch(`${ADMIN_API_BASE_URL}/slots`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ adminId, startTime: startRaw, endTime: endRaw }),
    });
    if (res.ok) {
      loadSlots();
      // Clear inputs for next entry
      if (startTimeInput) startTimeInput.value = "";
      if (endTimeInput) endTimeInput.value = "";
      alert("Slot created successfully");
    } else {
      const t = await res.text();
      console.error("Failed to add slot:", res.status, t);
      alert(t || "Failed to add slot");
    }
  } catch (err) {
    console.error("Add slot error:", err);
    alert("Failed to add slot");
  }
}
async function editSlot(slotId) {
  const startTime = prompt("Enter new Start Time (YYYY-MM-DDTHH:MM)");
  const endTime = prompt("Enter new End Time (YYYY-MM-DDTHH:MM)");

  try {
    const res = await fetch(
      `${ADMIN_API_BASE_URL}/slots/${slotId}?adminId=${encodeURIComponent(
        adminSelect.value
      )}`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          startTime,
          endTime,
          adminId: adminSelect.value,
        }),
      }
    );

    if (res.ok) {
      alert("Slot updated successfully");
      loadSlots();
    } else {
      alert("Failed to update slot");
    }
  } catch (err) {
    console.error("Edit slot error:", err);
  }
}

async function deleteSlot(slotId) {
  if (!confirm("Are you sure you want to delete this slot?")) return;
  try {
    const res = await fetch(
      `${ADMIN_API_BASE_URL}/slots/${slotId}?adminId=${encodeURIComponent(
        adminSelect.value
      )}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );

    if (res.ok) {
      alert("Slot deleted successfully");
      loadSlots();
    } else {
      alert("Failed to delete slot");
    }
  } catch (err) {
    console.error("Delete slot error:", err);
  }
}

async function loadAppointments() {
  try {
    const url = `${API_BASE_URL}/getappointments?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 304) {
        console.warn(
          "getappointments returned 304 Not Modified; skipping alert."
        );
        return;
      }
      const txt = await response.text();
      console.error("Failed to load appointments:", response.status, txt);
      alert("Failed to load appointments");
      return;
    }

    // Some servers return 304 Not Modified with an empty body when cached.
    // Parse body safely to avoid JSON errors on empty string.
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (_) {
      bodyText = "";
    }
    if (!bodyText || !bodyText.trim()) {
      console.warn(
        "getappointments returned empty body (status:",
        response.status,
        "). Treating as []"
      );
      appointments = [];
    } else {
      try {
        appointments = JSON.parse(bodyText);
      } catch (e) {
        console.error(
          "Invalid JSON from getappointments:",
          e,
          bodyText.slice(0, 200)
        );
        alert("Failed to load appointments");
        return;
      }
    }

    document.getElementById("totalAppointments").textContent =
      appointments.length;

    const today = new Date().toISOString().split("T")[0];
    const reslottedToday = appointments.filter(
      (a) =>
        a.updatedAt && a.updatedAt.includes(today) && a.status === "approved"
    ).length;
    document.getElementById("reslottedToday").textContent = reslottedToday;

    console.debug("Appointments loaded:", appointments.length, appointments[0]);
    try {
      renderAppointmentsTable();
    } catch (e) {
      console.error("Render appointments failed:", e);
      const tbody = document.querySelector("#appointmentsTable tbody");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7">Unable to render appointments. Check console for details.</td></tr>`;
      }
    }
  } catch (error) {
    console.error("Error loading appointments:", error);
    alert("Failed to load appointments");
  }
}
function getStatusBadgeClass(status) {
  switch (status) {
    case "approved":
      return "badge-success";
    case "pending":
      return "badge-warning";
    case "cancelled":
      return "badge-danger";
    default:
      return "badge-secondary";
  }
}

function renderAppointmentsTable() {
  const tbody =
    appointmentsTable?.querySelector("tbody") ||
    document.querySelector("#appointmentsTable tbody");
  tbody.innerHTML = "";

  appointments.forEach((a) => {
    try {
      const slot = a.slot || a.Slot || a.slotInfo || null;
      const user = a.user || a.User || null;
      const admin = a.admin || a.Admin || null;
      const row = document.createElement("tr");
      const safeNotes = a.notes ? escapeHtml(a.notes) : "";
      row.innerHTML = `
        <td>${a.id}</td>
        <td>${(user && (user.name || user.email)) || "N/A"}</td>
        <td>${
          slot && slot.startTime ? safeFormatDateTime(slot.startTime) : "N/A"
        }</td>
        <td>Consultation</td>
        <td>${
          safeNotes
            ? `<button class="btn btn-sm btn-outline-primary" data-notes="${safeNotes}">View</button>`
            : "-"
        }</td>
        <td>${(admin && (admin.name || admin.email)) || "Unassigned"}</td>
        <td><span class="badge ${getStatusBadgeClass(a.status)}">${
        a.status
      }</span></td>
        <td class="action-buttons">
          <button class="btn btn-warning btn-sm reassign-appointment" data-id="${
            a.id
          }"><i class="fas fa-exchange-alt"></i></button>
          <button class="btn btn-primary btn-sm update-status" data-id="${
            a.id
          }"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm delete-appointment" data-id="${
            a.id
          }"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(row);
      const btn = row.querySelector("button[data-notes]");
      if (btn) btn.addEventListener("click", () => openSANotesModal(a.notes));
    } catch (rowErr) {
      console.error("Failed to render appointment row. Record:", a, rowErr);
    }
  });

  document
    .querySelectorAll(".reassign-appointment")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        openReassignModal(e.currentTarget.dataset.id)
      )
    );
  document
    .querySelectorAll(".update-status")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        openStatusModal(e.currentTarget.dataset.id)
      )
    );
  document
    .querySelectorAll(".delete-appointment")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        deleteAppointment(e.currentTarget.dataset.id)
      )
    );

  if (appointments.length && !tbody.children.length) {
    console.warn(
      "Appointments received but not rendered. Sample:",
      appointments[0]
    );
  }
}

function openEditAdminModal(adminId) {
  const admin = admins.find((a) => a.id == adminId);
  if (!admin) return;

  document.getElementById("adminModalTitle").textContent = "Edit Admin";
  document.getElementById("passwordField").style.display = "none";
  document.getElementById("adminId").value = admin.id;
  document.getElementById("adminName").value = admin.name || "";
  document.getElementById("adminEmail").value = admin.email;
  document.getElementById("adminMobile").value = admin.mobile || "";
  document.getElementById("adminStatus").value = admin.status;
  adminModal.style.display = "flex";
}

function openReassignModal(appointmentId) {
  currentAppointmentId = appointmentId;
  adminList.innerHTML = "";

  admins.forEach((admin) => {
    const div = document.createElement("div");
    div.className = "admin-option";
    div.textContent = admin.name || admin.email;
    div.dataset.id = admin.id;
    div.addEventListener("click", () => {
      document
        .querySelectorAll(".admin-option")
        .forEach((opt) => opt.classList.remove("selected"));
      div.classList.add("selected");
      // Load available slots for this admin into dropdown
      loadAvailableSlotsForAdmin(admin.id);
    });
    adminList.appendChild(div);
  });

  reassignModal.style.display = "flex";
}

async function loadAvailableSlotsForAdmin(adminId) {
  try {
    newSlotId.innerHTML = '<option value="">Loading...</option>';
    const res = await fetch(
      `${API_BASE_URL}/admins/${adminId}/slots?available=true`,
      { headers: authHeaders() }
    );
    const slots = await res.json();
    if (!Array.isArray(slots) || slots.length === 0) {
      newSlotId.innerHTML = '<option value="">No available slots</option>';
      return;
    }
    newSlotId.innerHTML = slots
      .map(
        (s) =>
          `<option value="${s.id}">${new Date(
            s.startTime
          ).toLocaleString()}</option>`
      )
      .join("");
  } catch (e) {
    console.error("Error loading slots:", e);
    newSlotId.innerHTML = '<option value="">Error loading slots</option>';
  }
}

function openStatusModal(appointmentId) {
  currentAppointmentId = appointmentId;
  const appointment = appointments.find((a) => a.id == appointmentId);
  if (appointment) statusSelect.value = appointment.status;
  statusModal.style.display = "flex";
}

function closeAllModals() {
  adminModal.style.display = "none";
  reassignModal.style.display = "none";
  statusModal.style.display = "none";
}

async function updateAppointmentStatus() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${currentAppointmentId}/status`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status: statusSelect.value }),
      }
    );
    if (response.ok) {
      closeAllModals();
      await loadAppointments();
      alert("Appointment status updated successfully");
    } else {
      const t = await response.text();
      console.error("Failed to update status", response.status, t);
      alert("Failed to update appointment status");
    }
  } catch (error) {
    console.error("Error updating appointment status:", error);
    alert("Failed to update appointment status");
  }
}

async function deleteAppointment(id) {
  if (!confirm("Delete this appointment?")) return;
  try {
    const res = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) {
      await loadAppointments();
      alert("Appointment deleted");
    } else {
      const t = await res.text();
      console.error("Failed to delete appointment", res.status, t);
      alert("Failed to delete appointment");
    }
  } catch (e) {
    console.error("Delete appointment error:", e);
    alert("Failed to delete appointment");
  }
}

function handleMenuItemClick(e) {
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.classList.remove("active"));
  e.currentTarget.classList.add("active");
  // Simple section visibility handling (optional extension)
  // Currently keeps single-page view; can be expanded to toggle card sections by data-section
}

async function saveAdmin() {
  const adminId = document.getElementById("adminId").value;
  const adminData = {
    name: document.getElementById("adminName").value,
    email: document.getElementById("adminEmail").value,
    mobile: document.getElementById("adminMobile").value,
  };
  const password = document.getElementById("adminPassword").value;
  if (password) adminData.password = password;

  // Client-side validation
  // const emailOk = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(adminData.email || "");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email || "");
  const mobileOk = /^\d{10}$/.test((adminData.mobile || "").trim());
  if (!emailOk) {
    alert("Please enter a valid Gmail address (must end with @gmail.com)");
    return;
  }
  if (!mobileOk) {
    alert("Please enter a valid 10-digit mobile number");
    return;
  }

  try {
    const url = adminId
      ? `${API_BASE_URL}/update/admins/${adminId}`
      : `${API_BASE_URL}/create/admins`;
    const method = adminId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(adminData),
    });

    if (response.ok) {
      closeAllModals();
      loadAdmins();
      alert(
        adminId ? "Admin updated successfully" : "Admin created successfully"
      );
    } else alert("Failed to save admin");
  } catch (error) {
    console.error("Error saving admin:", error);
    alert("Failed to save admin");
  }
}

async function deleteAdmin(adminId) {
  if (!confirm("Are you sure you want to delete this admin?")) return;
  try {
    const response = await fetch(`${API_BASE_URL}/delete/admins/${adminId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (response.ok) {
      loadAdmins();
      alert("Admin deleted successfully");
    } else alert("Failed to delete admin");
  } catch (error) {
    console.error("Error deleting admin:", error);
    alert("Failed to delete admin");
  }
}

async function reassignAppointment() {
  const selectedAdmin = document.querySelector(".admin-option.selected");
  if (!selectedAdmin) return alert("Please select an admin");
  if (!newSlotId.value) return alert("Please select a slot");

  try {
    const response = await fetch(
      `${API_BASE_URL}/appointments/${currentAppointmentId}/reassign`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          newAdminId: selectedAdmin.dataset.id,
          newSlotId: newSlotId.value,
        }),
      }
    );
    if (response.ok) {
      closeAllModals();
      loadAppointments();
      alert("Appointment reassigned successfully");
    } else alert("Failed to reassign appointment");
  } catch (error) {
    console.error("Error reassigning appointment:", error);
    alert("Failed to reassign appointment");
  }
}
async function logout() {
  try {
    const token = localStorage.getItem("authToken");

    // Optional: if using token-based logout, send it
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("http://localhost:4000/api/auth/logout", {
      method: "POST",
      headers: headers,
    });

    if (!response.ok) {
      const msg = await response.text();
      console.error("Logout failed:", response.status, msg);
      alert("Logout failed. Please try again.");
      return;
    }

    // Clear token
    localStorage.removeItem("authToken");

    // Redirect to login
    window.location.href = "./index.html";
  } catch (error) {
    console.error("Error during logout:", error);
    alert("Logout failed. Please try again.");
  }
}
