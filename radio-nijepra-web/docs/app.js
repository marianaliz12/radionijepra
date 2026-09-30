// ===== Radio NIJEPRA · frontend =====
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    user: null,
    phases: [],
    activity: [],
    phaseKey: 'fase-1',
    filter: 'todos',
    open: new Set(),
    printAll: false
  };

  const ROLE_LABEL = { admin: 'Administrador', coordinador: 'Coordinador', estudiante: 'Estudiante' };
  const canVerify = () => state.user && ['admin', 'coordinador'].includes(state.user.role);

  // ---------- Utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toDate(utc) {
    if (!utc) return null;
    return new Date(utc.replace(' ', 'T') + 'Z');
  }
  function fmtDate(utc) {
    const d = toDate(utc);
    if (!d) return '';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtRelative(utc) {
    const d = toDate(utc);
    if (!d) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 7 * 86400) return `hace ${Math.floor(diff / 86400)} d`;
    return fmtDate(utc);
  }
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  function stats(steps) {
    const total = steps.length;
    const done = steps.filter(s => s.done).length;
    const verified = steps.filter(s => s.verified).length;
    return {
      total, done, verified,
      pctDone: total ? Math.round((done / total) * 100) : 0,
      pctVerified: total ? Math.round((verified / total) * 100) : 0
    };
  }
  const allSteps = () => state.phases.flatMap(p => p.steps.map(s => ({ ...s, phase: p })));

  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', isError);
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function confetti() {
    const box = $('#confetti');
    const colors = ['#F5B320', '#2F64E0', '#1E9E6A', '#E27A2E', '#1F3F8F'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('i');
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.6 + 's';
      piece.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
      box.appendChild(piece);
    }
    setTimeout(() => { box.innerHTML = ''; }, 3200);
  }

  // Aplica anchos de barras y anillos después de pintar (compatible con CSP).
  function paintMeters(root = document) {
    $$('[data-w]', root).forEach(el => { requestAnimationFrame(() => { el.style.width = el.dataset.w + '%'; }); });
    $$('circle[data-p]', root).forEach(c => {
      const r = Number(c.getAttribute('r'));
      const len = 2 * Math.PI * r;
      c.setAttribute('stroke-dasharray', String(len));
      c.setAttribute('stroke-dashoffset', String(len));
      requestAnimationFrame(() => c.setAttribute('stroke-dashoffset', String(len * (1 - Number(c.dataset.p) / 100))));
    });
  }

  // ---------- API ----------
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let data = {};
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (res.status === 401 && path !== '/api/login') {
      showLogin();
      throw new Error(data.error || 'Sesión vencida.');
    }
    if (!res.ok) throw new Error(data.error || 'Algo salió mal. Inténtalo de nuevo.');
    return data;
  }

  // ---------- Inicio de sesión ----------
  function showLogin() {
    state.user = null;
    document.body.classList.remove('is-admin');
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-form input[name=email]').focus();
  }

  async function showApp(user) {
    state.user = user;
    document.body.classList.toggle('is-admin', user.role === 'admin');
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#user-name').textContent = user.name;
    $('#user-role').textContent = ROLE_LABEL[user.role] || user.role;
    $('#user-avatar').textContent = initials(user.name);
    await loadRoadmap();
    route();
    if (user.mustChange) openForcePassword();
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const err = $('#login-error');
    err.textContent = '';
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const { user } = await api('/api/login', {
        method: 'POST',
        body: { email: f.email.value.trim(), password: f.password.value }
      });
      f.reset();
      if (!location.hash) location.hash = '#inicio';
      await showApp(user);
      loadChat();
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('.pw-toggle').addEventListener('click', e => {
    const input = e.currentTarget.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Ocultar' : 'Ver';
  });

  $('#logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* igual se cierra */ }
    $('#chat-log').innerHTML = '';
    closeChat();
    showLogin();
  });

  // Cambio obligatorio de contraseña
  function openForcePassword() {
    const dlg = $('#pw-dialog');
    dlg.addEventListener('cancel', ev => ev.preventDefault(), { once: true });
    dlg.showModal();
  }
  $('#pw-force-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const err = f.querySelector('.form-error');
    err.textContent = '';
    try {
      await api('/api/me/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
      state.user.mustChange = false;
      $('#pw-dialog').close();
      f.reset();
      toast('Contraseña actualizada. ¡Bienvenido!');
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  // ---------- Datos ----------
  async function loadRoadmap() {
    const { phases } = await api('/api/roadmap');
    state.phases = phases;
  }
  async function loadActivity(limit = 50) {
    const { activity } = await api(`/api/activity?limit=${limit}`);
    state.activity = activity;
  }

  // ---------- Enrutador ----------
  const VIEWS = { inicio: renderInicio, ruta: renderRuta, actividad: renderActividad, usuarios: renderUsuarios, cuenta: renderCuenta };

  function route() {
    if (!state.user) return;
    let [view, param] = location.hash.replace('#', '').split('/');
    if (!VIEWS[view] || (view === 'usuarios' && state.user.role !== 'admin')) view = 'inicio';
    if (view === 'ruta' && param && state.phases.some(p => p.key === param)) state.phaseKey = param;
    $$('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    VIEWS[view]();
    $('#main').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', () => { route(); window.scrollTo({ top: 0 }); });

  // ---------- Vista: Inicio ----------
  function phaseBar(s) {
    return `<div class="bar" role="img" aria-label="${s.done} de ${s.total} completados, ${s.verified} verificados">
        <i class="done" data-w="${s.pctDone}"></i><i class="verified" data-w="${s.pctVerified}"></i>
      </div>`;
  }

  async function renderInicio() {
    const main = $('#main');
    const steps = allSteps();
    const s = stats(steps);
    const next = steps.filter(x => !x.done).slice(0, 4);
    const toVerify = steps.filter(x => x.done && !x.verified);
    const first = state.user.name.split(' ')[0];

    main.innerHTML = `
      <section class="hero">
        <div class="ring" aria-label="${s.pctVerified}% verificado">
          <svg viewBox="0 0 150 150">
            <circle class="track" cx="75" cy="75" r="62"></circle>
            <circle class="done" cx="75" cy="75" r="62" data-p="${s.pctDone}"></circle>
            <circle class="verified" cx="75" cy="75" r="62" data-p="${s.pctVerified}"></circle>
          </svg>
          <div class="ring-label"><div><strong>${s.pctVerified}%</strong><small>verificado</small></div></div>
        </div>
        <div>
          <h1>¡Hola, ${esc(first)}!</h1>
          <p>Este es el avance de la hoja de ruta de Radio NIJEPRA. Cada paso se marca cuando se termina y se cierra cuando la coordinación verifica su entregable.</p>
          <div class="hero-stats">
            <div class="hero-stat"><strong>${s.verified}</strong><span>verificados</span></div>
            <div class="hero-stat"><strong>${s.done - s.verified}</strong><span>por verificar</span></div>
            <div class="hero-stat"><strong>${s.total - s.done}</strong><span>pendientes</span></div>
          </div>
        </div>
      </section>

      <div class="section-title"><h2>Las tres fases</h2><a href="#ruta" class="btn btn-ghost btn-sm">Ver hoja de ruta</a></div>
      <div class="grid-3">
        ${state.phases.map((p, i) => {
          const ps = stats(p.steps);
          return `<button class="card phase-card c-${p.color}" data-go="${p.key}">
            <span class="phase-badge">Fase ${i + 1}</span>
            <h3>${esc(p.title.replace(/^Fase \d+ · /, ''))}</h3>
            <p>${esc(p.subtitle)}</p>
            <span class="when">${esc(p.when)}</span>
            ${phaseBar(ps)}
            <div class="bar-legend"><span>${ps.verified}/${ps.total} verificados</span><span>${ps.pctDone}% hecho</span></div>
          </button>`;
        }).join('')}
      </div>

      <div class="grid-2">
        <div>
          <div class="section-title"><h2>Lo que sigue</h2></div>
          <div class="card">
            ${next.length ? `<ul class="list">${next.map(x => `
              <li><span class="dot ${x.phase.color === 'blue' ? '' : x.phase.color}">${state.phases.indexOf(x.phase) + 1}</span>
              <div><strong>${esc(x.title)}</strong><small>${esc(x.when)} · ${esc(x.deliverable)}</small></div></li>`).join('')}</ul>`
              : '<p class="empty">¡No hay pasos pendientes! 🎉</p>'}
          </div>
        </div>
        <div>
          <div class="section-title"><h2>${canVerify() ? 'Esperan tu verificación' : 'En revisión'}</h2></div>
          <div class="card">
            ${toVerify.length ? `<ul class="list">${toVerify.slice(0, 5).map(x => `
              <li><span class="dot gold">✓</span>
              <div><strong>${esc(x.title)}</strong><small>Marcado por ${esc(x.doneBy || '—')} · ${fmtRelative(x.doneAt)}</small></div></li>`).join('')}</ul>
              <a class="btn btn-ghost btn-sm" href="#ruta" data-filter="por-verificar">Revisar entregables</a>`
              : '<p class="empty">Nada pendiente de verificar.</p>'}
          </div>
        </div>
      </div>

      <div class="section-title"><h2>Actividad reciente</h2><a href="#actividad" class="btn btn-ghost btn-sm">Ver todo</a></div>
      <div class="card" id="home-activity"><p class="empty">Cargando…</p></div>
    `;
    paintMeters(main);
    $$('[data-go]', main).forEach(b => b.addEventListener('click', () => { state.filter = 'todos'; location.hash = `#ruta/${b.dataset.go}`; }));
    $$('[data-filter]', main).forEach(a => a.addEventListener('click', () => { state.filter = a.dataset.filter; }));

    try {
      await loadActivity(6);
      $('#home-activity').innerHTML = activityList(state.activity);
    } catch { /* ya se avisó */ }
  }

  // ---------- Vista: Hoja de ruta ----------
  const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  const ICON_BOX = '<svg viewBox="0 0 24 24"><path d="M4 7l8-4 8 4v10l-8 4-8-4zm8 2L6.2 6.1 4 7.2V8l8 4 8-4v-.8l-2.2-1.1z"/></svg>';

  function stepStatus(st) {
    if (st.verified) return '<span class="tag verified">✓ Verificado</span>';
    if (st.done) return '<span class="tag done">Completado · falta verificar</span>';
    return '<span class="tag pending">Pendiente</span>';
  }

  function stepCard(st, index) {
    const open = state.open.has(st.id) || state.printAll;
    const cls = st.verified ? 'is-verified is-done' : st.done ? 'is-done' : '';
    const meta = [];
    if (st.done) meta.push(`Completado por ${esc(st.doneBy || '—')} el ${fmtDate(st.doneAt)}`);
    if (st.verified) meta.push(`verificado por ${esc(st.verifiedBy || '—')} el ${fmtDate(st.verifiedAt)}`);
    const lockUncheck = st.verified && !canVerify();

    return `<li class="step ${cls}" data-id="${st.id}">
      <span class="step-num">${index + 1}</span>
      <article class="card step-card">
        <div class="step-top">
          <button class="check ${st.done ? 'on' : ''}" data-act="done" aria-pressed="${st.done}"
            aria-label="${st.done ? 'Desmarcar' : 'Marcar como completado'}: ${esc(st.title)}" ${lockUncheck ? 'disabled title="Ya fue verificado"' : ''}>${ICON_CHECK}</button>
          <div class="step-body">
            <div class="step-title"><h3>${esc(st.title)}</h3><span class="tag">${esc(st.when)}</span>${stepStatus(st)}</div>
            <div class="deliverable">${ICON_BOX}<div><span class="muted small">Entregable</span><br>${esc(st.deliverable)}</div></div>
            ${meta.length ? `<div class="step-meta">${meta.join(' · ')}</div>` : ''}
            ${st.evidenceUrl && !open ? `<a class="evidence-link" href="${esc(st.evidenceUrl)}" target="_blank" rel="noopener">📎 Ver evidencia</a>` : ''}
            <div class="step-actions">
              ${canVerify() && st.done ? `<button class="btn btn-sm ${st.verified ? 'btn-ghost' : 'btn-green'}" data-act="verify">${st.verified ? 'Quitar verificación' : '✓ Verificar entregable'}</button>` : ''}
              <button class="linkish" data-act="toggle" aria-expanded="${open}">${open ? 'Ocultar detalles' : 'Guía, notas y evidencia'}</button>
            </div>
            <div class="step-more" ${open ? '' : 'hidden'}>
              <div class="guide"><strong>¿Cómo se hace?</strong>${esc(st.guide)}</div>
              ${state.printAll ? `
                ${st.note ? `<p><strong>Notas:</strong> ${esc(st.note)}</p>` : ''}
                ${st.evidenceUrl ? `<p><strong>Evidencia:</strong> ${esc(st.evidenceUrl)}</p>` : ''}` : `
              <form class="notes-form">
                <label class="field"><span>Notas del equipo</span>
                  <textarea name="note" maxlength="2000" placeholder="¿Qué se hizo? ¿Qué falta?">${esc(st.note)}</textarea></label>
                <label class="field"><span>Enlace a la evidencia (Drive, fotos, acta…)</span>
                  <input name="evidenceUrl" type="url" placeholder="https://…" value="${esc(st.evidenceUrl)}"></label>
                <button class="btn btn-primary btn-sm" type="submit">Guardar</button>
                ${st.evidenceUrl ? `<a class="evidence-link" href="${esc(st.evidenceUrl)}" target="_blank" rel="noopener">📎 Abrir evidencia</a>` : ''}
              </form>`}
            </div>
          </div>
        </div>
      </article>
    </li>`;
  }

  function filteredSteps(steps) {
    switch (state.filter) {
      case 'pendientes': return steps.filter(s => !s.done);
      case 'por-verificar': return steps.filter(s => s.done && !s.verified);
      case 'verificados': return steps.filter(s => s.verified);
      default: return steps;
    }
  }

  function phaseBlock(p, pi) {
    const ps = stats(p.steps);
    const list = state.printAll ? p.steps : filteredSteps(p.steps);
    const complete = ps.total && ps.verified === ps.total;
    return `
      <div class="phase-head">
        <div>
          <div class="eyebrow">Fase ${pi + 1} · ${esc(p.when)}</div>
          <h2>${esc(p.title.replace(/^Fase \d+ · /, ''))}</h2>
          <p>${esc(p.subtitle)} — ${ps.verified} de ${ps.total} entregables verificados.</p>
        </div>
        ${state.printAll ? '' : `<div class="filters" role="group" aria-label="Filtrar pasos">
          ${[['todos', 'Todos'], ['pendientes', 'Pendientes'], ['por-verificar', 'Por verificar'], ['verificados', 'Verificados']]
            .map(([k, l]) => `<button class="chip ${state.filter === k ? 'active' : ''}" data-filter="${k}">${l}</button>`).join('')}
        </div>`}
      </div>
      ${complete ? '<div class="celebrate"><span>🎉</span>¡Fase completa! Todos los entregables están verificados.</div>' : ''}
      ${list.length
        ? `<ol class="steps">${list.map(st => stepCard(st, p.steps.indexOf(st))).join('')}</ol>`
        : '<div class="card"><p class="empty">No hay pasos en este filtro.</p></div>'}
    `;
  }

  function renderRuta() {
    const main = $('#main');
    const pi = Math.max(0, state.phases.findIndex(p => p.key === state.phaseKey));
    const phase = state.phases[pi];

    main.innerHTML = `
      <div class="view-head">
        <div>
          <div class="eyebrow">Hoja de ruta</div>
          <h1>Fases y entregables</h1>
          <p>Marca la casilla cuando termines un paso y deja el enlace a la evidencia. La coordinación revisa y verifica cada entregable.</p>
        </div>
        <button class="btn btn-ghost no-print" id="print-btn">🖨️ Imprimir informe</button>
      </div>
      <div class="print-only"><p class="muted">Informe generado el ${new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })} por ${esc(state.user.name)}.</p></div>
      <div class="phase-switch" role="tablist">
        ${state.phases.map((p, i) => {
          const ps = stats(p.steps);
          return `<button role="tab" aria-selected="${i === pi}" class="c-${p.color} ${i === pi ? 'active' : ''}" data-phase="${p.key}">
            <strong>${esc(p.title)}</strong><small>${ps.verified}/${ps.total} verificados · ${esc(p.when)}</small>
            ${phaseBar(ps)}
          </button>`;
        }).join('')}
      </div>
      <div id="phase-content">
        ${state.printAll ? state.phases.map((p, i) => `<section class="c-${p.color}">${phaseBlock(p, i)}</section>`).join('')
          : `<section class="c-${phase.color}">${phaseBlock(phase, pi)}</section>`}
      </div>
    `;
    paintMeters(main);

    $$('[data-phase]', main).forEach(b => b.addEventListener('click', () => { location.hash = `#ruta/${b.dataset.phase}`; }));
    $$('.chip[data-filter]', main).forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; renderRuta(); }));
    $('#print-btn').addEventListener('click', () => {
      state.printAll = true;
      renderRuta();
      setTimeout(() => { window.print(); state.printAll = false; renderRuta(); }, 150);
    });
    bindSteps(main);
  }

  function bindSteps(root) {
    $$('.step', root).forEach(li => {
      const id = Number(li.dataset.id);
      const step = allSteps().find(s => s.id === id);

      li.querySelector('[data-act=toggle]').addEventListener('click', () => {
        state.open.has(id) ? state.open.delete(id) : state.open.add(id);
        renderRuta();
      });

      li.querySelector('[data-act=done]').addEventListener('click', async () => {
        try {
          const { phases } = await api(`/api/steps/${id}/done`, { method: 'POST', body: { done: !step.done } });
          state.phases = phases;
          toast(step.done ? 'Paso reabierto.' : '¡Paso completado! Ahora falta la verificación.');
          renderRuta();
        } catch (ex) { toast(ex.message, true); }
      });

      const verifyBtn = li.querySelector('[data-act=verify]');
      if (verifyBtn) verifyBtn.addEventListener('click', async () => {
        const phaseBefore = step.phase;
        const wasComplete = stats(phaseBefore.steps).verified === phaseBefore.steps.length;
        try {
          const { phases } = await api(`/api/steps/${id}/verify`, { method: 'POST', body: { verified: !step.verified } });
          state.phases = phases;
          const after = phases.find(p => p.key === phaseBefore.key);
          const nowComplete = stats(after.steps).verified === after.steps.length;
          if (!wasComplete && nowComplete) { confetti(); toast(`🎉 ¡${after.title} completa!`); }
          else toast(step.verified ? 'Verificación retirada.' : 'Entregable verificado.');
          renderRuta();
        } catch (ex) { toast(ex.message, true); }
      });

      const form = li.querySelector('.notes-form');
      if (form) form.addEventListener('submit', async e => {
        e.preventDefault();
        try {
          const { phases } = await api(`/api/steps/${id}/notes`, {
            method: 'PUT', body: { note: form.note.value, evidenceUrl: form.evidenceUrl.value }
          });
          state.phases = phases;
          toast('Notas y evidencia guardadas.');
          renderRuta();
        } catch (ex) { toast(ex.message, true); }
      });
    });
  }

  // ---------- Vista: Actividad ----------
  const ACT_ICON = {
    'completó': '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'verificó': '<svg viewBox="0 0 24 24"><path d="M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z"/></svg>',
    'default': '<svg viewBox="0 0 24 24"><path d="M4 17.3V20h2.7l8-8-2.7-2.7zM18.7 8a1 1 0 0 0 0-1.4l-1.3-1.3a1 1 0 0 0-1.4 0l-1 1L17.7 9z"/></svg>'
  };

  function activityList(items) {
    if (!items.length) return '<p class="empty">Todavía no hay actividad. ¡Marca el primer paso!</p>';
    return `<ul class="timeline">${items.map(a => `
      <li><span class="ic ${esc(a.action.split(' ')[0])}">${ACT_ICON[a.action] || ACT_ICON.default}</span>
      <div><strong>${esc(a.user || 'Alguien')}</strong> ${esc(a.action)} <strong>${esc(a.detail)}</strong>
      <time datetime="${esc(a.at)}">${fmtRelative(a.at)}</time></div></li>`).join('')}</ul>`;
  }

  async function renderActividad() {
    const main = $('#main');
    main.innerHTML = `
      <div class="view-head"><div><div class="eyebrow">Actividad</div><h1>¿Qué ha pasado?</h1>
      <p>Registro de quién marcó, verificó o actualizó cada paso.</p></div></div>
      <div class="card" id="act-list"><p class="empty">Cargando…</p></div>`;
    try {
      await loadActivity(100);
      $('#act-list').innerHTML = activityList(state.activity);
    } catch (ex) { toast(ex.message, true); }
  }

  // ---------- Vista: Usuarios ----------
  async function renderUsuarios() {
    const main = $('#main');
    main.innerHTML = `
      <div class="view-head"><div><div class="eyebrow">Administración</div><h1>Usuarios</h1>
      <p>Crea cuentas para docentes y estudiantes. Los coordinadores pueden verificar entregables; los estudiantes pueden marcar pasos y subir evidencias.</p></div></div>
      <div class="grid-2">
        <div class="card">
          <h2>Nuevo usuario</h2>
          <form id="user-form" novalidate>
            <label class="field"><span>Nombre completo</span><input name="name" required></label>
            <label class="field"><span>Correo</span><input name="email" type="email" required placeholder="nombre@nijepra.edu.co"></label>
            <div class="form-row">
              <label class="field"><span>Rol</span>
                <select name="role"><option value="estudiante">Estudiante</option><option value="coordinador">Coordinador</option><option value="admin">Administrador</option></select></label>
              <label class="field"><span>Contraseña temporal</span><input name="password" type="text" minlength="8" required placeholder="Mínimo 8 caracteres"></label>
            </div>
            <p class="form-error" role="alert"></p>
            <button class="btn btn-primary" type="submit">Crear usuario</button>
            <p class="muted small">La persona deberá cambiar la contraseña en su primer ingreso.</p>
          </form>
        </div>
        <div class="card"><h2>Roles</h2>
          <ul class="list">
            <li><span class="role-pill role-admin">Administrador</span><div><small>Todo: usuarios, verificación y avance.</small></div></li>
            <li><span class="role-pill role-coordinador">Coordinador</span><div><small>Marca pasos y verifica entregables.</small></div></li>
            <li><span class="role-pill role-estudiante">Estudiante</span><div><small>Marca pasos, escribe notas y sube evidencias.</small></div></li>
          </ul>
        </div>
      </div>
      <div class="section-title"><h2>Equipo</h2></div>
      <div class="card table-wrap" id="users-table"><p class="empty">Cargando…</p></div>`;

    const load = async () => {
      const { users } = await api('/api/users');
      $('#users-table').innerHTML = `<table class="table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Desde</th><th></th></tr></thead>
        <tbody>${users.map(u => `<tr data-id="${u.id}">
          <td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td>
          <td><span class="role-pill role-${esc(u.role)}">${esc(ROLE_LABEL[u.role])}</span></td>
          <td class="muted">${fmtDate(u.created_at)}</td>
          <td>${u.id === state.user.id ? '<span class="muted small">Tú</span>' : `
            <button class="btn btn-ghost btn-sm" data-act="reset">Nueva clave</button>
            <button class="btn btn-danger btn-sm" data-act="del">Eliminar</button>`}</td></tr>`).join('')}</tbody></table>`;
      $$('#users-table tr[data-id]').forEach(tr => {
        const id = Number(tr.dataset.id);
        const name = tr.querySelector('strong').textContent;
        tr.querySelector('[data-act=del]')?.addEventListener('click', async () => {
          if (!confirm(`¿Eliminar a ${name}? Su actividad se conserva sin nombre.`)) return;
          try { await api(`/api/users/${id}`, { method: 'DELETE' }); toast('Usuario eliminado.'); load(); }
          catch (ex) { toast(ex.message, true); }
        });
        tr.querySelector('[data-act=reset]')?.addEventListener('click', async () => {
          const pw = prompt(`Nueva contraseña temporal para ${name} (mínimo 8 caracteres):`);
          if (!pw) return;
          try { await api(`/api/users/${id}/reset`, { method: 'POST', body: { password: pw } }); toast('Contraseña restablecida.'); }
          catch (ex) { toast(ex.message, true); }
        });
      });
    };

    $('#user-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget;
      const err = f.querySelector('.form-error');
      err.textContent = '';
      try {
        await api('/api/users', { method: 'POST', body: Object.fromEntries(new FormData(f)) });
        f.reset();
        toast('Usuario creado.');
        load();
      } catch (ex) { err.textContent = ex.message; }
    });

    try { await load(); } catch (ex) { toast(ex.message, true); }
  }

  // ---------- Vista: Mi cuenta ----------
  function renderCuenta() {
    const u = state.user;
    $('#main').innerHTML = `
      <div class="view-head"><div><div class="eyebrow">Mi cuenta</div><h1>${esc(u.name)}</h1>
      <p>${esc(u.email)} · <span class="role-pill role-${esc(u.role)}">${esc(ROLE_LABEL[u.role])}</span></p></div></div>
      <div class="grid-2">
        <div class="card">
          <h2>Cambiar contraseña</h2>
          <form id="pw-form" novalidate>
            <label class="field"><span>Contraseña actual</span><input type="password" name="current" autocomplete="current-password" required></label>
            <label class="field"><span>Nueva contraseña</span><input type="password" name="next" autocomplete="new-password" minlength="8" required></label>
            <p class="form-error" role="alert"></p>
            <button class="btn btn-primary" type="submit">Actualizar</button>
          </form>
        </div>
        <div class="card">
          <h2>¿Cómo funciona?</h2>
          <ul class="list">
            <li><span class="dot">1</span><div><strong>Haz el trabajo del paso</strong><small>Sigue la guía de cada paso en la hoja de ruta.</small></div></li>
            <li><span class="dot">2</span><div><strong>Marca la casilla</strong><small>Deja una nota y el enlace a la evidencia.</small></div></li>
            <li><span class="dot gold">3</span><div><strong>Espera la verificación</strong><small>La coordinación revisa el entregable y lo verifica.</small></div></li>
            <li><span class="dot green">4</span><div><strong>¿Dudas?</strong><small>Pregunta al asistente con el botón amarillo.</small></div></li>
          </ul>
        </div>
      </div>`;
    $('#pw-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget;
      const err = f.querySelector('.form-error');
      err.textContent = '';
      try {
        await api('/api/me/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
        f.reset();
        toast('Contraseña actualizada.');
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  // ---------- Asistente ----------
  const chatLog = $('#chat-log');
  let chatLoaded = false;

  // Formato ligero y seguro: escapa todo y luego aplica negritas, listas y párrafos.
  function formatBot(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n');
    let html = '';
    let inList = false;
    for (const raw of lines) {
      const line = raw.trim();
      const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
      if (item) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${item[1]}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line) html += `<p>${line}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
    if (role === 'user') div.textContent = text;
    else div.innerHTML = formatBot(text);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
  }

  function greeting() {
    const name = state.user ? state.user.name.split(' ')[0] : '';
    addMsg('assistant', `¡Hola${name ? ', ' + name : ''}! Soy el asistente de Radio NIJEPRA. Pregúntame sobre las fases, los entregables, la cabina, la fibra, la UPS, la música o la licencia FM.`);
  }

  async function loadChat() {
    chatLog.innerHTML = '';
    try {
      const { messages, mode } = await api('/api/chat');
      $('#chat-mode').textContent = mode === 'claude' ? 'Con inteligencia artificial (Claude)' : 'Respuestas del proyecto';
      greeting();
      messages.forEach(m => addMsg(m.role, m.content));
      chatLoaded = true;
    } catch { /* se reintenta al abrir */ }
  }

  function openChat() {
    $('#chat-panel').hidden = false;
    $('#chat-fab').setAttribute('aria-expanded', 'true');
    if (!chatLoaded) loadChat();
    setTimeout(() => $('#chat-text').focus(), 50);
  }
  function closeChat() {
    $('#chat-panel').hidden = true;
    $('#chat-fab').setAttribute('aria-expanded', 'false');
  }

  $('#chat-fab').addEventListener('click', () => ($('#chat-panel').hidden ? openChat() : closeChat()));
  $('#chat-close').addEventListener('click', closeChat);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#chat-panel').hidden) closeChat(); });

  $('#chat-clear').addEventListener('click', async () => {
    if (!confirm('¿Borrar la conversación?')) return;
    try { await api('/api/chat', { method: 'DELETE' }); chatLog.innerHTML = ''; greeting(); } catch (ex) { toast(ex.message, true); }
  });

  async function sendChat(text) {
    text = text.trim();
    if (!text) return;
    addMsg('user', text);
    const typing = document.createElement('div');
    typing.className = 'msg bot typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    chatLog.appendChild(typing);
    chatLog.scrollTop = chatLog.scrollHeight;
    const btn = $('#chat-form button');
    btn.disabled = true;
    try {
      const { reply } = await api('/api/chat', { method: 'POST', body: { message: text } });
      typing.remove();
      addMsg('assistant', reply);
    } catch (ex) {
      typing.remove();
      addMsg('assistant', 'No pude responder en este momento. Inténtalo de nuevo en un rato.');
    } finally {
      btn.disabled = false;
    }
  }

  const chatText = $('#chat-text');
  $('#chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const t = chatText.value;
    chatText.value = '';
    chatText.style.height = '';
    sendChat(t);
  });
  chatText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat-form').requestSubmit(); }
  });
  chatText.addEventListener('input', () => {
    chatText.style.height = 'auto';
    chatText.style.height = Math.min(chatText.scrollHeight, 120) + 'px';
  });
  $$('#chat-suggest button').forEach(b => b.addEventListener('click', () => sendChat(b.textContent)));

  // ---------- Arranque ----------
  (async () => {
    try {
      const { user } = await api('/api/me');
      if (!location.hash) location.hash = '#inicio';
      await showApp(user);
      loadChat();
    } catch {
      showLogin();
    }
  })();
})();
