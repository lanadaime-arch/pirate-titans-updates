/* PWA-only updater. Never touches the Android OTA protocol or player save keys. */
(() => {
  'use strict';
  const VERSION_URL = './version.json';
  let installedVersion = null;
  let alertVisible = false;
  let alreadyReloaded = false;

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
  async function check() {
    if (!navigator.onLine || alertVisible) return;
    try {
      const remote = await fetchVersion();
      if (installedVersion === null) {
        installedVersion = remote.versionCode;
      } else if (Number(remote.versionCode) > Number(installedVersion)) {
        offerUpdate(remote);
      }
    } catch (_) { /* Remain playable offline. */ }
  }
  async function start() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      try { await navigator.serviceWorker.register('./service-worker.js', { scope: './' }); }
      catch (_) { /* The game must still work without a service worker. */ }
    }
    await check();
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    setInterval(check, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
