'use strict';/*USER (PATIENT) PAGE*/
function renderBoard() {
  const list = $('#nextBoard');
  if (!doctors.length) {
    list.innerHTML = '<li class="board-empty">No doctors available yet.</li>';
    return;
  }
  list.innerHTML = doctors.slice(0, 4).map((doc) => {
    const next = nextAvailable(doc);
    if (!next) {
      return `<li>
        <span class="board-doc">${escapeHTML(doc.name)}</span>
        <span class="board-meta">No free slots in the next 14 days</span>
      </li>`;
    }
    return `<li>
      <span class="board-doc">${escapeHTML(doc.name)}</span>
      <span class="board-meta">${escapeHTML(doc.specialty)} - ${escapeHTML(formatDate(next.date))}, ${escapeHTML(next.time)}</span>
      <button class="btn btn-primary btn-small" type="button"
        data-action="book" data-id="${doc.id}" data-date="${next.date}" data-time="${escapeHTML(next.time)}">Book</button>
    </li>`;
  }).join('');
}
function renderSpecialtyFilter() {
  const select = $('#specialtyFilter');
  const current = select.value;
  const specialties = [...new Set(doctors.map((d) => d.specialty))].sort();
  select.innerHTML = '<option value="">All specialties</option>' +
    specialties.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
  select.value = specialties.includes(current) ? current : '';
}
function renderDoctors() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const specialty = $('#specialtyFilter').value;
  const result = doctors.filter((d) =>
    (!specialty || d.specialty === specialty) &&
    (!query || `${d.name} ${d.specialty}`.toLowerCase().includes(query))
  );
  const grid = $('#doctorGrid');
  if (!result.length) {
    grid.innerHTML = '<p class="empty">No doctors match your search. Try a different name or specialty.</p>';
    return;
  }
  const todayISO = toISODate(new Date());
  grid.innerHTML = result.map((d) => `
    <article class="doctor-card">
      ${avatarHTML(d)}
      <h3>${escapeHTML(d.name)}</h3>
      <p class="doctor-spec">${escapeHTML(d.specialty)}${isDoctorOff(d.id, todayISO) ? ' <span class="badge cancelled">On leave today</span>' : ''}</p>
      <div class="doctor-info">
        ${d.degree ? `<span>${escapeHTML(d.degree)}</span>` : ''}
        <span><strong>${Number(d.experience) || 0} years</strong> of experience</span>
        <span>Days: <strong>${escapeHTML(d.days.join(', '))}</strong></span>
        <span>Hours: <strong>${escapeHTML(minutesToLabel(timeToMinutes(d.start)))} - ${escapeHTML(minutesToLabel(timeToMinutes(d.end)))}</strong></span>
        <span>Fee: <strong>Tk ${Number(d.fee) || 0}</strong></span>
      </div>
      <button class="btn btn-primary" type="button" data-action="book" data-id="${d.id}">Book with ${escapeHTML(d.name.split(' ').slice(0, 2).join(' '))}</button>
    </article>
  `).join('');
}
function renderDoctorSelect() {
  const select = $('#pDoctor');
  const current = select.value;
  select.innerHTML = '<option value="">Select a doctor</option>' +
    doctors.map((d) => `<option value="${d.id}">${escapeHTML(d.name)} - ${escapeHTML(d.specialty)}</option>`).join('');
  select.value = getDoctor(current) ? current : '';
}
function setDateLimits() {
  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + 60);
  $('#pDate').min = toISODate(today);
  $('#pDate').max = toISODate(max);
}
function updateSlots() {
  const doctor = getDoctor($('#pDoctor').value);
  const date = $('#pDate').value;
  const select = $('#pTime');
  const hint = $('#slotHint');
  const previous = select.value;
  hint.textContent = '';
  if (!doctor || !date) {
    select.disabled = true;
    select.innerHTML = '<option value="">Select a doctor and date first</option>';
    return;
  }
  if (!doctor.days.includes(dayName(date))) {
    select.disabled = true;
    select.innerHTML = '<option value="">No slots on this day</option>';
    hint.textContent = `${doctor.name} sees patients on: ${doctor.days.join(', ')}.`;
    return;
  }
  if (isDoctorOff(doctor.id, date)) {
    select.disabled = true;
    select.innerHTML = '<option value="">Doctor unavailable this day</option>';
    hint.textContent = `${doctor.name} posted an emergency notice for this date. Please pick another date.`;
    return;
  }
  const slots = freeSlots(doctor, date);
  if (!slots.length) {
    select.disabled = true;
    select.innerHTML = '<option value="">All slots are taken</option>';
    hint.textContent = 'Try another date.';
    return;
  }
  select.disabled = false;
  select.innerHTML = '<option value="">Select a time</option>' +
    slots.map((s) => `<option value="${escapeHTML(s.label)}">${escapeHTML(s.label)}</option>`).join('');
  if (slots.some((s) => s.label === previous)) select.value = previous;
  hint.textContent = `${slots.length} free slot${slots.length === 1 ? '' : 's'} on this date.`;
}
function prefillBooking(doctorId, date, time) {
  $('#pDoctor').value = doctorId;
  if (date) $('#pDate').value = date;
  updateSlots();
  if (time) $('#pTime').value = time;
  $('#appointment').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => $('#pName').focus({ preventScroll: true }), 400);
}
function setFieldError(id, message) {
  const field = $(`#${id}`);
  const error = $(`[data-error-for="${id}"]`);
  if (field) field.classList.toggle('invalid', Boolean(message));
  if (error) error.textContent = message || '';
}
function validateBooking() {
  const name = $('#pName').value.trim();
  const phone = $('#pPhone').value.replace(/[\s-]/g, '');
  const doctorId = $('#pDoctor').value;
  const date = $('#pDate').value;
  const time = $('#pTime').value;
  let valid = true;
  const check = (id, condition, message) => {
    setFieldError(id, condition ? '' : message);
    if (!condition) valid = false;
  };
  check('pName', name.length >= 3, 'Enter the patient\'s full name.');
  check('pPhone', PHONE_PATTERN.test(phone), 'Enter a valid Bangladeshi mobile number, like 01712345678.');
  check('pDoctor', Boolean(doctorId), 'Select a doctor.');
  check('pDate', Boolean(date), 'Select a date.');
  check('pTime', Boolean(time), 'Select a time slot.');
  return valid ? { name, phone, doctorId: Number(doctorId), date, time } : null;
}
function handleBooking(event) {
  event.preventDefault();
  const data = validateBooking();
  if (!data) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }
  const doctor = getDoctor(data.doctorId);
  if (isDoctorOff(data.doctorId, data.date)) {
    showToast('That date was just marked unavailable. Please choose another date.', 'error');
    updateSlots();
    return;
  }
  if (isBooked(data.doctorId, data.date, data.time)) {
    showToast('That slot was just taken. Please choose another time.', 'error');
    updateSlots();
    return;
  }
  appointments.push({
    id: Date.now(),
    name: data.name,
    phone: data.phone,
    doctorId: data.doctorId,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date: data.date,
    time: data.time,
    reason: $('#pReason').value.trim(),
    status: 'Pending'
  });
  writeStorage(KEYS.appointments, appointments);
  writeStorage(KEYS.phone, data.phone);
  $('#bookingForm').reset();
  updateSlots();
  $$('.error[data-error-for]').forEach((el) => (el.textContent = ''));
  $$('.invalid').forEach((el) => el.classList.remove('invalid'));
  $('#lookupPhone').value = data.phone;
  renderAll();
  showToast(`Appointment booked with ${doctor.name} on ${formatDate(data.date)} at ${data.time}.`);
}
function renderLoginBar() {
  const bar = $('#userStatusBar');
  if (readStorage(KEYS.userAuth, false) === true) {
    const name = readStorage(KEYS.userName, '');
    bar.innerHTML = `<p class="hint">Welcome back${name ? ', ' + escapeHTML(name) : ''}. <button class="btn btn-ghost btn-small" type="button" data-action="logout-user">Log out</button></p>`;
  } else {
    bar.innerHTML = '<p class="hint"><a href="user-login.html">Log in</a> to see your appointments faster next time.</p>';
  }
}
function renderPatient() {
  const list = $('#patientList');
  const phone = $('#lookupPhone').value.replace(/[\s-]/g, '');

  if (!phone) {
    list.innerHTML = '<li class="empty">Enter your mobile number to see your appointments.</li>';
    return;
  }
  const mine = appointments
    .filter((a) => a.phone === phone)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!mine.length) {
    list.innerHTML = '<li class="empty">No appointments found for this number. Book one above.</li>';
    return;
  }
  list.innerHTML = mine.map((a) => {
    const cls = a.status.toLowerCase();
    return `
      <li class="appt-item ${cls}">
        <div>
          <div class="appt-row">
            <span class="appt-title">${escapeHTML(a.doctorName)}</span>
            <span class="badge ${cls}">${escapeHTML(a.status)}</span>
          </div>
          <p class="appt-meta">${escapeHTML(a.specialty || '')} - ${escapeHTML(formatDate(a.date))}, ${escapeHTML(a.time)}</p>
          <p class="appt-meta">Patient: ${escapeHTML(a.name)}${a.reason ? ' - ' + escapeHTML(a.reason) : ''}</p>
        </div>
        ${isActive(a)
          ? `<button class="btn btn-ghost btn-small" type="button" data-action="cancel" data-id="${a.id}">Cancel appointment</button>`
          : ''}
      </li>`;
  }).join('');
}
function renderAll() {
  renderBoard();
  renderSpecialtyFilter();
  renderDoctors();
  renderDoctorSelect();
  updateSlots();
  renderPatient();
  renderLoginBar();
}
function setupEvents() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, date, time } = btn.dataset;

    if (action === 'book') {
      prefillBooking(id, date, time);
    } else if (action === 'logout-user') {
      writeStorage(KEYS.userAuth, false);
      writeStorage(KEYS.userName, '');
      writeStorage(KEYS.phone, '');
      $('#lookupPhone').value = '';
      renderAll();
      showToast('Logged out.');
    } else if (action === 'cancel') {
      const appt = appointments.find((a) => a.id === Number(id));
      if (appt && confirm('Cancel this appointment?')) {
        appt.status = 'Cancelled';
        writeStorage(KEYS.appointments, appointments);
        renderAll();
        showToast('Appointment cancelled.');
      }
    }
  });
  $('#searchInput').addEventListener('input', renderDoctors);
  $('#specialtyFilter').addEventListener('change', renderDoctors);
  $('#pDoctor').addEventListener('change', updateSlots);
  $('#pDate').addEventListener('change', updateSlots);
  $('#bookingForm').addEventListener('submit', handleBooking);
  $('#lookupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    renderPatient();
  });
}
async function init() {
  await bootData();
  $('#lookupPhone').value = readStorage(KEYS.phone, '');
  setDateLimits();
  setupNavToggle();
  setupEvents();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);