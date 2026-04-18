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
    { src: N + "spud_game.jpg",       left: 76,  top: -18, width: 12, rot: 3,  z: 2 },
    { src: N + "image_12.jpg",        left: 83,  top: 26,  width: 17, rot: -3, z: 3, clip: "polygon(0 3%, 100% 0, 100% 97%, 6% 100%)" },
    { src: N + "image_15.jpg",        left: 72,  top: 46,  width: 19, rot: 4,  z: 2 },
    { src: N + "image_18.jpg",        left: 85,  top: 70,  width: 13, rot: -4, z: 3 },

    // TOP band (3)
    { src: N + "image_13.jpg",        left: 22,  top: -4,  width: 13, rot: -3, z: 1 },
    { src: N + "image_16.jpg",        left: 43,  top: -17, width: 15, rot: 4,  z: 1, clip: "polygon(0 0, 100% 0, 100% 78%, 65% 100%, 30% 92%, 0 80%)" },
    { src: N + "image_17.jpg",        left: 65,  top: -12, width: 13, rot: -2, z: 1 },

    // BOTTOM band (3)
    { src: N + "20220615_215346.jpg", left: 24,  top: 78,  width: 15, rot: 5,  z: 1 },
    { src: N + "image_19.jpg",        left: 46,  top: 80,  width: 13, rot: -3, z: 1, clip: "polygon(0 20%, 35% 0, 70% 8%, 100% 18%, 100% 100%, 0 100%)" },
    { src: N + "20220615_215358.jpg", left: 66,  top: 84,  width: 15, rot: 3,  z: 1 },
  ];

  const bg = document.getElementById("collageBg");
  if (bg) {
    SLOTS.forEach((s) => {
      const img = document.createElement("img");
      img.className = "collage-img";
      img.src = s.src;
      img.alt = "";
      img.loading = "lazy";
      img.style.left = s.left + "%";
      img.style.top = s.top + "%";
      img.style.width = s.width + "vw";
      img.style.transform = `rotate(${s.rot}deg)`;
      img.style.zIndex = String(s.z);
      if (s.clip) img.style.clipPath = s.clip;
      bg.appendChild(img);
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

  let frame = 0;
  function tick() {
    // Update grain every other frame => ~30fps for a classic cinematic cadence
    if ((frame & 1) === 0) {
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
    }
    frame++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
