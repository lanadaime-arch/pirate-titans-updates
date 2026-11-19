/* Pirate Titans — moteur d'animation 2D commun (travail non publié).
   Architecture inspirée d'Alvida V2 : dessins intégraux, native CSS, repos,
   frappe, spéciale et récupération séparés des calculs de dégâts.
   Ce fichier ne s'active que lorsqu'il est explicitement chargé par le jeu.
   Pas de rig, pas de morphing, pas de canvas animé sur chaque tick. */
(function(root){
 'use strict';
 const profiles=new Map(), sessions=new Map(), compiled=new Map();
 const validId=/^[a-z][a-z0-9_-]{0,39}$/; // IDs du casting officiel : bon_clay, big_mom
 const validAsset=/^\.\/[a-zA-Z0-9_./-]+\.(?:webp|png)$/;
 const finitePositive=x=>Number.isFinite(x)&&x>0;
 const pct=x=>Number(x.toFixed(5)).toString()+'%';
 function checkTimeline(label,steps,columns,rows){
  if(!Array.isArray(steps)||steps.length<2)throw Error(label+': séquence trop courte');
  let prior=0;
  return steps.map((item,i)=>{
   if(!Number.isInteger(item.frame)||item.frame<0||item.frame>=columns*rows)
    throw Error(label+': case hors atlas '+i);
   if(!finitePositive(item.until)||item.until>100||item.until<=prior)
    throw Error(label+': horodatage désordonné '+i);
   const normalized={frame:item.frame,from:prior,to:item.until};
   prior=item.until;
   return normalized;
  }).map((item,i,arr)=>{
   if(i===arr.length-1&&Math.abs(item.to-100)>0.00001)
    throw Error(label+': doit se terminer à 100 %');
   return item;
  });
 }
 function validate(id,input){
  if(!validId.test(id))throw Error('Identifiant de héros invalide');
  if(!input||!validAsset.test(input.asset))throw Error(id+': atlas invalide');
  const c=input.columns,r=input.rows;
  if(!Number.isInteger(c)||!Number.isInteger(r)||c<1||r<1||c*r>256)
   throw Error(id+': dimensions de grille invalides');
  const ratio=input.frameAspectRatio===undefined?1:input.frameAspectRatio;
  if(!finitePositive(ratio)||ratio>5)throw Error(id+': proportions de case invalides');
  const attack=checkTimeline(id+' attack',input.attack,c,r);
  const special=checkTimeline(id+' special',input.special,c,r);
  const idle=checkTimeline(id+' idle',input.idle,c,r);
  if(!finitePositive(input.normalMs)||!finitePositive(input.specialMs)||!finitePositive(input.intervalMs))
   throw Error(id+': durées invalides');
  if(input.intervalMs<Math.max(input.normalMs,input.specialMs))
   throw Error(id+': le mouvement serait relancé avant sa fin');
  if(attack.every(x=>x.frame===attack[0].frame)||special.every(x=>x.frame===special[0].frame))
   throw Error(id+': attaque sans déplacement visible');
  return {id,asset:input.asset,columns:c,rows:r,normalMs:input.normalMs,
   specialMs:input.specialMs,intervalMs:input.intervalMs,
   idleMs:input.idleMs||2600,scale:input.scale||1.35,frameAspectRatio:ratio,
   attack,special,idle};
 }
 function coordinates(frame,c,r){
  const x=frame%c,y=Math.floor(frame/c);
  return pct(c===1?0:100*x/(c-1))+' '+pct(r===1?0:100*y/(r-1));
 }
 function frames(key,name,steps,p){
  let cursor=0,blocks=[];
  for(const step of steps){
   const from=cursor===0?0:Math.min(step.from+0.006,100);
   const to=step.to===100?100:Math.max(from,step.to-0.004);
   blocks.push(pct(from)+','+pct(to)+'{background-position:'+coordinates(step.frame,p.columns,p.rows)+'}');
   cursor=step.to;
  }
  return '@keyframes '+key+'-'+name+'{'+blocks.join('')+'}';
 }
 function cssFor(p){
  const cl='.v08-formation .crew-slot.motion-'+p.id;
  const key='pirate-motion-'+p.id;
  return cl+' .hero-motion-actor{position:absolute;inset:0;pointer-events:none}\n'+
   cl+' .hero-motion-sprite{position:absolute;left:50%;bottom:-2%;height:'+(p.scale*100)+'%;width:auto;max-width:none;aspect-ratio:'+p.frameAspectRatio+';'+
   'transform:translateX(-50%);background-image:url("'+p.asset+'");background-repeat:no-repeat;'+
   'background-size:'+(p.columns*100)+'% '+(p.rows*100)+'%;image-rendering:auto;animation:'+key+'-idle '+p.idleMs+'ms step-end infinite}\n'+
   cl+'.strike{animation:none}\n'+
   cl+'.strike:not(.special) .hero-motion-sprite{animation:'+key+'-attack '+p.normalMs+'ms step-end 1 both}\n'+
   cl+'.strike.special .hero-motion-sprite{animation:'+key+'-special '+p.specialMs+'ms step-end 1 both}\n'+
   frames(key,'idle',p.idle,p)+frames(key,'attack',p.attack,p)+frames(key,'special',p.special,p);
 }
 function register(id,profile){
  const p=validate(id,profile);
  profiles.set(id,p);
  compiled.set(id,cssFor(p));
  return p;
 }
 function installStyles(id,doc){
  if(!profiles.has(id))throw Error('Profil absent : '+id);
  const d=doc||root.document;
  if(!d||!d.head)throw Error('Document du jeu indisponible');
  const styleId='hero-motion-style-'+id;
  let el=d.getElementById(styleId);
  if(!el){el=d.createElement('style');el.id=styleId;d.head.appendChild(el);}
  if(el.textContent!==compiled.get(id))el.textContent=compiled.get(id);
  return el;
 }
 function now(){return root.performance&&root.performance.now?root.performance.now():Date.now();}
 function reset(id,element){
  const previous=sessions.get(id);
  if(previous){
   previous.token++;
   if(previous.timer!==null)root.clearTimeout(previous.timer);
   if(previous.element&&previous.element!==element) {
    previous.element.classList.remove('strike','special');
   }
  }
  const s={element:element||previous?.element||null,last:-Infinity,token:previous?.token||0,timer:null};
  if(s.element)s.element.classList.remove('strike','special');
  sessions.set(id,s);
 }
 function trigger(id,element,mode='normal'){
  const p=profiles.get(id);
  if(!p||!element||element.hidden)return false;
  let s=sessions.get(id);
  if(!s||s.element!==element){reset(id,element);s=sessions.get(id);}
  const t=now();
  if(t-s.last<p.intervalMs)return false;
  s.last=t;
  s.token++;
  const token=s.token;
  if(s.timer!==null)root.clearTimeout(s.timer);
  element.classList.remove('strike');
  element.classList.toggle('special',mode==='special');
  // Relance une animation CSS complète sans reconstruire le DOM du sprite.
  void element.offsetWidth;
  element.classList.add('strike');
  const duration=mode==='special'?p.specialMs:p.normalMs;
  s.timer=root.setTimeout(()=>{
   if(s.token!==token||s.element!==element)return;
   element.classList.remove('strike','special');
   s.timer=null;
  },duration+20);
  return true;
 }
 function clear(id){
  const s=sessions.get(id);
  if(s)reset(id,null);
  sessions.delete(id);
 }
 root.PirateHeroMotion=Object.freeze({register,installStyles,trigger,reset,clear,
  profile:id=>profiles.get(id)||null,css:id=>compiled.get(id)||null});
})(window);
