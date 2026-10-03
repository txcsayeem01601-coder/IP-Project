'use strict';
/*Admin Login Page*/
function handleAdminLogin(event) {
  event.preventDefault();
  const username = $('#aUsername').value.trim();
  const password = $('#aPassword').value;
  const error = $('#loginError');
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    writeStorage(KEYS.adminAuth, true);
    window.location.href = 'admin.html';
  } else {
    error.textContent = 'Incorrect username or password.';
  }
}
function init() {
  setupNavToggle();
  if (isAdminAuthed()) {
    window.location.href = 'admin.html';
    return;
  }
  $('#adminLoginForm').addEventListener('submit', handleAdminLogin);
}
document.addEventListener('DOMContentLoaded', init);
