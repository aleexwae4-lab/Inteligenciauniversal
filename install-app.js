(() => {
  'use strict';
  const NATIVE_RE = /UniversalCoreNative\//i;
  if (NATIVE_RE.test(navigator.userAgent)) return;

  let deferredPrompt = null;
  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isiOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function notify(message) {
    if (typeof window.toast === 'function') return window.toast(message);
    window.alert(message);
  }

  function injectStyle() {
    if (document.getElementById('waeInstallStyle')) return;
    const style = document.createElement('style');
    style.id = 'waeInstallStyle';
    style.textContent = `
      .wae-install-app{
        display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 11px;
        border:1px solid rgba(40,247,164,.24);border-radius:11px;
        background:linear-gradient(180deg,rgba(40,247,164,.10),rgba(40,247,164,.04));
        color:#dffcef;font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:.01em;
        box-shadow:inset 0 1px rgba(255,255,255,.04),0 8px 24px rgba(0,0,0,.18);
        cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease;
      }
      .wae-install-app:hover{transform:translateY(-1px);border-color:rgba(40,247,164,.48);background:rgba(40,247,164,.12)}
      .wae-install-app svg{width:15px;height:15px;display:block}
      @media(max-width:520px){.wae-install-app span{display:none}.wae-install-app{width:34px;padding:0;justify-content:center}}
    `;
    document.head.appendChild(style);
  }

  function buttonMarkup() {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'installAppBtn';
    button.className = 'wae-install-app';
    button.setAttribute('aria-label', 'Instalar Universal Core');
    button.title = 'Instalar Universal Core';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Instalar app</span>
    `;
    return button;
  }

  function ensureButton() {
    if (isStandalone()) return null;
    let button = document.getElementById('installAppBtn');
    if (button) return button;
    injectStyle();
    button = buttonMarkup();
    const target = document.querySelector('.top-actions') || document.querySelector('.topbar');
    if (!target) return null;
    target.insertBefore(button, target.firstChild);
    button.addEventListener('click', install);
    return button;
  }

  async function install() {
    if (isStandalone()) return notify('Universal Core ya está instalado.');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        deferredPrompt = null;
        document.getElementById('installAppBtn')?.remove();
      }
      return;
    }
    if (isiOS()) {
      return notify('En iPhone o iPad: abre Compartir y elige “Añadir a pantalla de inicio”.');
    }
    notify('Abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.');
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    ensureButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('installAppBtn')?.remove();
    notify('Universal Core quedó instalado como aplicación.');
  });

  window.addEventListener('DOMContentLoaded', () => {
    if (!isStandalone()) ensureButton();
  });
})();