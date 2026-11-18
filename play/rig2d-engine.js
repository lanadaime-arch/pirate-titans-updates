/*
 * Pirate Titans — moteur de personnages 2D articulés, version technique 1.
 * IMPORTANT : ne convertit PAS automatiquement une image aplatie en rig.
 * Requiert de vrais calques transparents dessines au meme format et des pivots.
 * Aucune animation de gameplay ou sauvegarde ne doit dependre de ce module.
 *
 * Usage: await PirateRig2D.prepare(manifest) -> actor
 *        actor.mount(container); actor.play('idle'); actor.play('attack');
 * Le système actuel de Vivi n'est PAS remplacé par ce moteur.
 */
(function (global) {
  'use strict';
  const PREFIX = 'PirateRig2D : ';
  const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  const assert = (ok, message) => { if (!ok) throw new Error(PREFIX + message); };

  function validate(manifest) {
    assert(manifest && typeof manifest === 'object', 'manifeste absent');
    assert(Array.isArray(manifest.parts) && manifest.parts.length >= 2 &&
      manifest.parts.length <= 32, '2 à 32 calques requis');
    assert(manifest.clips && typeof manifest.clips === 'object', 'animations absentes');
    const ids = new Set();
    for (const part of manifest.parts) {
      assert(part && typeof part.id === 'string' &&
        /^[a-z][a-z0-9_-]{0,39}$/.test(part.id) && !ids.has(part.id),
        'identifiant de calque absent, dupliqué ou invalide');
      ids.add(part.id);
      assert(typeof part.src === 'string' &&
        /^\.\/[a-zA-Z0-9_.-]+\.(?:png|webp|svg)$/.test(part.src),
        'ressource locale PNG, WebP ou SVG requise pour ' + part.id);
      const p = part.pivot;
      assert(Array.isArray(p) && p.length === 2 &&
        p.every(x => within(x, 0, 1)), 'pivot normalisé invalide pour ' + part.id);
      if (part.parent != null) {
        assert(typeof part.parent === 'string' && part.parent !== part.id,
          'parent invalide pour ' + part.id);
      }
    }
    const byId = new Map(manifest.parts.map(p => [p.id, p]));
    for (const part of manifest.parts) {
      let parent = part.parent;
      const seen = new Set([part.id]);
      while (parent != null) {
        assert(byId.has(parent) && !seen.has(parent),
          'hiérarchie circulaire ou parent absent pour ' + part.id);
        seen.add(parent);
        parent = byId.get(parent).parent;
      }
    }
    assert(Object.prototype.hasOwnProperty.call(manifest.clips, 'idle'),
      'clip de repos indispensable');
    for (const [name, clip] of Object.entries(manifest.clips)) {
      assert(/^[a-z][a-z0-9_-]{0,39}$/.test(name) &&
        clip && within(clip.duration, 150, 10000),
        'clip ou durée invalide : ' + name);
      assert(clip.tracks && typeof clip.tracks === 'object',
        'pistes manquantes : ' + name);
      for (const [id, frames] of Object.entries(clip.tracks)) {
        assert(byId.has(id), 'piste inconnue : ' + id);
        assert(Array.isArray(frames) && frames.length >= 2 &&
          frames.length <= 80, '2 à 80 poses par piste : ' + id);
        let previous = -1;
        for (const frame of frames) {
          assert(frame && within(frame.at, 0, 1) && frame.at > previous &&
            within(frame.angle === undefined ? 0 : frame.angle, -180, 180) &&
            within(frame.dx === undefined ? 0 : frame.dx, -50, 50) &&
            within(frame.dy === undefined ? 0 : frame.dy, -50, 50),
            'pose invalide pour ' + id + '/' + name);
          previous = frame.at;
        }
        assert(frames[0].at === 0 && frames[frames.length - 1].at === 1,
          'première et dernière poses requises pour ' + id + '/' + name);
      }
    }
    return true;
  }

  function transform(frame) {
    const angle = frame.angle || 0;
    const x = frame.dx || 0;
    const y = frame.dy || 0;
    // No scale here: never introduce accidental growth/shrinking of an actor.
    return 'translate(' + x + '%, ' + y + '%) rotate(' + angle + 'deg)';
  }
  function imageLoaded(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(PREFIX + 'image manquante ' + src));
      img.src = src;
    });
  }
  async function prepare(manifest) {
    validate(manifest);
    assert(global.document && global.Image, 'navigateur requis pour monter le personnage');
    // Refuser tout art incomplet avant de toucher à l'arène.
    const loaded = await Promise.all(manifest.parts.map(p => imageLoaded(p.src)));
    const width = loaded[0].naturalWidth, height = loaded[0].naturalHeight;
    assert(width >= 16 && height >= 16 &&
      loaded.every(img => img.naturalWidth === width && img.naturalHeight === height),
      'calques de tailles incompatibles : chaque image doit avoir le même canevas');
    const roots = [];
    const nodes = new Map();
    for (let i = 0; i < manifest.parts.length; i++) {
      const part = manifest.parts[i];
      const el = document.createElement('div');
      el.className = 'pirate-rig2d-part pirate-rig2d-' + part.id;
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;' +
        'will-change:transform;backface-visibility:hidden;';
      el.style.transformOrigin = (part.pivot[0] * 100) + '% ' + (part.pivot[1] * 100) + '%';
      const image = loaded[i];
      image.draggable = false;
      image.alt = '';
      image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;' +
        'object-fit:fill;user-select:none;pointer-events:none;';
      el.appendChild(image);
      nodes.set(part.id, el);
    }
    // Each part is a full transparent canvas, nested to inherit parent rotation.
    for (const part of manifest.parts) {
      const el = nodes.get(part.id);
      if (part.parent) nodes.get(part.parent).appendChild(el);
      else roots.push(el);
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'pirate-rig2d';
    wrapper.style.cssText = 'position:absolute;inset:0;pointer-events:none;' +
      'contain:layout style;overflow:visible;';
    for (const el of roots) wrapper.appendChild(el);
    const active = [];
    let runId = 0;
    let mounted = false;
    let disposed = false;
    function stop() {
      runId++;
      for (const animation of active.splice(0)) animation.cancel();
      for (const el of nodes.values()) el.style.transform = '';
    }
    function play(name) {
      assert(!disposed && mounted, 'personnage non monté ou détruit');
      const clip = manifest.clips[name];
      assert(clip, 'animation inconnue : ' + name);
      stop();
      const current = runId;
      const canAnimate = typeof wrapper.animate === 'function';
      for (const [id, frames] of Object.entries(clip.tracks)) {
        const el = nodes.get(id);
        const keyframes = frames.map(frame => ({
          offset: frame.at,
          transform: transform(frame),
          easing: 'ease-in-out'
        }));
        if (canAnimate) {
          const a = el.animate(keyframes, {
            duration: clip.duration,
            iterations: name === 'idle' ? Infinity : 1,
            fill: 'forwards'
          });
          active.push(a);
        } else {
          // Appareil ancien : apparence statique cohérente plutôt qu'images cassées.
          el.style.transform = transform(frames[0]);
        }
      }
      if (canAnimate && name !== 'idle' && active.length) {
        Promise.all(active.map(a => a.finished.catch(() => null)))
          .then(() => { if (current === runId && !disposed && mounted) play('idle'); });
      }
      return true;
    }
    return {
      mount(container) {
        assert(!disposed && container && typeof container.appendChild === 'function',
          'conteneur invalide');
        if (mounted) stop();
        container.appendChild(wrapper);
        mounted = true;
        return this;
      },
      play,
      stop,
      destroy() {
        if (disposed) return;
        stop();
        wrapper.remove();
        mounted = false;
        disposed = true;
        nodes.clear();
      },
      get element() { return wrapper; }
    };
  }
  Object.defineProperty(global, 'PirateRig2D', {
    configurable: false,
    writable: false,
    value: Object.freeze({ validate, prepare, transform })
  });
})(typeof window !== 'undefined' ? window : globalThis);
