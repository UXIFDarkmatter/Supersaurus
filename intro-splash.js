(() => {
  const GIF_DURATION = 2540;
  const FLY_DURATION = 650;
  const LAST_FRAME_SRC = "images/supersaurus_last.png";

  const splash = document.getElementById("introSplash");
  const gif = document.getElementById("introGif");
  const logoCircle = document.querySelector(".logo-circle");
  if (!splash || !gif || !logoCircle) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    splash.classList.add("done");
    logoCircle.style.backgroundImage = `url(${LAST_FRAME_SRC})`;
    logoCircle.style.backgroundSize = "cover";
    logoCircle.style.backgroundPosition = "center";
    logoCircle.style.borderColor = "transparent";
    return;
  }

  setTimeout(() => {
    gif.src = LAST_FRAME_SRC;

    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    const rect = logoCircle.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    splash.classList.add("flying");
    splash.style.top = startY + "px";
    splash.style.left = startX + "px";

    const peakX = startX + (endX - startX) * 0.55;
    const peakY = Math.min(startY, endY) - 70;
    const startSize = 300;
    const peakSize = 180;

    splash.animate(
      [
        {
          top: startY + "px",
          left: startX + "px",
          width: startSize + "px",
          height: startSize + "px",
          easing: "cubic-bezier(0.3, 0, 0.4, 1)",
        },
        {
          top: peakY + "px",
          left: peakX + "px",
          width: peakSize + "px",
          height: peakSize + "px",
          offset: 0.5,
          easing: "cubic-bezier(0.5, 0, 0.6, 1)",
        },
        {
          top: endY + "px",
          left: endX + "px",
          width: rect.width + "px",
          height: rect.height + "px",
        },
      ],
      { duration: FLY_DURATION, fill: "forwards" }
    );

    setTimeout(() => impact(endX, endY), FLY_DURATION - 40);
  }, GIF_DURATION);

  function impact(x, y) {
    logoCircle.style.backgroundImage = `url(${LAST_FRAME_SRC})`;
    logoCircle.style.backgroundSize = "cover";
    logoCircle.style.backgroundPosition = "center";
    logoCircle.style.borderColor = "transparent";
    splash.classList.add("done");

    logoCircle.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        {
          transform: "scale(1.35)",
          filter: "brightness(1.8)",
          offset: 0.25,
        },
        { transform: "scale(0.92)", offset: 0.55 },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );

    const blip = document.createElement("div");
    blip.style.cssText = [
      "position: fixed",
      `top: ${y}px`,
      `left: ${x}px`,
      "width: 12px",
      "height: 12px",
      "border-radius: 50%",
      "background: radial-gradient(circle, rgba(255,245,210,1) 0%, rgba(255,220,130,0.7) 35%, rgba(255,200,80,0) 70%)",
      "transform: translate(-50%, -50%) scale(0)",
      "pointer-events: none",
      "z-index: 99",
      "mix-blend-mode: screen",
    ].join(";");
    document.body.appendChild(blip);

    blip.animate(
      [
        { transform: "translate(-50%, -50%) scale(0)", opacity: 1 },
        { transform: "translate(-50%, -50%) scale(7)", opacity: 0 },
      ],
      { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" }
    );
    setTimeout(() => blip.remove(), 560);

    const ring = document.createElement("div");
    ring.style.cssText = [
      "position: fixed",
      `top: ${y}px`,
      `left: ${x}px`,
      "width: 40px",
      "height: 40px",
      "border-radius: 50%",
      "border: 2px solid rgba(255,240,190,0.9)",
      "transform: translate(-50%, -50%) scale(0.4)",
      "pointer-events: none",
      "z-index: 99",
      "mix-blend-mode: screen",
    ].join(";");
    document.body.appendChild(ring);

    ring.animate(
      [
        {
          transform: "translate(-50%, -50%) scale(0.4)",
          opacity: 1,
          borderWidth: "2px",
        },
        {
          transform: "translate(-50%, -50%) scale(2.4)",
          opacity: 0,
          borderWidth: "0.5px",
        },
      ],
      { duration: 480, easing: "ease-out", fill: "forwards" }
    );
    setTimeout(() => ring.remove(), 520);
  }
})();
