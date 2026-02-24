import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';

/* ----------------------------------
   Renderer
---------------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

/* ----------------------------------
   Scene
---------------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

/* ----------------------------------
   Camera
---------------------------------- */
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 1.6, 3);

/* ----------------------------------
   PC Controls (OrbitControls)
---------------------------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.enableDamping = true;
controls.enabled = true;
controls.update();

/* ----------------------------------
   XR session switch
---------------------------------- */
renderer.xr.addEventListener('sessionstart', () => {
  // VR開始時：マウス操作を無効化
  controls.enabled = false;
});

renderer.xr.addEventListener('sessionend', () => {
  // VR終了時：マウス操作を復帰
  controls.enabled = true;
  controls.update();
});

/* ----------------------------------
   Light (最低限)
---------------------------------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

/* ----------------------------------
   Debug helpers（必要なら有効化）
---------------------------------- */
 scene.add(new THREE.AxesHelper(1));
 scene.add(new THREE.GridHelper(10, 10));

/* ----------------------------------
   Gaussian Splat (spark)
---------------------------------- */
const splat = new SplatMesh({
  url: './point_cloud_alpha_voxel_200k.ply',   // ← 自分の PLY
  alphaTest: 0.003
});

// ★ 最重要：位置とスケール
splat.rotation.x = -Math.PI / 2;
splat.position.set(0, 1.5, -1.0);
splat.scale.setScalar(0.02);
//splat.material.uniforms.sizeMultiplier.value = 2.0;
scene.add(splat);

// ロード確認
splat.onLoad = () => {
  console.log('Gaussian Splat loaded');
};

const splat2 = new SplatMesh({
  url: './point_cloud_alpha_voxel_200k.ply',   // ← 自分の PLY
  alphaTest: 0.003
});

// ★ 最重要：位置とスケール
splat2.position.set(0, 1.5, -1.0);
splat2.scale.setScalar(0.02);
//splat.material.uniforms.sizeMultiplier.value = 2.0;
scene.add(splat2);

// ロード確認
splat2.onLoad = () => {
  console.log('Gaussian Splat loaded');
};

/* ----------------------------------
   Resize
---------------------------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ----------------------------------
   Render loop
---------------------------------- */
renderer.setAnimationLoop(() => {
  if (controls.enabled) {
    controls.update(); // PC操作時のみ
  }
  renderer.render(scene, camera);
});
