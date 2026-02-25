import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { XRControllerModelFactory } from 'three/examples/webxr/XRControllerModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();

let rightController = null;
const moveSpeed = 3.0; 

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
   UI
---------------------------------- */
const menuData = [
  { icon: "./icon/360.png", title: "360°画像", key: "F1" },
  { icon: "./icon/Map.png", title: "MAP", key: "F2" },
  { icon: "./icon/News.png", title: "情報", key: "F3" },
  { icon: "./icon/Setting.png", title: "設定", key: "F4" },
  { icon: "./icon/ExitApp.png", title: "終了", key: "F5" }
];

const uiGroup = new THREE.Group();
uiGroup.position.set(0, -0.25, -1.5);
uiGroup.renderOrder = 1000;
camera.add(uiGroup);
scene.add(camera);

const menu = new THREE.Group();
uiGroup.add(menu);

function createMenuBar(width = 1.4, height = 0.28) {
  const geometry = new THREE.PlaneGeometry(width, height);

  const material = new THREE.MeshBasicMaterial({
    color: 0x2f5f75,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false
  });

  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    material
  );

  bar.renderOrder = 1000;
  bar.position.z = -0.001; // ← ボタンより少し後ろ

  return bar;
}


const menuBar = createMenuBar();
uiGroup.add(menuBar);
function createButton(data) {

  const group = new THREE.Group();

  const BUTTON_W = 0.18;
  const BUTTON_H = 0.18;

  // 背景
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W, BUTTON_H),
    new THREE.MeshBasicMaterial({
      color: 0x5aa0bd,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    })
  );

  bg.renderOrder = 1001;
  group.add(bg);

  // アイコン
  const texture = new THREE.TextureLoader().load(data.icon);

  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  );

  icon.position.set(0, 0.04, 0.001);
  icon.renderOrder = 1002;
  group.add(icon);

  // テキストCanvas
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 512, 256);

  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(data.title, 256, 150);

  ctx.fillStyle = "#d0e6f0";
  ctx.font = "26px sans-serif";
  ctx.fillText(data.key, 256, 200);

  const textTexture = new THREE.CanvasTexture(canvas);

  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.10),
    new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  );

  text.position.set(0, -0.05, 0.002);
  text.renderOrder = 1003;

  group.add(text);

  return group;
}

const spacing = 0.22;

menuData.forEach((data, i) => {

  const btn = createButton(data);

  btn.position.x =
    (i - (menuData.length - 1) / 2) * spacing;

  uiGroup.add(btn);
});

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

          const x = axes[2] ?? 0;  // 右スティック左右
          const y = axes[3] ?? 0;  // 右スティック前後

          if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);

            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(camera.up, forward).normalize(); 

            // ---- 符号修正 ----
            world.position.addScaledVector(forward, y * moveSpeed * delta);
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
