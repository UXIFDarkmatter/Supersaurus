(() => {
  const N = "images/People/NostalgiaWeb/";

  // Each slot: left/top in %, width in vw, rotation deg, optional polygon clip
  // Slots are hand-placed to frame the centered people grid.
  const SLOTS = [
    // LEFT column (4)
    { src: N + "g_hat_game.jpg",      left: -3,  top: -7,  width: 22, rot: -4, z: 2, clip: "polygon(3% 0, 100% 4%, 97% 100%, 0 96%)" },
    { src: N + "image_11.jpg",        left: -2,  top: 24,  width: 17, rot: 3,  z: 3 },
    { src: N + "image_14.jpg",        left: 10,  top: 32,  width: 19, rot: -2, z: 2, clip: "polygon(6% 0, 100% 2%, 94% 100%, 0 98%)" },
    { src: N + "20210324_130600.jpg", left: -4,  top: 76,  width: 20, rot: 4,  z: 3 },

    // RIGHT column (4)
    { src: N + "spud_game.jpg",       left: 78,  top: -18, width: 12, rot: 3,  z: 2 },
    { src: N + "image_12.jpg",        left: 83,  top: 26,  width: 17, rot: -3, z: 3, clip: "polygon(0 3%, 100% 0, 100% 97%, 6% 100%)" },
    { src: N + "image_15.jpg",        left: 72,  top: 46,  width: 19, rot: 4,  z: 2 },
    { src: N + "image_18.jpg",        left: 85,  top: 70,  width: 13, rot: -4, z: 3 },

    // TOP band (3)
    { src: N + "image_13.jpg",        left: 22,  top: 2,   width: 13, rot: -3, z: 1 },
    { src: N + "image_16.jpg",        left: 43,  top: -11, width: 15, rot: 4,  z: 1, clip: "polygon(0 0, 100% 0, 100% 78%, 65% 100%, 30% 92%, 0 80%)" },
    { src: N + "image_17.jpg",        left: 65,  top: -6,  width: 13, rot: -2, z: 1 },

    // BOTTOM band (3)
    { src: N + "20220615_215346.jpg", left: 24,  top: 72,  width: 15, rot: 5,  z: 1 },
    { src: N + "image_19.jpg",        left: 46,  top: 74,  width: 13, rot: -3, z: 1, clip: "polygon(0 20%, 35% 0, 70% 8%, 100% 18%, 100% 100%, 0 100%)" },
    { src: N + "20220615_215358.jpg", left: 66,  top: 78,  width: 15, rot: 3,  z: 1 },

    // CENTER
    { src: N + "chris.jpg",           left: 42,  top: 32,  width: 16, rot: -3, z: 3 },
  ];

  // Per-slot drift for the montage animation. Last entry is Chris.
  // Format: [dx0 start-vw, dy0, dx1 end-vw, dy1, duration-s, delay-s]
  const DRIFT_PATTERN = [
    // LEFT column — drift rightward
    [-5,  1,  3, -1, 24,   0  ],
    [-4, -1,  4,  2, 22,  -3  ],
    [-5,  1,  3, -1, 26,  -6  ],
    [-3, -2,  5,  1, 21,  -9  ],
    // RIGHT column — drift leftward
    [ 5, -1, -3,  2, 23,  -1.5],
    [ 4,  1, -5, -2, 25,  -4.5],
    [ 5, -2, -3,  1, 22,  -7.5],
    [ 3,  2, -4, -1, 20, -10.5],
    // TOP band — drift with slight downward
    [-3, -2,  4,  1, 25,  -2  ],
    [ 3,  1, -4, -1, 24,  -5  ],
    [-4,  2,  3, -2, 23,  -8  ],
    // BOTTOM band — drift with slight upward
    [ 3, -1, -4,  2, 22,  -3.5],
    [-4,  1,  3, -1, 26,  -6.5],
    [ 4, -2, -3,  1, 21,  -9.5],
    // CENTER — Chris, gentler drift + longer cycle so sweat-drop reference stays calm
    [-2,  1,  3, -1, 28,  -1  ],
  ];

  const DROPS = [
    { x: "40%", y: "26%", delay: "0s",   scale: 0.8  },                  // upper-left forehead
    { x: "48%", y: "24%", delay: "0.9s", scale: 0.8  },                  // upper-right temple
    { x: "44%", y: "28%", delay: "1.7s", scale: 0.7  },                  // cheek/jaw
    { x: "18%", y: "46%", delay: "0.4s", scale: 0.55, splash: true },    // elbow → floor
    { x: "12%", y: "56%", delay: "1.3s", scale: 0.55, splash: true },    // wrist → floor
  ];
  const DROP_SVG =
    '<svg viewBox="0 0 20 30" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">' +
      '<path d="M10 2 C 10 9, 2 17, 2 22 A 8 8 0 0 0 18 22 C 18 17, 10 9, 10 2 Z" fill="#5ec7ff" stroke="#1f6aa0" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<ellipse cx="7" cy="20" rx="1.6" ry="2.6" fill="#ffffff" opacity="0.75"/>' +
    '</svg>';
  const RIPPLE_SVG =
    '<svg viewBox="0 0 20 8" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">' +
      '<ellipse cx="10" cy="4" rx="9" ry="3" fill="none" stroke="#5ec7ff" stroke-width="1.4"/>' +
    '</svg>';

  const bg = document.getElementById("collageBg");
  if (bg) {
    SLOTS.forEach((s, i) => {
      const isChris = i === SLOTS.length - 1;
      const d = DRIFT_PATTERN[i];

      const img = document.createElement("img");
      img.className = "collage-img";
      img.src = s.src;
      img.alt = "";
      img.loading = "lazy";
      img.style.transform = `rotate(${s.rot}deg)`;
      if (s.clip) img.style.clipPath = s.clip;

      const slot = document.createElement("div");
      slot.className = "collage-slot";
      slot.style.left = s.left + "%";
      slot.style.top = s.top + "%";
      slot.style.width = s.width + "vw";
      slot.style.zIndex = String(s.z);
      slot.style.setProperty("--dx0", d[0] + "vw");
      slot.style.setProperty("--dy0", d[1] + "vw");
      slot.style.setProperty("--dx1", d[2] + "vw");
      slot.style.setProperty("--dy1", d[3] + "vw");
      slot.style.setProperty("--dur", d[4] + "s");
      slot.style.setProperty("--dly", d[5] + "s");
      slot.appendChild(img);

      if (isChris) {
        // Sweat drops live inside Chris's slot so they drift + fade with him
        const sweat = document.createElement("div");
        sweat.className = "chris-sweat";
        sweat.setAttribute("aria-hidden", "true");
        sweat.style.left = "0";
        sweat.style.top = "0";
        sweat.style.width = "100%";
        sweat.style.height = (s.width * 1154 / 866) + "vw";

        DROPS.forEach((dp) => {
          const el = document.createElement("div");
          el.className = "sweat-drop";
          el.style.setProperty("--x", dp.x);
          el.style.setProperty("--y", dp.y);
          el.style.setProperty("--delay", dp.delay);
          if (dp.scale) el.style.setProperty("--scale", dp.scale);
          if (dp.splash) el.classList.add("sweat-drop--splash");
          el.innerHTML = DROP_SVG;
          sweat.appendChild(el);

          if (dp.splash) {
            const ripple = document.createElement("div");
            ripple.className = "sweat-ripple";
            ripple.style.setProperty("--x", dp.x);
            ripple.style.setProperty("--y", dp.y);
            ripple.style.setProperty("--delay", dp.delay);
            if (dp.scale) ripple.style.setProperty("--scale", dp.scale);
            ripple.innerHTML = RIPPLE_SVG;
            sweat.appendChild(ripple);
          }
        });
        slot.appendChild(sweat);
      }

      bg.appendChild(slot);
    });
  }

  // ---------- Animated film grain ----------
  const canvas = document.getElementById("filmGrain");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const SIZE = 1024; // source canvas size; CSS scales to fill viewport (finer grain)
  canvas.width = SIZE;
  canvas.height = SIZE;

  const imgData = ctx.createImageData(SIZE, SIZE);
  const data = imgData.data;

  // Pre-fill alpha to avoid writing it each frame
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
})();
