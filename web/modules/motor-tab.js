import {
  normalizeMotorLearnedState,
  normalizeMotorRuntimeConfig,
  normalizeMovementRole,
} from "./motor-runtime-config.js";

const MOTOR_TAB_STORAGE_KEY = "esp32NotifierMotorTabConfig";
const ACTIVE_TAB_STORAGE_KEY = "notifierActiveTab";

const MOTOR_CHANNELS = [
  {
    key: "a",
    name: "Channel A",
    forwardSignal: "IN1",
    backwardSignal: "IN2",
    forwardButtonKey: "motorChannelAForwardButton",
    backwardButtonKey: "motorChannelABackwardButton",
    forwardDurationKey: "motorChannelAForwardDuration",
    forwardRoleKey: "motorChannelAForwardRole",
    forwardLimitKey: "motorChannelAForwardLimit",
    backwardDurationKey: "motorChannelABackwardDuration",
    backwardRoleKey: "motorChannelABackwardRole",
    backwardLimitKey: "motorChannelABackwardLimit",
    statusKey: "motorChannelAStatus",
  },
  {
    key: "b",
    name: "Channel B",
    forwardSignal: "IN3",
    backwardSignal: "IN4",
    forwardButtonKey: "motorChannelBForwardButton",
    backwardButtonKey: "motorChannelBBackwardButton",
    forwardDurationKey: "motorChannelBForwardDuration",
    forwardRoleKey: "motorChannelBForwardRole",
    forwardLimitKey: "motorChannelBForwardLimit",
    backwardDurationKey: "motorChannelBBackwardDuration",
    backwardRoleKey: "motorChannelBBackwardRole",
    backwardLimitKey: "motorChannelBBackwardLimit",
    statusKey: "motorChannelBStatus",
  },
];

const DIRECTION_KEYS = ["forward", "backward"];
const TOUCH_BUTTON_ACTION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "toggle_open", label: "Toggle Open" },
  { value: "toggle_close", label: "Toggle Close" },
  { value: "toggle_open_close", label: "Toggle Open/Close" },
];

const MOVEMENT_ROLE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "opening", label: "Opening" },
  { value: "closing", label: "Closing" },
];

function titleCase(value) {
  return String(value || "")
    .replaceAll(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function roleButtonLabel(role, direction) {
  if (role === "opening") {
    return "Open";
  }
  if (role === "closing") {
    return "Close";
  }
  return titleCase(direction);
}

function roleProgressLabel(role, direction) {
  if (role === "opening") {
    return "Opening";
  }
  if (role === "closing") {
    return "Closing";
  }
  return titleCase(direction);
}

function roleCompleteLabel(role, direction) {
  if (role === "opening") {
    return "Open";
  }
  if (role === "closing") {
    return "Closed";
  }
  return titleCase(direction);
}

function statusReasonLabel(stopReason) {
  if (stopReason === "end_switch_activated") {
    return "end switch activated";
  }
  if (stopReason === "time_limit_reached") {
    return "time limit reached";
  }
  if (stopReason === "manual_stop") {
    return "manual stop";
  }
  return "";
}

function learnedStateLabel(value) {
  return normalizeMotorLearnedState(value) === "open" ? "Open" : "Closed";
}

function defaultUiState() {
  return {
    a: {
      learnedState: "unknown",
      forward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
      backward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
    },
    b: {
      learnedState: "unknown",
      forward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
      backward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
    },
    touchButtons: {
      button1: { action: "none" },
      button2: { action: "none" },
    },
  };
}

function normalizeUiState(value) {
  return normalizeMotorRuntimeConfig(value);
}

function readStoredUiState() {
  try {
    return normalizeUiState(window.localStorage.getItem(MOTOR_TAB_STORAGE_KEY) || "{}");
  } catch {
    return defaultUiState();
  }
}

function copyUiState(target, source) {
  const normalized = normalizeUiState(source);
  ["a", "b"].forEach((channelKey) => {
    target[channelKey].learnedState = normalized[channelKey].learnedState;
    DIRECTION_KEYS.forEach((directionKey) => {
      target[channelKey][directionKey].durationMs = normalized[channelKey][directionKey].durationMs;
      target[channelKey][directionKey].limitInputIndex = normalized[channelKey][directionKey].limitInputIndex;
      target[channelKey][directionKey].movementRole = normalized[channelKey][directionKey].movementRole;
      target[channelKey][directionKey].movementRoleExplicit = normalized[channelKey][directionKey].movementRoleExplicit;
    });
  });
  target.touchButtons.button1.action = normalized.touchButtons.button1.action;
  target.touchButtons.button2.action = normalized.touchButtons.button2.action;
}

function stableUiStateKey(value) {
  return JSON.stringify(normalizeUiState(value));
}

function uiStateHasCustomizations(value) {
  const normalized = normalizeUiState(value);
  return ["a", "b"].some((channelKey) => DIRECTION_KEYS.some((directionKey) => {
    const direction = normalized[channelKey][directionKey];
    return direction.limitInputIndex !== ""
      || Number(direction.durationMs) !== 5000
      || direction.movementRoleExplicit === true;
  })) || ["button1", "button2"].some((key) => normalized.touchButtons?.[key]?.action !== "none");
}

export function createMotorTab({
  state,
  elements,
  normalizedPeripheralControlProfiles,
  normalizedPeripheralInputProfiles,
  peripheralHelperBindingValue,
  inputAssignedPin,
  activeTabName,
  activateTabByName,
  request,
  saveSettings,
  queueSettingsSave,
  awaitPendingSettingsSave,
  loadStatus,
  setMessage,
  toast,
}) {
  const uiState = defaultUiState();
  const pendingChannels = new Set();
  let lastHydratedSettingsKey = "";
  let motorConfigSaveTimer = null;
  let motorConfigSavePromise = Promise.resolve();

  copyUiState(uiState, readStoredUiState());

  function learnedStateFor(channelKey, status) {
    const runtimeState = normalizeMotorLearnedState(status?.learnedState);
    if (runtimeState !== "unknown") {
      return runtimeState;
    }
    return normalizeMotorLearnedState(uiState[channelKey]?.learnedState);
  }

  function preferredDirectionFor(channelKey, status) {
    if (status?.active) {
      return String(status.direction || "forward").trim().toLowerCase() === "backward" ? "backward" : "forward";
    }

    const learnedState = learnedStateFor(channelKey, status);
    if (learnedState === "open" || learnedState === "closed") {
      const targetRole = learnedState === "open" ? "opening" : "closing";
      const forwardRole = normalizeMovementRole(uiState[channelKey]?.forward?.movementRole, "forward");
      const backwardRole = normalizeMovementRole(uiState[channelKey]?.backward?.movementRole, "backward");
      if (forwardRole === targetRole && backwardRole !== targetRole) {
        return "forward";
      }
      if (backwardRole === targetRole && forwardRole !== targetRole) {
        return "backward";
      }
    }

    return "forward";
  }

  function persistUiState() {
    try {
      window.localStorage.setItem(MOTOR_TAB_STORAGE_KEY, JSON.stringify(uiState));
    } catch {
    }
  }

  function syncUiStateFromSettings() {
    if (state.settingsLoading || state.settingsSaving || state.settingsDirty) {
      return;
    }
    const settingsUiState = state.settings?.ui?.motorRuntimeConfig;
    if (!settingsUiState) {
      return;
    }
    const nextKey = stableUiStateKey(settingsUiState);
    if (nextKey === lastHydratedSettingsKey) {
      return;
    }
    if (!uiStateHasCustomizations(settingsUiState) && uiStateHasCustomizations(uiState)) {
      return;
    }
    copyUiState(uiState, settingsUiState);
    lastHydratedSettingsKey = nextKey;
    persistUiState();
  }

  function persistUiStateToSettings() {
    state.settings ||= {};
    state.settings.ui ||= {};
    const normalized = normalizeUiState(uiState);
    state.settings.ui.motorRuntimeConfig = normalized;
    lastHydratedSettingsKey = stableUiStateKey(normalized);
    persistUiState();
    return normalized;
  }

  async function persistMotorConfigNow() {
    if (motorConfigSaveTimer) {
      window.clearTimeout(motorConfigSaveTimer);
      motorConfigSaveTimer = null;
    }
    const normalized = persistUiStateToSettings();
    const saveOperation = (async () => {
      await request("/api/motor/config", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
      return normalized;
    })();
    motorConfigSavePromise = saveOperation;
    try {
      await saveOperation;
    } finally {
      if (motorConfigSavePromise === saveOperation) {
        motorConfigSavePromise = Promise.resolve();
      }
    }
    return normalized;
  }

  function queueMotorConfigSave(delayMs = 150) {
    persistUiStateToSettings();
    if (motorConfigSaveTimer) {
      window.clearTimeout(motorConfigSaveTimer);
    }
    motorConfigSaveTimer = window.setTimeout(() => {
      persistMotorConfigNow().catch((error) => {
        toast(error?.message || "Failed to save motor settings");
      });
    }, delayMs);
  }

  function activeDrv8833Config() {
    const controlProfiles = normalizedPeripheralControlProfiles();
    for (let index = 0; index < controlProfiles.length; index += 1) {
      const normalizedProfile = String(controlProfiles[index] || "none").trim().toLowerCase();
      if (normalizedProfile !== "drv8833-dual-motor-driver") {
        continue;
      }
      return {
        controlIndex: index,
        label: controlProfiles.length > 1 ? `DRV8833 ${index + 1}` : "DRV8833",
        channels: MOTOR_CHANNELS.map((channel) => {
          const forwardPin = Number(peripheralHelperBindingValue("control", index, channel.forwardSignal));
          const backwardPin = Number(peripheralHelperBindingValue("control", index, channel.backwardSignal));
          return {
            ...channel,
            forwardPin: Number.isFinite(forwardPin) && forwardPin >= 0 ? forwardPin : null,
            backwardPin: Number.isFinite(backwardPin) && backwardPin >= 0 ? backwardPin : null,
            configured: Number.isFinite(forwardPin) && forwardPin >= 0 && Number.isFinite(backwardPin) && backwardPin >= 0 && forwardPin !== backwardPin,
          };
        }),
      };
    }
    return null;
  }

  function configuredLimitSwitches() {
    const inputProfiles = normalizedPeripheralInputProfiles();
    return inputProfiles.reduce((result, profileValue, index) => {
      const normalizedProfile = String(profileValue || "none").trim().toLowerCase();
      if (normalizedProfile !== "limit-switch") {
        return result;
      }
      const pin = inputAssignedPin(index);
      const pinLabel = Number.isFinite(pin) ? `GPIO ${pin}` : "GPIO unassigned";
      const contactLabel = String(peripheralHelperBindingValue("input", index, "CONTACT") || "NO").trim().toUpperCase() === "NC" ? "NC" : "NO";
      const sourceLabel = String(peripheralHelperBindingValue("input", index, "SOURCE") || "GND").trim().toUpperCase() === "VCC" ? "VCC" : "GND";
      result.push({
        value: String(index),
        label: `Input ${index + 1} • ${pinLabel} • ${contactLabel} to ${sourceLabel}`,
      });
      return result;
    }, []);
  }

  function isTouchButtonStatus(inputStatus) {
    const profile = String(inputStatus?.profile || "").trim().toLowerCase();
    return profile.includes("touch");
  }

  function configuredTouchButtons() {
    return [
      { key: "button1", label: "Touch 1", runtime: state.status?.input?.button1 || null },
      { key: "button2", label: "Touch 2", runtime: state.status?.input?.button2 || null },
    ].filter((entry) => isTouchButtonStatus(entry.runtime));
  }

  function motorStatusFor(channelIndex) {
    const channels = Array.isArray(state.status?.motor?.channels) ? state.status.motor.channels : [];
    return channels[channelIndex] || null;
  }

  function channelElements(channel) {
    return {
      forwardButton: elements[channel.forwardButtonKey],
      backwardButton: elements[channel.backwardButtonKey],
      forwardDurationInput: elements[channel.forwardDurationKey],
      forwardRoleSelect: elements[channel.forwardRoleKey],
      forwardLimitSelect: elements[channel.forwardLimitKey],
      backwardDurationInput: elements[channel.backwardDurationKey],
      backwardRoleSelect: elements[channel.backwardRoleKey],
      backwardLimitSelect: elements[channel.backwardLimitKey],
      status: elements[channel.statusKey],
    };
  }

  function directionControls(controls, direction) {
    return direction === "backward"
      ? {
          button: controls.backwardButton,
          durationInput: controls.backwardDurationInput,
          roleSelect: controls.backwardRoleSelect,
          limitSelect: controls.backwardLimitSelect,
        }
      : {
          button: controls.forwardButton,
          durationInput: controls.forwardDurationInput,
          roleSelect: controls.forwardRoleSelect,
          limitSelect: controls.forwardLimitSelect,
        };
  }

  function syncOppositeMovementRole(channelKey, direction, nextRole) {
    if (nextRole !== "opening" && nextRole !== "closing") {
      return;
    }
    const oppositeDirection = direction === "forward" ? "backward" : "forward";
    const oppositeRole = nextRole === "opening" ? "closing" : "opening";
    const currentOppositeRole = normalizeMovementRole(uiState[channelKey][oppositeDirection].movementRole, oppositeDirection);
    if (currentOppositeRole === nextRole) {
      uiState[channelKey][oppositeDirection].movementRole = oppositeRole;
      uiState[channelKey][oppositeDirection].movementRoleExplicit = true;
    }
  }

  function syncLimitOptions(select, selectedValue, options) {
    if (!select) {
      return;
    }
    const normalizedSelectedValue = selectedValue === undefined || selectedValue === null || selectedValue === ""
      ? ""
      : String(selectedValue);
    const optionMarkup = [
      '<option value="">No stop switch</option>',
      ...options.map((option) => `<option value="${option.value}">${option.label}</option>`),
    ].join("");
    select.innerHTML = optionMarkup;
    select.value = options.some((option) => option.value === normalizedSelectedValue) ? normalizedSelectedValue : "";
  }

  function formatStatusText(channel, status) {
    if (!status || typeof status !== "object") {
      return "idle";
    }

    const active = Boolean(status.active);
    const learnedState = learnedStateFor(channel.key, status);
    const stopReason = String(status.stopReason || "").trim().toLowerCase();
    const direction = String(status.direction || "forward").trim().toLowerCase() === "backward" ? "backward" : "forward";
    const lastDirection = String(status.lastDirection || direction).trim().toLowerCase() === "backward" ? "backward" : "forward";
    const effectiveDirection = active ? direction : lastDirection;
    const role = normalizeMovementRole(uiState[channel.key][effectiveDirection]?.movementRole, effectiveDirection);

    if (active) {
      const remainingMs = Math.max(0, Number(status.remainingMs || 0));
      return `${roleProgressLabel(role, direction)}, ${remainingMs} ms left`;
    }

    if (learnedState !== "unknown") {
      const label = learnedStateLabel(learnedState);
      if (stopReason === "time_limit_reached" || stopReason === "end_switch_activated") {
        return `${label}, ${statusReasonLabel(stopReason)}`;
      }
      return label;
    }

    if (stopReason === "time_limit_reached" || stopReason === "end_switch_activated") {
      return `${roleCompleteLabel(role, lastDirection)}, ${statusReasonLabel(stopReason)}`;
    }

    if (stopReason === "manual_stop") {
      return `${roleProgressLabel(role, lastDirection)} stopped`;
    }

    return "idle";
  }

  function setVisibility(visible) {
    if (elements.motorTabButton) {
      elements.motorTabButton.hidden = !visible;
      elements.motorTabButton.tabIndex = visible ? 0 : -1;
      elements.motorTabButton.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    if (elements.motorTab) {
      elements.motorTab.hidden = !visible;
    }
    if (elements.motorHeroStat) {
      elements.motorHeroStat.hidden = !visible;
    }
    if (visible && activeTabName() !== "motor") {
      try {
        if (window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) === "motor") {
          activateTabByName("motor");
        }
      } catch {
      }
    }
    if (!visible && activeTabName() === "motor") {
      activateTabByName("gpio");
    }
  }

  function channelStatusText(channel, status) {
    if (!channel.configured) {
      return `${channel.forwardSignal} and ${channel.backwardSignal} are not both assigned yet`;
    }

    const pinsLabel = `${channel.forwardSignal}: GPIO ${channel.forwardPin}, ${channel.backwardSignal}: GPIO ${channel.backwardPin}`;
    const statusText = formatStatusText(channel, status);
    return `${pinsLabel} • ${statusText}`;
  }

  function renderHero(driver) {
    if (!elements.motorHeroState || !elements.motorHeroMeta || !elements.motorHeroControls) {
      return;
    }

    if (!driver) {
      elements.motorHeroState.textContent = "Idle";
      elements.motorHeroState.classList.remove("ok", "warn", "bad");
      elements.motorHeroMeta.textContent = "No motor channels configured.";
      elements.motorHeroControls.hidden = true;
      elements.motorHeroControls.innerHTML = "";
      return;
    }

    const configuredChannels = driver.channels
      .map((channel, channelIndex) => ({ channel, channelIndex, status: motorStatusFor(channelIndex) }))
      .filter(({ channel }) => channel.configured);
    const activeEntry = configuredChannels.find(({ status }) => Boolean(status?.active));
    const learnedEntry = configuredChannels.find(({ channel, status }) => learnedStateFor(channel.key, status) !== "unknown");
    const stopReasonEntry = configuredChannels.find(({ status }) => {
      const stopReason = String(status?.stopReason || "").trim().toLowerCase();
      return stopReason === "time_limit_reached" || stopReason === "end_switch_activated";
    });

    elements.motorHeroState.classList.remove("ok", "warn", "bad");
    if (activeEntry) {
      const direction = String(activeEntry.status?.direction || "forward").trim().toLowerCase() === "backward" ? "backward" : "forward";
      const role = normalizeMovementRole(uiState[activeEntry.channel.key][direction]?.movementRole, direction);
      elements.motorHeroState.textContent = `${activeEntry.channel.name} ${roleProgressLabel(role, direction)}`;
      elements.motorHeroState.classList.add("ok");
    } else if (learnedEntry) {
      const learnedState = learnedStateFor(learnedEntry.channel.key, learnedEntry.status);
      elements.motorHeroState.textContent = `${learnedEntry.channel.name} ${learnedStateLabel(learnedState)}`;
      elements.motorHeroState.classList.add("ok");
    } else if (stopReasonEntry) {
      const lastDirection = String(stopReasonEntry.status?.lastDirection || "forward").trim().toLowerCase() === "backward" ? "backward" : "forward";
      const role = normalizeMovementRole(uiState[stopReasonEntry.channel.key][lastDirection]?.movementRole, lastDirection);
      elements.motorHeroState.textContent = `${stopReasonEntry.channel.name} ${roleCompleteLabel(role, lastDirection)}`;
      elements.motorHeroState.classList.add(stopReasonEntry.status?.stopReason === "end_switch_activated" ? "warn" : "bad");
    } else {
      elements.motorHeroState.textContent = configuredChannels.length ? "Idle" : "Not Wired";
    }

    if (!configuredChannels.length) {
      elements.motorHeroMeta.textContent = "No motor channels wired yet.";
      elements.motorHeroControls.hidden = true;
      elements.motorHeroControls.innerHTML = "";
      return;
    }

    elements.motorHeroMeta.textContent = configuredChannels
      .map(({ channel, status }) => `${channel.name}: ${formatStatusText(channel, status)}`)
      .join(" | ");

    elements.motorHeroControls.hidden = false;
    elements.motorHeroControls.innerHTML = configuredChannels.map(({ channel, channelIndex, status }) => {
      const active = Boolean(status?.active);
      const pending = pendingChannels.has(channelIndex);
      const disabled = active || pending;
      const forwardRole = normalizeMovementRole(uiState[channel.key].forward?.movementRole, "forward");
      const backwardRole = normalizeMovementRole(uiState[channel.key].backward?.movementRole, "backward");
      const preferredDirection = preferredDirectionFor(channel.key, status);
      return `
        <div class="motor-hero-row">
          <span class="motor-hero-row-label">${channel.name.replace("Channel ", "")}</span>
          <button type="button" class="motor-hero-button${preferredDirection === "forward" ? "" : " secondary"}" data-motor-channel="${channelIndex}" data-motor-direction="forward" ${disabled ? "disabled" : ""}>${roleButtonLabel(forwardRole, "forward")}</button>
          <button type="button" class="motor-hero-button${preferredDirection === "backward" ? "" : " secondary"}" data-motor-channel="${channelIndex}" data-motor-direction="backward" ${disabled ? "disabled" : ""}>${roleButtonLabel(backwardRole, "backward")}</button>
        </div>
      `;
    }).join("");

    elements.motorHeroControls.querySelectorAll("button[data-motor-channel]").forEach((button) => {
      button.addEventListener("click", () => {
        runChannel(Number(button.dataset.motorChannel), String(button.dataset.motorDirection || "forward")).catch((error) => {
          toast(error?.message || "Motor command failed");
        });
      });
    });
  }

  function renderTouchButtons(driver) {
    if (!elements.motorTouchSection || !elements.motorTouchList || !elements.motorTouchSummary) {
      return;
    }

    const touchButtons = configuredTouchButtons();
    elements.motorTouchSection.hidden = !driver || touchButtons.length === 0;
    if (!driver || touchButtons.length === 0) {
      elements.motorTouchList.innerHTML = "";
      elements.motorTouchSummary.textContent = "Assign motor actions to configured touch buttons.";
      return;
    }

    elements.motorTouchList.innerHTML = touchButtons.map(({ key, label, runtime }) => {
      const configuredIndex = Number(runtime?.configuredIndex);
      const pin = Number(runtime?.pin);
      const detail = [
        Number.isFinite(configuredIndex) && configuredIndex >= 0 ? `Input ${configuredIndex + 1}` : "",
        Number.isFinite(pin) && pin >= 0 ? `GPIO ${pin}` : "",
      ].filter(Boolean).join(" • ");
      const action = uiState.touchButtons?.[key]?.action || "none";
      const selectId = `motor-touch-action-${key}`;
      return `
        <div class="motor-touch-row">
          <div class="motor-touch-meta">
            <div class="motor-touch-title">${label}</div>
            <div class="motor-touch-detail">${detail || "Configured touch input"}</div>
          </div>
          <label class="motor-field" for="${selectId}">
            <span>Action</span>
            <select id="${selectId}" name="${selectId}" data-motor-touch-action="${key}">
              ${TOUCH_BUTTON_ACTION_OPTIONS.map((option) => `<option value="${option.value}"${option.value === action ? " selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
        </div>
      `;
    }).join("");
    elements.motorTouchSummary.textContent = "Touch actions are saved in preferences and Toggle Open/Close uses the learned valve state.";
  }

  function render() {
    syncUiStateFromSettings();

    const driver = activeDrv8833Config();
    setVisibility(Boolean(driver));
    if (!driver) {
      if (elements.motorSummary) {
        elements.motorSummary.textContent = "Select and wire a DRV8833 in Configuration to enable runtime motor controls.";
      }
      renderHero(null);
      return;
    }

    const limitOptions = configuredLimitSwitches();
    if (elements.motorSummary) {
      const configuredChannels = driver.channels.filter((channel) => channel.configured).length;
      elements.motorSummary.textContent = `${driver.label} ready. ${configuredChannels}/2 channels wired.${limitOptions.length ? " Limit switches are available for auto-stop." : " Configure an Input as a limit switch to enable auto-stop."}`;
    }

    driver.channels.forEach((channel, channelIndex) => {
      const controls = channelElements(channel);
      const persisted = uiState[channel.key];
      const status = motorStatusFor(channelIndex);
      persisted.learnedState = learnedStateFor(channel.key, status);
      const preferredDirection = preferredDirectionFor(channel.key, status);

      const active = Boolean(status?.active);
      const pending = pendingChannels.has(channelIndex);
      const disabled = !channel.configured || active || pending;
      DIRECTION_KEYS.forEach((direction) => {
        const directionUi = persisted[direction];
        const directionControlSet = directionControls(controls, direction);
        if (directionControlSet.durationInput) {
          directionControlSet.durationInput.value = String(Math.max(100, Number(directionUi.durationMs || 5000)));
          directionControlSet.durationInput.disabled = !channel.configured || pending;
        }
        if (directionControlSet.roleSelect) {
          directionControlSet.roleSelect.innerHTML = MOVEMENT_ROLE_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
          directionControlSet.roleSelect.value = normalizeMovementRole(directionUi.movementRole, direction);
          directionControlSet.roleSelect.disabled = !channel.configured || pending;
        }
        syncLimitOptions(directionControlSet.limitSelect, directionUi.limitInputIndex, limitOptions);
        if (directionControlSet.limitSelect) {
          directionControlSet.limitSelect.disabled = !channel.configured || pending;
        }
        if (directionControlSet.button) {
          const buttonLabel = roleButtonLabel(normalizeMovementRole(directionUi.movementRole, direction), direction);
          directionControlSet.button.textContent = buttonLabel;
          directionControlSet.button.disabled = disabled;
          directionControlSet.button.classList.toggle("secondary", direction !== preferredDirection);
          directionControlSet.button.title = channel.configured
            ? (active ? "Channel is already running" : (pending ? "Motor command in progress" : `Run ${buttonLabel}`))
            : "Assign both DRV8833 pins in Configuration first";
        }
      });

      if (controls.status) {
        controls.status.textContent = channelStatusText(channel, status);
      }
    });

    renderHero(driver);
    renderTouchButtons(driver);
  }

  async function runChannel(channelIndex, direction) {
    if (pendingChannels.has(channelIndex)) {
      return;
    }

    const channel = MOTOR_CHANNELS[channelIndex];
    const controls = channelElements(channel);
    const directionKey = direction === "backward" ? "backward" : "forward";
    const directionUi = uiState[channel.key][directionKey];
    const directionControlSet = directionControls(controls, directionKey);
    const durationMs = Math.max(100, Number(directionControlSet.durationInput?.value || directionUi.durationMs || 5000));
    const limitInputIndex = String(directionControlSet.limitSelect?.value || "").trim();

    directionUi.durationMs = durationMs;
    directionUi.limitInputIndex = limitInputIndex;
    persistUiStateToSettings();
    pendingChannels.add(channelIndex);
    render();

    try {
      await persistMotorConfigNow();

      await request("/api/motor/run", {
        method: "POST",
        body: JSON.stringify({
          channel: channelIndex,
          direction,
          durationMs,
          limitInputIndex: limitInputIndex === "" ? null : Number(limitInputIndex),
        }),
      });

      const summary = `${channel.name} ${roleButtonLabel(normalizeMovementRole(directionUi.movementRole, directionKey), directionKey)} for ${durationMs} ms`;
      setMessage(summary);
      toast(summary);
      await loadStatus();
    } finally {
      pendingChannels.delete(channelIndex);
      render();
    }
  }

  function bindEvents() {
    MOTOR_CHANNELS.forEach((channel, channelIndex) => {
      const controls = channelElements(channel);
      controls.forwardButton?.addEventListener("click", () => {
        runChannel(channelIndex, "forward").catch((error) => {
          toast(error?.message || "Motor command failed");
        });
      });
      controls.backwardButton?.addEventListener("click", () => {
        runChannel(channelIndex, "backward").catch((error) => {
          toast(error?.message || "Motor command failed");
        });
      });
      DIRECTION_KEYS.forEach((direction) => {
        const directionControlSet = directionControls(controls, direction);
        directionControlSet.durationInput?.addEventListener("change", (event) => {
          uiState[channel.key][direction].durationMs = Math.max(100, Number(event.target.value || 5000));
          queueMotorConfigSave();
          render();
        });
        directionControlSet.roleSelect?.addEventListener("change", (event) => {
          uiState[channel.key][direction].movementRole = normalizeMovementRole(event.target.value, direction);
          uiState[channel.key][direction].movementRoleExplicit = uiState[channel.key][direction].movementRole !== "none";
          syncOppositeMovementRole(channel.key, direction, uiState[channel.key][direction].movementRole);
          queueMotorConfigSave();
          render();
        });
        directionControlSet.limitSelect?.addEventListener("change", (event) => {
          uiState[channel.key][direction].limitInputIndex = String(event.target.value || "");
          queueMotorConfigSave();
          render();
        });
      });
    });

    elements.motorTouchList?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.dataset.motorTouchAction) {
        return;
      }
      const key = String(target.dataset.motorTouchAction || "");
      if (!uiState.touchButtons?.[key]) {
        return;
      }
      uiState.touchButtons[key].action = TOUCH_BUTTON_ACTION_OPTIONS.some((option) => option.value === target.value) ? target.value : "none";
      queueMotorConfigSave();
      render();
    });
  }

  return {
    bindEvents,
    render,
  };
}