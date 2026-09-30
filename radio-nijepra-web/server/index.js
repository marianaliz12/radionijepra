// Servidor de Radio NIJEPRA: API + archivos del frontend.
const path = require('node:path');
const express = require('express');
const { db, createdAdmin, DB_FILE } = require('./db');
const { loadSession, requireAuth, requireRole, login, logout, publicUser } = require('./auth');
const { hashPassword, verifyPassword } = require('./auth-utils');
const chat = require('./chat');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Cabeceras de seguridad básicas.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'");
  next();
});

app.use(loadSession);

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (userId, stepId, action, detail = '') =>
  db.prepare('INSERT INTO activity (user_id, step_id, action, detail) VALUES (?, ?, ?, ?)')
    .run(userId, stepId, action, detail);

// ---------- Autenticación ----------
app.post('/api/login', login);
app.post('/api/logout', logout);
app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/me/password', requireAuth, (req, res) => {
  const { current, next: nextPassword } = req.body || {};
  if (!verifyPassword(String(current || ''), req.user.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  }
  if (String(nextPassword || '').length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?')
    .run(hashPassword(String(nextPassword)), req.user.id);
  res.json({ ok: true });
});

// ---------- Hoja de ruta ----------
function roadmapPayload() {
  const phases = db.prepare('SELECT * FROM phases ORDER BY position').all();
  const steps = db.prepare(`
    SELECT s.*, ud.name AS done_by_name, uv.name AS verified_by_name
    FROM steps s
    LEFT JOIN users ud ON ud.id = s.done_by
    LEFT JOIN users uv ON uv.id = s.verified_by
    ORDER BY s.position`).all();
  return phases.map(p => ({
    id: p.id, key: p.key, title: p.title, subtitle: p.subtitle, when: p.when_text, color: p.color,
    steps: steps.filter(s => s.phase_id === p.id).map(s => ({
      id: s.id, key: s.key, title: s.title, when: s.when_text, deliverable: s.deliverable, guide: s.guide,
      done: !!s.done, doneBy: s.done_by_name, doneAt: s.done_at,
      verified: !!s.verified, verifiedBy: s.verified_by_name, verifiedAt: s.verified_at,
      note: s.note, evidenceUrl: s.evidence_url
    }))
  }));
}

app.get('/api/roadmap', requireAuth, (_req, res) => res.json({ phases: roadmapPayload() }));

function getStep(req, res) {
  const step = db.prepare('SELECT * FROM steps WHERE id = ?').get(Number(req.params.id));
  if (!step) res.status(404).json({ error: 'Paso no encontrado.' });
  return step;
}

// Marcar o desmarcar un paso como completado (cualquier usuario).
app.post('/api/steps/:id/done', requireAuth, (req, res) => {
  const step = getStep(req, res); if (!step) return;
  const done = !!req.body?.done;
  if (done) {
    db.prepare('UPDATE steps SET done = 1, done_by = ?, done_at = ? WHERE id = ?').run(req.user.id, now(), step.id);
    log(req.user.id, step.id, 'completó', step.title);
  } else {
    if (step.verified && req.user.role === 'estudiante') {
      return res.status(403).json({ error: 'Este paso ya fue verificado. Pide a un coordinador que lo reabra.' });
    }
    db.prepare(`UPDATE steps SET done = 0, done_by = NULL, done_at = NULL,
                verified = 0, verified_by = NULL, verified_at = NULL WHERE id = ?`).run(step.id);
    log(req.user.id, step.id, 'reabrió', step.title);
  }
  res.json({ phases: roadmapPayload() });
});

// Verificar el entregable (coordinador o administrador).
app.post('/api/steps/:id/verify', requireRole('admin', 'coordinador'), (req, res) => {
  const step = getStep(req, res); if (!step) return;
  const verified = !!req.body?.verified;
  if (verified && !step.done) {
    return res.status(400).json({ error: 'Primero hay que marcar el paso como completado.' });
  }
  if (verified) {
    db.prepare('UPDATE steps SET verified = 1, verified_by = ?, verified_at = ? WHERE id = ?').run(req.user.id, now(), step.id);
    log(req.user.id, step.id, 'verificó', step.title);
  } else {
    db.prepare('UPDATE steps SET verified = 0, verified_by = NULL, verified_at = NULL WHERE id = ?').run(step.id);
    log(req.user.id, step.id, 'quitó la verificación de', step.title);
  }
  res.json({ phases: roadmapPayload() });
});

// Guardar nota y enlace de evidencia.
app.put('/api/steps/:id/notes', requireAuth, (req, res) => {
  const step = getStep(req, res); if (!step) return;
  const note = String(req.body?.note || '').slice(0, 2000);
  let evidenceUrl = String(req.body?.evidenceUrl || '').trim().slice(0, 500);
  if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
    return res.status(400).json({ error: 'El enlace de evidencia debe empezar por http:// o https://' });
  }
  db.prepare('UPDATE steps SET note = ?, evidence_url = ? WHERE id = ?').run(note, evidenceUrl, step.id);
  log(req.user.id, step.id, 'actualizó la evidencia de', step.title);
  res.json({ phases: roadmapPayload() });
});

// ---------- Actividad ----------
app.get('/api/activity', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT a.id, a.action, a.detail, a.created_at AS at, u.name AS user
    FROM activity a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT ?`).all(limit);
  res.json({ activity: rows });
});

// ---------- Usuarios (solo administrador) ----------
app.get('/api/users', requireRole('admin'), (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  res.json({ users });
});

app.post('/api/users', requireRole('admin'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const role = String(req.body?.role || 'estudiante');
  const password = String(req.body?.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Escribe un nombre y un correo válido.' });
  if (!['admin', 'coordinador', 'estudiante'].includes(role)) return res.status(400).json({ error: 'Rol no válido.' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña inicial debe tener al menos 8 caracteres.' });
  try {
    db.prepare('INSERT INTO users (name, email, role, password_hash, must_change) VALUES (?, ?, ?, ?, 1)')
      .run(name, email, role, hashPassword(password));
  } catch {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
  }
  log(req.user.id, null, 'creó el usuario', `${name} (${role})`);
  res.status(201).json({ ok: true });
});

app.delete('/api/users/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  const u = db.prepare('SELECT name FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  log(req.user.id, null, 'eliminó el usuario', u.name);
  res.json({ ok: true });
});

app.post('/api/users/:id/reset', requireRole('admin'), (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  const r = db.prepare('UPDATE users SET password_hash = ?, must_change = 1 WHERE id = ?')
    .run(hashPassword(password), Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'Usuario no encontrado.' });
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- Asistente ----------
app.get('/api/chat', requireAuth, (req, res) => {
  const messages = db.prepare(`SELECT role, content FROM chat_messages WHERE user_id = ?
                               ORDER BY id DESC LIMIT 30`).all(req.user.id).reverse();
  res.json({ messages, mode: process.env.ANTHROPIC_API_KEY ? 'claude' : 'faq' });
});

app.post('/api/chat', requireAuth, async (req, res) => {
  const text = String(req.body?.message || '').trim().slice(0, 1500);
  if (!text) return res.status(400).json({ error: 'Escribe una pregunta.' });
  db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)").run(req.user.id, text);
  const history = db.prepare(`SELECT role, content FROM chat_messages WHERE user_id = ?
                              ORDER BY id DESC LIMIT 12`).all(req.user.id).reverse();
  // La API exige que el primer mensaje sea del usuario.
  while (history.length && history[0].role !== 'user') history.shift();
  const reply = await chat.answer(req.user, history);
  db.prepare("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)").run(req.user.id, reply.text);
  res.json({ reply: reply.text, source: reply.source });
});

app.delete('/api/chat', requireAuth, (req, res) => {
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---------- Frontend ----------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Radio NIJEPRA en http://localhost:${PORT}`);
  console.log(`Base de datos: ${DB_FILE}`);
  console.log(`Asistente: ${process.env.ANTHROPIC_API_KEY ? 'Claude (API)' : 'preguntas frecuentes (sin clave de API)'}`);
  if (createdAdmin) {
    console.log(`Administrador inicial creado: ${createdAdmin.email} / ${createdAdmin.password}`);
    console.log('Cambia esta contraseña en el primer inicio de sesión.');
  }
});
