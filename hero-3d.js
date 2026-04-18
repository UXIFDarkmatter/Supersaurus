import * as THREE from "three";

const COLOR_SRC = "images/original_composition_small.jpg";
const BG_SRC = "images/original_composition_small_bg.jpg";
const DEPTH_SRC = "images/original_composition_small_depth.jpg";

const DISPLACEMENT = 0.45;
const CAMERA_FOV = 32;
const CAMERA_Z = 4.2;
const GRID = 320;

const canvas = document.getElementById("hero3dCanvas");
const container = canvas.parentElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
camera.position.set(0, 0, CAMERA_Z);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

let planeMesh = null;
let imageAspect = 1;

function fitPlaneToView() {
  if (!planeMesh) return;
  const vFov = (camera.fov * Math.PI) / 180;
  const viewH = 2 * Math.tan(vFov / 2) * CAMERA_Z;
  const viewW = viewH * camera.aspect;
  let w, h;
  if (imageAspect > camera.aspect) {
    h = viewH;
    w = viewH * imageAspect;
  } else {
    w = viewW;
    h = viewW / imageAspect;
  }
  planeMesh.scale.set(w, h, 1);
}

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitPlaneToView();
}

const loader = new THREE.TextureLoader();
const load = (src) =>
  new Promise((resolve, reject) => loader.load(src, resolve, undefined, reject));

Promise.all([load(COLOR_SRC), load(BG_SRC), load(DEPTH_SRC)])
  .then(([colorTex, bgTex, depthTex]) => {
    colorTex.colorSpace = THREE.SRGBColorSpace;
    bgTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    bgTex.anisotropy = colorTex.anisotropy;

    imageAspect = colorTex.image.width / colorTex.image.height;

    const geo = new THREE.PlaneGeometry(1, 1, GRID, GRID);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: colorTex },
        uBg: { value: bgTex },
        uDepth: { value: depthTex },
        uDisplacement: { value: DISPLACEMENT },
        uEdgeStrength: { value: 6.0 },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uDepth;
        uniform float uDisplacement;
        varying vec2 vUv;
        varying float vDepth;
        varying float vEdge;
        void main() {
          vUv = uv;
          float d = texture2D(uDepth, uv).r;
          vDepth = d;
          vec2 px = vec2(1.0 / ${GRID}.0);
          float dx = texture2D(uDepth, uv + vec2(px.x, 0.0)).r - texture2D(uDepth, uv - vec2(px.x, 0.0)).r;
          float dy = texture2D(uDepth, uv + vec2(0.0, px.y)).r - texture2D(uDepth, uv - vec2(0.0, px.y)).r;
          vEdge = length(vec2(dx, dy));
          vec3 pos = position + vec3(0.0, 0.0, d * uDisplacement);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uColor;
        uniform sampler2D uBg;
        uniform float uEdgeStrength;
        varying vec2 vUv;
        varying float vDepth;
        varying float vEdge;
        void main() {
          vec4 fg = texture2D(uColor, vUv);
          vec4 bg = texture2D(uBg, vUv);
          // Fade to inpainted bg at depth discontinuities to hide stretch artifacts.
          float edgeMix = clamp(vEdge * uEdgeStrength, 0.0, 1.0);
          vec4 color = mix(fg, bg, edgeMix);
          gl_FragColor = color;
        }
      `,
    });

    planeMesh = new THREE.Mesh(geo, material);
    scene.add(planeMesh);

    resize();
    animate();
  })
  .catch((err) => {
    console.error("Hero 3D texture load failed:", err);
  });

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("pointermove", (e) => {
  const rect = container.getBoundingClientRect();
  pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
  pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
});

let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.008;

  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;

  const idleX = Math.sin(t) * 0.08;
  const idleY = Math.cos(t * 0.7) * 0.05;

  camera.position.x = pointer.x * 0.55 + idleX;
  camera.position.y = -pointer.y * 0.32 + idleY;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

window.addEventListener("resize", resize);
resize();
