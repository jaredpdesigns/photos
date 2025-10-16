/*
 * Theme management
 */
const getTheme = (fn) => {
  if (!window.matchMedia) {
    return;
  }

  const query = window.matchMedia("(prefers-color-scheme: dark)");

  fn(query.matches);

  query.addEventListener("change", (event) => fn(event.matches));
};

function toggleTheme() {
  if (sessionStorage.getItem("theme") === null) {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      sessionStorage.setItem("theme", "dark");
    } else {
      sessionStorage.setItem("theme", "light");
    }
    document.documentElement.setAttribute(
      "data-theme",
      sessionStorage.getItem("theme")
    );
  }
  if (document.documentElement.getAttribute("data-theme") === "dark") {
    sessionStorage.setItem("theme", "light");
  } else {
    sessionStorage.setItem("theme", "dark");
  }
  document.documentElement.setAttribute(
    "data-theme",
    sessionStorage.getItem("theme")
  );
}

getTheme((isDark) => {
  document.documentElement.setAttribute(
    "data-theme",
    sessionStorage.getItem("theme")
      ? sessionStorage.getItem("theme")
      : isDark
      ? "dark"
      : "light"
  );
});

/*
 * Photo popover management
 */
const getPopovers = () => {
  const popovers = Array.from(document.querySelectorAll("[popover]"));
  const openIndex = popovers.findIndex((popover) =>
    popover.matches(":popover-open")
  );

  if (openIndex === -1) {
    return { current: null, next: null, prev: null };
  }

  return {
    current: popovers[openIndex],
    next: popovers[openIndex + 1] || null,
    prev: popovers[openIndex - 1] || null
  };
};

const focusTriggerButton = (popover) => {
  const id = popover.getAttribute("id");
  const trigger = document.querySelector(`[popovertarget="${id}"]`);
  trigger?.focus();
};

function handleNext() {
  const { next } = getPopovers();
  next?.showPopover();
}

function handlePrev() {
  const { prev } = getPopovers();
  prev?.showPopover();
}

/*
 * Swipe gesture handling for touch devices
 */
let touchStart = { x: 0, y: 0 };
const minSwipeDistance = 50;

document.addEventListener("touchstart", (event) => {
  if (event.target.closest("[popover].photo__details:popover-open")) {
    touchStart.x = event.changedTouches[0].screenX;
    touchStart.y = event.changedTouches[0].screenY;
  }
});

document.addEventListener("touchend", (event) => {
  if (event.target.closest("[popover].photo__details:popover-open")) {
    const touchEnd = {
      x: event.changedTouches[0].screenX,
      y: event.changedTouches[0].screenY
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;

    /*
     * Check if horizontal swipe is more significant than vertical
     */
    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > minSwipeDistance
    ) {
      deltaX > 0 ? handlePrev() : handleNext();
    }
  }
});

/*
 * Apply background color to root element when popover opens
 * and remove focus from close button
 */
document.addEventListener(
  "toggle",
  (event) => {
    if (event.target.matches("[popover].photo__details")) {
      if (event.newState === "open") {
        const bgValue = event.target.dataset.bg;
        if (bgValue) {
          document.documentElement.style.setProperty("--bg", bgValue);
        }

        /*
         * Remove focus from the close button
         */
        const closeButton = event.target.querySelector(
          '[popovertargetaction="hide"]'
        );
        if (closeButton && document.activeElement === closeButton) {
          closeButton.blur();
        }
      } else if (event.newState === "closed") {
        document.documentElement.style.removeProperty("--bg");
      }
    }
  },
  true
);

/*
 * Keyboard navigation
 */
document.addEventListener("keydown", (event) => {
  const { current } = getPopovers();
  if (!current) return;

  switch (event.key) {
    case "Escape":
      focusTriggerButton(current);
      break;
    case "ArrowLeft":
      handlePrev();
      break;
    case "ArrowRight":
      handleNext();
      break;
  }
});
