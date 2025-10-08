const API_BASE = "http://localhost:4000/api"; // Adjust if needed
const token = localStorage.getItem("authToken"); // saved by login.html

// Helper to add auth header
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Basic HTML escape to render notes safely
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Notes modal helpers
const notesModal = document.getElementById("notesModal");
const notesModalText = document.getElementById("notesModalText");
const notesModalClose = document.getElementById("notesModalClose");

function openNotesModal(text) {
  if (!notesModal || !notesModalText) return;
  notesModalText.textContent = text || "";
  notesModal.style.display = "flex";
  // lock scroll
  document.body.style.overflow = "hidden";
}
// Expose for inline onclick
window.openNotesModal = openNotesModal;
function closeNotesModal() {
  if (!notesModal) return;
  notesModal.style.display = "none";
  document.body.style.overflow = "";
}
if (notesModalClose) notesModalClose.addEventListener("click", closeNotesModal);
if (notesModal)
  notesModal.addEventListener("click", (e) => {
    if (e.target === notesModal) closeNotesModal();
  });
// Close on ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeNotesModal();
});

// -------------- Admin Notes (popup & actions) --------------
let currentNotesAppointmentId = null;
const adminNotesModal = document.getElementById("adminNotesModal");
const adminNotesInput = document.getElementById("adminNotesInput");
let adminNotesBackdrop = null;

function showAdminNotesModal() {
  if (!adminNotesModal) return;
  console.debug("showAdminNotesModal: opening");
  // Force a reliable centered popup without Bootstrap JS
  adminNotesModal.style.position = "fixed";
  adminNotesModal.style.inset = "0";
  adminNotesModal.style.display = "flex";
  adminNotesModal.style.alignItems = "center";
  adminNotesModal.style.justifyContent = "center";
  adminNotesModal.classList.add("show");
  adminNotesModal.style.zIndex = "2001"; // ensure above any overlays
  adminNotesModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const dlg = adminNotesModal.querySelector(".modal-dialog");
  if (dlg) dlg.classList.add("show");
  // lightweight backdrop
  adminNotesBackdrop = document.createElement("div");
  adminNotesBackdrop.className = "modal-backdrop fade show";
  adminNotesBackdrop.style.zIndex = "2000";
  document.body.appendChild(adminNotesBackdrop);
  document.body.style.overflow = "hidden";
  // wire close button (since we don't load bootstrap js)
  const closeBtn = adminNotesModal.querySelector(".btn-close");
  if (closeBtn) {
    closeBtn.onclick = hideAdminNotesModal;
  }
}

function hideAdminNotesModal() {
  if (!adminNotesModal) return;
  adminNotesModal.classList.remove("show");
  adminNotesModal.style.display = "none";
  adminNotesModal.setAttribute("aria-hidden", "true");
  const dlg = adminNotesModal.querySelector(".modal-dialog");
  if (dlg) dlg.classList.remove("show");
  if (adminNotesBackdrop) {
    adminNotesBackdrop.remove();
    adminNotesBackdrop = null;
  }
  document.body.style.overflow = "";
  document.body.classList.remove("modal-open");
  currentNotesAppointmentId = null;
}

window.openAdminNotes = function (appointmentId, existingNotes) {
  console.debug("openAdminNotes clicked", { appointmentId, existingNotes });
  currentNotesAppointmentId = appointmentId;
  if (adminNotesInput) adminNotesInput.value = existingNotes || "";
  showAdminNotesModal();
  // focus input for quick typing
  setTimeout(() => adminNotesInput && adminNotesInput.focus(), 0);
};

window.saveAdminNote = async function () {
  if (!currentNotesAppointmentId) return;
  try {
    const res = await fetch(
      `${API_BASE}/admin/appointments/${currentNotesAppointmentId}/admin-notes`,
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ adminNotes: adminNotesInput?.value || "" }),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message || "Failed to save notes");
      return;
    }
    await loadRecentAppointments();
    hideAdminNotesModal();
  } catch (e) {
    console.error(e);
  }
};

window.deleteAdminNote = async function () {
  if (!currentNotesAppointmentId) return;
  try {
    const res = await fetch(
      `${API_BASE}/admin/appointments/${currentNotesAppointmentId}/admin-notes`,
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ adminNotes: "" }),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message || "Failed to delete notes");
      return;
    }
    await loadRecentAppointments();
    hideAdminNotesModal();
  } catch (e) {
    console.error(e);
  }
};

// ------------------- Fetch Stats -------------------
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: authHeaders(),
    });
    const data = await res.json();

    document.getElementById("total-slots").textContent = data.totalSlots;
    document.getElementById("booked-appointments").textContent =
      data.bookedAppointments;
    document.getElementById("available-slots").textContent =
      data.availableSlots;
    document.getElementById("pending-appointments").textContent =
      data.pendingAppointments;
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

// ------------------- Fetch Recent Appointments -------------------
async function loadRecentAppointments() {
  try {
    const res = await fetch(`${API_BASE}/admin/recent-appointments?limit=50`, {
      headers: authHeaders(),
    });
    const appointments = await res.json();
    const tbody = document.getElementById("recent-appointments-table");
    if (!tbody) return;
    tbody.innerHTML = "";

    appointments.forEach((app) => {
      const tr = document.createElement("tr");
      const start = new Date(app.slot.startTime);
      const end = new Date(app.slot.endTime);
      const safeNotes = app.notes ? escapeHtml(app.notes) : "";
      const adminNotesSafe = escapeHtml(app.adminNotes || "");
      // Prepare raw strings for dataset
      const rawUserNotes = (app.notes ?? "").toString();
      const rawAdminNotes = (app.adminNotes ?? "").toString();
      tr.innerHTML = `
        <td>${app.user?.email || "User"}</td>
        <td>${start.toLocaleString()} - ${end.toLocaleTimeString()}</td>
        <td>${safeNotes ? `<button class=\"btn btn-light btn-sm btn-view-notes\">View</button>` : '-'}</td>
        <td>
          <div class=\"admin-notes-text\">-</div>
          <button class=\"btn btn-link p-0 btn-edit-admin-notes\" data-id=\"${app.id}\">Edit Notes</button>
        </td>
        <td><span class=\"badge ${app.status === "pending" ? "badge-pending" : "badge-approved"}\">${app.status}</span></td>`;
      // After injecting HTML, set raw strings on dataset to avoid any encoding pitfalls
      const vb = tr.querySelector('.btn-view-notes');
      if (vb) vb.dataset.notes = rawUserNotes;
      const eb = tr.querySelector('.btn-edit-admin-notes');
      if (eb) eb.dataset.notes = rawAdminNotes;
      tbody.appendChild(tr);
    });

    // Ensure the delegated listener is attached only once
    if (!tbody.__notesDelegated) {
      tbody.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.btn-view-notes');
        if (viewBtn && tbody.contains(viewBtn)) {
          try {
            // Prefer dataset (raw string). Fallback to attribute if needed.
            const text = (viewBtn.dataset.notes ?? "").toString();
            console.debug('Opening user notes modal with text:', text);
            openNotesModal(text);
          } catch (err) {
            console.error('Failed to open notes modal:', err);
          }
          return;
        }
        const editBtn = e.target.closest('.btn-edit-admin-notes');
        if (editBtn && tbody.contains(editBtn)) {
          try {
            const id = Number(editBtn.getAttribute('data-id'));
            const text = (editBtn.dataset.notes ?? "").toString();
            console.debug('Opening admin notes modal with id/text:', id, text);
            openAdminNotes(id, text);
          } catch (err) {
            console.error('Failed to open admin notes modal:', err);
          }
          return;
        }
      });
      Object.defineProperty(tbody, '__notesDelegated', { value: true, writable: false });
    }
  } catch (err) {
    console.error("Error loading recent appointments:", err);
  }
}

// ------------------- Fetch Charts -------------------
async function loadCharts() {
  try {
    const res = await fetch(`${API_BASE}/admin/charts`, {
      headers: authHeaders(),
    });
    const data = await res.json();

    // Weekly Appointments Chart
    const ctx1 = document.getElementById("weeklyAppointmentsChart").getContext("2d");
    new Chart(ctx1, {
      type: "bar",
      data: {
        labels: data.weeklyAppointments.labels,
        datasets: [
          { label: "Appointments", data: data.weeklyAppointments.data, backgroundColor: "#4361ee" },
        ],
      },
    });

    // Slot Status Chart
    const ctx2 = document.getElementById("slotStatusChart").getContext("2d");
    new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: data.slotStatus.labels,
        datasets: [
          { data: data.slotStatus.data, backgroundColor: ["#f72585", "#4cc9f0", "#ffb703"] },
        ],
      },
    });
  } catch (err) {
    console.error("Error loading charts:", err);
  }
}

// ------------------- Slot Management -------------------
document
  .getElementById("create-slot-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;

    // If the range is longer than 30 minutes, create multiple contiguous 30-min slots
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const slotMs = 30 * 60 * 1000;

    try {
      if (diffMs > slotMs) {
        if (diffMs % slotMs !== 0) {
          alert("Range must be a multiple of 30 minutes to create multiple slots.");
          return;
        }
        let created = 0,
          failed = 0;
        for (let t = new Date(start); t < end; t = new Date(t.getTime() + slotMs)) {
          const s = t.toISOString();
          const e30 = new Date(t.getTime() + slotMs).toISOString();
          const res = await fetch(`${API_BASE}/admin/slots`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ startTime: s, endTime: e30 }),
          });
          if (res.ok) created++;
          else failed++;
        }
        alert(`Created ${created} slots${failed ? `, ${failed} failed (overlap or invalid)` : ""}.`);
      } else {
        const res = await fetch(`${API_BASE}/admin/slots`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ startTime, endTime }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.message || "Error creating slot");
          return;
        }
        alert(data.message);
      }
      await loadSlots();
      document.getElementById("create-slot-form").reset();
    } catch (err) {
      console.error("Error creating slot:", err);
    }
  });

async function loadSlots(date) {
  try {
    let url = `${API_BASE}/admin/slots`;
    if (date) url += `?date=${date}`;

    const res = await fetch(url, { headers: authHeaders() });
    const slots = await res.json();

    const tbody = document.getElementById("slots-table");
    tbody.innerHTML = "";
    slots.forEach((slot) => {
      const tr = document.createElement("tr");
      const booked = !slot.isAvailable;
      tr.innerHTML = `
          <td>${new Date(slot.startTime).toLocaleDateString()}</td>
          <td>${new Date(slot.startTime).toLocaleTimeString()} - ${new Date(slot.endTime).toLocaleTimeString()}</td>
          <td>${booked ? "Booked" : "Available"}</td>
          <td>
            <button class="btn btn-sm btn-primary" ${booked ? 'disabled title="Cannot edit booked slot"' : ""} onclick="editSlot(${slot.id})">Edit</button>
            <button class="btn btn-sm btn-danger" ${booked ? 'disabled title="Cannot delete booked slot"' : ""} onclick="deleteSlot(${slot.id})">Delete</button>
          </td>
        `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading slots:", err);
  }
}

// Start Slot Management listener
document.getElementById("filter-slots-btn").addEventListener("click", () => {
  const date = document.getElementById("slot-date-filter").value;
  loadSlots(date);
});

// ------------------- Approve / Delete Appointment -------------------
async function approveAppointment(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/appointments/${id}/approve`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    if (res.ok) loadRecentAppointments();
  } catch (err) {
    console.error(err);
  }
}

async function deleteAppointment(id) {
  if (!confirm("Are you sure?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/appointments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) loadRecentAppointments();
  } catch (err) {
    console.error(err);
  }
}

// ------------------- Initialize -------------------
async function initDashboard() {
  await loadStats();
  await loadRecentAppointments();
  await loadCharts();
  await loadSlots();
}
setInterval(() => {
  loadStats();
  loadRecentAppointments();
  loadCharts();
  loadSlots();
}, 10000);
initDashboard();

// ---- Expose actions for inline buttons ----
window.editSlot = async function (id) {
  const start = prompt("Enter new start time (YYYY-MM-DDTHH:mm)");
  const end = prompt("Enter new end time (YYYY-MM-DDTHH:mm)");
  if (!start || !end) return;
  try {
    const res = await fetch(`${API_BASE}/admin/slots/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ startTime: start, endTime: end }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.message || "Failed to update slot");
    await loadSlots();
  } catch (e) {
    console.error(e);
  }
};

window.deleteSlot = async function (id) {
  if (!confirm("Delete this slot?")) return;
  try {
    const res = await fetch(`${API_BASE}/admin/slots/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) alert(data.message || "Failed to delete slot");
    await loadSlots();
  } catch (e) {
    console.error(e);
  }
};
window.logout = logout;

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
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.getElementById("sidebar");
  const content = document.getElementById("content");
  const toggleButton = document.getElementById("sidebarCollapse");

  toggleButton.addEventListener("click", function () {
    sidebar.classList.toggle("active");
    content.classList.toggle("active");
  });
});
