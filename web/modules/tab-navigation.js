export function initTabNavigation({ storageKey, onActivate } = {}) {
  const buttons = [...document.querySelectorAll(".tab-button")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const activateHook = typeof onActivate === "function" ? onActivate : () => {};

  const resolveTabName = (tabName) => buttons.some((button) => button.dataset.tab === tabName && !button.hidden && !button.disabled)
    ? tabName
    : (buttons.find((button) => !button.hidden && !button.disabled)?.dataset.tab || "gpio");

  const activateTab = (tabName) => {
    const resolvedTabName = resolveTabName(tabName);
    for (const button of buttons) {
      const isActive = button.dataset.tab === resolvedTabName;
      button.setAttribute("aria-selected", String(isActive));
    }
    for (const panel of panels) {
      panel.classList.toggle("active", panel.id === `tab-${resolvedTabName}` && !panel.hidden);
    }
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, resolvedTabName);
      } catch {
      }
    }
    activateHook(resolvedTabName);
    return resolvedTabName;
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  }

  let initialTab = buttons[0]?.dataset.tab || "gpio";
  if (storageKey) {
    try {
      const savedTab = window.localStorage.getItem(storageKey);
      if (savedTab && buttons.some((button) => button.dataset.tab === savedTab)) {
        initialTab = savedTab;
      }
    } catch {
    }
  }
  activateTab(initialTab);

  return {
    activateTabByName(tabName) {
      const button = buttons.find((candidate) => candidate.dataset.tab === tabName);
      if (!button || button.hidden || button.disabled) {
        return false;
      }
      activateTab(tabName);
      return true;
    },
    activeTabName() {
      return buttons.find((button) => button.getAttribute("aria-selected") === "true")?.dataset.tab || "";
    },
  };
}