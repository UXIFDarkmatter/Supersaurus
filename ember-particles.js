(() => {
  const COUNT = 80;
  const HUE_SPEED = 8;
  const RISE_MIN = 8;
  const RISE_MAX = 22;
  const DRIFT = 14;
  const SIZE_MIN = 1.5;
  const SIZE_MAX = 4.0;
  const LIFE_MIN = 6;
  const LIFE_MAX = 14;

  const hero = document.getElementById("hero");
  const canvas = document.getElementById("emberCanvas");
  if (!hero || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  const particles = [];
  let lastT = performance.now();
  let hueBase = Math.random() * 360;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawn(p, initial = false) {
    p.x = rand(0, width);
    p.y = initial ? rand(0, height) : height + rand(0, 40);
    p.vx = rand(-DRIFT, DRIFT);
    p.vy = -rand(RISE_MIN, RISE_MAX);
    p.size = rand(SIZE_MIN, SIZE_MAX);
    p.hueOffset = rand(0, 360);
    p.life = 0;
    p.maxLife = rand(LIFE_MIN, LIFE_MAX);
    p.wobble = rand(0, Math.PI * 2);
    p.wobbleSpeed = rand(0.4, 1.2);
  }

  for (let i = 0; i < COUNT; i++) {
    const p = {};
    spawn(p, true);
    particles.push(p);
  }

  function resize() {
    width = hero.clientWidth;
    height = hero.clientHeight;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    hueBase = (hueBase + HUE_SPEED * dt) % 360;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      p.life += dt;
      if (p.life >= p.maxLife || p.y < -20) {
        spawn(p);
        continue;
      }
      p.wobble += p.wobbleSpeed * dt;
      p.x += (p.vx + Math.sin(p.wobble) * 10) * dt;
      p.y += p.vy * dt;

      const t = p.life / p.maxLife;
      const fadeIn = Math.min(1, p.life / 1.0);
      const fadeOut = Math.min(1, (p.maxLife - p.life) / 1.5);
      const alpha = Math.min(fadeIn, fadeOut) * 0.9;
      const hue = (hueBase + p.hueOffset) % 360;

      const r = p.size * 6;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `hsla(${hue}, 100%, 70%, ${alpha})`);
      grad.addColorStop(0.35, `hsla(${hue}, 100%, 55%, ${alpha * 0.5})`);
      grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  function start() {
    resize();
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  if (hero.clientHeight > 0) {
    start();
  } else {
    const obs = new ResizeObserver(() => {
      if (hero.clientHeight > 0) {
        obs.disconnect();
        start();
      }
    });
    obs.observe(hero);
  }

  window.addEventListener("resize", resize);
})();
