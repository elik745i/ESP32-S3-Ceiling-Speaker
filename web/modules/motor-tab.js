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

function defaultMovementRole(direction) {
  return "none";
}

function normalizeMovementRole(value, direction) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue === "opening" || normalizedValue === "closing" || normalizedValue === "none") {
    return normalizedValue;
  }
  return defaultMovementRole(direction);
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

function defaultUiState() {
  return {
    a: {
      forward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
      backward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
    },
    b: {
      forward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
      backward: { durationMs: 5000, limitInputIndex: "", movementRole: "none", movementRoleExplicit: false },
    },
  };
}

function normalizeUiState(value) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }
  source = source && typeof source === "object" && !Array.isArray(source) ? source : {};

  const normalizeDirectionState = (channelKey, directionKey) => {
    const legacyChannel = source?.[channelKey] && typeof source[channelKey] === "object" ? source[channelKey] : {};
    const direction = legacyChannel?.[directionKey] && typeof legacyChannel[directionKey] === "object" ? legacyChannel[directionKey] : {};
    const fallbackDuration = Math.max(100, Number(legacyChannel?.durationMs || 5000));
    const fallbackLimit = legacyChannel?.limitInputIndex === "" || legacyChannel?.limitInputIndex === undefined || legacyChannel?.limitInputIndex === null
      ? ""
      : String(legacyChannel.limitInputIndex);
    const movementRoleExplicit = direction?.movementRoleExplicit === true;
    return {
      durationMs: Math.max(100, Number(direction?.durationMs || fallbackDuration || 5000)),
      limitInputIndex: direction?.limitInputIndex === "" || direction?.limitInputIndex === undefined || direction?.limitInputIndex === null
        ? fallbackLimit
        : String(direction.limitInputIndex),
      movementRole: movementRoleExplicit ? normalizeMovementRole(direction?.movementRole, directionKey) : "none",
      movementRoleExplicit,
    };
  };

  return {
    a: {
      forward: normalizeDirectionState("a", "forward"),
      backward: normalizeDirectionState("a", "backward"),
    },
    b: {
      forward: normalizeDirectionState("b", "forward"),
      backward: normalizeDirectionState("b", "backward"),
    },
  };
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
    DIRECTION_KEYS.forEach((directionKey) => {
      target[channelKey][directionKey].durationMs = normalized[channelKey][directionKey].durationMs;
      target[channelKey][directionKey].limitInputIndex = normalized[channelKey][directionKey].limitInputIndex;
      target[channelKey][directionKey].movementRole = normalized[channelKey][directionKey].movementRole;
      target[channelKey][directionKey].movementRoleExplicit = normalized[channelKey][directionKey].movementRoleExplicit;
    });
  });
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
  }));
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

  copyUiState(uiState, readStoredUiState());

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

  function persistUiStateToSettings(options = {}) {
    state.settings ||= {};
    state.settings.ui ||= {};
    const normalized = normalizeUiState(uiState);
    state.settings.ui.motorRuntimeConfig = normalized;
    lastHydratedSettingsKey = stableUiStateKey(normalized);
    state.settingsDirty = true;
    persistUiState();
    if (!state.settingsLoading && options.queuePersist !== false) {
      queueSettingsSave?.(0);
    }
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
    const stopReason = String(status.stopReason || "").trim().toLowerCase();
    const direction = String(status.direction || "forward").trim().toLowerCase() === "backward" ? "backward" : "forward";
    const lastDirection = String(status.lastDirection || direction).trim().toLowerCase() === "backward" ? "backward" : "forward";
    const effectiveDirection = active ? direction : lastDirection;
    const role = normalizeMovementRole(uiState[channel.key][effectiveDirection]?.movementRole, effectiveDirection);

    if (active) {
      const remainingMs = Math.max(0, Number(status.remainingMs || 0));
      return `${roleProgressLabel(role, direction)}, ${remainingMs} ms left`;
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
      return `
        <div class="motor-hero-row">
          <span class="motor-hero-row-label">${channel.name.replace("Channel ", "")}</span>
          <button type="button" class="motor-hero-button" data-motor-channel="${channelIndex}" data-motor-direction="forward" ${disabled ? "disabled" : ""}>${roleButtonLabel(forwardRole, "forward")}</button>
          <button type="button" class="motor-hero-button secondary" data-motor-channel="${channelIndex}" data-motor-direction="backward" ${disabled ? "disabled" : ""}>${roleButtonLabel(backwardRole, "backward")}</button>
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
    persistUiStateToSettings({ queuePersist: state.settingsDirty });
    pendingChannels.add(channelIndex);
    render();

    try {
      if (state.settingsDirty) {
        await saveSettings({ silent: true });
      }
      await awaitPendingSettingsSave();

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
          persistUiStateToSettings();
          render();
        });
        directionControlSet.roleSelect?.addEventListener("change", (event) => {
          uiState[channel.key][direction].movementRole = normalizeMovementRole(event.target.value, direction);
          uiState[channel.key][direction].movementRoleExplicit = uiState[channel.key][direction].movementRole !== "none";
          syncOppositeMovementRole(channel.key, direction, uiState[channel.key][direction].movementRole);
          persistUiStateToSettings();
          render();
        });
        directionControlSet.limitSelect?.addEventListener("change", (event) => {
          uiState[channel.key][direction].limitInputIndex = String(event.target.value || "");
          persistUiStateToSettings();
          render();
        });
      });
    });
  }

  return {
    bindEvents,
    render,
  };
}