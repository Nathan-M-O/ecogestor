export function validarData(data) {
  if (typeof data !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(data + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

export function validarString(str, { min = 1, max = 200 } = {}) {
  if (typeof str !== 'string') return false;
  const t = str.trim();
  return t.length >= min && t.length <= max;
}

export function validarNumero(n, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof n !== 'number') return false;
  if (!Number.isFinite(n)) return false;
  return n >= min && n <= max;
}

export function validarEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarEnum(valor, opcoes) {
  return opcoes.includes(valor);
}