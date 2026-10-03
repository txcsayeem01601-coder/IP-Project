'use strict';
//COMMON — for all page
const KEYS = {
  doctors: 'mc_doctors_v1',
  appointments: 'mc_appointments_v1',
  offDays: 'mc_off_days_v1',
  phone: 'mc_last_phone',
  activeDoctor: 'mc_active_doctor',
  adminAuth: 'mc_admin_auth',
  doctorAuth: 'mc_doctor_auth',
  userAuth: 'mc_user_auth',
  userName: 'mc_user_name'
};
// Demo-only credentials — this app has no backend, so this is NOT real security.
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_WORKING_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
const SLOT_MINUTES = 30;
const PHONE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;
// Used only if doctors.json cannot be loaded
const FALLBACK_DATA = {
  clinic: { name: 'MediCare Clinic', phone: '+880 1700-000000', address: 'Chattogram, Bangladesh' },
  doctors: [
    { id: 1, name: 'Dr. Rafiqul Islam', specialty: 'Cardiologist', degree: 'MBBS, FCPS (Cardiology)', experience: 14, fee: 1000, days: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'], start: '17:00', end: '20:00', photo: '', pin: '1001' },
    { id: 2, name: 'Dr. Sabrina Ahmed', specialty: 'Dermatologist', degree: 'MBBS, DDV', experience: 9, fee: 800, days: ['Sat', 'Mon', 'Wed', 'Thu'], start: '17:00', end: '21:00', photo: '', pin: '1002' }
  ]
};
// Shared app state, populated once by bootData()
let clinic = FALLBACK_DATA.clinic;
let doctors = [];
let appointments = [];
let offDays = {}; // { [doctorId]: [{ date: 'YYYY-MM-DD', reason: string }] }
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be blocked; the app still works for this session
  }
}
function pad(n) { return String(n).padStart(2, '0'); }
function toISODate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseISODate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function formatDate(iso) { return parseISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function dayName(iso) { return DAYS[parseISODate(iso).getDay()]; }
function timeToMinutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function minutesToLabel(total) {
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad(m)} ${suffix}`;
}
function makeSlots(start, end) {
  const slots = [];
  for (let t = timeToMinutes(start); t + SLOT_MINUTES <= timeToMinutes(end); t += SLOT_MINUTES) {
    slots.push({ label: minutesToLabel(t), minutes: t });
  }
  return slots;
}
function initials(name) {
  const parts = name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'DR';
}
function avatarHTML(doctor) {
  if (doctor.photo) {
    return `<img class="avatar avatar-photo" src="${escapeHTML(doctor.photo)}" data-name="${escapeHTML(doctor.name)}" alt="${escapeHTML(doctor.name)}" loading="lazy" onerror="handleAvatarError(this)">`;
  }
  return `<div class="avatar" aria-hidden="true">${escapeHTML(initials(doctor.name))}</div>`;
}
function handleAvatarError(img) {
  const div = document.createElement('div');
  div.className = 'avatar';
  div.setAttribute('aria-hidden', 'true');
  div.textContent = initials(img.dataset.name || '');
  img.replaceWith(div);
}
function getDoctor(id) { return doctors.find((d) => d.id === Number(id)); }
function isActive(appt) { return appt.status !== 'Cancelled'; }
function isBooked(doctorId, date, timeLabel) {
  return appointments.some((a) => a.doctorId === Number(doctorId) && a.date === date && a.time === timeLabel && isActive(a));
}
//For Doctor Emergency "off day" notices.
function offDaysFor(doctorId) {
  return offDays[doctorId] || [];
}
function isDoctorOff(doctorId, iso) {
  return offDaysFor(doctorId).some((o) => o.date === iso);
}
function offReason(doctorId, iso) {
  return offDaysFor(doctorId).find((o) => o.date === iso)?.reason || '';
}
function saveOffDays() { writeStorage(KEYS.offDays, offDays); }
//Free slots for a doctor on a date.
function freeSlots(doctor, iso) {
  if (!doctor || !iso || !doctor.days.includes(dayName(iso))) return [];
  if (isDoctorOff(doctor.id, iso)) return [];
  const now = new Date();
  const isToday = iso === toISODate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return makeSlots(doctor.start, doctor.end).filter(
    (s) => !isBooked(doctor.id, iso, s.label) && (!isToday || s.minutes > nowMinutes)
  );
}
// Looks up to 14 days ahead for the first free slot
function nextAvailable(doctor) {
  const day = new Date();
  for (let i = 0; i < 14; i++) {
    const iso = toISODate(day);
    const slots = freeSlots(doctor, iso);
    if (slots.length) return { date: iso, time: slots[0].label };
    day.setDate(day.getDate() + 1);
  }
  return null;
}
let toastTimer;
function showToast(message, type = 'ok') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
//Loading & startup shared by every page.
async function loadDoctors() {
  const saved = readStorage(KEYS.doctors, null);
  if (Array.isArray(saved)) return saved;
  try {
    const response = await fetch('doctors.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    clinic = data.clinic || clinic;
    return data.doctors;
  } catch (err) {
    console.warn('Could not load doctors.json, using built-in data.', err);
    return FALLBACK_DATA.doctors;
  }
}
// Loads shared state and fills
async function bootData() {
  appointments = readStorage(KEYS.appointments, []);
  offDays = readStorage(KEYS.offDays, {});
  doctors = await loadDoctors();
  const nameEl = $('#clinicName');
  const contactEl = $('#clinicContact');
  if (nameEl) nameEl.textContent = clinic.name;
  if (contactEl) contactEl.textContent = `${clinic.phone} | ${clinic.address}`;
}
// Auth guards — client-side only, demo-grade (no backend / no real security)
function isAdminAuthed() { return readStorage(KEYS.adminAuth, false) === true; }
function requireAdminAuth() {
  if (!isAdminAuthed()) { window.location.href = 'admin-login.html'; return false; }
  return true;
}
function logoutAdmin() { writeStorage(KEYS.adminAuth, false); window.location.href = 'admin-login.html'; }
function isDoctorAuthed() {
  return readStorage(KEYS.doctorAuth, false) === true && Boolean(getDoctor(readStorage(KEYS.activeDoctor, null)));
}
function requireDoctorAuth() {
  if (!isDoctorAuthed()) { window.location.href = 'doctor-login.html'; return false; }
  return true;
}
function logoutDoctor() {
  writeStorage(KEYS.doctorAuth, false);
  writeStorage(KEYS.activeDoctor, null);
  window.location.href = 'doctor-login.html';
}
// Mobile hamburger menu, shared markup/behaviour on every page
function setupNavToggle() {
  const toggle = $('#menuToggle');
  const nav = $('#mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}