(() => {
  if (window.parent === window) return;
  window.addEventListener(
    "wheel",
    (e) => {
      window.parent.postMessage(
        {
          type: "supersaurus:wheel",
          deltaY: e.deltaY,
          deltaX: e.deltaX,
          deltaMode: e.deltaMode,
        },
        "*"
      );
    },
    { passive: true }
  );
})();
