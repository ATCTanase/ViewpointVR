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
let uiIsVisible = true;

const billboardButtons = [];

const params = new URLSearchParams(window.location.search);
const sceneName = params.get("model") || "GoiThermalPS2F";
const name = ["GoiThermalPS2F","OchiaiHydroelectricPS1F","GoiThermalPS1F","Showroom-12A"];
const modelConfigs = {
  [name[0]]: {
    ply: `./${name[0]}/Model/GoiThermalPS2F.ply`,
    position: [8,0,-130],
    rotation: [Math.PI, Math.PI/2, 0],
    scale: 1
  },
  [name[1]]: {
    ply: `./${name[1]}/Model/OchiaiHydroelectricPS1F.ply`,
    position: [2.5,2,-4],
    rotation: [THREE.MathUtils.degToRad(94),-Math.PI/2,0],
    scale: 10
  },
  [name[2]]: {
    ply: `./${name[2]}/Model/GoiThermalPS1F.ply`,
    position: [10,2,-25],//座標
    rotation: [THREE.MathUtils.degToRad(-100),THREE.MathUtils.degToRad(-95),0],//回転
    scale: 50//モデル自体のサイズ
  },
  [name[3]]: {
    ply: `./${name[3]}/Model/Showroom-12A.ply`,
    position: [-7,1,-5.5],
    rotation: [THREE.MathUtils.degToRad(-87.8),0,0],
    scale: 1
  }
};

const map = {
  [name[0]]: {map: `./${name[0]}/Image/Map.png` },
  [name[1]]: {map: `./${name[1]}/Image/Map.png` },
  [name[2]]: {map: `./${name[2]}/Image/Map.png` },
  [name[3]]: {map: `./${name[3]}/Image/Map.png` },
};

const billboardConfigs = {
  [name[0]]: [{
      position: new THREE.Vector3(0, 1.5, -3),
      iconUrl: "./icon/Info.png",
      title: "360°画像",
      popupImageUrl: `./${name[0]}/Image/360_Image.png`},
    {
      position: new THREE.Vector3(2, 1.5, -4),
      iconUrl: "./icon/Info.png",
      title: "設備情報",
      popupImageUrl: `./${name[0]}/Image/Facility_Info.png`
    }],
  [name[1]]: [{
      position: new THREE.Vector3(0, 1.5, -1.5),
      iconUrl: "./icon/Info.png",
      title: "360°画像",
      popupImageUrl: `./${name[1]}/Image/360_Image.png`},
    {
      position: new THREE.Vector3(2, 1.5, -2.5),
      iconUrl: "./icon/Info.png",
      title: "設備情報",
      popupImageUrl: `./${name[1]}/Image/Facility_Info.png`
  }],
    [name[2]]: [{
      position: new THREE.Vector3(0, 1.5, -3),
      iconUrl: "./icon/Info.png",
      title: "360°画像",
      popupImageUrl: `./${name[2]}/Image/360_Image.png`},
    {
      position: new THREE.Vector3(2, 1.5, -4),
      iconUrl: "./icon/Info.png",
      title: "設備情報",
      popupImageUrl: `./${name[2]}/Image/Facility_Info.png`
  }], 
   [name[3]]: [{
      position: new THREE.Vector3(0, 1.5, 0),
      iconUrl: "./icon/Info.png",
      title: "360°画像",
      popupImageUrl: `./${name[3]}/Image/360_Image.png`},
    {
      position: new THREE.Vector3(2, 1.5, -1),
      iconUrl: "./icon/Info.png",
      title: "設備情報",
      popupImageUrl: `./${name[3]}/Image/Facility_Info.png`
  }]
}

const modelConfig = modelConfigs[sceneName];
const billboardConfig = billboardConfigs[sceneName];

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
uiGroup.position.set(0, -0.5, -1.5);
camera.add(uiGroup);
const cameraGroup = new THREE.Group();
scene.add(cameraGroup);
cameraGroup.add(camera);
cameraGroup.position.set(0, 0, 3); 

const rotationSpeed = 2.0; 

const menu = new THREE.Group();
uiGroup.add(menu);
const BUTTON_W = 0.18;
const spacing = 0.21;

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  return shape;
}
function createMenuBar(width, height) {
  const radius = 0.05
  const shape = createRoundedRectShape(width, height, radius);
  const geometry = new THREE.ShapeGeometry(shape, 12);
  

  const material = new THREE.MeshBasicMaterial({
      color: 0x2f5f75,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthWrite: false
  });

  const bar = new THREE.Mesh(
    geometry,
    material
  );
  
  return bar;
}

const totalWidth =
  (menuData.length - 1) * spacing + BUTTON_W + 0.15; // 余白ちょい足し

const menuBar = createMenuBar(totalWidth, 0.3);
menuBar.renderOrder = 1000;
uiGroup.add(menuBar);

function createButton(data) {

  const group = new THREE.Group();
  const BUTTON_H = 0.18;
  const cornerRadius = 0.02; // 角丸の半径（お好みで調整）

  // 角丸の形状データを作成
  const roundedRectShape = createRoundedRectShape(BUTTON_W, BUTTON_H, cornerRadius);
  
  // PlaneGeometry の代わりに ShapeGeometry を使用
  const bgGeometry = new THREE.ShapeGeometry(roundedRectShape);

  //背景（見た目）
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: 0x5aa0bd,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false
  });
  const bg = new THREE.Mesh(bgGeometry, bgMaterial);
  bg.renderOrder = 1001; // HUDの優先度
  group.add(bg);

  //当たり判定（透明）
  const hitArea = new THREE.Mesh(
    bgGeometry,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  

  hitArea.userData.onClick = data.action;
  hitArea.userData.isButton = true;
  group.add(hitArea);
  
  hitArea.userData.bgMaterial = bgMaterial;
  hitArea.userData.defaultColor = new THREE.Color(0x5aa0bd);

  // アイコン
  const texture = new THREE.TextureLoader().load(data.icon);

  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
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
      depthTest: true,
      depthWrite: false
    })
  );

  text.position.set(0, -0.05, 0.002);
  text.renderOrder = 1002;
  group.add(text);

  return group;
}

menuData.forEach((data, i) => {

  const btn = createButton(data);

  btn.position.x =
    (i - (menuData.length - 1) / 2) * spacing;
  btn.position.y = -0.02; 

  uiGroup.add(btn);
});
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
raycaster.near = 0;
raycaster.far = 5;

window.addEventListener("click", (event) => {

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targets = uiIsVisible
    ? [...uiGroup.children, ...billboardButtons]
    : [...billboardButtons];
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
          if(btn == obj){
            clicked.userData.popup.visible = !clicked.userData.isOpen;
            clicked.userData.isOpen = !clicked.userData.isOpen;
          }else {
            btn.userData.popup.visible = false;
            btn.userData.isOpen = false;
          }
        });
        return;
      }

      obj = obj.parent;
    }
  }
});

function updateHover(rayOrigin, rayDirection) {
  if(!uiIsVisible) return;

  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);

  const intersects = raycaster.intersectObjects(uiGroup.children, true);

  let hovered = null;

  for (let i = 0; i < intersects.length; i++) {
    let obj = intersects[i].object;
    if (obj.userData?.isButton) {
      hovered = obj;
    }
  }

  // --- ホバー演出の更新 ---
  if (currentHover && currentHover !== hovered) {
    //元の色に戻す
    if (currentHover.userData.bgMaterial) {
      currentHover.userData.bgMaterial.color.copy(currentHover.userData.defaultColor);
    }
  }

  if (hovered && hovered !== currentHover) {
    //明るくする
    if (hovered.userData.bgMaterial) {
      const base = hovered.userData.defaultColor.clone();
      hovered.userData.bgMaterial.color.copy(base.multiplyScalar(1.3));
    }
  }

  currentHover = hovered;
}

function open360() {
  console.log("360");
}

function openMap() {
  console.log("MAP");
  mapGroup.visible = !mapGroup.visible ;
}

function openInfo() {
  console.log("情報");
}

function openSetting() {
  console.log("設定");
}

function exitApp() {
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    if (session) session.end();
  }else{
    window.location.reload();
  }
  console.log("終了");
}

// ---------------------------
// Map UI
// ---------------------------
async function Exists(url) {
  console.log("check url:", url);
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

const mapGroup = new THREE.Group();
camera.add(mapGroup);

// 左上配置（視界の左上）
mapGroup.position.set(-0.3, 0.35, -1.5);
const path = map[sceneName].map;
Exists(path).then(exists => {
  if (exists) {
  const mapTexture = new THREE.TextureLoader().load(path);

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

  mapMesh.renderOrder = 1002;
  // 初期は非表示
  mapGroup.visible = false;
  }
  else
  {}
});
function createBillboardButton({ position, iconUrl, title, popupImageUrl }) {

  const group = new THREE.Group();
  group.position.copy(position);

  const BUTTON_SIZE = 0.35;

  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x5aa0bd,
    transparent: false, 
    alphaTest: 0.01,
    depthWrite: true,
    depthTest: true,
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
      transparent: false,
      alphaTest: 0.01,
      depthWrite: true,
      depthTest: true
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
      transparent: false,
      alphaTest: 0.01,
      depthWrite: true,
      depthTest: true
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
      transparent: false,
      depthWrite: true,
      depthTest: true
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


billboardConfig.forEach(config => {  
  Exists(config.popupImageUrl).then(exists => {
  if (exists) {
    world.add(createBillboardButton({
      position: config.position,
      iconUrl: config.iconUrl,
      title: config.title,
      popupImageUrl: config.popupImageUrl
    }));
  }});
});

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
  right: false,
  up: false,
  down: false,
  sprint: false
};

window.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW": keys.forward = true; break;
      case "KeyS": keys.backward = true; break;
      case "KeyA": keys.left = true; break;
      case "KeyD": keys.right = true; break;
      case "KeyE": keys.up = true; break;
      case "KeyQ": keys.down = true; break;
      case "ShiftLeft":
      case "ShiftRight": keys.sprint = true; break;
      case "Escape": 
        uiIsVisible = !uiIsVisible;
        uiGroup.visible = uiIsVisible;
        if (!uiIsVisible) mapGroup.visible = false;
        break;
    }
  });

  window.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW": keys.forward = false; break;
      case "KeyS": keys.backward = false; break;
      case "KeyA": keys.left = false; break;
      case "KeyD": keys.right = false; break;    
      case "KeyE": keys.up = false; break;
      case "KeyQ": keys.down = false; break;
      case "ShiftLeft":
      case "ShiftRight": keys.sprint = false; break;
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
  if (keys.up) velocity.y += 1;
  if (keys.down) velocity.y -= 1;

  if (velocity.lengthSq() === 0) return;

  velocity.normalize();

  // カメラのY回転だけ取得
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
  move.y += velocity.y;

  const speedMultiplier = keys.sprint ? 3.0 : 1.0;
  move.multiplyScalar(moveSpeed * speedMultiplier * delta);

  camera.position.add(move);
}


/* ----------------------------------
   XR session switch
---------------------------------- */
renderer.xr.addEventListener('sessionstart', () => {

  controls.enabled = false;

  cameraGroup.position.set(0, 0, 3); 

  controllerGrip1 = renderer.xr.getControllerGrip(0);
  const model1 = controllerModelFactory.createControllerModel(controllerGrip1);
  controllerGrip1.add(model1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  const model2 = controllerModelFactory.createControllerModel(controllerGrip2);
  controllerGrip2.add(model2);

  cameraGroup.add(controllerGrip1, controllerGrip2);
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  cameraGroup.add(controller1, controller2);

  // レーザー作成
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);

  const material = new THREE.LineBasicMaterial({ 
    color: 0x00ffcc,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    renderOrder: 2001
  });
  controller1.addEventListener("selectstart", () => {
    uiIsVisible = !uiIsVisible;
    uiGroup.visible = uiIsVisible;
    if (!uiIsVisible) mapGroup.visible = false;
});

  laser = new THREE.Line(geometry, material);
  laser.renderOrder = 2001;
  laser.scale.z = 2;

  controller2.add(laser);

  // トリガー押下
  controller2.addEventListener("selectstart", () => {

    tempMatrix.identity().extractRotation(controller2.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const targets = uiIsVisible
      ? [...uiGroup.children, ...billboardButtons]
      : [...billboardButtons];
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
            if(btn == obj){
              clicked.userData.popup.visible = !clicked.userData.isOpen;
              clicked.userData.isOpen = !clicked.userData.isOpen;
            }else {
              btn.userData.popup.visible = false;
              btn.userData.isOpen = false;
            }
          });
          return;
        }
        
        obj = obj.parent;
      }
    }
  });
});


renderer.xr.addEventListener('sessionend', () => {
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
  url: modelConfig.ply,
  pointSize: 0.04,
  alphaTest: 0.003
});

//位置とスケール
splat.rotation.set(...modelConfig.rotation,"YXZ");
splat.position.set(...modelConfig.position);
splat.scale.setScalar(modelConfig.scale);
world.add(splat);

splat.traverse((obj) => {
  obj.renderOrder = 10;
  if (obj.isMesh && obj.material) {
    obj.material.depthTest = true;
    obj.material.transparent = false;
    obj.material.depthWrite = true; 
    obj.material.alphaTest = 0.1; 
    obj.material.needsUpdate = true;
  }
})

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
function applyTopOrder(object, orderValue) {
  if (!object) return;

  object.traverse(obj => {
    // すでにこのオーダーが適用済みならスキップ
    if (obj.userData.appliedOrder === orderValue) return;

    if (obj.isMesh || obj.isLine) {
      obj.renderOrder = orderValue;
      if (obj.material) {
        obj.material.depthTest = true;
        obj.material.depthWrite = true;
        obj.material.transparent = false;
      }
      // 適用済みフラグを立てる
      obj.userData.appliedOrder = orderValue;
      console.log("Controller settings applied to:", obj.name || "unnamed mesh");
    }
  });
}


const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (renderer.xr.isPresenting) {
    if (controllerGrip1) applyTopOrder(controllerGrip1, 2000);
    if (controllerGrip2) applyTopOrder(controllerGrip2, 2000);
  }

  if (renderer.xr.isPresenting) {

    const session = renderer.xr.getSession();
    let baseMoveSpeed = 2.0;

    if (session) {
      let isSprinting = false;
      session.inputSources.forEach((source) => {
        if (!source.gamepad) return;

        if (source.handedness === "right") {
          const grip = source.gamepad.buttons[1];
          if (grip?.pressed) {
            isSprinting = true;
          }
        }
      });

      const speed = isSprinting ? baseMoveSpeed * 3.0 : baseMoveSpeed;

      session.inputSources.forEach((source) => {
        if (!source.gamepad) return;

        const gp = source.gamepad;
        // 右手：回転
        if (source.handedness === "right") {

          const axes = gp.axes;
          let lx = axes[2] ?? 0;

          const stickDeadZone = 0.5;
          const stickSensitivity = 1.5;
          
          if (Math.abs(lx) < stickDeadZone) lx = 0;

          if (lx !== 0) {
            yaw -= lx * stickSensitivity * delta;
            cameraGroup.rotation.y = yaw;
          }
        }

        // 左手：移動
        if (source.handedness === "left") {

          const axes = gp.axes;
          let x = axes[2] ?? 0;
          let y = axes[3] ?? 0;

          const deadZone = 0.1;
          if (Math.abs(x) < deadZone) x = 0;
          if (Math.abs(y) < deadZone) y = 0;

          if (x !== 0 || y !== 0) {

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(forward, camera.up).normalize();

            cameraGroup.position.addScaledVector(forward, -y * speed * delta);
            cameraGroup.position.addScaledVector(right,  x * speed * delta);
          }
          // 上下
          const buttonX = gp.buttons[4];
          const buttonY = gp.buttons[5];

          if (buttonY?.pressed) {
            cameraGroup.position.y += speed * delta;
          }

          if (buttonX?.pressed) {
            cameraGroup.position.y -= speed * delta;
          }
        }
      });

      //レーザー
      if (controller2 && laser) {

        tempMatrix.identity().extractRotation(controller2.matrixWorld);

        raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        const targets = uiIsVisible
          ? [...uiGroup.children, ...billboardButtons]
          : [...billboardButtons];

        const intersects = raycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
          laser.scale.z = intersects[0].distance;
        } else {
          laser.scale.z = 2;
        }
      }
    }
  }

  
  cameraGroup.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  billboardButtons.forEach(btn => {
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camPos.y = btn.position.y;
    btn.lookAt(camPos);
  });

  updateCameraRotation();
  updateMovement(delta);

  
  updateHover(
    raycaster.ray.origin,
    raycaster.ray.direction
  );

  if (controls.enabled) {
    controls.update();
  }

  renderer.render(scene, camera);
});
