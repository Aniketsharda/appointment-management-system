// user.js

const slotsContainer = document.getElementById("slots-container");
const slotSelect = document.getElementById("slotId");
const bookingForm = document.getElementById("booking-form");
const bookingMessage = document.getElementById("booking-message");
const checkForm = document.getElementById("check-appointment-form");
const appointmentsList = document.getElementById("appointments-list");

// API endpoint base
const API_BASE = "http://localhost:4000/api"; // adjust to your backend

// Utilities for formatting time without seconds
function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  const d = new Date(value);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Load available slots
async function loadSlots() {
  try {
    const res = await fetch(`${API_BASE}/users/slots`);
    const data = await res.json();

    if (!data.length) {
      slotsContainer.innerHTML = "<p>No slots available</p>";
      slotSelect.innerHTML = "<option value=''>No slots available</option>";
      return;
    }

    // Display slots as cards (do not show admin or slot id)
    slotsContainer.innerHTML = data
      .map(
        (slot) => `
            <div class="card">
                <div class="card-header">${formatDateTime(slot.startTime)}</div>
                <div class="card-body">
                    <p class="slot-time">${formatDateTime(
                      slot.startTime
                    )} - ${formatTime(slot.endTime)}</p>
                </div>
                <div class="card-footer">
                  <button class="btn btn-accent" onclick="window.selectSlot(${
                    slot.id
                  })">Book this slot</button>
                </div>
            </div>
        `
      )
      .join("");

    // Populate slot select dropdown
    slotSelect.disabled = false;
    slotSelect.innerHTML =
      `<option value="">Select a slot</option>` +
      data
        .map(
          (slot) =>
            `<option value="${slot.id}">${formatDateTime(
              slot.startTime
            )}</option>`
        )
        .join("");
  } catch (err) {
    console.error(err);
    slotsContainer.innerHTML = "<p>Error loading slots</p>";
    slotSelect.innerHTML = "<option value=''>Error loading slots</option>";
  }
}

// Handle booking form submission
bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const slotId = slotSelect.value;
  const notes = (document.getElementById("notes")?.value || "").trim();

  // Validation rules
  const emailOk = !email || /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
  const mobileOk = !mobile || /^\d{10}$/.test(mobile);

  if ((!email && !mobile) || !slotId) {
    bookingMessage.innerHTML = `<div class="message message-error">Please provide email or mobile and select a slot</div>`;
    return;
  }

  if (!emailOk) {
    bookingMessage.innerHTML = `<div class="message message-error">Please enter a valid Gmail address (must end with @gmail.com)</div>`;
    return;
  }
  if (!mobileOk) {
    bookingMessage.innerHTML = `<div class="message message-error">Please enter a valid 10-digit mobile number</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/bookappointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mobile, slotId, notes }),
    });

    const data = await res.json();

    if (res.ok) {
      bookingMessage.innerHTML = `<div class="message message-success">${data.message}</div>`;
      bookingForm.reset();
      await loadSlots();
    } else {
      bookingMessage.innerHTML = "";
    }
  } catch (err) {
    console.error(err);
    bookingMessage.innerHTML = "";
  }
});

// Handle check appointments
checkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("check-email").value.trim();
  const mobile = document.getElementById("check-mobile").value.trim();

  // Validation rules (email/mobile optional but must be valid if provided)
  const emailOk = !email || /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
  const mobileOk = !mobile || /^\d{10}$/.test(mobile);

  if (!email && !mobile) {
    appointmentsList.innerHTML = "<p>Please enter email or mobile.</p>";
    return;
  }

  if (!emailOk) {
    appointmentsList.innerHTML =
      "<p>Please enter a valid Gmail address (must end with @gmail.com)</p>";
    return;
  }
  if (!mobileOk) {
    appointmentsList.innerHTML =
      "<p>Please enter a valid 10-digit mobile number</p>";
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/users/appointments?email=${email}&mobile=${mobile}`
    );
    const data = await res.json();

    if (!data.length) {
      appointmentsList.innerHTML = "<p>No appointments found.</p>";
      return;
    }

    appointmentsList.innerHTML = data
      .map(
        (app) => `
            <div class="appointment-item">
                <div class="appointment-details">
                    <h4>${new Date(app.slotTime).toLocaleString()}</h4>
                    <p>Status: <span class="appointment-status ${
                      app.status === "approved"
                        ? "status-approved"
                        : "status-pending"
                    }">${app.status}</span></p>
                </div>
            </div>
        `
      )
      .join("");
  } catch (err) {
    console.error(err);
    appointmentsList.innerHTML = "<p>Error fetching appointments</p>";
  }
});

// Initialize
loadSlots();
// setInterval(() => {
//   loadSlots();
// }, 20000);

// Helper to select slot from card button and scroll to booking form
window.selectSlot = function (id) {
  const slotSelect = document.getElementById("slotId");
  if (!slotSelect) return;
  slotSelect.value = String(id);
  document
    .getElementById("book-appointment")
    ?.scrollIntoView({ behavior: "smooth" });
};
