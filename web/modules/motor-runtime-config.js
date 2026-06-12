export function normalizeMotorLearnedState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "open" || normalized === "closed" ? normalized : "unknown";
}

export function normalizeTouchMotorAction(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[-/\s]+/g, "_");
  return normalized === "toggle_open" || normalized === "toggle_close" || normalized === "toggle_open_close" || normalized === "none"
    ? normalized
    : "none";
}

export function normalizeMovementRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "opening" || normalized === "closing" || normalized === "none" ? normalized : "none";
}

function normalizeDirectionState(source, channelKey, directionKey) {
  const legacyChannel = source?.[channelKey] && typeof source[channelKey] === "object" ? source[channelKey] : {};
  const direction = legacyChannel?.[directionKey] && typeof legacyChannel[directionKey] === "object" ? legacyChannel[directionKey] : {};
  const fallbackDuration = Math.max(100, Number(legacyChannel?.durationMs || 5000));
  const fallbackLimit = legacyChannel?.limitInputIndex === "" || legacyChannel?.limitInputIndex === undefined || legacyChannel?.limitInputIndex === null
    ? ""
    : String(legacyChannel.limitInputIndex);
  const normalizedRole = normalizeMovementRole(direction?.movementRole);
  const movementRoleExplicit = direction?.movementRoleExplicit === true || normalizedRole === "opening" || normalizedRole === "closing";
  return {
    durationMs: Math.max(100, Number(direction?.durationMs || fallbackDuration || 5000)),
    limitInputIndex: direction?.limitInputIndex === "" || direction?.limitInputIndex === undefined || direction?.limitInputIndex === null
      ? fallbackLimit
      : String(direction.limitInputIndex),
    movementRole: movementRoleExplicit ? normalizedRole : "none",
    movementRoleExplicit,
  };
}

export function normalizeMotorRuntimeConfig(value) {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }
  source = source && typeof source === "object" && !Array.isArray(source) ? source : {};

  return {
    a: {
      learnedState: normalizeMotorLearnedState(source?.a?.learnedState),
      forward: normalizeDirectionState(source, "a", "forward"),
      backward: normalizeDirectionState(source, "a", "backward"),
    },
    b: {
      learnedState: normalizeMotorLearnedState(source?.b?.learnedState),
      forward: normalizeDirectionState(source, "b", "forward"),
      backward: normalizeDirectionState(source, "b", "backward"),
    },
    touchButtons: {
      button1: { action: normalizeTouchMotorAction(source?.touchButtons?.button1?.action) },
      button2: { action: normalizeTouchMotorAction(source?.touchButtons?.button2?.action) },
    },
  };
}