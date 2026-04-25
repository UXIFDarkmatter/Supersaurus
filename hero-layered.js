(() => {
  const MANIFEST_URL = "images/hero/layers.json";
  const BASE_URL = "images/hero/";

  // Inter-plane: the plane itself translates. Foreground shifts more than background.
  const INTER_STRENGTH = 0.009;  // fraction of canvas dimension at mouse extremes
  // Intra-plane: within a plane, depth modulates UV sampling (v1 parallax, per-layer now).
  const INTRA_STRENGTH = 0.012;
  const LERP = 0.08;

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("heroCanvas");
  if (!hero || !canvas) return;

  let gl = null;
  try {
    gl =
      canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, alpha: true }) ||
      canvas.getContext("experimental-webgl");
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    hero.classList.add("fallback-mode");
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const vertSrc = `
    attribute vec2 aPos;
    uniform vec4 uRect;     // (left, top, ndcWidth, ndcHeight); local aPos.y=0 is top of layer
    uniform vec2 uShift;    // inter-plane translation in NDC
    uniform float uAnchor;  // 0 = uniform translate; 1 = bottom pinned (top gets full shift)
    varying vec2 vUv;
    void main() {
      vUv = aPos;
      float shearScale = mix(1.0, 1.0 - aPos.y, uAnchor);
      float x = uRect.x + aPos.x * uRect.z + uShift.x * shearScale;
      float y = uRect.y - aPos.y * uRect.w + uShift.y * shearScale;
      gl_Position = vec4(x, y, 0.0, 1.0);
    }
  `;

  const fragSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uColor;
    uniform sampler2D uDepth;
    uniform vec2 uIntra;
    uniform float uHasDepth;
    void main() {
      vec2 uv = vUv;
      if (uHasDepth > 0.5) {
        float d = texture2D(uDepth, vUv).r;
        uv = vUv + uIntra * (d - 0.5);
      }
      gl_FragColor = texture2D(uColor, clamp(uv, 0.0, 1.0));
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    hero.classList.add("fallback-mode");
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    hero.classList.add("fallback-mode");
    return;
  }
  gl.useProgram(prog);

  const posLoc = gl.getAttribLocation(prog, "aPos");
  const rectLoc = gl.getUniformLocation(prog, "uRect");
  const shiftLoc = gl.getUniformLocation(prog, "uShift");
  const anchorLoc = gl.getUniformLocation(prog, "uAnchor");
  const colorLoc = gl.getUniformLocation(prog, "uColor");
  const depthLoc = gl.getUniformLocation(prog, "uDepth");
  const intraLoc = gl.getUniformLocation(prog, "uIntra");
  const hasDepthLoc = gl.getUniformLocation(prog, "uHasDepth");

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  function loadTex(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        resolve(tex);
      };
      img.onerror = () => reject(new Error("failed to load " + url));
      img.src = url;
    });
  }

  let scene = null;
  let aspect = 1;

  function resize() {
    const cw = hero.clientWidth;
    const ch = hero.clientHeight;
    const containerAspect = cw / ch;
    let cssW, cssH;
    if (containerAspect > aspect) {
      // container wider than scene → fill width, overflow height
      cssW = cw;
      cssH = cw / aspect;
    } else {
      // container taller (or equal) → fill height, overflow width
      cssH = ch;
      cssW = ch * aspect;
    }
    canvas.width = Math.round(cssW * devicePixelRatio);
    canvas.height = Math.round(cssH * devicePixelRatio);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.style.left = ((cw - cssW) / 2) + "px";
    canvas.style.top = ((ch - cssH) / 2) + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  function onMove(e) {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    target.x = (x - 0.5) * 2;
    target.y = (y - 0.5) * 2;
  }

  function onLeave() {
    target.x = 0;
    target.y = 0;
  }

  function render() {
    current.x += (target.x - current.x) * LERP;
    current.y += (target.y - current.y) * LERP;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const layer of scene.layers) {
      // "Look-through" parallax: foreground shifts opposite of mouse direction.
      const shiftX = -current.x * INTER_STRENGTH * 2 * layer.interWeight;
      const shiftY =  current.y * INTER_STRENGTH * 2 * layer.interWeight;
      gl.uniform4fv(rectLoc, layer.rect);
      gl.uniform2f(shiftLoc, shiftX, shiftY);
      gl.uniform1f(anchorLoc, layer.anchor);
      gl.uniform2f(intraLoc, current.x * INTRA_STRENGTH, current.y * INTRA_STRENGTH);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layer.colorTex);
      gl.uniform1i(colorLoc, 0);

      if (layer.depthTex) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, layer.depthTex);
        gl.uniform1i(depthLoc, 1);
        gl.uniform1f(hasDepthLoc, 1);
      } else {
        gl.uniform1f(hasDepthLoc, 0);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(render);
  }

  fetch(MANIFEST_URL)
    .then((r) => {
      if (!r.ok) throw new Error("manifest fetch: " + r.status);
      return r.json();
    })
    .then((m) => {
      const W = m.canvas.width;
      const H = m.canvas.height;
      aspect = W / H;

      const N = m.layers.length;
      const layers = m.layers.map((L, i) => {
        const pHint = L.hints && L.hints.parallax;
        const interWeight = pHint != null ? Number(pHint) : N > 1 ? i / (N - 1) : 0;
        // Anchor default is bottom-pinned (1.0) so grounded characters don't slide off the floor.
        // Bg is unaffected anyway because its interWeight is ~0.
        const aHint = L.hints && L.hints.anchor;
        let anchor = 1;
        if (aHint != null) {
          if (aHint === "bottom") anchor = 1;
          else if (aHint === "none" || aHint === "top") anchor = 0;
          else if (!isNaN(Number(aHint))) anchor = Math.max(0, Math.min(1, Number(aHint)));
        }
        const nx = L.bounds.x / W;
        const ny = L.bounds.y / H;
        const nw = L.bounds.width / W;
        const nh = L.bounds.height / H;
        const rect = new Float32Array([
          2 * nx - 1,
          1 - 2 * ny,
          2 * nw,
          2 * nh,
        ]);
        return Object.assign({}, L, { interWeight, anchor, rect });
      });

      return Promise.all(
        layers.map((L) => {
          const colorP = loadTex(BASE_URL + L.file);
          const depthP = L.depth_file ? loadTex(BASE_URL + L.depth_file) : Promise.resolve(null);
          return Promise.all([colorP, depthP]).then(([c, d]) => {
            L.colorTex = c;
            L.depthTex = d;
            return L;
          });
        })
      ).then(() => ({ layers, W, H }));
    })
    .then((s) => {
      scene = s;
      resize();
      hero.classList.add("parallax-active");
      window.addEventListener("resize", resize);
      window.addEventListener("mousemove", onMove);
      hero.addEventListener("mouseleave", onLeave);
      requestAnimationFrame(render);
    })
    .catch((err) => {
      console.warn("Layered hero disabled:", err);
      hero.classList.add("fallback-mode");
    });
})();
