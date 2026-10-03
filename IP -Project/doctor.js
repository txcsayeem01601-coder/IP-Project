'use strict';/*DOCTOR Portal Page*/
let activeDoctorId = null;
function renderProfile(doctor) {
  $('#profileCard').innerHTML = `
    <div class="doctor-card" style="border:0;padding:0">
      ${avatarHTML(doctor)}
      <h3>${escapeHTML(doctor.name)}</h3>
      <p class="doctor-spec">${escapeHTML(doctor.specialty)}</p>
      <div class="doctor-info">
        ${doctor.degree ? `<span>${escapeHTML(doctor.degree)}</span>` : ''}
        <span><strong>${Number(doctor.experience) || 0} years</strong> of experience</span>
        <span>Days: <strong>${escapeHTML(doctor.days.join(', '))}</strong></span>
        <span>Hours: <strong>${escapeHTML(minutesToLabel(timeToMinutes(doctor.start)))} - ${escapeHTML(minutesToLabel(timeToMinutes(doctor.end)))}</strong></span>
        <span>Fee: <strong>Tk ${Number(doctor.fee) || 0}</strong></span>
      </div>
    </div>`;
}
function renderOffDays(doctor) {
  const todayISO = toISODate(new Date());
  const upcoming = offDaysFor(doctor.id)
    .filter((o) => o.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  $('#offDayList').innerHTML = upcoming.length
    ? upcoming.map((o) => `
        <li>
          <span>${escapeHTML(formatDate(o.date))}${o.reason ? `<small>${escapeHTML(o.reason)}</small>` : ''}</span>
          <button class="btn btn-danger-text" type="button" data-remove-off="${o.date}">Cancel notice</button>
        </li>`).join('')
    : '<li>No emergency notices posted.</li>';
}
function renderDoctorAppointments(doctor) {
  const todayISO = toISODate(new Date());
  const mine = appointments
    .filter((a) => a.doctorId === doctor.id && a.date >= todayISO)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  $('#doctorApptList').innerHTML = mine.length
    ? mine.map((a) => {
        const cls = a.status.toLowerCase();
        return `
          <li class="appt-item ${cls}">
            <div>
              <div class="appt-row">
                <span class="appt-title">${escapeHTML(a.name)}</span>
                <span class="badge ${cls}">${escapeHTML(a.status)}</span>
              </div>
              <p class="appt-meta">${escapeHTML(formatDate(a.date))}, ${escapeHTML(a.time)}</p>
              <p class="appt-meta">${escapeHTML(a.phone)}${a.reason ? ' - ' + escapeHTML(a.reason) : ''}</p>
            </div>
          </li>`;
      }).join('')
    : '<li class="empty">No upcoming appointments.</li>';
}
function renderDoctorPanel() {
  const doctor = getDoctor(activeDoctorId);
  if (!doctor) {
    $('#doctorPanel').hidden = true;
    return;
  }
  $('#doctorPanel').hidden = false;
  renderProfile(doctor);
  renderOffDays(doctor);
  renderDoctorAppointments(doctor);
}
function handleAddOffDay(event) {
  event.preventDefault();
  const doctor = getDoctor(activeDoctorId);
  if (!doctor) return;
  const date = $('#offDate').value;
  const todayISO = toISODate(new Date());
  let message = '';
  if (!date) message = 'Pick a date.';
  else if (date < todayISO) message = 'Choose today or a future date.';
  else if (isDoctorOff(doctor.id, date)) message = 'A notice already exists for this date.';
  $('[data-error-for="offDate"]').textContent = message;
  if (message) return;
  offDays[doctor.id] = [...offDaysFor(doctor.id), { date, reason: $('#offReason').value.trim() }];
  saveOffDays();
  event.target.reset();
  renderOffDays(doctor);
  showToast(`Emergency notice posted for ${formatDate(date)}.`);
}
function handleRemoveOffDay(date) {
  const doctor = getDoctor(activeDoctorId);
  if (!doctor) return;
  offDays[doctor.id] = offDaysFor(doctor.id).filter((o) => o.date !== date);
  saveOffDays();
  renderOffDays(doctor);
  showToast('Emergency notice cancelled.');
}
function setupEvents() {
  $('#offDayForm').addEventListener('submit', handleAddOffDay);
  $('#offDayList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-off]');
    if (btn) handleRemoveOffDay(btn.dataset.removeOff);
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="logout-doctor"]')) logoutDoctor();
  });
}
async function init() {
  await bootData();
  if (!requireDoctorAuth()) return;
  setupNavToggle();
  setupEvents();
  activeDoctorId = readStorage(KEYS.activeDoctor, null);
  const doctor = getDoctor(activeDoctorId);
  if (doctor) $('#doctorGreeting').textContent = `Signed in as ${doctor.name} (${doctor.specialty})`;
  renderDoctorPanel();
  $('#offDate').min = toISODate(new Date());
}
document.addEventListener('DOMContentLoaded', init);