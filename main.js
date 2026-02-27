import * as THREE from 'three';
import { VRButton } from 'three/examples/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { XRControllerModelFactory } from 'three/examples/webxr/XRControllerModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();

let rightInputSource = null;
const moveSpeed = 3.0; 

let controller1, controller2;
let controllerGrip1, controllerGrip2;
let tempMatrix = new THREE.Matrix4();
let laser = null;
let currentHover = null;

const billboardButtons = [];

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
camera.position.set(0, 1.6, 0);


/* ----------------------------------
   UI
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
const cameraGroup = new THREE.Group();
scene.add(cameraGroup);
cameraGroup.add(camera);

const rotationSpeed = 2.0; 

const menu = new THREE.Group();
uiGroup.add(menu);
const BUTTON_W = 0.18;
const spacing = 0.21;

function createMenuBar(width, height) {
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
  return bar;
}

const totalWidth =
  (menuData.length - 1) * spacing + BUTTON_W + 0.15; // 余白ちょい足し

const menuBar = createMenuBar(totalWidth, 0.3);
menuBar.renderOrder = 9990;
uiGroup.add(menuBar);
function createButton(data) {

  const group = new THREE.Group();
  const BUTTON_H = 0.18;
  
  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W, BUTTON_H),
    new THREE.MeshBasicMaterial({ visible: false })
  );

  hitArea.userData.onClick = data.action;
  hitArea.userData.isButton = true;

  group.add(hitArea);

  // 背景
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: 0x5aa0bd,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false
  });

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W, BUTTON_H),
    bgMaterial
  );
  
  bg.renderOrder = 9991;
  group.add(bg);

  hitArea.userData.bgMaterial = bgMaterial;
  hitArea.userData.defaultColor = new THREE.Color(0x5aa0bd);

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
  icon.renderOrder = 9992;
  group.add(icon);

  // テキストCanvas
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 512, 256);

  ctx.textAlign = "center";
  ctx.fillStyle = "white";
  ctx.font = "bold 84px sans-serif";
  ctx.fillText(data.title, 256, 150);

  ctx.fillStyle = "#d0e6f0";
  ctx.font = "42px sans-serif";
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
  text.renderOrder = 9992;
  group.add(text);

  return group;
}

menuData.forEach((data, i) => {

  const btn = createButton(data);

  btn.position.x =
    (i - (menuData.length - 1) / 2) * spacing;

  uiGroup.add(btn);
});
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targets = [
    ...uiGroup.children,
    ...billboardButtons
  ];
  const intersects = raycaster.intersectObjects(targets, true);

  for (let i = 0; i < intersects.length; i++) {

    let obj = intersects[i].object;

    while (obj) {

      // =========================
      // HUDボタン
      // =========================
      if (obj.userData?.isButton) {

        const mat = obj.userData.bgMaterial;

        mat.color.multiplyScalar(0.7);

        setTimeout(() => {
          mat.color.copy(obj.userData.defaultColor);
        }, 120);

        obj.userData.onClick();
        return;
      }

      // =========================
      // Billboardボタン
      // =========================
      if (obj.userData?.isBillboardButton) {

        const clicked = obj;

        // 全部閉じる
        billboardButtons.forEach(btn => {
          btn.userData.popup.visible = false;
          btn.userData.isOpen = false;
        });

        // 開いてなければ開く
        if (!clicked.userData.isOpen) {
          clicked.userData.popup.visible = true;
          clicked.userData.isOpen = true;
        }

        return;
      }

      obj = obj.parent;
    }
  }
});

function updateHover(rayOrigin, rayDirection) {

  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);

  const intersects = raycaster.intersectObjects(uiGroup.children, true);

  let hovered = null;

  for (let i = 0; i < intersects.length; i++) {
    let obj = intersects[i].object;

    while (obj) {
      if (obj.userData?.isButton) {
        hovered = obj;
        break;
      }
      obj = obj.parent;
    }
    if (hovered) break;
  }

  // 前回のホバー解除
  if (currentHover && currentHover !== hovered) {
    currentHover.userData.bgMaterial.color.copy(
      currentHover.userData.defaultColor
    );
  }

  // 新ホバー
  if (hovered && hovered !== currentHover) {
    const base = hovered.userData.defaultColor.clone();
    hovered.userData.bgMaterial.color.copy(
      base.multiplyScalar(1.3)
    );
  }

  currentHover = hovered;
}

function open360() {
  console.log("360");
}

function openMap() {
  console.log("MAP");
  mapGroup.visible = !mapGroup.visible;
}

function openInfo() {
  console.log("情報");
}

function openSetting() {
  console.log("設定");
}

function exitApp() {
  console.log("終了");
}

// ---------------------------
// Map UI
// ---------------------------
const mapGroup = new THREE.Group();
camera.add(mapGroup);

// 左上配置（視界の左上）
mapGroup.position.set(-0.3, 0.35, -1.2);

const mapTexture = new THREE.TextureLoader().load("./Map/MAP.png");

const mapMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.4, 0.4),
  new THREE.MeshBasicMaterial({
    map: mapTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
);

mapGroup.add(mapMesh);

mapMesh.renderOrder = 9992;
// 初期は非表示
mapGroup.visible = false;

function createBillboardButton({ position, iconUrl, title, popupImageUrl }) {

  const group = new THREE.Group();
  group.position.copy(position);

  const BUTTON_SIZE = 0.35;

  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x5aa0bd,
    transparent: true
  });

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_SIZE, BUTTON_SIZE),
    bgMat
  );

  group.add(bg);

  // アイコン
  const iconSize = 0.16;
  const iconTex = new THREE.TextureLoader().load(iconUrl);
  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(iconSize, iconSize),
    new THREE.MeshBasicMaterial({
      map: iconTex,
      transparent: true,
      alphaTest: 0.01
    })
  );

icon.position.set(0, 0.07, 0.01);
group.add(icon);

  // タイトル
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "white";
  ctx.font = "bold 100px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, 40, 140);

  const textTex = new THREE.CanvasTexture(canvas);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.10),
    new THREE.MeshBasicMaterial({
      map: textTex,
      transparent: true,
      alphaTest: 0.01
    })
  );

  text.position.set(0, -0.10, 0.01);
  group.add(text);

  // ===== ポップアップ =====
  const loader = new THREE.TextureLoader();

  const popup = new THREE.Mesh();
  popup.position.set(0, 0.6, 0);
  popup.visible = false;

  loader.load(popupImageUrl, (texture) => {

    const image = texture.image;
    const aspect = image.width / image.height;

    const baseHeight = 0.6;   // 基準高さ
    const width = baseHeight * aspect;
    const height = baseHeight;

    popup.geometry = new THREE.PlaneGeometry(width, height);
    popup.material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });

  });

  group.add(popup);

  // ===== データ =====
  group.userData.isBillboardButton = true;
  group.userData.popup = popup;
  group.userData.isOpen = false;

  billboardButtons.push(group);

  return group;
}

world.add(createBillboardButton({
  position: new THREE.Vector3(0, 1.5, -3),
  iconUrl: "./icon/Info.png",
  title: "360°画像",
  popupImageUrl: "./Image/360_Image.png"
}));

world.add(createBillboardButton({
  position: new THREE.Vector3(2, 1.5, -4),
  iconUrl: "./icon/Info.png",
  title: "設備情報",
  popupImageUrl: "./Image/Facility_Info.png"
}));

/* ----------------------------------
   PC Controls (OrbitControls)
---------------------------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.enableDamping = true;
controls.enabled = true;
controls.update();
let yaw = 0;
let pitch = 0;

const sensitivity = 0.002;
let isDragging = false;


renderer.domElement.addEventListener("mousedown", () => {
  isDragging = true;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mousemove", (event) => {

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  updateHover(
    raycaster.ray.origin,
    raycaster.ray.direction
  );

  if (!isDragging) return;

  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;

  // 上下制限
  pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
});

function updateCameraRotation() {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

window.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW": keys.forward = true; break;
      case "KeyS": keys.backward = true; break;
      case "KeyA": keys.left = true; break;
      case "KeyD": keys.right = true; break;
    }
  });

  window.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW": keys.forward = false; break;
      case "KeyS": keys.backward = false; break;
      case "KeyA": keys.left = false; break;
      case "KeyD": keys.right = false; break;
    }
  });

const velocity = new THREE.Vector3();
function updateMovement(delta) {
  if (renderer.xr.isPresenting) return;

  controls.enabled = false;
  velocity.set(0, 0, 0);

  if (keys.forward) velocity.z += 1;
  if (keys.backward) velocity.z -= 1;
  if (keys.left) velocity.x -= 1;
  if (keys.right) velocity.x += 1;

  if (velocity.lengthSq() === 0) return;

  velocity.normalize();

  // 🔥 カメラのY回転だけ取得
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  euler.setFromQuaternion(camera.quaternion);

  const yaw = euler.y;

  const forward = new THREE.Vector3(
    -Math.sin(yaw),
    0,
    -Math.cos(yaw)
  );

  const right = new THREE.Vector3(
    Math.cos(yaw),
    0,
    -Math.sin(yaw)
  );

  const move = new THREE.Vector3();
  move.addScaledVector(forward, velocity.z);
  move.addScaledVector(right, velocity.x);

  move.multiplyScalar(moveSpeed * delta);

  camera.position.add(move);
}


/* ----------------------------------
   XR session switch
---------------------------------- */
renderer.xr.addEventListener('sessionstart', () => {

  controls.enabled = false;
  world.position.set(0, 0, -3);

    // 表示用（見える）
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1)
  ); 
  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2)
  );
  
  controllerGrip1.renderOrder = 10000;
  controllerGrip2.renderOrder = 10000;
  cameraGroup.add(controllerGrip1, controllerGrip2);
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  cameraGroup.add(controller1, controller2);

  // レーザー作成
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);

  const material = new THREE.LineBasicMaterial({ color: 0x00ffcc });

  laser = new THREE.Line(geometry, material);
  laser.scale.z = 5;

  controller2.add(laser);

  // トリガー押下
  controller2.addEventListener("selectstart", () => {

    tempMatrix.identity().extractRotation(controller2.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const targets = [
      ...uiGroup.children,
      ...billboardButtons
    ];
    const intersects = raycaster.intersectObjects(targets, true);

    for (let i = 0; i < intersects.length; i++) {

      let obj = intersects[i].object;

      while (obj) {

        // =========================
        // HUDボタン
        // =========================
        if (obj.userData?.isButton) {

          const mat = obj.userData.bgMaterial;

          mat.color.multiplyScalar(0.7);

          setTimeout(() => {
            mat.color.copy(obj.userData.defaultColor);
          }, 120);

          obj.userData.onClick();
          return;
        }

        // =========================
        // Billboardボタン
        // =========================
        if (obj.userData?.isBillboardButton) {

          const clicked = obj;

          // 全部閉じる
          billboardButtons.forEach(btn => {
            btn.userData.popup.visible = false;
            btn.userData.isOpen = false;
          });

          // 開いてなければ開く
          if (!clicked.userData.isOpen) {
            clicked.userData.popup.visible = true;
            clicked.userData.isOpen = true;
          }

          return;
        }

        obj = obj.parent;
      }
    }
  });
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
//  world.add(new THREE.AxesHelper(1));
//  world.add(new THREE.GridHelper(10, 10));

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
console.log(splat.uniforms);

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
          const x = axes[2] ?? 0; // スティック左右
          const y = axes[3] ?? 0; // スティック前後

          if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
            // カメラが向いている方向を取得
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0; // 地面を這うように移動
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(camera.up, forward).normalize();

            // cameraGroup 自体を移動させる
            // yはスティック上方向がマイナスのため、引き算で前に進む
            cameraGroup.position.addScaledVector(forward, -y * moveSpeed * delta);
            cameraGroup.position.addScaledVector(right, x * moveSpeed * delta);
          }
        }        
        if (source.handedness === 'left' && source.gamepad) {
          const axes = source.gamepad.axes;
          const x = axes[2] ?? 0; // スティック左右

          if (Math.abs(x) > 0.1) {
            // 世界ではなく、カメラを包んでいるグループを回転させる
            cameraGroup.rotation.y -= x * rotationSpeed * delta;
          }
        }
    })
    if (controller2 && laser) {

      tempMatrix.identity().extractRotation(controller2.matrixWorld);

      raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      const intersects = raycaster.intersectObjects(uiGroup.children, true);

      if (intersects.length > 0) {
        laser.scale.z = intersects[0].distance;
      } else {
        laser.scale.z = 5;
      }
    }
  }

  updateHover(
    raycaster.ray.origin,
    raycaster.ray.direction
  );

  billboardButtons.forEach(btn => {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos); // cameraGroupの回転も考慮された座標が取れる
    camPos.y = btn.position.y;
    btn.lookAt(camPos);
  });

  updateCameraRotation();
  updateMovement(delta);

  if (controls.enabled) {
    controls.update(); // PC操作時のみ
  }
  renderer.render(scene, camera);
});
