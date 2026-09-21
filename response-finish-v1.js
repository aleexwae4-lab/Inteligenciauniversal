/* Scoped enhancement: preserve Universal Core's existing layout and runtime. */
(() => {
  'use strict';
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  if (typeof window === 'undefined' || window.__waeResponseFinishV1) return;
  let active = null, serial = 0, queued = false;
  const root = () => document.getElementById('messages');
  const body = a => a.querySelector('.rich-content, .rich-answer, .assistant-body');
  const notify = m => window.toast?.(m);
  function textOf(a) {
    const n = body(a)?.cloneNode(true);
    if (!n) return '';
    n.querySelectorAll('button, .iu-code-head, .wae-table-toolbar, .wae-code-toolbar').forEach(e => e.remove());
    return String(n.textContent || '').trim();
  }
  function renderMobile(a) {
    const n = a.querySelector('.assistant-body');
    if (!n || n.children.length || document.documentElement.dataset.aiBusy === 'true') return;
    const t = n.textContent || '';
    if (!/(^|\n)\s*(#{1,4}\s|\|.+\||[-*]\s|:::)|\*\*[^*]+\*\*|\x60{3}/.test(t)) return;
    if (typeof window.__waeRich?.render !== 'function') return;
    n.innerHTML = window.__waeRich.render(t);
    n.style.whiteSpace = 'normal';
  }
  function sync() {
    root()?.querySelectorAll('[data-wae-finish="voice"]').forEach(b => {
      const mine = active?.article === b.closest('.message.assistant, .turn.assistant');
      const label = !mine ? 'Escuchar' : active.mode === 'paused' ? 'Continuar' : active.mode === 'cloud' ? 'Detener' : 'Pausar';
      if (b.textContent !== label) b.textContent = label;
      b.setAttribute('aria-label', label + ' respuesta');
      b.setAttribute('aria-pressed', String(Boolean(mine)));
    });
  }
  function stop() {
    serial++;
    try { window.speechSynthesis?.cancel(); } catch {}
    try { window.__waeVoice?.stop?.(); } catch {}
    active = null; sync();
  }
  function speak(a) {
    if (active?.article === a) {
      if (active.mode === 'cloud') return stop();
      if (active.mode === 'paused') {
        try { window.speechSynthesis.resume(); active.mode = 'speaking'; } catch { stop(); }
      } else {
        try {
          window.speechSynthesis.pause();
          if (window.speechSynthesis.paused) active.mode = 'paused';
          else { stop(); notify('La pausa no está disponible; toca Escuchar para reiniciar'); }
        } catch { stop(); }
      }
      sync(); return;
    }
    const value = textOf(a).replace(/\x60{3}[\s\S]*?\x60{3}/g, ' código disponible ')
      .replace(/https?:\/\/\S+/g, ' enlace disponible ').replace(/[#*_~|<>]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!value) return notify('La respuesta no contiene texto para leer');
    stop();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      const cloud = window.__waeVoice;
      if (!cloud?.speak) return notify('La voz no está disponible en este dispositivo');
      active = { article: a, mode: 'cloud' }; sync();
      Promise.resolve(cloud.speak(value, { force: true })).catch(() => notify('No se pudo reproducir la voz'))
        .finally(() => { if (active?.article === a && active.mode === 'cloud') { active = null; sync(); } });
      return;
    }
    const synth = window.speechSynthesis, id = serial, chunks = value.match(/[\s\S]{1,210}/g) || [];
    const voices = synth.getVoices();
    const voice = voices.find(v => /^es[-_]MX$/i.test(v.lang)) || voices.find(v => /^es[-_]/i.test(v.lang));
    active = { article: a, mode: 'speaking' }; sync();
    function next(i) {
      if (id !== serial) return;
      if (i >= chunks.length) { active = null; sync(); return; }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = 'es-MX'; u.rate = 1;
      if (voice) u.voice = voice;
      u.onend = () => next(i + 1);
      u.onerror = e => {
        if (id !== serial) return;
        active = null; sync();
        if (!['canceled', 'interrupted'].includes(e.error)) notify('No se pudo reproducir la voz');
      };
      try { synth.speak(u); } catch { active = null; sync(); notify('La voz no está disponible'); }
    }
    next(0);
  }
  async function copy(a) {
    const value = textOf(a);
    if (!value) return notify('No hay contenido para copiar');
    try { await navigator.clipboard.writeText(value); notify('Respuesta copiada'); }
    catch {
      const el = document.createElement('textarea');
      el.value = value; el.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(el); el.select();
      const ok = document.execCommand?.('copy'); el.remove();
      notify(ok ? 'Respuesta copiada' : 'No se pudo copiar la respuesta');
    }
  }
  function workspace(a) {
    const editor = document.getElementById('documentEditor'), n = body(a);
    if (!editor || !n) return notify('Workspace no disponible');
    const section = document.createElement('section'), clone = n.cloneNode(true);
    section.className = 'workspace-ai-block';
    clone.querySelectorAll('script, style, link, iframe, object, embed, form, input, button, svg').forEach(e => e.remove());
    clone.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || (['href','src','xlink:href'].includes(attr.name.toLowerCase()) && !/^(https?:|mailto:|#)/i.test(attr.value.trim()))) el.removeAttribute(attr.name);
      });
    });
    section.append(...clone.childNodes);
    editor.querySelector('.placeholder-line')?.remove();
    editor.appendChild(section);
    const state = document.getElementById('saveState');
    if (state) state.textContent = 'Cambios sin guardar';
    document.getElementById('workspaceBtn')?.click();
    notify('Respuesta enviada al Workspace');
  }
  function enhance(a) {
    if (!body(a)) return;
    renderMobile(a);
    let bar = a.querySelector('.iu-answer-actions, .answer-actions, .actions, .wae-response-controls');
    if (!bar) { bar = document.createElement('div'); bar.className = 'wae-response-controls'; a.appendChild(bar); }
    const names = { voice: 'Escuchar', copy: 'Copiar', workspace: 'Workspace' };
    const legacy = { voice: '[data-act="listen"], .speak-answer', copy: '[data-act="copy"], .copy-answer', workspace: '[data-act="workspace"]' };
    for (const action of Object.keys(names)) {
      let b = bar.querySelector('[data-wae-finish="' + action + '"]') || bar.querySelector(legacy[action]);
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.textContent = names[action]; bar.appendChild(b); }
      b.dataset.waeFinish = action;
    }
    a.classList.add('wae-response-enhanced');
  }
  function scan() {
    queued = false;
    root()?.querySelectorAll('.message.assistant:not(#typingMessage):not(#iuLiveStream), .turn.assistant').forEach(enhance);
    sync();
  }
  function schedule() { if (!queued) { queued = true; queueMicrotask(scan); } }
  function install() {
    const r = root(); if (!r) return;
    r.addEventListener('click', e => {
      const b = e.target?.closest?.('[data-wae-finish]');
      if (!b || !r.contains(b)) return;
      const a = b.closest('.message.assistant, .turn.assistant');
      if (!a) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (b.dataset.waeFinish === 'voice') speak(a);
      if (b.dataset.waeFinish === 'copy') void copy(a);
      if (b.dataset.waeFinish === 'workspace') workspace(a);
    }, true);
    new MutationObserver(schedule).observe(r, { childList: true, subtree: true });
    window.addEventListener('wae:stream-event', e => { if (e.detail?.event === 'response.complete') schedule(); });
    window.addEventListener('pagehide', stop);
    scan();
  }
  window.__waeResponseFinishV1 = { version: 'v1', refresh: schedule, stop };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();