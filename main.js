import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { XRControllerModelFactory } from "three/examples//jsm/webxr/XRControllerModelFactory.js";

// コントローラモデルファクトリーの準備
const controllerModelFactory = new XRControllerModelFactory();

// コントローラの光線の準備
const geometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1),
]);
const line = new THREE.Line(geometry);
line.name = "line";
line.scale.z = 5;

// コントローラの追加
function addController(index) {
  // コントローラの追加
  const controller = renderer.xr.getController(index);
  scene.add(controller);

  // コントローラモデルの追加
  const controllerGrip = renderer.xr.getControllerGrip(index);
  controllerGrip.add(
    controllerModelFactory.createControllerModel(controllerGrip)
  );
  scene.add(controllerGrip);

  // コントローラの光線の追加
  controller.add(line.clone());
  return controller;
}
// コントローラの準備
const controller0 = addController(0);
const controller1 = addController(1);

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

const world = new THREE.Group();
scene.add(world);

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
  world.position.set(0, 0, -3);
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
 world.add(new THREE.AxesHelper(1));
 world.add(new THREE.GridHelper(10, 10));

/* ----------------------------------
   Gaussian Splat (spark)
---------------------------------- */
const splat = new SplatMesh({
  url: './point_cloud_alpha_voxel_200k.ply',   // ← 自分の PLY
  alphaTest: 0.003
});

// ★ 最重要：位置とスケール
splat.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, "YXZ");
splat.position.set(8, 0, -130);
//splat.scale.setScalar(0.02);
//splat.material.uniforms.sizeMultiplier.value = 2.0;
world.add(splat);

// ロード確認
splat.onLoad = () => {
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
