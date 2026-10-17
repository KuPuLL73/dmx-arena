import * as THREE from './vendor/three-0.169.0.module.min.js';

// A single reused GPU context. Unity has already evaluated the native clips
// offline; the mini app interpolates only 35 joints and draws the original meshes.
const documents=new Map(),geometries=new Map(),textures=new Map();
const slots=['primary','backup','melee','special','head'];
let renderer,scene,camera,canvas,root,bones=[],named={},clips={},current={},epoch=0,raf=0,last=0,visible=false,lost=false,observer,resizeObserver,drag;
let yaw=-.6,targetYaw=-.6,started=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const metrics={frames:0,renderMs:0,maxRenderMs:0,mode:'idle'};
const q0=new THREE.Quaternion(),q1=new THREE.Quaternion(),delta=new THREE.Quaternion(),v0=new THREE.Vector3();
const get=url=>{if(!documents.has(url))documents.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Asset unavailable');return r.json();}).catch(e=>{documents.delete(url);throw e;}));return documents.get(url);};
function geometry(data,key,skinned=false){
 if(!geometries.has(key)){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices);
  if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.joints,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));}
  geometries.set(key,g);
 }return geometries.get(key);
}
function material(url){
 if(!textures.has(url))textures.set(url,new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,t=>{
  t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  resolve(new THREE.MeshStandardMaterial({map:t,roughness:.86,metalness:.02,side:THREE.DoubleSide,alphaTest:.15}));
 },undefined,reject)).catch(e=>{textures.delete(url);throw e;}));return textures.get(url);
}
function prefab(data,mat,key){
 const object=new THREE.Group();let parent=object;
 for(const tr of data.transforms||[]){const child=new THREE.Group();child.position.fromArray(tr.position);child.quaternion.fromArray(tr.rotation);child.scale.fromArray(tr.scale);parent.add(child);parent=child;}
 parent.add(new THREE.Mesh(geometry(data,key),mat));return object;
}
function socket(name){
 // Prefabs use Unity's upright axes, while the exported bones use FBX axes.
 // Preserve the original joint motion and cancel only its rest orientation.
 const bone=named[name],joint=new THREE.Group();bone.getWorldQuaternion(q0);joint.quaternion.copy(q0).invert();bone.add(joint);return joint;
}
function sample(clip,t){
 const duration=clip.duration||1,pos=(t%duration+duration)%duration*clip.fps;
 const i=Math.min(clip.frames.length-2,Math.floor(pos));return {a:clip.frames[i].values,b:clip.frames[i+1].values,mix:pos-i};
}
function pose(t){
 const motion=clips.motion||clips.idle,s=sample(motion,t),idle=s.a===s.b?null:clips.idle.frames[0].values;
 const armed=clips.weapon&&['idle','walk'].includes(current.motion);
 for(let i=0;i<bones.length;i++){
  const o=i*10,b=bones[i];b.position.set(s.a[o],s.a[o+1],s.a[o+2]).lerp(v0.set(s.b[o],s.b[o+1],s.b[o+2]),s.mix);
  q0.fromArray(s.a,o+3);q1.fromArray(s.b,o+3);q0.slerp(q1,s.mix);
  if(armed&&/^(clavicle|upperarm|lowerarm|hand_|WeaponPoint)/.test(b.name)){
   // The game's weapon stance supplies the arms. Add the breathing rotation
   // relative to its first frame, without moving joints away from their sockets.
   q1.fromArray(idle,o+3).invert();delta.copy(q0).multiply(q1);q0.fromArray(clips.weapon.frames[0].values,o+3).premultiply(delta);
  }
  b.quaternion.copy(q0);b.scale.set(s.a[o+7],s.a[o+8],s.a[o+9]);
 }
 // Stop locomotion root drift in the dressing room. Native limb motion remains.
 if(named.root){named.root.position.x=0;named.root.position.y=0;}
 yaw+=(targetYaw-yaw)*.14;root.rotation.y=yaw;
}
function paint(time=performance.now()){
 if(!root||lost)return;pose(reduced.matches?0:(time-started)/1000);
 const before=performance.now();renderer.render(scene,camera);const ms=performance.now()-before;
 metrics.frames++;metrics.renderMs+=ms;metrics.maxRenderMs=Math.max(ms,metrics.maxRenderMs);canvas.dataset.avatarFrames=String(metrics.frames);
}
function cancel(){cancelAnimationFrame(raf);raf=0;last=0;metrics.mode=lost?'context-lost':'paused';}
function animate(time){raf=0;if(!visible||lost||document.hidden||!canvas?.isConnected||reduced.matches)return;if(time-last>=32){last=time;paint(time);}raf=requestAnimationFrame(animate);}
function resume(){if(!renderer||!root||!canvas?.isConnected||!visible||lost||document.hidden){cancel();return;}if(reduced.matches){paint(0);cancel();return;}if(!raf){metrics.mode='playing';raf=requestAnimationFrame(animate);}}
function resize(){if(!canvas?.isConnected||!root)return;const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(w,h,false);camera.left=-1.13*w/h;camera.right=1.13*w/h;camera.updateProjectionMatrix();paint();}
function init(){
 if(renderer)return;
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.setClearColor(0,0);
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1.20,-1.20,.1,30);camera.position.set(0,1.08,5);camera.lookAt(0,1.08,0);
 scene.add(new THREE.HemisphereLight(0xe2edff,0x51454f,2.5));
 const key=new THREE.DirectionalLight(0xfff1dd,3.4);key.position.set(-3,5,4);scene.add(key);
 const rim=new THREE.DirectionalLight(0xff4966,2.2);rim.position.set(3,3,-3);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xb5ceff,1.2);fill.position.set(3,2,4);scene.add(fill);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancel();});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;resize();resume();});
 document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
}
function disposeRoot(){if(!root)return;const skeletons=new Set();root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());scene.remove(root);root=null;}
async function trim(){
 const used=new Set();root?.traverse(o=>{if(o.isMesh)used.add(o.material);});
 for(const [url,p] of textures){if(textures.size<=40)break;const mat=await p.catch(()=>null);if(mat&&!used.has(mat)){mat.map.dispose();mat.dispose();textures.delete(url);}}
}
export function stop(){++epoch;cancel();visible=false;observer?.disconnect();resizeObserver?.disconnect();if(drag&&canvas){canvas.removeEventListener('pointerdown',drag.down);canvas.removeEventListener('pointermove',drag.move);canvas.removeEventListener('pointerup',drag.up);canvas.removeEventListener('pointercancel',drag.up);canvas.removeEventListener('keydown',drag.key);}drag=null;}
export async function mount(target,models={},isCurrent=()=>true,appearance={}){
 stop();const own=epoch;target.dataset.avatarState='loading';
 const [rig,index,wardrobe]=await Promise.all([get('character/rig-v2.json'),get('character/index-v2.json'),get('character/wardrobe-v2.json')]);
 const outfit={body:1,backpack:0,motion:'idle',held:'primary',...appearance};
 const body=wardrobe.bodies.find(r=>r.id===outfit.body)||wardrobe.bodies.find(r=>r.id===1),pack=wardrobe.backpacks.find(r=>r.id===outfit.backpack);
 const selected=models[outfit.held]||models.primary||models.backup||models.melee||models.special;
 const held=Object.keys(models).find(k=>models[k]===selected)||'primary';outfit.held=held;
 const equipped=await Promise.all(Object.entries(models).map(async([slot,row])=>{
  const b=row.gameModel,definition=index.definitions[(slot==='head'?'mask:':'weapon:')+b?.definitionId],texture=definition?.skins[String(b?.skinId)];
  if(!definition||!texture)throw Error('Unverified 3D skin');
  return {slot,data:await get(definition.geometry),mat:await material(texture),key:definition.geometry};
 }));
 const motionFile=outfit.motion==='walk'?'character/motion-A_TP_CH_Jog_F_not_fbx-v2.json':outfit.motion.startsWith('dance-')&&wardrobe.motions.some(r=>'dance-'+r.id===outfit.motion)?'character/motion-'+outfit.motion+'-v2.json':'character/motion-A_TP_CH_Breathing-v2.json';
 const poseID=appearance.stance||{primary:1,backup:2,special:3,melee:4}[held];
 const [bodyMat,idle,motion,weapon,backpack]=await Promise.all([material(body.texture),get('character/motion-A_TP_CH_Breathing-v2.json'),get(motionFile),selected?get('character/motion-weapon_pose_'+poseID+'-v2.json'):null,pack?.geometry?Promise.all([get(pack.geometry),material(pack.texture)]):null]);
 const headMat=await material(rig.meshes.find(m=>m.name==='player_head').texture||'character/head-default-v2.png');
 if(own!==epoch||!target.isConnected||!isCurrent())return;
 init();disposeRoot();canvas=renderer.domElement;target.replaceWith(canvas);canvas.id=target.id;canvas.className=target.className;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',target.getAttribute('aria-label')||'Твой персонаж');canvas.tabIndex=0;
 root=new THREE.Group();scene.add(root);bones=rig.nodes.map(n=>{const b=new THREE.Bone();b.name=n.name;b.position.fromArray(n.position);b.quaternion.fromArray(n.rotation);b.scale.fromArray(n.scale);return b;});named=Object.fromEntries(bones.map(b=>[b.name,b]));
 rig.nodes.forEach((n,i)=>(n.parent>=0?bones[n.parent]:root).add(bones[i]));root.updateMatrixWorld(true);
 for(const mesh of rig.meshes){
  if(mesh.name==='player_head'&&models.head)continue;
  const inverses=bones.map((b,i)=>mesh.binds[i]?new THREE.Matrix4().fromArray(mesh.binds[i]):new THREE.Matrix4());
  const skinned=new THREE.SkinnedMesh(geometry(mesh,mesh.name,true),mesh.name==='player_head'?headMat:bodyMat);skinned.bindMode='detached';skinned.frustumCulled=false;skinned.bind(new THREE.Skeleton(bones,inverses),new THREE.Matrix4());root.add(skinned);
 }
 if(backpack){const object=prefab(backpack[0],backpack[1],pack.geometry);object.position.z=-.55;socket('spine_03').add(object);}
 for(const e of equipped){
  const object=prefab(e.data,e.mat,e.key);
  if(e.slot==='head'){
   // Mask prefabs include an absolute mannequin-height offset. The face socket
   // already supplies that height, so remove it once rather than applying it twice.
   object.updateMatrixWorld(true);const centre=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());object.position.sub(centre);object.position.y+=.19;socket('head').add(object);
  }
  else if(e.slot===held){object.scale.setScalar(100);named.WeaponPoint_R.add(object);}
  else {
   // Spare weapons follow the native spine/hip joints. Their shape and textures
   // remain original; only their display holster position is chosen by DMX.
   const joint=socket(e.slot==='backup'?'thigh_r':e.slot==='melee'?'thigh_l':'spine_03');joint.add(object);
   object.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),size=box.getSize(v0).length();object.scale.setScalar(Math.min(1,.75/Math.max(size,.01)));
   object.rotation.set(0,0,e.slot==='special'?Math.PI/2:-.75);object.position.set(e.slot==='backup'?-.14:.15,e.slot==='special'?.06:-.10,.18);
   if(e.slot==='special'&&backpack)object.visible=false;
  }
 }
 root.scale.x=-1;root.updateMatrixWorld(true);clips={idle,motion,weapon};current=outfit;started=performance.now();yaw=targetYaw=-.6;
 canvas.dataset.avatarMode='3d';canvas.dataset.avatarRig='native';canvas.dataset.avatarState='ready';canvas.dataset.equipped=slots.filter(s=>models[s]).join(',');canvas.dataset.avatarSignature=JSON.stringify({outfit,ids:Object.values(models).map(m=>[m.id,m.gameModel])});
 canvas.dataset.body=String(body.id);canvas.dataset.backpack=String(pack?.id||0);canvas.dataset.motion=outfit.motion;
 const note=canvas.parentElement.querySelector('.avatar-note');if(note)note.textContent='';
 let pointer,x=0,moved=false;
 drag={down:e=>{pointer=e.pointerId;x=e.clientX;moved=false;},move:e=>{if(pointer!==e.pointerId)return;const diff=e.clientX-x;if(Math.abs(diff)>2)moved=true;if(moved){canvas.setPointerCapture(e.pointerId);targetYaw+=diff*.012;x=e.clientX;paint();}},up:()=>{pointer=undefined;},key:e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();targetYaw=e.key==='Home'?-.6:targetYaw+(e.key==='ArrowLeft'?-.25:.25);paint();}}};
 for(const [event,fn] of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','up'],['keydown','key']])canvas.addEventListener(event,drag[fn]);
 observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?resume():cancel();});observer.observe(canvas);resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);resize();visible=true;resume();await trim();
}
export function stats(){return {...metrics,visible,contexts:renderer?1:0,bones:bones.length,body:current.body,backpack:current.backpack,motion:current.motion,triangles:renderer?.info.render.triangles||0,averageRenderMs:metrics.frames?metrics.renderMs/metrics.frames:0};}
export function stickerFrame(seconds){cancel();renderer.setPixelRatio(1);renderer.setSize(512,512,false);camera.left=-1.13;camera.right=1.13;camera.updateProjectionMatrix();pose(seconds);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}
