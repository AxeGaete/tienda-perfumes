/* Utilidades de seguridad compartidas por la tienda y el panel de admin.
 * Todo dato que venga de la base de datos, del localStorage o del usuario
 * debe pasar por estas funciones antes de insertarse con innerHTML. */

// Imagen de reemplazo embebida (no depende de ningún servicio externo).
const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280">' +
  '<rect width="100%" height="100%" fill="#eeeeee"/>' +
  '<text x="50%" y="50%" fill="#999999" font-family="sans-serif" font-size="16" ' +
  'text-anchor="middle" dy=".3em">Perfume</text></svg>'
);

// Convierte cualquier valor en texto seguro para insertar dentro de HTML o de un atributo.
function escapeHtml(valor) {
  return String(valor === null || valor === undefined ? '' : valor).replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

// Solo deja pasar URLs https (o del mismo origen) e imágenes data: en base64.
// Cualquier otra cosa (javascript:, etc.) se reemplaza por la imagen de reemplazo.
function urlImagenSegura(url) {
  const s = String(url === null || url === undefined ? '' : url).trim();
  if (/^data:image\/(png|jpe?g|webp|avif|gif);base64,[a-z0-9+/=]+$/i.test(s)) return s;
  try {
    const u = new URL(s, window.location.origin);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && u.origin === window.location.origin)) return u.href;
  } catch (e) { /* URL inválida */ }
  return PLACEHOLDER_IMG;
}

// Fuerza un número entero (para ids y cantidades que se insertan en atributos onclick).
function enteroSeguro(valor, porDefecto) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : (porDefecto === undefined ? 0 : porDefecto);
}
