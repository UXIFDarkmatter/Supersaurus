(() => {
  const GIF_DURATION = 5080;
  const FLY_DURATION = 1000;
  const LAST_FRAME_SRC = "images/supersaurus_last.png";

  const splash = document.getElementById("introSplash");
  const gif = document.getElementById("introGif");
  const logoCircle = document.querySelector(".logo-circle");
  if (!splash || !gif || !logoCircle) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    splash.classList.add("done");
    logoCircle.style.backgroundImage = `url(${LAST_FRAME_SRC})`;
    logoCircle.style.backgroundSize = "cover";
    logoCircle.style.backgroundPosition = "center";
    logoCircle.style.borderColor = "transparent";
    return;
  }

  setTimeout(() => {
    gif.src = LAST_FRAME_SRC;

    const rect = logoCircle.getBoundingClientRect();
    splash.classList.add("flying");
    splash.style.top = rect.top + rect.height / 2 + "px";
    splash.style.left = rect.left + rect.width / 2 + "px";
    splash.style.width = rect.width + "px";
    splash.style.height = rect.height + "px";

    setTimeout(() => {
      logoCircle.style.backgroundImage = `url(${LAST_FRAME_SRC})`;
      logoCircle.style.backgroundSize = "cover";
      logoCircle.style.backgroundPosition = "center";
      logoCircle.style.borderColor = "transparent";
      splash.classList.add("done");
    }, FLY_DURATION - 50);
  }, GIF_DURATION);
})();
