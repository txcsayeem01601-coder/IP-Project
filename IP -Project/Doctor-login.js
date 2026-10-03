'use strict';
/*Doctor Login Page*/
function populateLoginSelect() {
  const select = $('#lDoctor');
  select.innerHTML = '<option value="">Select your name</option>' +
    doctors.map((d) => `<option value="${d.id}">${escapeHTML(d.name)} - ${escapeHTML(d.specialty)}</option>`).join('');
}
function handleDoctorLogin(event) {
  event.preventDefault();
  const id = $('#lDoctor').value;
  const pin = $('#lPin').value.trim();
  const error = $('#loginError');
  const doctor = getDoctor(id);
  if (!doctor) {
    error.textContent = 'Select your name.';
    return;
  }
  if (!pin || pin !== String(doctor.pin || '')) {
    error.textContent = 'Incorrect PIN.';
    return;
  }
  writeStorage(KEYS.doctorAuth, true);
  writeStorage(KEYS.activeDoctor, doctor.id);
  window.location.href = 'doctor.html';
}
async function init() {
  await bootData();
  setupNavToggle();
  if (isDoctorAuthed()) {
    window.location.href = 'doctor.html';
    return;
  }
  populateLoginSelect();
  $('#doctorLoginForm').addEventListener('submit', handleDoctorLogin);
}
document.addEventListener('DOMContentLoaded', init);
