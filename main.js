import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { XRControllerModelFactory } from 'three/examples/webxr/XRControllerModelFactory.js';

/* ----------------------------------
   Variables & Constants
---------------------------------- */
const moveSpeed = 3.0;
const stickSensitivity = 2.0;
const stickDeadZone = 0.1;
const sensitivity = 0.002;

let controller1, controller2;
let controllerGrip1, controllerGrip2;
const controllerModelFactory = new XRControllerModelFactory();

let laser = null;
let currentHover = null;
const billboardButtons = [];

let yaw = 0;
let pitch = 0;
let isSplatLoaded = false; // Splat読み込みフラグ

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tempMatrix = new THREE.Matrix4();

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
   Scene & Camera Rig
---------------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const cameraRig = new THREE.Group();
scene.add(cameraRig);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.01, 1000
);
camera.position.set(0, 1.6,3); // 初期高さ
cameraRig.add(camera);

const world = new THREE.Group();
scene.add(world);

/* ----------------------------------
   UI Setup
---------------------------------- */
const menuData = [
  { icon: "./icon/360.png", title: "360°画像", key: "F1", action: () => open360() },
  { icon: "./icon/Map.png", title: "MAP", key: "F2", action: () => openMap() },
  { icon: "./icon/News.png", title: "情報", key: "F3", action: () => openInfo() },
  { icon: "./icon/Setting.png", title: "設定", key: "F4", action: () => openSetting() },
  { icon: "./icon/ExitApp.png", title: "終了", key: "F5", action: () => exitApp() }
];

const uiGroup = new THREE.Group();
uiGroup.position.set(0, -0.25, -1.5);
camera.add(uiGroup);

const BUTTON_W = 0.18;
const spacing = 0.21;

function createMenuBar(width, height) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x2f5f75, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false
  });
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  bar.renderOrder = 9990;
  return bar;
}

const totalWidth = (menuData.length - 1) * spacing + BUTTON_W + 0.15;
uiGroup.add(createMenuBar(totalWidth, 0.3));

function createButton(data) {
  const group = new THREE.Group();
  const BUTTON_H = 0.18;
  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W, BUTTON_H),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitArea.userData = { onClick: data.action, isButton: true };
  group.add(hitArea);

  const bgMaterial = new THREE.MeshBasicMaterial({
    color: 0x5aa0bd, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(BUTTON_W, BUTTON_H), bgMaterial);
  bg.renderOrder = 9991;
  group.add(bg);
  hitArea.userData.bgMaterial = bgMaterial;
  hitArea.userData.defaultColor = new THREE.Color(0x5aa0bd);

  const iconTex = new THREE.TextureLoader().load(data.icon);
  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, depthTest: false, depthWrite: false })
  );
  icon.position.set(0, 0.04, 0.001);
  icon.renderOrder = 9992;
  group.add(icon);

  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center"; ctx.fillStyle = "white"; ctx.font = "bold 84px sans-serif";
  ctx.fillText(data.title, 256, 150);
  ctx.fillStyle = "#d0e6f0"; ctx.font = "42px sans-serif";
  ctx.fillText(data.key, 256, 200);

  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.10),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false, depthWrite: false })
  );
  text.position.set(0, -0.05, 0.002);
  text.renderOrder = 9992;
  group.add(text);
  return group;
}

menuData.forEach((data, i) => {
  const btn = createButton(data);
  btn.position.x = (i - (menuData.length - 1) / 2) * spacing;
  uiGroup.add(btn);
});

/* ----------------------------------
   Interactions & Hover
---------------------------------- */
function checkIntersects() {
  const targets = [...uiGroup.children, ...billboardButtons];
  const intersects = raycaster.intersectObjects(targets, true);
  for (let i = 0; i < intersects.length; i++) {
    let obj = intersects[i].object;
    while (obj) {
      if (obj.userData?.isButton) {
        const mat = obj.userData.bgMaterial;
        mat.color.multiplyScalar(0.7);
        setTimeout(() => mat.color.copy(obj.userData.defaultColor), 120);
        obj.userData.onClick();
        return true;
      }
      if (obj.userData?.isBillboardButton) {
        const targetState = !obj.userData.isOpen;
        billboardButtons.forEach(btn => { btn.userData.popup.visible = false; btn.userData.isOpen = false; });
        obj.userData.isOpen = targetState;
        obj.userData.popup.visible = targetState;
        return true;
      }
      obj = obj.parent;
    }
  }
  return false;
}

function updateHover(rayOrigin, rayDirection) {
  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);
  const intersects = raycaster.intersectObjects(uiGroup.children, true);
  let hovered = null;
  for (let i = 0; i < intersects.length; i++) {
    let obj = intersects[i].object;
    while (obj) {
      if (obj.userData?.isButton) { hovered = obj; break; }
      obj = obj.parent;
    }
    if (hovered) break;
  }
  if (currentHover && currentHover !== hovered) {
    currentHover.userData.bgMaterial.color.copy(currentHover.userData.defaultColor);
  }
  if (hovered && hovered !== currentHover) {
    hovered.userData.bgMaterial.color.copy(hovered.userData.defaultColor.clone().multiplyScalar(1.3));
  }
  currentHover = hovered;
}

/* ----------------------------------
   PC Controls
---------------------------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener("click", (e) => {
  if (renderer.xr.isPresenting) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  checkIntersects();
});

const keys = { forward: false, backward: false, left: false, right: false };
window.addEventListener("keydown", (e) => { if (keys.hasOwnProperty(e.code.replace('Key','').toLowerCase())) keys[e.code.replace('Key','').toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { if (keys.hasOwnProperty(e.code.replace('Key','').toLowerCase())) keys[e.code.replace('Key','').toLowerCase()] = false; });

function updateMovement(delta) {
  if (renderer.xr.isPresenting) return;
  const moveVec = new THREE.Vector3();
  if (keys.forward) moveVec.z -= 1;
  if (keys.backward) moveVec.z += 1;
  if (keys.left) moveVec.x -= 1;
  if (keys.right) moveVec.x += 1;
  if (moveVec.lengthSq() > 0) {
    moveVec.normalize();
    const yawEuler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ');
    moveVec.applyEuler(yawEuler);
    cameraRig.position.addScaledVector(moveVec, moveSpeed * delta);
  }
}

/* ----------------------------------
   XR Session
---------------------------------- */
renderer.xr.addEventListener('sessionstart', () => {
  controls.enabled = false;
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  cameraRig.add(controller1, controller2);

  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  cameraRig.add(controllerGrip1, controllerGrip2);

  laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]),
    new THREE.LineBasicMaterial({ color: 0x00ffcc })
  );
  laser.scale.z = 5;
  controller2.add(laser);

  controller2.addEventListener("selectstart", () => {
    tempMatrix.identity().extractRotation(controller2.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    checkIntersects();
  });
});

/* ----------------------------------
   Map & Billboard
---------------------------------- */
const mapGroup = new THREE.Group();
camera.add(mapGroup);
mapGroup.position.set(-0.3, 0.35, -1.2);
const mapMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.4, 0.4),
  new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load("./Map/MAP.png"), transparent: true, depthTest: false, depthWrite: false })
);
mapGroup.add(mapMesh);
mapGroup.visible = false;

function open360() { console.log("360"); }
function openMap() { mapGroup.visible = !mapGroup.visible; }
function openInfo() { console.log("情報"); }
function openSetting() { console.log("設定"); }
function exitApp() { console.log("終了"); }

function createBillboardButton({ position, iconUrl, title, popupImageUrl }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0x5aa0bd, transparent: true })));

  const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(iconUrl), transparent: true, alphaTest: 0.01 }));
  icon.position.set(0, 0.07, 0.01);
  group.add(icon);

  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.font = "bold 100px sans-serif"; ctx.fillText(title, 40, 140);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.10), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, alphaTest: 0.01 }));
  text.position.set(0, -0.10, 0.01);
  group.add(text);

  const popup = new THREE.Mesh();
  popup.position.set(0, 0.6, 0);
  popup.visible = false;
  new THREE.TextureLoader().load(popupImageUrl, (tex) => {
    popup.geometry = new THREE.PlaneGeometry(0.6 * (tex.image.width / tex.image.height), 0.6);
    popup.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  });
  group.add(popup);

  group.userData = { isBillboardButton: true, popup: popup, isOpen: false };
  billboardButtons.push(group);
  return group;
}

world.add(createBillboardButton({ position: new THREE.Vector3(0, 1.5, -3), iconUrl: "./icon/Info.png", title: "360°画像", popupImageUrl: "./Image/360_Image.png" }));
world.add(createBillboardButton({ position: new THREE.Vector3(2, 1.5, -4), iconUrl: "./icon/Info.png", title: "設備情報", popupImageUrl: "./Image/Facility_Info.png" }));

/* ----------------------------------
   Gaussian Splat
---------------------------------- */
const splat = new SplatMesh({
  url: './point_cloud_alpha_voxel_200k.ply',
  pointSize: 0.04,
  alphaTest: 0.003
});
splat.rotation.set(-Math.PI / 2, -Math.PI / 2, 0, "YXZ");
splat.position.set(8, 0, -130);
world.add(splat);

splat.onLoad = () => {
  isSplatLoaded = true;
  console.log("Splat loaded");
};

/* ----------------------------------
   Main Loop
---------------------------------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  // 1. XR入力処理
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    if (session) {
      session.inputSources.forEach((source) => {
        if (!source.gamepad) return;
        const axes = source.gamepad.axes;
        if (source.handedness === 'right') {
          const rx = axes[2] || 0; const ry = axes[3] || 0;
          if (Math.abs(rx) > stickDeadZone || Math.abs(ry) > stickDeadZone) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
            cameraRig.position.addScaledVector(forward, -ry * moveSpeed * delta);
            cameraRig.position.addScaledVector(right, -rx * moveSpeed * delta);
          }
        }
        if (source.handedness === 'left') {
          const lx = axes[2] || 0;
          if (Math.abs(lx) > stickDeadZone) cameraRig.rotation.y -= lx * stickSensitivity * delta;
        }
      });
    }

    if (controller2 && laser) {
      tempMatrix.identity().extractRotation(controller2.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      updateHover(raycaster.ray.origin, raycaster.ray.direction);
      const intersects = raycaster.intersectObjects(uiGroup.children, true);
      laser.scale.z = intersects.length > 0 ? intersects[0].distance : 5;
    }
  } else {
    // PCホバー
    raycaster.setFromCamera(mouse, camera);
    updateHover(raycaster.ray.origin, raycaster.ray.direction);
  }

  // 2. ビルボード更新
  billboardButtons.forEach(btn => {
    const target = new THREE.Vector3();
    camera.getWorldPosition(target);
    target.y = btn.position.y;
    btn.lookAt(target);
  });

  updateMovement(delta);
  if (controls.enabled) controls.update();

  // 3. Splat更新 (修正点)
  if (isSplatLoaded && splat.update) {
    // VR中ならXRカメラ、そうでなければ通常のカメラ
    const activeCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    
    // 行列を強制更新してから渡す（decomposeエラー対策）
    activeCamera.updateMatrixWorld(true);
    splat.update(activeCamera, renderer);
  }

  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});