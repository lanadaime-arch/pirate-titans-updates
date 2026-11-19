/*
 * Pirate Titans - prototype de calcul de progression des 37 héros F0.
 *
 * STATUT : CODE ÉCRIT / NON INTÉGRÉ AU JEU. index.html ne charge PAS ce fichier.
 * Toutes les données numériques TT2 proviennent du snapshot sourcé :
 * docs/TT2_REFERENCE_37_HEROS_F0_2026-11-19.json
 * Aucun chiffre PV/or ne doit être inventé pour rendre ces chiffres jouables.
 *
 * IMPORTANT : la croissance de coût ×1.082/niveau est une hypothèse HISTORIQUE
 * TT2 (source datant de 2017), pas une formule TT2 2026 confirmée.
 * De même, DPS base × niveau × multiplicateurs F0 = modèle de travail, NON
 * formule DPS 2026 authentifiée. Ne pas appliquer à une sauvegarde active.
 */
(function (root, makeModule) {
  'use strict';
  const api = makeModule();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PirateHeroEconomyF0 = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const MAX_LEVEL = 6000;
  const HISTORICAL_TT2_COST_MULTIPLIER = 1.082;
  const CLASS_COLUMN = Object.freeze({
    corps_a_corps: 'melee',
    distance: 'ranged',
    pouvoir: 'spell'
  });
  function requireInt(n, lo, hi, name) {
    if (!Number.isInteger(n) || n < lo || n > hi) {
      throw new RangeError(name + ' attendu entier de ' + lo + ' à ' + hi);
    }
    return n;
  }
  function decimalLog10(text) {
    const s = String(text).trim();
    const m = /^(\d+(?:\.\d+)?)(?:[Ee]([+-]?\d+))?$/.exec(s);
    if (!m) throw new TypeError('Nombre decimal ou scientifique incorrect : ' + s);
    const mantissa = Number(m[1]), exponent = Number(m[2] || 0);
    if (!(mantissa > 0) || !Number.isFinite(mantissa) || !Number.isFinite(exponent)) {
      throw new RangeError('Quantite strictement positive attendue : ' + s);
    }
    return Math.log10(mantissa) + exponent;
  }
  function log10ToScientific(logValue, precision) {
    if (logValue === -Infinity) return '0';
    if (!Number.isFinite(logValue)) throw new RangeError('Log10 infini');
    const digits = precision === undefined ? 4 : requireInt(precision, 1, 12, 'precision');
    let exponent = Math.floor(logValue);
    let mantissa = Number(Math.pow(10, logValue - exponent).toPrecision(digits));
    if (mantissa >= 10) { mantissa /= 10; exponent += 1; }
    return mantissa.toPrecision(digits) + 'E' + (exponent >= 0 ? '+' : '') + exponent;
  }
  function rankRef(reference, rank) {
    if (!reference || !Array.isArray(reference.heroRankReferences)) throw new TypeError('Reference TT2 absente');
    const a = reference.heroRankReferences[requireInt(rank, 1, 37, 'rank') - 1];
    if (!a || a.ptHeroRank !== rank || a.tt2UnlockOrder !== rank - 1) {
      throw new Error('Reference TT2 et rang Pirate Titans non alignes : ' + rank);
    }
    return a;
  }
  function milestone(reference, level, type) {
    const className = CLASS_COLUMN[type];
    if (!className) throw new TypeError('Type de combat inconnu : ' + type);
    requireInt(level, 0, MAX_LEVEL, 'level');
    if (!reference || !Array.isArray(reference.f0UpgradeMilestones)) throw new TypeError('Paliers F0 absents');
    let best = null;
    for (const row of reference.f0UpgradeMilestones) {
      if (row.level > level) break;
      best = row;
    }
    return best ? {level:best.level, multiplierLog10:decimalLog10(best.cumulative[className])}
                : {level:0, multiplierLog10:0};
  }
  function heroReferenceModel(casting, reference, rank, level, options) {
    requireInt(level, 0, MAX_LEVEL, 'level');
    const h = casting && casting.heroes && casting.heroes[requireInt(rank,1,37,'rank') - 1];
    if (!h || h.rank !== rank || !h.combatF0) throw new Error('Casting officiel et rang incoherents');
    const r = rankRef(reference, rank);
    const opts = options || {};
    const costMultiplier = opts.historicalCostGrowth === undefined ?
      HISTORICAL_TT2_COST_MULTIPLIER : Number(opts.historicalCostGrowth);
    if (!(costMultiplier > 1) || !Number.isFinite(costMultiplier)) throw new RangeError('Hypothese cout invalide');
    const bonuses = milestone(reference, level, h.combatF0.type);
    // Hypothese ancienne TT2 seulement; prix pour acheter le PROCHAIN niveau.
    const nextLevelCostLog10 = level === MAX_LEVEL ? null :
      decimalLog10(r.purchaseCost1) + level * Math.log10(costMultiplier);
    // Hypothese de DPS, distincte de la valeur affichee finale TT2.
    const baseDamageLog10 = level === 0 ? -Infinity :
      decimalLog10(r.defaultDamageAmount) + Math.log10(level) + bonuses.multiplierLog10;
    return {
      id:h.id,rank,level,type:h.combatF0.type,position:h.combatF0.position,
      milestoneLevel:bonuses.level,milestoneMultiplierLog10:bonuses.multiplierLog10,
      baseDamageLog10,nextLevelCostLog10,
      sourcePurchaseCost:r.purchaseCost1,sourceDefaultDamage:r.defaultDamageAmount,
      costFormulaStatus:'hypothese_historique_1.082',
      damageFormulaStatus:'hypothese_niveau_fois_multiplicateurs_F0'
    };
  }
  function logSum10(values) {
    const finite = values.filter(x => x !== -Infinity);
    if (finite.some(x => !Number.isFinite(x))) throw new TypeError('DPS log non fini');
    if (!finite.length) return -Infinity;
    const max = Math.max(...finite);
    return max + Math.log10(finite.reduce((total,x)=>total+Math.pow(10,x-max),0));
  }
  function crewDamageLog10(casting, reference, levelsById, multipliers) {
    const cfg = multipliers || {};
    const globalLog = cfg.global === undefined ? 0 : decimalLog10(cfg.global);
    const classBoosts = cfg.byType || {},positionBoosts = cfg.byPosition || {};
    const contribution=[];
    for (const h of casting.heroes) {
      const lvl = levelsById && levelsById[h.id] === undefined ? 0 : (levelsById ? levelsById[h.id] : 0);
      const est = heroReferenceModel(casting,reference,h.rank,lvl);
      let value = est.baseDamageLog10;
      if (value !== -Infinity) {
        value += decimalLog10(classBoosts[h.combatF0.type] === undefined ? 1 : classBoosts[h.combatF0.type]);
        value += decimalLog10(positionBoosts[h.combatF0.position] === undefined ? 1 : positionBoosts[h.combatF0.position]);
      }
      contribution.push({id:h.id,rank:h.rank,damageLog10:value});
    }
    return {damageLog10:logSum10(contribution.map(c=>c.damageLog10)) + (contribution.some(c=>c.damageLog10!==-Infinity)?globalLog:0),
      contribution};
  }
  return Object.freeze({
    MAX_LEVEL,HISTORICAL_TT2_COST_MULTIPLIER,CLASS_COLUMN,
    decimalLog10,log10ToScientific,rankRef,milestone,heroReferenceModel,crewDamageLog10,logSum10
  });
});
