import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// =====================================================================
// DOM
// =====================================================================
const canvas = document.getElementById('c') as HTMLCanvasElement;
const main = canvas.parentElement as HTMLElement;
const bgEl = document.getElementById('bg') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;

// =====================================================================
// Renderer — matches the app's setup, plus color management
// =====================================================================
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Color management (item #11 — "color management sanity")
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // toggled on by the ACES group
renderer.toneMappingExposure = 1.0;

// =====================================================================
// Scene
// =====================================================================
const scene = new THREE.Scene();

// Shadow-catcher floor (same approach as src/three/sceneSetup.ts)
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ opacity: 0.35 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ---- Test primitives ----
// A mini-version of the app's scenes: varied heights, stacks, mix of shapes
// and materials so every effect has something to work on.
const meshList: THREE.Mesh[] = [];
function addCube(
  x: number,
  y: number,
  z: number,
  color: string,
  roughness = 0.55,
  metalness = 0.05,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
    }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  meshList.push(m);
  return m;
}

// Central stack
addCube(0, 0.5, 0, '#e3b23c');
addCube(0, 1.5, 0, '#d96e4e');
addCube(1, 0.5, 0, '#6b7280');
addCube(-1, 0.5, 0, '#7a9e7e');
addCube(0, 0.5, 1, '#9bb0c9');
addCube(0, 0.5, -1, '#c9a86b');
// Taller pillar
addCube(2, 0.5, -2, '#5a6b8a');
addCube(2, 1.5, -2, '#5a6b8a');
addCube(2, 2.5, -2, '#5a6b8a');
// Metallic cube
addCube(-2, 0.5, 2, '#c0c4cc', 0.25, 0.9);
// Rough dark cube (reads SSAO well)
addCube(-2, 0.5, -2, '#2a2d35', 0.9, 0.0);
// Slim tile
const tile = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.25, 1),
  new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.7 }),
);
tile.position.set(1, 0.125, 2);
tile.castShadow = true;
tile.receiveShadow = true;
scene.add(tile);
meshList.push(tile);

// =====================================================================
// Lights — three-point rig (key + fill + rim) + ambient
// =====================================================================
//
// DESIGN CALL (user-tunable via sidebar):
// Classic rig ratio ≈ key:fill:rim = 1.0 : 0.3–0.5 : 0.5–1.0
// - Key casts the shadow; high elevation + side angle keeps the iso silhouette readable.
// - Fill is cool/dim, opposite side, no shadows — lifts the shaded side.
// - Rim is warm/bright, behind subject, low elevation — pops edges off the background.
// Tuning knobs in the UI let you shift the whole vibe (cinematic vs toy vs clean product).

const ambient = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -20;
keyLight.shadow.camera.right = 20;
keyLight.shadow.camera.top = 20;
keyLight.shadow.camera.bottom = -20;
keyLight.shadow.bias = -0.00005;
keyLight.shadow.normalBias = 0.04;
keyLight.shadow.radius = 4;
positionDirectional(keyLight, 40, 55, 14);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xcfe1ff, 1.2);
positionDirectional(fillLight, 220, 30, 14);
fillLight.visible = false; // toggled by rim group
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffe3c2, 2.5);
positionDirectional(rimLight, 220, 20, 14);
rimLight.visible = false;
scene.add(rimLight);

function positionDirectional(
  light: THREE.DirectionalLight,
  azDeg: number,
  elDeg: number,
  distance: number,
) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elDeg * Math.PI) / 180;
  light.position.set(
    distance * Math.cos(el) * Math.sin(az),
    distance * Math.sin(el),
    distance * Math.cos(el) * Math.cos(az),
  );
}

// =====================================================================
// Environment (IBL) — RoomEnvironment, same trick three.js editor uses
// =====================================================================
let envTexture: THREE.Texture | null = null;
let envIntensity = 1.0;
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
  // Do NOT assign to scene.environment yet — only when the toggle is ON.
}

// =====================================================================
// Camera — iso ortho, 30° angle (matches app default)
// =====================================================================
function makeCamera() {
  const w = main.clientWidth;
  const h = main.clientHeight;
  const zoom = 7;
  const aspect = w / h;
  const cam = new THREE.OrthographicCamera(
    -zoom * aspect,
    zoom * aspect,
    zoom,
    -zoom,
    -100,
    100,
  );
  const angleDeg = 30;
  const rad = (angleDeg * Math.PI) / 180;
  const horiz = zoom * Math.cos(rad);
  const vert = zoom * Math.sin(rad);
  const diag = horiz / Math.SQRT2;
  cam.position.set(diag, vert, diag);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  return cam;
}
let camera = makeCamera();

// =====================================================================
// Composer + passes
// =====================================================================
let composer = new EffectComposer(renderer);
let renderPass = new RenderPass(scene, camera);
let ssaoPass: SSAOPass;
let outlinePass: OutlinePass;
let tiltPass: ShaderPass;
let smaaPass: SMAAPass;
let outputPass: OutputPass;

function buildComposer() {
  const w = main.clientWidth;
  const h = main.clientHeight;

  composer = new EffectComposer(renderer);
  composer.setSize(w, h);

  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  ssaoPass = new SSAOPass(scene, camera, w, h);
  ssaoPass.kernelRadius = 0.3;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.1;
  ssaoPass.enabled = false;
  composer.addPass(ssaoPass);

  outlinePass = new OutlinePass(new THREE.Vector2(w, h), scene, camera);
  outlinePass.selectedObjects = meshList;
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeThickness = 2.0;
  outlinePass.edgeGlow = 0.0;
  outlinePass.visibleEdgeColor.set('#1a1a1a');
  outlinePass.hiddenEdgeColor.set('#1a1a1a');
  outlinePass.enabled = false;
  composer.addPass(outlinePass);

  tiltPass = new ShaderPass(TiltShiftShader);
  tiltPass.uniforms.resolution.value.set(w, h);
  tiltPass.enabled = false;
  composer.addPass(tiltPass);

  smaaPass = new SMAAPass(w, h);
  smaaPass.enabled = false;
  composer.addPass(smaaPass);

  outputPass = new OutputPass();
  composer.addPass(outputPass);
}

// Tilt-shift shader — screen-Y distance from focus line drives blur radius.
// A small 5×5 box blur is cheap and reads well for iso scenes at prototype
// quality. The `weightForDistance` call is the artistic curve — play with
// it if the falloff feels wrong (linear feels harsh, smoothstep feels
// photographic, pow(x, 0.5) keeps more of the image in focus).
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focusY: { value: 0.5 },
    focusRange: { value: 0.15 },
    maxBlur: { value: 3.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focusY;
    uniform float focusRange;
    uniform float maxBlur;
    varying vec2 vUv;

    float weightForDistance(float d, float range) {
      // smoothstep: photographic falloff. Returns 0 in-focus, 1 fully blurred.
      return smoothstep(range, range + 0.30, d);
    }

    void main() {
      float d = abs(vUv.y - focusY);
      float t = weightForDistance(d, focusRange);
      float r = maxBlur * t;

      if (r < 0.01) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 px = r / resolution;
      vec4 sum = vec4(0.0);
      // 5×5 box kernel = 25 taps. Enough for prototype quality.
      for (float i = -2.0; i <= 2.0; i += 1.0) {
        for (float j = -2.0; j <= 2.0; j += 1.0) {
          sum += texture2D(tDiffuse, vUv + vec2(i, j) * px);
        }
      }
      gl_FragColor = sum / 25.0;
    }
  `,
};

buildComposer();

// =====================================================================
// Rendering
// =====================================================================
let dirty = true;
function requestRender() {
  dirty = true;
}

function render() {
  composer.render();
  updateHud();
}

function updateHud() {
  const parts: string[] = [];
  if (renderer.toneMapping === THREE.ACESFilmicToneMapping) parts.push('ACES');
  if (scene.environment) parts.push('IBL');
  if (fillLight.visible) parts.push('3-light');
  if (ssaoPass.enabled) parts.push('SSAO');
  if (outlinePass.enabled) parts.push('outline');
  if (tiltPass.enabled) parts.push('tilt-shift');
  if (smaaPass.enabled) parts.push('SMAA');
  if (renderer.shadowMap.type === THREE.VSMShadowMap) parts.push('VSM');
  hud.textContent = parts.length ? parts.join(' · ') : 'baseline (no effects)';
}

function tick() {
  if (dirty) {
    render();
    dirty = false;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// =====================================================================
// Resize
// =====================================================================
const ro = new ResizeObserver(() => {
  const w = main.clientWidth;
  const h = main.clientHeight;
  renderer.setSize(w, h, false);
  camera = makeCamera();
  buildComposer();
  applyAllStateToComposer();
  requestRender();
});
ro.observe(main);

// =====================================================================
// UI wiring
// =====================================================================
function $(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function bindGroup(groupId: string, checkboxId: string, onChange: (on: boolean) => void) {
  const group = $(groupId) as HTMLDivElement;
  const cb = $(checkboxId) as HTMLInputElement;
  // Header click toggles (but don't double-fire when clicking the actual checkbox)
  group.querySelector('header')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT') {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    }
  });
  cb.addEventListener('change', () => {
    group.dataset.on = String(cb.checked);
    onChange(cb.checked);
    requestRender();
  });
}

function bindRange(id: string, onChange: (v: number) => void, decimals = 2) {
  const input = $(id) as HTMLInputElement;
  const valEl = document.getElementById(`${id}-v`);
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (valEl) valEl.textContent = v.toFixed(decimals);
    onChange(v);
    requestRender();
  });
}

function bindColor(id: string, onChange: (hex: string) => void) {
  const input = $(id) as HTMLInputElement;
  input.addEventListener('input', () => {
    onChange(input.value);
    requestRender();
  });
}

// ---- Tonemap ----
bindGroup('g-tonemap', 'tonemap-on', (on) => {
  renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  // Materials need recompile when tonemapping changes
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material && 'needsUpdate' in o.material) {
      (o.material as THREE.Material).needsUpdate = true;
    }
  });
});
bindRange('exposure', (v) => {
  renderer.toneMappingExposure = v;
});

// ---- Environment ----
bindGroup('g-env', 'env-on', (on) => {
  scene.environment = on && envTexture ? envTexture : null;
  scene.environmentIntensity = envIntensity;
});
bindRange('env-int', (v) => {
  envIntensity = v;
  scene.environmentIntensity = v;
});

// ---- Rim / fill ----
bindGroup('g-rim', 'rim-on', (on) => {
  fillLight.visible = on;
  rimLight.visible = on;
});
bindRange('fill-int', (v) => (fillLight.intensity = v));
bindColor('fill-col', (hex) => fillLight.color.set(hex));
bindRange('rim-int', (v) => (rimLight.intensity = v));
bindColor('rim-col', (hex) => rimLight.color.set(hex));
bindRange('rim-az', (v) => positionDirectional(rimLight, v, 20, 14), 0);

// ---- Background ----
let bgMode: 'linear' | 'radial' = 'linear';
let bgTop = '#e8ecf4';
let bgBot = '#a7b2c4';
function applyBg(on: boolean) {
  if (!on) {
    bgEl.style.background = '#444';
    return;
  }
  bgEl.style.background =
    bgMode === 'linear'
      ? `linear-gradient(180deg, ${bgTop} 0%, ${bgBot} 100%)`
      : `radial-gradient(ellipse at center, ${bgTop} 0%, ${bgBot} 100%)`;
}
bindGroup('g-bg', 'bg-on', applyBg);
bindColor('bg-top', (hex) => {
  bgTop = hex;
  applyBg(($('bg-on') as HTMLInputElement).checked);
});
bindColor('bg-bot', (hex) => {
  bgBot = hex;
  applyBg(($('bg-on') as HTMLInputElement).checked);
});
$('bg-linear').addEventListener('click', () => {
  bgMode = 'linear';
  $('bg-linear').dataset.active = 'true';
  $('bg-radial').dataset.active = 'false';
  applyBg(($('bg-on') as HTMLInputElement).checked);
});
$('bg-radial').addEventListener('click', () => {
  bgMode = 'radial';
  $('bg-linear').dataset.active = 'false';
  $('bg-radial').dataset.active = 'true';
  applyBg(($('bg-on') as HTMLInputElement).checked);
});

// ---- SSAO ----
bindGroup('g-ssao', 'ssao-on', (on) => (ssaoPass.enabled = on));
bindRange('ssao-r', (v) => (ssaoPass.kernelRadius = v));
bindRange('ssao-min', (v) => (ssaoPass.minDistance = v), 4);
bindRange('ssao-max', (v) => (ssaoPass.maxDistance = v));

// ---- Outline ----
bindGroup('g-outline', 'outline-on', (on) => (outlinePass.enabled = on));
bindRange('outline-thick', (v) => (outlinePass.edgeThickness = v), 1);
bindRange('outline-str', (v) => (outlinePass.edgeStrength = v), 1);
bindColor('outline-col', (hex) => {
  outlinePass.visibleEdgeColor.set(hex);
  outlinePass.hiddenEdgeColor.set(hex);
});

// ---- Tilt-shift ----
bindGroup('g-tilt', 'tilt-on', (on) => (tiltPass.enabled = on));
bindRange('tilt-y', (v) => (tiltPass.uniforms.focusY.value = v));
bindRange('tilt-range', (v) => (tiltPass.uniforms.focusRange.value = v));
bindRange('tilt-blur', (v) => (tiltPass.uniforms.maxBlur.value = v), 1);

// ---- Shadow ----
bindGroup('g-shadow', 'shadow-on', (on) => {
  keyLight.castShadow = on;
  floor.visible = on;
});
bindRange('shadow-rad', (v) => (keyLight.shadow.radius = v), 1);
bindRange('shadow-op', (v) => {
  (floor.material as THREE.ShadowMaterial).opacity = v;
});
function setShadowType(vsm: boolean) {
  renderer.shadowMap.type = vsm ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.needsUpdate = true;
  // Materials need recompile when shadow map type changes
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material && 'needsUpdate' in o.material) {
      (o.material as THREE.Material).needsUpdate = true;
    }
  });
  $('shadow-pcf').dataset.active = String(!vsm);
  $('shadow-vsm').dataset.active = String(vsm);
}
$('shadow-pcf').addEventListener('click', () => {
  setShadowType(false);
  requestRender();
});
$('shadow-vsm').addEventListener('click', () => {
  setShadowType(true);
  requestRender();
});

// ---- SMAA ----
bindGroup('g-smaa', 'smaa-on', (on) => (smaaPass.enabled = on));

// Some state is lost when we rebuild the composer on resize. Re-apply all of
// it from the DOM inputs in one pass.
function applyAllStateToComposer() {
  ssaoPass.enabled = ($('ssao-on') as HTMLInputElement).checked;
  ssaoPass.kernelRadius = parseFloat(($('ssao-r') as HTMLInputElement).value);
  ssaoPass.minDistance = parseFloat(($('ssao-min') as HTMLInputElement).value);
  ssaoPass.maxDistance = parseFloat(($('ssao-max') as HTMLInputElement).value);

  outlinePass.enabled = ($('outline-on') as HTMLInputElement).checked;
  outlinePass.edgeThickness = parseFloat(($('outline-thick') as HTMLInputElement).value);
  outlinePass.edgeStrength = parseFloat(($('outline-str') as HTMLInputElement).value);
  outlinePass.visibleEdgeColor.set(($('outline-col') as HTMLInputElement).value);
  outlinePass.hiddenEdgeColor.set(($('outline-col') as HTMLInputElement).value);
  outlinePass.selectedObjects = meshList;

  tiltPass.enabled = ($('tilt-on') as HTMLInputElement).checked;
  tiltPass.uniforms.focusY.value = parseFloat(($('tilt-y') as HTMLInputElement).value);
  tiltPass.uniforms.focusRange.value = parseFloat(($('tilt-range') as HTMLInputElement).value);
  tiltPass.uniforms.maxBlur.value = parseFloat(($('tilt-blur') as HTMLInputElement).value);

  smaaPass.enabled = ($('smaa-on') as HTMLInputElement).checked;
}

requestRender();
