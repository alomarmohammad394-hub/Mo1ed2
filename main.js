import * as THREE from "three";

// -------------------- Renderer / Scene / Camera --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3ff);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

// -------------------- Licht --------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// -------------------- Boden --------------------
const floorGeo = new THREE.PlaneGeometry(200, 200);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2f8f2f, roughness: 1 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// kleine “Arena”-Wände (einfach fürs Gefühl)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b4b4b });
function addWall(x, z, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  m.position.set(x, h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}
addWall(0, -100, 200, 6, 2);
addWall(0, 100, 200, 6, 2);
addWall(-100, 0, 2, 6, 200);
addWall(100, 0, 2, 6, 200);

// -------------------- Spieler --------------------
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.6 })
);
player.position.set(0, 1.2, 0);
player.castShadow = true;
scene.add(player);

// “Waffe” nur als kleines Teil am Spieler
const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.12, 0.55),
  new THREE.MeshStandardMaterial({ color: 0x111111 })
);
gun.position.set(0.35, 0.2, -0.2);
player.add(gun);

// -------------------- Steuerung: WASD + Maus --------------------
const keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyW") keys.w = true;
  if (e.code === "KeyA") keys.a = true;
  if (e.code === "KeyS") keys.s = true;
  if (e.code === "KeyD") keys.d = true;
  if (e.code === "ShiftLeft") keys.shift = true;
  if (e.code === "Space") keys.space = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyA") keys.a = false;
  if (e.code === "KeyS") keys.s = false;
  if (e.code === "KeyD") keys.d = false;
  if (e.code === "ShiftLeft") keys.shift = false;
  if (e.code === "Space") keys.space = false;
});

// Pointer Lock (Maus in-game)
let pointerLocked = false;
renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

let yaw = 0;   // links/rechts
let pitch = 0; // hoch/runter
document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  const sensitivity = 0.0022;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch = Math.max(-1.1, Math.min(1.1, pitch));
});

// -------------------- Physik (simpel) --------------------
const velocity = new THREE.Vector3();
const GRAVITY = -22;      // stärker = “echter”
const MOVE_SPEED = 6.5;
const SPRINT_MULT = 1.6;
const JUMP_VELOCITY = 8.5;

let onGround = false;

// Boden ist bei y=0. Capsule: Mittelpunkt muss bei mind. ~0.9 sein, damit sie “steht”.
const groundY = 0;
const playerStandY = 0.35 + 0.9; // radius + halfHeight = ca 1.25 (passt gut)

// -------------------- Bullets --------------------
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.05, 10, 10);
const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffd54f });

function shoot() {
  // Richtung aus Kamera (Third-person aim)
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir).normalize();

  const b = new THREE.Mesh(bulletGeo, bulletMat);
  b.castShadow = true;

  // Spawn vor der Kamera, nicht im Spieler
  const spawn = camera.position.clone().add(dir.clone().multiplyScalar(1.0));
  b.position.copy(spawn);

  bullets.push({
    mesh: b,
    vel: dir.multiplyScalar(35),
    life: 2.0,
  });

  scene.add(b);
}

window.addEventListener("mousedown", (e) => {
  if (!pointerLocked) return;
  if (e.button === 0) shoot(); // Linksklick
});

// -------------------- Kamera (Third Person) --------------------
const camOffset = new THREE.Vector3(0, 1.6, 3.8); // hinter + leicht hoch

function updateCamera(dt) {
  // Spieler schaut in yaw Richtung
  player.rotation.y = yaw;

  // Kamera-Offset rotiert mit yaw (damit sie hinter dem Spieler bleibt)
  const rotatedOffset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  // Zielposition der Kamera
  const targetPos = player.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  const desiredCamPos = player.position.clone().add(rotatedOffset);

  // Smooth Kamera
  camera.position.lerp(desiredCamPos, 1 - Math.pow(0.000001, dt));
  camera.lookAt(targetPos);

  // Pitch: wir kippen die Kamera hoch/runter, ohne den Spieler zu kippen
  camera.rotateX(pitch);
}

// -------------------- Bewegung --------------------
function updateMovement(dt) {
  // Bewegung relativ zur Blickrichtung (yaw)
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(forward);
  if (keys.s) moveDir.sub(forward);
  if (keys.d) moveDir.add(right);
  if (keys.a) moveDir.sub(right);

  if (moveDir.lengthSq() > 0) moveDir.normalize();

  let speed = MOVE_SPEED * (keys.shift ? SPRINT_MULT : 1);

  // Horizontal velocity setzen (Y lassen wir für Sprung/Gravity)
  velocity.x = moveDir.x * speed;
  velocity.z = moveDir.z * speed;

  // Gravity
  velocity.y += GRAVITY * dt;

  // Springen
  if (keys.space && onGround) {
    velocity.y = JUMP_VELOCITY;
    onGround = false;
  }

  // Position updaten
  player.position.x += velocity.x * dt;
  player.position.y += velocity.y * dt;
  player.position.z += velocity.z * dt;

  // Boden-Kollision (simpel)
  if (player.position.y <= playerStandY) {
    player.position.y = playerStandY;
    velocity.y = 0;
    onGround = true;
  }

  // Mini Begrenzung (Arena)
  player.position.x = Math.max(-95, Math.min(95, player.position.x));
  player.position.z = Math.max(-95, Math.min(95, player.position.z));
}

// -------------------- Bullets updaten --------------------
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;

    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }
}

// -------------------- UI Hint --------------------
const hint = document.createElement("div");
hint.style.position = "fixed";
hint.style.left = "12px";
hint.style.bottom = "12px";
hint.style.padding = "10px 12px";
hint.style.background = "rgba(0,0,0,0.55)";
hint.style.color = "white";
hint.style.fontFamily = "system-ui, Arial";
hint.style.fontSize = "14px";
hint.style.borderRadius = "10px";
hint.style.userSelect = "none";
hint.innerHTML = `
<b>Klick ins Fenster</b> (Maus lock)<br/>
WASD = laufen · Shift = sprint · Space = jump<br/>
Linksklick = schießen · ESC = Maus frei
`;
document.body.appendChild(hint);

// -------------------- Resize --------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------- Loop --------------------
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updateMovement(dt);
  updateCamera(dt);
  updateBullets(dt);

  renderer.render(scene, camera);
}
animate(last);
