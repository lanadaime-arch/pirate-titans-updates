/* Vivi 2D articulée : éléments vectoriels dessinés séparément, non découpés de l'illustration aplatie. */
(function(global){
'use strict';
const part=(id,pivot,parent)=>({id,pivot,parent,src:'./vivi-vector-'+id+'.svg'});
const key=(at,angle=0,dx=0,dy=0)=>({at,angle,dx,dy});
function clip(duration,raw){
 const tracks={};
 for(const [name,poses] of Object.entries(raw))tracks[name]=poses.map(p=>key(...p));
 return {duration,tracks};
}
const manifest={
 parts:[
  // V0.9.69 : un seul squelette : bassin -> jambes et buste -> tête / bras / cheveux.
  // Aucun calque n'a été redecoupé et aucun changement de dimension n'est permis.
  part('hips',[.50,.61]),
  part('left_leg',[.455,.675],'hips'),
  part('right_leg',[.56,.675],'hips'),
  part('torso',[.50,.51],'hips'),
  part('hair_back',[.40,.17],'torso'),
  part('left_arm',[.415,.42],'torso'),
  part('right_arm',[.59,.42],'torso'),
  part('head',[.50,.36],'torso'),
  part('hair_front',[.50,.36],'head')
 ],
 clips:{
  idle:clip(2600,{
   hips:[[0,0],[.5,0],[1,0]],
   hair_back:[[0,-2],[.5,2],[1,-2]],
   left_arm:[[0,0],[.5,-1],[1,0]],
   right_arm:[[0,0],[.5,1],[1,0]],
   head:[[0,-1],[.5,1],[1,-1]],
   torso:[[0,0],[.5,0,0,-.6],[1,0]]
  }),
  // Retenue -> prise d'appui -> frappe vers l'ennemi à droite -> retour au repos.
  // Les deux bras se dirigent vers l'ennemi, plus de croisement au centre.
  attack:clip(2238,{
   hips:[[0,0],[.16,-2,-1,0],[.33,-2,-1,0],[.44,3,2,0],[.60,2,1,0],[.78,0],[1,0]],
   left_leg:[[0,0],[.16,12,0,1],[.33,17,0,1.5],[.44,15,0,1.5],[.60,13,0,1.4],[.78,4,0,.1],[1,0]],
   right_leg:[[0,0],[.16,-12,0,1],[.33,-16,0,1.5],[.44,-20,0,1.8],[.60,-16,0,1.5],[.78,-4,0,.1],[1,0]],
   torso:[[0,0],[.16,-8,-1,0],[.33,-10,-1,0],[.44,12,3,-1],[.60,7,2,-1],[.78,0],[1,0]],
   hair_back:[[0,0],[.16,-4],[.33,-7],[.44,11],[.60,-5],[.78,1],[1,0]],
   left_arm:[[0,0],[.16,23],[.33,31],[.44,-75],[.60,-60],[.78,-9],[1,0]],
   right_arm:[[0,0],[.16,18],[.33,24],[.44,-51],[.60,-37],[.78,-6],[1,0]],
   head:[[0,0],[.16,4],[.33,6],[.44,-6],[.60,-3],[.78,0],[1,0]]
  }),
  special:clip(2397,{
   hips:[[0,0],[.14,-2,-1,0],[.30,-2,-1,0],[.42,4,2,0],[.57,2,1,0],[.68,-1,0,0],[.85,0],[1,0]],
   left_leg:[[0,0],[.14,13,0,1],[.30,20,0,1.4],[.42,18,0,1.4],[.57,15,0,1],[.68,16,0,1.3],[.85,4],[1,0]],
   right_leg:[[0,0],[.14,-13,0,1],[.30,-20,0,1.4],[.42,-21,0,1.5],[.57,-15,0,1],[.68,-17,0,1.3],[.85,-4],[1,0]],
   torso:[[0,0],[.14,-10,-1,0],[.30,-14,-1,0],[.42,15,4,-1],[.57,6,2,-1],[.68,10,2,-1],[.85,0],[1,0]],
   hair_back:[[0,0],[.14,-5],[.30,-9],[.42,14],[.57,-8],[.68,8],[.85,0],[1,0]],
   left_arm:[[0,0],[.14,28],[.30,33],[.42,-77],[.57,-29],[.68,-66],[.85,-9],[1,0]],
   right_arm:[[0,0],[.14,20],[.30,27],[.42,-58],[.57,-37],[.68,-55],[.85,-6],[1,0]],
   head:[[0,0],[.14,5],[.30,7],[.42,-7],[.57,-4],[.68,-5],[.85,0],[1,0]]
  })
 }
};
global.ViviRigVectorKit=Object.freeze({manifest});
})(typeof window!=='undefined'?window:globalThis);
