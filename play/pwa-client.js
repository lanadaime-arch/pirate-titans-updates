/* PWA-only updater. Never touches the Android OTA protocol or player save keys. */
(() => {
  'use strict';
  const VERSION_URL = './version.json';
  // Replaced with release/game.json versionCode when the iPhone package is built.
  const installedVersion = 960;
  let alertVisible = false;

  const fetchVersion = async () => {
    const response = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Version indisponible');
    return response.json();
  };
  function offerUpdate(next) {
    if (alertVisible) return;
    alertVisible = true;
    const panel = document.createElement('aside');
    panel.id = 'pirate-pwa-update';
    panel.setAttribute('role', 'status');
    Object.assign(panel.style, {
      position: 'fixed', zIndex: '2147483647', left: '12px', right: '12px',
      bottom: 'calc(env(safe-area-inset-bottom) + 14px)',
      background: '#101b30', color: 'white', border: '2px solid #d7af57',
      borderRadius: '14px', padding: '12px', textAlign: 'center',
      boxShadow: '0 6px 22px #000b', fontFamily: 'system-ui,sans-serif'
    });
    const title = document.createElement('strong');
    title.textContent = 'Nouvelle version ' + next.versionName + ' disponible';
    const details = document.createElement('p');
    details.textContent = next.notes || 'Une mise à jour du jeu est disponible.';
    details.style.margin = '8px 0';
    const button = document.createElement('button');
    button.textContent = 'Mettre à jour le jeu';
    Object.assign(button.style, { padding: '10px 18px', background: '#d7af57',
      border: '0', borderRadius: '8px', fontWeight: 'bold', color: '#101b30' });
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Mise à jour…';
      try {
        // The existing game is expected to persist its progress on its normal schedule.
        // Do not clear localStorage, IndexedDB, or save keys.
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) await registration.update();
        // Navigation is network-first in the service worker.
        window.location.reload();
      } catch (_) {
        button.disabled = false;
        button.textContent = 'Réessayer';
      }
    });
    panel.append(title, details, button);
    document.body.appendChild(panel);
  }
  async function check(manual = false) {
    // Browser event callbacks receive Event objects; only a deliberate
    // settings-button click is allowed to open a 'jeu déjà à jour' dialog.
    const requestedByUser = manual === true;
    if (alertVisible) {
      if (requestedByUser) window.alert('La proposition de mise à jour est déjà affichée.');
      return;
    }
    if (!navigator.onLine) {
      if (requestedByUser) window.alert('Pas de connexion Internet : impossible de vérifier les mises à jour.');
      return;
    }
    try {
      const remote = await fetchVersion();
      if (Number(remote.versionCode) > Number(installedVersion)) {
        offerUpdate(remote);
      } else if (requestedByUser) {
        window.alert('Pirate Titans V' + String(remote.versionName) + ' : jeu déjà à jour.');
      }
    } catch (_) {
      if (requestedByUser) window.alert('Vérification impossible. Réessaie lorsque la connexion est disponible.');
    }
  }
  // Exposed to the existing game settings modal; native Android uses its own hook.
  window.PiratePWA = { checkForUpdates: () => check(true) };
  async function start() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      try { await navigator.serviceWorker.register('./service-worker.js', { scope: './' }); }
      catch (_) { /* The game must still work without a service worker. */ }
    }
    await check();
    window.addEventListener('focus', () => check(false));
    window.addEventListener('online', () => check(false));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check(false);
    });
    setInterval(() => check(false), 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
