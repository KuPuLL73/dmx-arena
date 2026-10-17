import * as THREE from './vendor/three-0.169.0.module.min.js';

// One small renderer, shared geometry, and a bounded texture cache for every set.
const jsonCache=new Map(),geometryCache=new Map(),materials=new Map();
let renderer,scene,camera,root,head,upperLeft,upperRight,foreLeft,foreRight,primary;
let epoch=0,raf=0,observer,resizeObserver,visible=false,frame=0,phase=0,yaw=.22,targetYaw=.22,last=0,canvas;
let motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null,lost=false;
const diagnostics={frames:0,renderMs:0,maxRenderMs:0,mode:'idle'};
const allowed=['primary','backup','melee','special','head'];
const loadJSON=url=>{
 if(!jsonCache.has(url))jsonCache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Model unavailable');return r.json();}).catch(e=>{jsonCache.delete(url);throw e;}));
 return jsonCache.get(url);
};
function meshGeometry(data,key){
 if(!geometryCache.has(key)){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geometry.setIndex(data.indices);
  if(data.normals)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));else geometry.computeVertexNormals();
  geometry.computeBoundingSphere();geometryCache.set(key,geometry);
 }
 return geometryCache.get(key);
}
async function material(url){
 if(!materials.has(url))materials.set(url,new Promise((resolve,reject)=>{
  new THREE.TextureLoader().load(url,texture=>{
   texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
   resolve(new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,alphaTest:.2,flatShading:true}));
  },undefined,reject);
 }).catch(e=>{materials.delete(url);throw e;}));
 return materials.get(url);
}
async function trimMaterials(){
 for(const [key,promise] of materials){
  if(materials.size<=32)break;const mat=await promise.catch(()=>null);
  const used=new Set();scene.traverse(o=>{if(o.isMesh)used.add(o.material);});
  if(mat&&!used.has(mat)){mat.map?.dispose();mat.dispose();materials.delete(key);}
 }
}
function signature(models){return allowed.map(slot=>{const m=models[slot];return slot+':'+(m?.id||'')+':'+(m?.gameModel?.definitionId??'')+':'+(m?.gameModel?.skinId??'');}).join('|');}
function hash(value){let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function pose(t,loop=false){
 const slow=Math.sin(t*(loop?2*Math.PI/3:1.65)+phase),look=Math.sin(t*(loop?2*Math.PI/3:.58)+phase);
 yaw+=(targetYaw-yaw)*.10;
 root.rotation.y=yaw;root.rotation.z=slow*.008;root.position.y=slow*.008;
 head.rotation.y=look*.065;head.rotation.z=slow*.012;
 upperLeft.rotation.z=primary?.userData.held?-.04+slow*.006:slow*.008;
 upperRight.rotation.z=primary?.userData.held ? .05-slow*.006 : -slow*.008;
 foreLeft.rotation.z=primary?.userData.held?1.30+slow*.012:slow*.01;
 foreRight.rotation.z=primary?.userData.held?-1.25-slow*.01:-slow*.01;
 if(primary?.userData.held){primary.position.y=1.16+slow*.01;primary.rotation.z=.12+slow*.01;}
}
function paint(time=performance.now()){
 pose(motion?.matches?0:time/1000);const start=performance.now();renderer.render(scene,camera);const elapsed=performance.now()-start;
 diagnostics.frames++;diagnostics.renderMs+=elapsed;diagnostics.maxRenderMs=Math.max(diagnostics.maxRenderMs,elapsed);canvas.dataset.avatarFrames=String(diagnostics.frames);
}
function cancel(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;diagnostics.mode='paused';}
function animate(time){
 raf=0;if(lost||!visible||document.hidden||!canvas?.isConnected||motion?.matches)return;
 // 30 Hz is enough for a slow idle pose. Skip work instead of drawing catch-up frames.
 if(time-last>=32){last=time;paint(time);}raf=requestAnimationFrame(animate);
}
function resume(){
 if(lost||!renderer||!canvas?.isConnected||document.hidden||!visible){cancel();return;}
 if(motion?.matches){paint(0);cancel();return;}
 if(!raf){diagnostics.mode='playing';raf=requestAnimationFrame(animate);}
}
function resize(){
 if(!canvas?.isConnected)return;
 const rect=canvas.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(width,height,false);
 const aspect=width/height;camera.left=-1.43*aspect;camera.right=1.43*aspect;camera.updateProjectionMatrix();paint();
}
function initialize(){
 if(renderer)return;
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancel();diagnostics.mode='context-lost';});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;renderer.compile(scene,camera);resize();resume();});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1.15,1.15,2.70,-.16,.1,20);camera.position.set(0,1.29,5);camera.lookAt(0,1.29,0);
 // Camera bounds are relative to its centre.
 camera.top=1.43;camera.bottom=-1.43;camera.updateProjectionMatrix();
 scene.add(new THREE.AmbientLight(0xffffff,1.55));
 const key=new THREE.DirectionalLight(0xfff3e6,1.7);key.position.set(-3,5,5);scene.add(key);
 const rim=new THREE.DirectionalLight(0xff465c,.65);rim.position.set(2,2,-3);scene.add(rim);
 const shadow=document.createElement('canvas');shadow.width=128;shadow.height=128;
 const ctx=shadow.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,62);gradient.addColorStop(0,'#000b');gradient.addColorStop(1,'#0000');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.65),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadow),transparent:true,depthWrite:false}));plane.rotation.x=-Math.PI/2;plane.position.y=-.006;scene.add(plane);
 document.addEventListener('visibilitychange',resume);motion?.addEventListener('change',resume);
}
function part(body,name,mat){
 const data=body.parts[name],group=new THREE.Group();group.position.fromArray(data.pivot);
 group.add(new THREE.Mesh(meshGeometry(data.geometry,'body:'+name),mat));root.add(group);return group;
}
function equipment(data,mat,slot){
 const group=new THREE.Group(),mesh=new THREE.Mesh(meshGeometry(data,data.key),mat);group.add(mesh);
 const size=data.size,max=Math.max(...size),lengthAxis=size.indexOf(max);
 if(slot==='head'){
  const s=.62/Math.max(size[0],size[1],size[2]);mesh.scale.setScalar(s);group.position.set(0,2.095,0);
 }else{
  // Align the original model's long axis with X for held guns and Y for holsters.
  const horizontal=slot==='primary';
  if(lengthAxis===2)mesh.rotation[horizontal?'y':'x']=horizontal?Math.PI/2:Math.PI/2;
  else if(lengthAxis===(horizontal?1:0))mesh.rotation.z=Math.PI/2;
  mesh.scale.setScalar(({primary:1.15,backup:.40,melee:.68,special:1.1}[slot])/max);
  if(slot==='primary'){group.position.set(0,1.16,.30);group.rotation.z=.12;group.userData.held=true;}
  if(slot==='backup'){group.position.set(.37,.91,.15);group.rotation.z=-.15;}
  if(slot==='melee'){group.position.set(-.40,.82,-.10);group.rotation.z=-.18;}
  if(slot==='special'){group.position.set(.35,1.29,-.25);group.rotation.z=-.18;}
 }
 group.name=slot;root.add(group);return group;
}
export function stop(){++epoch;cancel();observer?.disconnect();resizeObserver?.disconnect();visible=false;}
export async function mount(placeholder,models,isCurrent){
 stop();const own=epoch;placeholder.dataset.avatarState='loading';
 const [body,index]=await Promise.all([loadJSON('character/body-v1.json'),loadJSON('character/index-v1.json')]);
 const entries=allowed.filter(s=>models[s]).map(slot=>{
  const binding=models[slot].gameModel;
  if(!binding||!Number.isSafeInteger(binding.definitionId)||!Number.isSafeInteger(binding.skinId)||binding.kind!==(slot==='head'?'mask':'weapon'))throw Error('Game model identity unavailable');
  const definition=index.definitions[binding.kind+':'+binding.definitionId],texture=definition?.skins[String(binding.skinId)];
  if(!texture)throw Error('Skin texture unavailable');
  return {slot,definition,texture};
 });
 const [bodyMat,equipped]=await Promise.all([material(body.texture),Promise.all(entries.map(async row=>({slot:row.slot,mat:await material(row.texture),data:{...await loadJSON(row.definition.geometry),key:row.definition.geometry}})))]);
 if(own!==epoch||!placeholder.isConnected||!isCurrent())return;
 initialize();if(root)scene.remove(root);root=new THREE.Group();scene.add(root);
 part(body,'torso',bodyMat);part(body,'legLeft',bodyMat);part(body,'legRight',bodyMat);
 upperLeft=part(body,'armLeft',bodyMat);upperRight=part(body,'armRight',bodyMat);
 foreLeft=part(body,'forearmLeft',bodyMat);foreRight=part(body,'forearmRight',bodyMat);
 head=part(body,'head',bodyMat);primary=null;
 for(const row of equipped){if(row.slot==='head'){root.remove(head);head=equipment(row.data,row.mat,row.slot);}else{const group=equipment(row.data,row.mat,row.slot);if(row.slot==='primary')primary=group;}}
 const fingerprint=signature(models);phase=hash(fingerprint)/4294967296*Math.PI*2;
 targetYaw=yaw=.22;diagnostics.frames=0;diagnostics.renderMs=0;diagnostics.maxRenderMs=0;
 canvas=renderer.domElement;canvas.id=placeholder.id;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',(placeholder.getAttribute('aria-label')||'Персонаж в твоём сете')+'. Можно повернуть горизонтальным свайпом.');
 canvas.dataset.avatarState='ready';canvas.dataset.avatarMode='3d';canvas.dataset.equipped=Object.keys(models).join(',');canvas.dataset.avatarSignature=fingerprint;
 placeholder.replaceWith(canvas);renderer.compile(scene,camera);resize();
 let pointer=null;
 canvas.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,yaw:targetYaw,moved:false,id:e.pointerId};};
 canvas.onpointermove=e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(!pointer.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){pointer.moved=true;canvas.setPointerCapture(e.pointerId);}if(pointer.moved){targetYaw=Math.max(-1.05,Math.min(1.05,pointer.yaw+dx*.009));if(motion?.matches)resize();}};
 canvas.onpointerup=canvas.onpointercancel=e=>{if(pointer&&!pointer.moved)targetYaw=targetYaw>.2?-.35:.5;pointer=null;if(motion?.matches)resize();};
 resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
 observer=new IntersectionObserver(rows=>{visible=rows.some(r=>r.isIntersecting);resume();},{threshold:.05});observer.observe(canvas);
 const note=canvas.parentElement.querySelector('.avatar-note');if(note)note.textContent='';
 trimMaterials();
}
export function stats(){return {...diagnostics,textures:materials.size,geometries:geometryCache.size,averageRenderMs:diagnostics.frames?diagnostics.renderMs/diagnostics.frames:0,visible,contexts:renderer?1:0};}
// Offline sticker preparation uses the same scene and exact skin bindings.
export function stickerFrame(seconds){
 if(!root||lost)throw Error('Character is not ready');
 visible=false;cancel();renderer.setPixelRatio(1);renderer.setSize(512,512,false);
 camera.left=-1.43;camera.right=1.43;camera.updateProjectionMatrix();
 yaw=targetYaw=.22+Math.sin(seconds*2*Math.PI/3)*.035;pose(seconds,true);
 renderer.render(scene,camera);return canvas.toDataURL('image/png');
}
