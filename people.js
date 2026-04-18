import * as THREE from "three";

const STAGGER_MS = 180;
const BLOOM_DURATION_MS = 1100;
const DEPTH_DISPLACEMENT = 0.22;
const POINTER_RANGE = 0.38;
const GRID_SEGMENTS = 160;

const tiles = [];
const loader = new THREE.TextureLoader();

function createTile(tileEl) {
  const canvas = tileEl.querySelector("canvas");
  const colorSrc = tileEl.dataset.color;
  const depthSrc = tileEl.dataset.depth;
  const index = Number(tileEl.dataset.index);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const CAMERA_Z = 3.2;
  camera.position.set(0, 0, CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const tile = {
    el: tileEl,
    canvas,
    scene,
    camera,
    renderer,
    mesh: null,
    material: null,
    imageAspect: 1,
    cameraZ: CAMERA_Z,
    pointer: { x: 0, y: 0, tx: 0, ty: 0, inside: false },
    bloomStartTs: null,
    bloomStaggerMs: index * STAGGER_MS,
    ready: false,
  };

  tile.fit = () => {
    const w = tileEl.clientWidth;
    const h = tileEl.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!tile.mesh) return;
    const vFov = (camera.fov * Math.PI) / 180;
    const viewH = 2 * Math.tan(vFov / 2) * tile.cameraZ;
    const viewW = viewH * camera.aspect;
    const ia = tile.imageAspect;
    let pw, ph;
    if (ia > camera.aspect) {
      ph = viewH;
      pw = viewH * ia;
    } else {
      pw = viewW;
      ph = viewW / ia;
    }
    tile.mesh.scale.set(pw, ph, 1);
  };

  tileEl.addEventListener("pointermove", (e) => {
    const rect = tileEl.getBoundingClientRect();
    tile.pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    tile.pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    tile.pointer.inside = true;
  });
  tileEl.addEventListener("pointerleave", () => {
    tile.pointer.inside = false;
    tile.pointer.tx = 0;
    tile.pointer.ty = 0;
  });

  Promise.all([
    new Promise((res, rej) => loader.load(colorSrc, res, undefined, rej)),
    new Promise((res, rej) => loader.load(depthSrc, res, undefined, rej)),
  ])
    .then(([colorTex, depthTex]) => {
      colorTex.colorSpace = THREE.SRGBColorSpace;
      colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tile.imageAspect = colorTex.image.width / colorTex.image.height;

      const geo = new THREE.PlaneGeometry(1, 1, GRID_SEGMENTS, GRID_SEGMENTS);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uColor: { value: colorTex },
          uDepth: { value: depthTex },
          uDisplacement: { value: DEPTH_DISPLACEMENT },
          uProgress: { value: 0 },
          uBloomCenter: { value: new THREE.Vector2(0.5 + (Math.random() - 0.5) * 0.3, 0.55 + (Math.random() - 0.5) * 0.2) },
          uSeed: { value: Math.random() * 100 },
        },
        vertexShader: /* glsl */ `
          uniform sampler2D uDepth;
          uniform float uDisplacement;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            float d = texture2D(uDepth, uv).r;
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
            vec2 d = vUv - uBloomCenter;
            float dist = length(d);
            float n = (fbm(vUv * 3.2) - 0.5) * 0.35;
            float f2 = (fbm(vUv * 8.0 + 13.0) - 0.5) * 0.08;
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

      tile.material = material;
      tile.mesh = new THREE.Mesh(geo, material);
      scene.add(tile.mesh);
      tile.fit();
      tile.ready = true;
    })
    .catch((err) => {
      console.warn(`Tile ${index} failed to load:`, err);
    });

  return tile;
}

document.querySelectorAll(".people-tile").forEach((el) => {
  tiles.push(createTile(el));
});

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const tile = tiles.find((t) => t.el === entry.target);
      if (tile && tile.bloomStartTs === null) {
        tile.bloomStartTs = performance.now() + tile.bloomStaggerMs;
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.25 }
);
tiles.forEach((t) => io.observe(t.el));

function loop(nowMs) {
  requestAnimationFrame(loop);
  for (const tile of tiles) {
    if (!tile.ready) continue;

    tile.pointer.x += (tile.pointer.tx - tile.pointer.x) * 0.08;
    tile.pointer.y += (tile.pointer.ty - tile.pointer.y) * 0.08;

    tile.camera.position.x = tile.pointer.x * POINTER_RANGE;
    tile.camera.position.y = -tile.pointer.y * POINTER_RANGE * 0.8;
    tile.camera.lookAt(0, 0, 0);

    if (tile.bloomStartTs !== null) {
      const raw = Math.max(0, nowMs - tile.bloomStartTs) / BLOOM_DURATION_MS;
      const t = Math.min(1, raw);
      const eased = t * t * (3 - 2 * t);
      tile.material.uniforms.uProgress.value = eased * 1.4;
    }

    tile.renderer.render(tile.scene, tile.camera);
  }
}
requestAnimationFrame(loop);

let resizeRaf = 0;
window.addEventListener("resize", () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    tiles.forEach((t) => t.fit && t.fit());
  });
});
