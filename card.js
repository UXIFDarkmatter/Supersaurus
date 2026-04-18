import * as THREE from "three";

const CARDS = [
  { color: "images/People/9.png",  depth: "images/People/9_depth.jpg",  name: "Garrett", title: "CEO" },
  { color: "images/People/1.png",  depth: "images/People/1_depth.jpg",  name: "Wes",     title: "Game Director" },
  { color: "images/People/2.png",  depth: "images/People/2_depth.jpg",  name: "Matt",    title: "Tech Director" },
  { color: "images/People/3.png",  depth: "images/People/3_depth.jpg",  name: "Hayden",  title: "Game Designer" },
  { color: "images/People/4.png",  depth: "images/People/4_depth.jpg",  name: "Chris",   title: "Engineer" },
  { color: "images/People/5.png",  depth: "images/People/5_depth.jpg",  name: "Michael", title: "Game Designer" },
  { color: "images/People/6.png",  depth: "images/People/6_depth.jpg",  name: "Mike",    title: "VFX Artist" },
  { color: "images/People/7.png",  depth: "images/People/7_depth.jpg",  name: "Jacob",   title: "Environment Artist" },
  { color: "images/People/8.png",  depth: "images/People/8_depth.jpg",  name: "Adri",    title: "VFX Artist" },
  { color: "images/People/10.png", depth: "images/People/10_depth.jpg", name: "Nate",    title: "Animator" },
];

const DEPTH_DISPLACEMENT = 0.22;
const POINTER_RANGE = 0.38;
const GRID_SEGMENTS = 160;
const CROP_INSET = 0.09;
const BLOOM_DURATION_MS = 1100;
const BLOOM_DELAY_MS = 250;

const params = new URLSearchParams(location.search);
const rawId = Number(params.get("i"));
const id = Number.isFinite(rawId) ? Math.max(0, Math.min(CARDS.length - 1, rawId)) : 0;
const data = CARDS[id];

const slot = document.getElementById("cardSlot");
slot.innerHTML = `
  <div class="people-tile" id="cardTile"><canvas id="cardCanvas"></canvas></div>
  <div class="people-caption">
    <p class="people-name">${data.name}</p>
    <p class="people-title">${data.title}</p>
  </div>
`;

const tileEl = document.getElementById("cardTile");
const canvas = document.getElementById("cardCanvas");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const CAMERA_Z = 3.2;
camera.position.set(0, 0, CAMERA_Z);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

let mesh = null;
let material = null;
let imageAspect = 1;

function fit() {
  const w = tileEl.clientWidth;
  const h = tileEl.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!mesh) return;
  const vFov = (camera.fov * Math.PI) / 180;
  const viewH = 2 * Math.tan(vFov / 2) * CAMERA_Z;
  const viewW = viewH * camera.aspect;
  let pw, ph;
  if (imageAspect > camera.aspect) {
    ph = viewH;
    pw = viewH * imageAspect;
  } else {
    pw = viewW;
    ph = viewW / imageAspect;
  }
  mesh.scale.set(pw, ph, 1);
}

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
tileEl.addEventListener("pointermove", (e) => {
  const rect = tileEl.getBoundingClientRect();
  pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
  pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
});
tileEl.addEventListener("pointerleave", () => {
  pointer.tx = 0;
  pointer.ty = 0;
});

const loader = new THREE.TextureLoader();
const load = (src) =>
  new Promise((resolve, reject) => loader.load(src, resolve, undefined, reject));

Promise.all([load(data.color), load(data.depth)])
  .then(([colorTex, depthTex]) => {
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    imageAspect = colorTex.image.width / colorTex.image.height;
    tileEl.style.aspectRatio = `${colorTex.image.width} / ${colorTex.image.height}`;

    const geo = new THREE.PlaneGeometry(1, 1, GRID_SEGMENTS, GRID_SEGMENTS);
    material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uColor: { value: colorTex },
        uDepth: { value: depthTex },
        uDisplacement: { value: DEPTH_DISPLACEMENT },
        uCropInset: { value: CROP_INSET },
        uProgress: { value: 0 },
        uBloomCenter: {
          value: new THREE.Vector2(
            0.5 + (Math.random() - 0.5) * 0.3,
            0.55 + (Math.random() - 0.5) * 0.2
          ),
        },
        uSeed: { value: Math.random() * 100 },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uDepth;
        uniform float uDisplacement;
        uniform float uCropInset;
        varying vec2 vUv;
        varying vec2 vTileUv;
        void main() {
          vTileUv = uv;
          float s = 1.0 - 2.0 * uCropInset;
          vUv = (uv - 0.5) * s + 0.5;
          float d = texture2D(uDepth, vUv).r;
          vec3 pos = position + vec3(0.0, 0.0, d * uDisplacement);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uColor;
        uniform float uProgress;
        uniform vec2 uBloomCenter;
        uniform float uSeed;
        varying vec2 vUv;
        varying vec2 vTileUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21) + uSeed);
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * vnoise(p);
            p *= 2.07;
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec4 col = texture2D(uColor, vUv);
          vec2 d = vTileUv - uBloomCenter;
          float dist = length(d);
          float n = (fbm(vTileUv * 3.2) - 0.5) * 0.35;
          float f2 = (fbm(vTileUv * 8.0 + 13.0) - 0.5) * 0.08;
          float edgeDist = dist + n + f2;

          float alpha = smoothstep(uProgress + 0.05, uProgress - 0.05, edgeDist);

          float ringWidth = 0.09;
          float ring = smoothstep(ringWidth, 0.0, abs(edgeDist - uProgress));
          vec3 ink = vec3(0.08, 0.07, 0.11);
          col.rgb = mix(col.rgb, ink, ring * 0.55 * alpha);

          gl_FragColor = vec4(col.rgb, alpha);
        }
      `,
    });

    mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
    fit();
    bloomStartTs = performance.now() + BLOOM_DELAY_MS;
  })
  .catch((err) => console.warn("card texture load failed:", err));

let bloomStartTs = null;

function loop(nowMs) {
  requestAnimationFrame(loop);
  if (!mesh) return;

  pointer.x += (pointer.tx - pointer.x) * 0.08;
  pointer.y += (pointer.ty - pointer.y) * 0.08;

  camera.position.x = pointer.x * POINTER_RANGE;
  camera.position.y = -pointer.y * POINTER_RANGE * 0.8;
  camera.lookAt(0, 0, 0);

  if (bloomStartTs !== null) {
    const raw = Math.max(0, nowMs - bloomStartTs) / BLOOM_DURATION_MS;
    const t = Math.min(1, raw);
    const eased = t * t * (3 - 2 * t);
    material.uniforms.uProgress.value = eased * 1.4;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

let resizeRaf = 0;
window.addEventListener("resize", () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(fit);
});
