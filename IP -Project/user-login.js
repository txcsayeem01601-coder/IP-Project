'use strict';
/*Patient Login Page*/
function handleUserLogin(event) {
  event.preventDefault();
  const name = $('#uName').value.trim();
  const phone = $('#uPhone').value.replace(/[\s-]/g, '');
  const error = $('#loginError');
  if (name.length < 2) {
    error.textContent = "Enter your name.";
    return;
  }
  if (!PHONE_PATTERN.test(phone)) {
    error.textContent = 'Enter a valid Bangladeshi mobile number, like 01712345678.';
    return;
  }
  writeStorage(KEYS.userAuth, true);
  writeStorage(KEYS.userName, name);
  writeStorage(KEYS.phone, phone);
  window.location.href = 'index.html#patient';
}
function init() {
  setupNavToggle();
  $('#userLoginForm').addEventListener('submit', handleUserLogin);
}
document.addEventListener('DOMContentLoaded', init);
