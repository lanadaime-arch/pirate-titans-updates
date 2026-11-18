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
  part('hair_back',[.40,.17]),
  part('left_leg',[.455,.675]),
  part('right_leg',[.56,.675]),
  part('hips',[.50,.61]),
  part('torso',[.50,.51]),
  part('left_arm',[.415,.42],'torso'),
  part('right_arm',[.59,.42],'torso'),
  part('head',[.50,.36],'torso'),
  part('hair_front',[.50,.36],'head')
 ],
 clips:{
  idle:clip(2600,{
   hair_back:[[0,-2],[.5,2],[1,-2]],
   left_arm:[[0,0],[.5,-1],[1,0]],right_arm:[[0,0],[.5,1],[1,0]],
   head:[[0,-1],[.5,1],[1,-1]],torso:[[0,0],[.5,0,0,-.6],[1,0]]
  }),
  attack:clip(2238,{
   hair_back:[[0,0],[.23,-7],[.43,9],[.7,-3],[1,0]],
   torso:[[0,0],[.23,-8,0,2],[.39,8,1,0],[.55,5],[.74,-2],[1,0]],
   head:[[0,0],[.2,5],[.43,-6],[.74,1],[1,0]],
   left_arm:[[0,0],[.23,21],[.39,-55],[.52,-28],[.75,9],[1,0]],
   right_arm:[[0,0],[.23,-25],[.39,55],[.52,30],[.75,-8],[1,0]],
   hips:[[0,0],[.23,-2],[.4,3],[.69,0],[1,0]],
   left_leg:[[0,0],[.23,-7],[.4,-12],[.67,-5],[1,0]],
   right_leg:[[0,0],[.23,7],[.4,12],[.67,4],[1,0]]
  }),
  special:clip(2397,{
   hair_back:[[0,0],[.19,-7],[.41,12],[.61,-10],[1,0]],
   torso:[[0,0],[.18,-10,0,2],[.4,10],[.59,-7],[.73,5],[1,0]],
   head:[[0,0],[.18,3],[.42,-8],[.65,4],[1,0]],
   left_arm:[[0,0],[.2,25],[.41,-75],[.62,35],[.73,-18],[1,0]],
   right_arm:[[0,0],[.2,-22],[.41,75],[.62,-35],[.73,15],[1,0]],
   hips:[[0,0],[.2,-2],[.41,3],[.72,-1],[1,0]],
   left_leg:[[0,0],[.19,-8],[.41,-12],[.7,-5],[1,0]],
   right_leg:[[0,0],[.19,8],[.41,12],[.7,5],[1,0]]
  })
 }
};
global.ViviRigVectorKit=Object.freeze({manifest});
})(typeof window!=='undefined'?window:globalThis);
