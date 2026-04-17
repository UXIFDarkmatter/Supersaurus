(() => {
  const COLOR_SRC = "images/original_composition_small.jpg";
  const DEPTH_SRC = "images/original_composition_small_depth.jpg";
  const BG_SRC = "images/original_composition_small_bg.jpg";
  const STRENGTH = 0.015;
  const LERP = 0.08;

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("heroCanvas");
  const imgEl = document.getElementById("heroImage");
  if (!hero || !canvas || !imgEl) return;

  const gl =
    canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false }) ||
    canvas.getContext("experimental-webgl");
  if (!gl) return;

  const vertSrc = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fragSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uColor;
    uniform sampler2D uDepth;
    uniform sampler2D uBg;
    uniform vec2 uMouse;
    uniform float uStrength;
    uniform float uMode;
    void main() {
      vec2 shift = uMouse * uStrength;
      vec3 col;

      if (uMode < 0.5) {
        float d = texture2D(uDepth, vUv).r;
        vec2 uv = clamp(vUv + shift * (d - 0.5), 0.0, 1.0);
        col = texture2D(uColor, uv).rgb;
      } else {
        float d = texture2D(uDepth, vUv).r;
        vec2 uv = vUv + shift * (d - 0.5);
        d = texture2D(uDepth, uv).r;
        uv = vUv + shift * (d - 0.5);
        float dFinal = texture2D(uDepth, uv).r;

        vec2 fgUv = clamp(uv, 0.0, 1.0);
        vec2 bgUv = clamp(vUv - shift * 0.2, 0.0, 1.0);

        vec3 fg = texture2D(uColor, fgUv).rgb;
        vec3 bg = texture2D(uBg, bgUv).rgb;
        float alpha = smoothstep(0.30, 0.48, dFinal);
        col = mix(bg, fg, alpha);
      }
      gl_FragColor = vec4(col, 1.0);
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
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const posLoc = gl.getAttribLocation(prog, "aPos");
  const colorLoc = gl.getUniformLocation(prog, "uColor");
  const depthLoc = gl.getUniformLocation(prog, "uDepth");
  const bgLoc = gl.getUniformLocation(prog, "uBg");
  const mouseLoc = gl.getUniformLocation(prog, "uMouse");
  const strengthLoc = gl.getUniformLocation(prog, "uStrength");
  const modeLoc = gl.getUniformLocation(prog, "uMode");

  const params = new URLSearchParams(window.location.search);
  let mode = params.get("parallax") === "inpainted" ? 1 : 0;
  window.addEventListener("keydown", (e) => {
    if (e.key === "v" || e.key === "V") {
      mode = mode === 1 ? 0 : 1;
      console.log("Parallax mode:", mode === 1 ? "inpainted (v2)" : "simple (v1)");
    }
  });

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  function loadTex(url, unit) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        resolve({ tex, img });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  let imgAspect = 1;
  function resize() {
    const w = hero.clientWidth;
    const h = Math.round(w / imgAspect);
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    hero.style.height = h + "px";
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
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(colorLoc, 0);
    gl.uniform1i(depthLoc, 1);
    gl.uniform1i(bgLoc, 2);
    gl.uniform2f(mouseLoc, current.x, current.y);
    gl.uniform1f(strengthLoc, STRENGTH);
    gl.uniform1f(modeLoc, mode);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  Promise.all([loadTex(COLOR_SRC, 0), loadTex(DEPTH_SRC, 1), loadTex(BG_SRC, 2)])
    .then(([color]) => {
      imgAspect = color.img.naturalWidth / color.img.naturalHeight;
      resize();
      hero.classList.add("parallax-active");
      window.addEventListener("resize", resize);
      window.addEventListener("mousemove", onMove);
      hero.addEventListener("mouseleave", onLeave);
      requestAnimationFrame(render);
    })
    .catch((err) => {
      console.warn("Depth parallax disabled:", err);
    });
})();
