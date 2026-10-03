'use strict';
/*Admin Panel Page*/
function renderStats() {
  const todayISO = toISODate(new Date());
  const active = appointments.filter(isActive);
  $('#stats').innerHTML = [
    [appointments.length, 'Total appointments'],
    [appointments.filter((a) => a.status === 'Pending').length, 'Waiting for confirmation'],
    [active.filter((a) => a.date === todayISO).length, 'Appointments today'],
    [doctors.length, 'Doctors']
  ].map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('');
}
let editingPhotoId = null;
function renderAdminDoctors() {
  $('#adminDoctors').innerHTML = doctors.length
    ? doctors.map((d) => {
        if (editingPhotoId === d.id) {
          return `
            <li>
              <span class="mini-doctor">
                ${avatarHTML(d)}
                <span>${escapeHTML(d.name)}<small>${escapeHTML(d.specialty)}</small></span>
              </span>
              <form class="mini-edit-form" data-id="${d.id}">
                <div class="mini-edit-row">
                  <input type="url" class="mini-edit-input" placeholder="Paste the link here" value="${escapeHTML(d.photo || '')}">
                  <button class="btn btn-primary btn-small" type="submit">Save</button>
                  <button class="btn btn-ghost btn-small" type="button" data-action="cancel-edit-photo">Cancel</button>
                </div>
                <div class="mini-edit-preview">
                  <img class="mini-edit-preview-img" id="editPreview-${d.id}" alt="" ${d.photo ? `src="${escapeHTML(d.photo)}"` : 'hidden'}>
                  <small id="editStatus-${d.id}">${d.photo ? '' : 'Previou here'}</small>
                </div>
              </form>
            </li>`;
        }
        return `
          <li>
            <span class="mini-doctor">
              ${avatarHTML(d)}
              <span>${escapeHTML(d.name)}<small>${escapeHTML(d.specialty)}</small></span>
            </span>
            <span class="mini-actions">
              <button class="btn btn-ghost btn-small" type="button" data-action="edit-photo" data-id="${d.id}">Edit photo</button>
              <button class="btn btn-danger-text" type="button" data-action="remove-doctor" data-id="${d.id}">Remove</button>
            </span>
          </li>`;
      }).join('')
    : '<li>No doctors yet.</li>';
}
function renderAdminOffDays() {
  const rows = doctors.flatMap((d) => offDaysFor(d.id).map((o) => ({ doctor: d, ...o })))
    .sort((a, b) => a.date.localeCompare(b.date));
  $('#adminOffDays').innerHTML = rows.length
    ? rows.map((o) => `
        <li>
          <span>${escapeHTML(o.doctor.name)} - ${escapeHTML(formatDate(o.date))}${o.reason ? `<small>${escapeHTML(o.reason)}</small>` : ''}</span>
          <button class="btn btn-danger-text" type="button" data-action="clear-off" data-id="${o.doctor.id}" data-date="${o.date}">Clear</button>
        </li>`).join('')
    : '<li>No emergency notices posted.</li>';
}
function renderAdminTable() {
  const rows = [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  $('#adminTable').innerHTML = rows.length
    ? rows.map((a) => `
        <tr>
          <td>${escapeHTML(a.name)}</td>
          <td>${escapeHTML(a.phone)}</td>
          <td>${escapeHTML(a.doctorName)}</td>
          <td>${escapeHTML(formatDate(a.date))}</td>
          <td>${escapeHTML(a.time)}</td>
          <td>
            <select data-status-id="${a.id}" aria-label="Status for ${escapeHTML(a.name)}">
              ${['Pending', 'Confirmed', 'Cancelled'].map((s) => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td><button class="btn btn-danger-text" type="button" data-action="delete-appt" data-id="${a.id}">Delete</button></td>
        </tr>`).join('')
    : '<tr><td colspan="7">No appointments yet.</td></tr>';
}
function renderDayChecks() {
  $('#dayChecks').innerHTML = DAYS.map((d) => `
    <label>
      <input type="checkbox" value="${d}" ${DEFAULT_WORKING_DAYS.includes(d) ? 'checked' : ''}>
      <span>${d}</span>
    </label>`).join('');
}
function renderAll() {
  renderStats();
  renderAdminDoctors();
  renderAdminOffDays();
  renderAdminTable();
}
function handleAddDoctor(event) {
  event.preventDefault();
  const error = $('#addDoctorError');
  const name = $('#dName').value.trim();
  const specialty = $('#dSpecialty').value.trim();
  const start = $('#dStart').value;
  const end = $('#dEnd').value;
  const days = $$('#dayChecks input:checked').map((c) => c.value);
  let message = '';
  if (name.length < 3) message = 'Enter the doctor\'s name.';
  else if (!specialty) message = 'Enter a specialty.';
  else if (!start || !end || timeToMinutes(end) - timeToMinutes(start) < SLOT_MINUTES) message = 'End time must be at least 30 minutes after the start time.';
  else if (!days.length) message = 'Select at least one working day.';
  error.textContent = message;
  if (message) return;
  const fullName = /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
  doctors.push({
    id: doctors.reduce((max, d) => Math.max(max, d.id), 0) + 1,
    name: fullName,
    specialty,
    degree: $('#dDegree').value.trim(),
    experience: Number($('#dExp').value) || 0,
    fee: Number($('#dFee').value) || 0,
    days: DAYS.filter((d) => days.includes(d)),
    start,
    end,
    photo: $('#dPhoto').value.trim()
  });
  writeStorage(KEYS.doctors, doctors);
  event.target.reset();
  renderDayChecks();
  renderAll();
  showToast(`${fullName} added.`);
}
async function resetDemoData() {
  if (!confirm('Delete all appointments, off-day notices, and restore the original doctor list?')) return;
  try {
    localStorage.removeItem(KEYS.doctors);
    localStorage.removeItem(KEYS.appointments);
    localStorage.removeItem(KEYS.offDays);
  } catch {
    // ignore
  }
  appointments = [];
  offDays = {};
  doctors = await loadDoctors();
  renderAll();
  showToast('Demo data restored.');
}
function setupEvents() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, date } = btn.dataset;
    if (action === 'delete-appt') {
      if (confirm('Delete this appointment permanently?')) {
        appointments = appointments.filter((a) => a.id !== Number(id));
        writeStorage(KEYS.appointments, appointments);
        renderAll();
        showToast('Appointment deleted.');
      }
    } else if (action === 'edit-photo') {
      editingPhotoId = Number(id);
      renderAdminDoctors();
    } else if (action === 'cancel-edit-photo') {
      editingPhotoId = null;
      renderAdminDoctors();
    } else if (action === 'remove-doctor') {
      const doc = getDoctor(id);
      if (doc && confirm(`Remove ${doc.name}? Their existing appointments stay in the list.`)) {
        doctors = doctors.filter((d) => d.id !== Number(id));
        delete offDays[id];
        writeStorage(KEYS.doctors, doctors);
        saveOffDays();
        renderAll();
        showToast(`${doc.name} removed.`);
      }
    } else if (action === 'clear-off') {
      offDays[id] = offDaysFor(id).filter((o) => o.date !== date);
      saveOffDays();
      renderAll();
      showToast('Emergency notice cleared.');
    } else if (action === 'reset-data') {
      resetDemoData();
    } else if (action === 'logout-admin') {
      logoutAdmin();
    }
  });
  document.addEventListener('input', (e) => {
    const input = e.target.closest('.mini-edit-input');
    if (!input) return;
    const id = input.closest('.mini-edit-form').dataset.id;
    const img = document.getElementById(`editPreview-${id}`);
    const status = document.getElementById(`editStatus-${id}`);
    const url = input.value.trim();
    if (!url) {
      img.hidden = true;
      status.textContent = 'Previou here';
      return;
    }
    status.textContent = 'Loading...';
    img.onload = () => { img.hidden = false; status.textContent = '✓ Picture founded — Save it'; };
    img.onerror = () => { img.hidden = true; status.textContent = '✗ The image cannot be found at this link — please check the link again.'; };
    img.src = url;
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.mini-edit-form');
    if (!form) return;
    e.preventDefault();
    const doc = getDoctor(form.dataset.id);
    if (!doc) return;
    doc.photo = $('.mini-edit-input', form).value.trim();
    writeStorage(KEYS.doctors, doctors);
    editingPhotoId = null;
    renderAll();
    showToast(`${doc.name}'s photo updated.`);
  });
  document.addEventListener('change', (e) => {
    const select = e.target.closest('[data-status-id]');
    if (!select) return;
    const appt = appointments.find((a) => a.id === Number(select.dataset.statusId));
    if (appt) {
      appt.status = select.value;
      writeStorage(KEYS.appointments, appointments);
      renderAll();
      showToast(`Status changed to ${appt.status}.`);
    }
  });
  $('#addDoctorForm').addEventListener('submit', handleAddDoctor);
}
async function init() {
  if (!requireAdminAuth()) return;
  await bootData();
  setupNavToggle();
  renderDayChecks();
  setupEvents();
  renderAll();
}
document.addEventListener('DOMContentLoaded', init);