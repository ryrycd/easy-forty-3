export function normalizeUS(phoneRaw) {
  if (!phoneRaw) return null;
  const digits = String(phoneRaw).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('1') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length >= 11 && String(phoneRaw).startsWith('+')) return String(phoneRaw);
  return null;
}
export function validHandle(h) {
  if (!h) return false;
  if (/^@?[A-Za-z0-9_.-]{3,32}$/.test(h)) return true;
  if (/^[A-Za-z ]{2,60}$/.test(h)) return true;
  return false;
}
