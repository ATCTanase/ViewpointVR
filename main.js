import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { XRControllerModelFactory } from 'three/examples/webxr/XRControllerModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();

let rightController = null;
const moveSpeed = 2.0; 

let controller1, controller2;
let controllerGrip1, controllerGrip2;

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

 
  const session = renderer.xr.getSession();

  // 右手InputSource取得
  session.addEventListener('inputsourceschange', () => {
    session.inputSources.forEach((source) => {
      if (source.handedness === 'right' && source.gamepad) {
        rightInputSource = source;
      }
    });
  });

  // controller input object
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  scene.add(controller1, controller2);

  // controller model
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1)
  );
  scene.add(controllerGrip1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2)
  );
  scene.add(controllerGrip2);

});

renderer.xr.addEventListener('sessionend', () => {
  // VR終了時：マウス操作を復帰
  controls.enabled = true;
  controls.update();

  scene.remove(controller1, controller2);
  scene.remove(controllerGrip1, controllerGrip2);

  rightInputSource = null;

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
  pointSize: 0.04,
  alphaTest: 0.003
});

// ★ 最重要：位置とスケール
splat.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, "YXZ");
splat.position.set(8, 0, -130);
//splat.scale.setScalar(0.02);
world.add(splat);

console.log(splat);
console.log(splat.material);

// ロード確認
splat.onLoad = () => {
  console.log("Gaussian Splat loaded");
   console.log(splat.material);
   console.log(splat.material.uniforms);
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
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  if (renderer.xr.isPresenting) {

    const session = renderer.xr.getSession();

    if (session) {

      session.inputSources.forEach((source) => {

        if (source.handedness === 'right' && source.gamepad) {

          const axes = source.gamepad.axes;

          // Quest系は [2],[3] が右スティック
          const x = axes[2] ?? 0;
          const y = axes[3] ?? 0;

          if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {

            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            dir.y = 0;
            dir.normalize();

            const right = new THREE.Vector3()
              .crossVectors(dir, camera.up)
              .normalize();

            world.position.addScaledVector(dir, -y * moveSpeed * delta);
            world.position.addScaledVector(right, x * moveSpeed * delta);
          }
        }

      });
    }
  }

  if (controls.enabled) {
    controls.update(); // PC操作時のみ
  }
  renderer.render(scene, camera);
});
