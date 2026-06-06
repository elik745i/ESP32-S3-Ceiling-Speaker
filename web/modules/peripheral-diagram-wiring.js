import {
  peripheralDiagramLabelPalette,
  peripheralDiagramLabelId,
  peripheralDiagramBoardNodeId,
  peripheralDiagramBoardLabelEntryId,
  peripheralDiagramBoardLabelDefaultLayout,
  resolvePeripheralDiagramNodeLabels,
} from "./peripheral-diagram-label-editor.js";

const PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY = "__wireCurves";

function normalizeSignalLabel(label) {
  return String(label || "")
    .replace(/^OLED\s+/i, "")
    .replace(/^I2S\s+/i, "")
    .replace(/^SD\s+/i, "")
    .replace(/^TX\s*\/\s*/i, "TX ")
    .replace(/^RX\s*\/\s*/i, "RX ")
    .trim();
}

function signalKey(label) {
  return normalizeSignalLabel(label).toUpperCase();
}

function isPositivePowerSignal(label) {
  return ["VCC", "VIN", "PWR", "VBUS", "5V", "3V3", "3.3V", "3VO"].includes(signalKey(label));
}

function isGroundSignal(label) {
  return signalKey(label) === "GND" || signalKey(label) === "GROUND";
}

function powerRailLabelForNode(node, label) {
  const key = signalKey(label);
  if (key === "GND" || key === "GROUND") {
    return "GND";
  }
  if (key === "5V" || key === "VIN" || key === "VBUS") {
    return "5V";
  }
  if (key === "3V3" || key === "3.3V" || key === "3VO") {
    return "3V3";
  }
  if (!["VCC", "PWR"].includes(key)) {
    return null;
  }
  return ["audio", "control"].includes(String(node?.groupKey || "")) ? "5V" : "3V3";
}

function classifyWireColor(connection) {
  const signal = signalKey(connection.signalLabel);
  const board = signalKey(connection.boardLabel);

  if (signal === "GND" || board === "GND") {
    return { stroke: "#111827", glow: "rgba(17, 24, 39, 0.18)", badge: "#111827", text: "#ffffff" };
  }
  if (board === "5V" || signal === "5V" || signal === "VIN" || signal === "VBUS") {
    return { stroke: "#dc2626", glow: "rgba(220, 38, 38, 0.18)", badge: "#dc2626", text: "#ffffff" };
  }
  if (board === "3V3" || signal === "3V3" || signal === "3.3V" || signal === "VCC" || signal === "PWR") {
    return { stroke: "#ea580c", glow: "rgba(234, 88, 12, 0.18)", badge: "#ea580c", text: "#ffffff" };
  }
  if (["SDA", "MOSI", "DIN", "DOUT", "DATA", "DQ", "RX"].includes(signal)) {
    return { stroke: "#0284c7", glow: "rgba(2, 132, 199, 0.18)", badge: "#0284c7", text: "#ffffff" };
  }
  if (["SCL", "SCK", "CLK", "BCLK", "WS", "PCLK", "TX"].includes(signal)) {
    return { stroke: "#ca8a04", glow: "rgba(202, 138, 4, 0.18)", badge: "#ca8a04", text: "#ffffff" };
  }
  if (["CS", "RST", "RESET", "DC", "BL", "INT", "EN", "STBY", "TRIG", "TRIGGER", "CTRL", "CMD"].includes(signal)) {
    return { stroke: "#16a34a", glow: "rgba(22, 163, 74, 0.18)", badge: "#16a34a", text: "#ffffff" };
  }
  if (["PWM", "PWM1", "PWM2", "OUT", "IN", "SIG", "GPIO", "A", "B", "SW", "BUS"].includes(signal)) {
    return { stroke: "#7c3aed", glow: "rgba(124, 58, 237, 0.18)", badge: "#7c3aed", text: "#ffffff" };
  }
  return { stroke: "#0f766e", glow: "rgba(15, 118, 110, 0.18)", badge: "#0f766e", text: "#ffffff" };
}

function boardTargetKey(connection) {
  return connection.type === "gpio"
    ? `gpio:${connection.pin}`
    : `rail:${String(connection.boardLabel || "").toUpperCase()}`;
}

function boardSideForNode(nodeRect, boardRect) {
  const nodeCenterX = nodeRect.left + (nodeRect.width / 2);
  const nodeCenterY = nodeRect.top + (nodeRect.height / 2);
  const boardCenterX = boardRect.left + (boardRect.width / 2);
  const boardCenterY = boardRect.top + (boardRect.height / 2);
  const deltaX = nodeCenterX - boardCenterX;
  const deltaY = nodeCenterY - boardCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX < 0 ? "left" : "right";
  }
  return deltaY < 0 ? "top" : "bottom";
}

function nodeAnchorForConnection(nodeRect, boardRect, connectionIndex, connectionCount) {
  const side = boardSideForNode(nodeRect, boardRect);
  const spreadIndex = connectionIndex + 1;
  const spreadCount = Math.max(connectionCount + 1, 2);

  if (side === "left") {
    return {
      x: nodeRect.left + nodeRect.width,
      y: nodeRect.top + ((nodeRect.height / spreadCount) * spreadIndex),
      side,
    };
  }
  if (side === "right") {
    return {
      x: nodeRect.left,
      y: nodeRect.top + ((nodeRect.height / spreadCount) * spreadIndex),
      side,
    };
  }
  if (side === "top") {
    return {
      x: nodeRect.left + ((nodeRect.width / spreadCount) * spreadIndex),
      y: nodeRect.top + nodeRect.height,
      side,
    };
  }
  return {
    x: nodeRect.left + ((nodeRect.width / spreadCount) * spreadIndex),
    y: nodeRect.top,
    side,
  };
}

function createSvgElement(tagName) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

function anchorDetourPoint(anchor, ownerRect, target, margin = 26) {
  const ownerLeft = Number(ownerRect?.left || 0);
  const ownerTop = Number(ownerRect?.top || 0);
  const ownerRight = ownerLeft + Number(ownerRect?.width || 0);
  const ownerBottom = ownerTop + Number(ownerRect?.height || 0);
  const ownerCenterX = ownerLeft + ((ownerRight - ownerLeft) / 2);
  const ownerCenterY = ownerTop + ((ownerBottom - ownerTop) / 2);

  if (anchor.side === "top" || anchor.side === "bottom") {
    return {
      x: target.x < ownerCenterX ? ownerLeft - margin : ownerRight + margin,
      y: anchor.y,
    };
  }

  return {
    x: anchor.x,
    y: target.y < ownerCenterY ? ownerTop - margin : ownerBottom + margin,
  };
}

function connectionPath(nodeAnchor, boardAnchor, nodeOwnerRect, boardOwnerRect) {
  const startDetour = anchorDetourPoint(nodeAnchor, nodeOwnerRect, boardAnchor);
  const endDetour = anchorDetourPoint(boardAnchor, boardOwnerRect, nodeAnchor);
  const points = [
    `M ${nodeAnchor.x} ${nodeAnchor.y}`,
    `L ${startDetour.x} ${startDetour.y}`,
  ];

  if (Math.abs(startDetour.x - endDetour.x) > 0.5 || Math.abs(startDetour.y - endDetour.y) > 0.5) {
    const intermediate = (nodeAnchor.side === "top" || nodeAnchor.side === "bottom")
      ? { x: endDetour.x, y: startDetour.y }
      : { x: startDetour.x, y: endDetour.y };
    if (Math.abs(intermediate.x - startDetour.x) > 0.5 || Math.abs(intermediate.y - startDetour.y) > 0.5) {
      points.push(`L ${intermediate.x} ${intermediate.y}`);
    }
  }

  points.push(`L ${endDetour.x} ${endDetour.y}`);
  points.push(`L ${boardAnchor.x} ${boardAnchor.y}`);
  return points.join(" ");
}

function defaultConnectionControlPoint(nodeAnchor, startDetour, endDetour) {
  const controlPoint = (nodeAnchor.side === "top" || nodeAnchor.side === "bottom")
    ? { x: endDetour.x, y: startDetour.y }
    : { x: startDetour.x, y: endDetour.y };

  if (Math.abs(controlPoint.x - startDetour.x) <= 0.5 && Math.abs(controlPoint.y - startDetour.y) <= 0.5) {
    return {
      x: (startDetour.x + endDetour.x) / 2,
      y: (startDetour.y + endDetour.y) / 2,
    };
  }

  return controlPoint;
}

function quadraticPointAt(startPoint, controlPoint, endPoint, t) {
  const inverse = 1 - t;
  return {
    x: (inverse * inverse * startPoint.x) + (2 * inverse * t * controlPoint.x) + (t * t * endPoint.x),
    y: (inverse * inverse * startPoint.y) + (2 * inverse * t * controlPoint.y) + (t * t * endPoint.y),
  };
}

function controlPointFromHandlePoint(startPoint, endPoint, handlePoint) {
  return {
    x: (2 * handlePoint.x) - ((startPoint.x + endPoint.x) / 2),
    y: (2 * handlePoint.y) - ((startPoint.y + endPoint.y) / 2),
  };
}

function connectionGeometry(nodeAnchor, boardAnchor, nodeOwnerRect, boardOwnerRect, manualCurvePoint = null) {
  const startDetour = anchorDetourPoint(nodeAnchor, nodeOwnerRect, boardAnchor);
  const endDetour = anchorDetourPoint(boardAnchor, boardOwnerRect, nodeAnchor);
  const controlPoint = manualCurvePoint || defaultConnectionControlPoint(nodeAnchor, startDetour, endDetour);
  const hasCurve = Math.abs(startDetour.x - endDetour.x) > 0.5 || Math.abs(startDetour.y - endDetour.y) > 0.5;
  const points = [
    `M ${nodeAnchor.x} ${nodeAnchor.y}`,
    `L ${startDetour.x} ${startDetour.y}`,
  ];

  if (hasCurve) {
    points.push(`Q ${controlPoint.x} ${controlPoint.y} ${endDetour.x} ${endDetour.y}`);
  } else {
    points.push(`L ${endDetour.x} ${endDetour.y}`);
  }

  points.push(`L ${boardAnchor.x} ${boardAnchor.y}`);
  return {
    path: points.join(" "),
    controlPoint,
    handlePoint: hasCurve
      ? quadraticPointAt(startDetour, controlPoint, endDetour, 0.5)
      : { x: (startDetour.x + endDetour.x) / 2, y: (startDetour.y + endDetour.y) / 2 },
    startDetour,
    endDetour,
  };
}

function selectedOptionText(element, fallback) {
  return String(element?.selectedOptions?.[0]?.textContent || fallback || "").trim();
}

const BOARD_ANCHOR_CALIBRATIONS = {
  "esp32-s3-zero": {
    topInsetRatio: 0.065,
    bottomInsetRatio: 0.06,
    outerOffset: 5,
    extraLaneGap: 11,
  },
};

function boardAnchorCalibration(boardProfile) {
  return {
    topInsetRatio: 0.055,
    bottomInsetRatio: 0.055,
    outerOffset: 8,
    extraLaneGap: 12,
    ...(BOARD_ANCHOR_CALIBRATIONS[boardProfile] || {}),
  };
}

function setActiveConnection(overlay, activeGroup) {
  const groups = overlay.querySelectorAll(".peripheral-diagram-wire-connection");
  const hovering = Boolean(activeGroup);
  overlay.classList.toggle("is-connection-hovering", hovering);
  groups.forEach((group) => {
    group.classList.toggle("is-active", group === activeGroup);
  });
}

function ensureLabelLayer(stage) {
  if (!stage) {
    return null;
  }

  let layer = stage.querySelector(".peripheral-diagram-label-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "peripheral-diagram-label-layer";
    stage.appendChild(layer);
  }
  return layer;
}

function relativeRectForElement(element, stageRect) {
  const rect = element?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) {
    return null;
  }
  return {
    left: rect.left - stageRect.left,
    top: rect.top - stageRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function nodeVisualRect(nodeElement, stageRect) {
  const visual = nodeElement?.querySelector(".peripheral-diagram-node-visual");
  const visualSurface = visual?.firstElementChild || visual;
  return relativeRectForElement(visualSurface, stageRect) || relativeRectForElement(visual, stageRect) || relativeRectForElement(nodeElement, stageRect);
}

function signalLabelStorageKey(nodeId, signalLabel) {
  return `${nodeId}:${signalKey(signalLabel)}`;
}

function connectionStorageKey(connection) {
  return `${String(connection.nodeId || "node")}:${signalKey(connection.signalLabel)}:${boardTargetKey(connection)}`;
}

function ensureWireCurveStore(state) {
  state.peripheralDiagramPositions ||= {};
  const current = state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY] = {};
  }
  return state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY];
}

function clearWireCurveStore(state) {
  if (!state.peripheralDiagramPositions || typeof state.peripheralDiagramPositions !== "object") {
    state.peripheralDiagramPositions = {};
    return false;
  }
  const current = state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY];
  if (!current || typeof current !== "object" || Array.isArray(current) || !Object.keys(current).length) {
    delete state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY];
    return false;
  }
  delete state.peripheralDiagramPositions[PERIPHERAL_DIAGRAM_WIRE_CURVES_KEY];
  return true;
}

function readStoredWireCurve(state, key, stageRect) {
  const entry = ensureWireCurveStore(state)[key];
  if (!entry || !stageRect?.width || !stageRect?.height) {
    return null;
  }
  const xFactor = Number(entry.xFactor);
  const yFactor = Number(entry.yFactor);
  if (!Number.isFinite(xFactor) || !Number.isFinite(yFactor)) {
    return null;
  }
  return {
    x: clampValue(xFactor * stageRect.width, 0, stageRect.width),
    y: clampValue(yFactor * stageRect.height, 0, stageRect.height),
  };
}

function writeStoredWireCurve(state, key, point, stageRect) {
  if (!point || !stageRect?.width || !stageRect?.height) {
    return;
  }
  ensureWireCurveStore(state)[key] = {
    xFactor: clampValue(point.x / stageRect.width, 0, 1),
    yFactor: clampValue(point.y / stageRect.height, 0, 1),
  };
}

function signalLabelDefaultLayout(nodeRect, anchor, signalLabel) {
  const label = normalizeSignalLabel(signalLabel) || "SIG";
  const width = Math.max(28, (label.length * 6.6) + 14);
  const sideOffset = anchor.side === "left"
    ? 8
    : (anchor.side === "right"
      ? -(width + 8)
      : -(width / 2));
  const verticalOffset = anchor.side === "top" ? 8 : -26;
  const centerX = anchor.x + sideOffset + (width / 2);
  const centerY = anchor.y + verticalOffset + 9;
  return {
    xFactor: nodeRect.width > 0 ? ((centerX - (nodeRect.left + (nodeRect.width / 2))) / nodeRect.width) : 0,
    yFactor: nodeRect.height > 0 ? ((centerY - (nodeRect.top + (nodeRect.height / 2))) / nodeRect.height) : 0,
    rotation: 0,
  };
}

function floatingLabelDefaultLayout(nodeRect, index, count) {
  const verticalCenter = (count - 1) / 2;
  return {
    xFactor: 0,
    yFactor: ((index - verticalCenter) * 0.18) - 0.32,
    rotation: 0,
  };
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function convertLayoutToVisualSpace(layout, sourceRect, visualRect) {
  if (!sourceRect?.width || !sourceRect?.height || !visualRect?.width || !visualRect?.height) {
    return {
      xFactor: Number(layout?.xFactor || 0),
      yFactor: Number(layout?.yFactor || 0),
      rotation: Number(layout?.rotation || 0),
    };
  }
  return {
    xFactor: (Number(layout?.xFactor || 0) * sourceRect.width) / visualRect.width,
    yFactor: (Number(layout?.yFactor || 0) * sourceRect.height) / visualRect.height,
    rotation: Number(layout?.rotation || 0),
  };
}

function renderSignalLabels(layer, labelEntries) {
  if (!layer) {
    return;
  }

  layer.innerHTML = "";
  const stage = layer.parentElement;
  const stageWidth = stage?.clientWidth || 0;
  const stageHeight = stage?.clientHeight || 0;
  const labelPadding = 36;
  labelEntries.forEach((entry) => {
    const rawCenterX = entry.nodeRect.left + (entry.nodeRect.width / 2) + (entry.layout.xFactor * entry.nodeRect.width);
    const rawCenterY = entry.nodeRect.top + (entry.nodeRect.height / 2) + (entry.layout.yFactor * entry.nodeRect.height);
    const centerX = stageWidth > 0 ? clampValue(rawCenterX, labelPadding, stageWidth - labelPadding) : rawCenterX;
    const centerY = stageHeight > 0 ? clampValue(rawCenterY, labelPadding, stageHeight - labelPadding) : rawCenterY;
    const element = document.createElement("div");
    element.className = "peripheral-diagram-floating-label";
    element.style.left = `${centerX}px`;
    element.style.top = `${centerY}px`;
    element.style.transform = `translate(-50%, -50%) rotate(${Number(entry.layout.rotation || 0)}deg)`;

    const pill = document.createElement("span");
    pill.className = "peripheral-diagram-floating-label-pill";
    pill.textContent = entry.label;
    pill.style.background = entry.palette.badge;
    pill.style.color = entry.palette.text;
    element.appendChild(pill);
    layer.appendChild(element);
  });
}

function labelDisplayCenter(entry, stageWidth, stageHeight, labelPadding = 36) {
  const rawCenterX = entry.nodeRect.left + (entry.nodeRect.width / 2) + (entry.layout.xFactor * entry.nodeRect.width);
  const rawCenterY = entry.nodeRect.top + (entry.nodeRect.height / 2) + (entry.layout.yFactor * entry.nodeRect.height);
  return {
    x: stageWidth > 0 ? clampValue(rawCenterX, labelPadding, stageWidth - labelPadding) : rawCenterX,
    y: stageHeight > 0 ? clampValue(rawCenterY, labelPadding, stageHeight - labelPadding) : rawCenterY,
  };
}

function floatingLabelSize(label) {
  const normalized = normalizeSignalLabel(label) || "SIG";
  return {
    width: Math.max(28, (normalized.length * 6.6) + 30),
    height: 24,
  };
}

function labelAnchorAwayFromOwner(entry, ownerRect, stageWidth, stageHeight) {
  const center = labelDisplayCenter(entry, stageWidth, stageHeight);
  const rotation = (Number(entry.layout?.rotation || 0) * Math.PI) / 180;
  const size = floatingLabelSize(entry.label);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const ownerCenterX = Number(ownerRect?.left || 0) + (Number(ownerRect?.width || 0) / 2);
  const ownerCenterY = Number(ownerRect?.top || 0) + (Number(ownerRect?.height || 0) / 2);
  const deltaX = center.x - ownerCenterX;
  const deltaY = center.y - ownerCenterY;

  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
    return { x: center.x, y: center.y, side: "right" };
  }

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = (deltaX * cos) - (deltaY * sin);
  const localY = (deltaX * sin) + (deltaY * cos);
  const scaleX = Math.abs(localX) > 0.001 ? (halfWidth / Math.abs(localX)) : Number.POSITIVE_INFINITY;
  const scaleY = Math.abs(localY) > 0.001 ? (halfHeight / Math.abs(localY)) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);
  const edgeLocalX = localX * scale;
  const edgeLocalY = localY * scale;
  const worldCos = Math.cos(rotation);
  const worldSin = Math.sin(rotation);
  const edgeWorldX = center.x + (edgeLocalX * worldCos) - (edgeLocalY * worldSin);
  const edgeWorldY = center.y + (edgeLocalX * worldSin) + (edgeLocalY * worldCos);
  const side = Math.abs(edgeLocalX / Math.max(halfWidth, 1)) >= Math.abs(edgeLocalY / Math.max(halfHeight, 1))
    ? (edgeLocalX < 0 ? "left" : "right")
    : (edgeLocalY < 0 ? "top" : "bottom");

  return {
    x: edgeWorldX,
    y: edgeWorldY,
    side,
  };
}

export function createPeripheralDiagramWiringModule({
  state,
  elements,
  gpioBoardLayouts,
  gpioBoardExtraLayouts,
  activeGpioBoardProfile,
  realPeripheralBindingDefinitions,
  helperSignalLabels,
  peripheralHelperBindingValue,
  setPeripheralHelperBindingValue,
  savePeripheralDiagramPositions,
}) {
  let lastRenderedNodes = [];
  const curveDragState = {
    key: "",
    pointerId: null,
    group: null,
  };
  function defaultSignalLabelEntries(node) {
    const groupKey = String(node?.groupKey || "");
    const profileValue = String(node?.profileValue || "none");
    const index = Number(node?.index || 0);
    const entries = [];
    const used = new Set();

    for (const definition of realPeripheralBindingDefinitions(groupKey, profileValue, state.settings || {}, index)) {
      const label = normalizeSignalLabel(definition.label);
      const id = peripheralDiagramLabelId(label);
      if (!label || used.has(id)) {
        continue;
      }
      used.add(id);
      entries.push({ id, label, order: entries.length });
    }

    for (const signalLabel of helperSignalLabels(groupKey, profileValue)) {
      const label = normalizeSignalLabel(signalLabel);
      const id = peripheralDiagramLabelId(label);
      if (!label || used.has(id)) {
        continue;
      }
      used.add(id);
      entries.push({ id, label, order: entries.length });
    }

    return entries;
  }

  function resolvedBoardSignalPins() {
    const boardProfile = activeGpioBoardProfile();
    if (!boardProfile) {
      return new Map();
    }

    const boardDefaults = editableBoardLabels(boardProfile);
    const pinById = new Map(
      boardDefaults
        .filter((entry) => Number.isFinite(Number(entry.pin)))
        .map((entry) => [entry.id, Number(entry.pin)]),
    );
    const resolvedBoardLabels = resolvePeripheralDiagramNodeLabels(
      state,
      peripheralDiagramBoardNodeId(boardProfile),
      boardDefaults,
    );

    const boardPinsBySignal = new Map();
    for (const entry of resolvedBoardLabels) {
      const pin = pinById.get(entry.id);
      if (!Number.isFinite(pin)) {
        continue;
      }
      const key = signalKey(entry.label);
      if (!key || boardPinsBySignal.has(key)) {
        continue;
      }
      boardPinsBySignal.set(key, pin);
    }

    return boardPinsBySignal;
  }

  function matchingOptionValue(element, pin) {
    if (!element) {
      return null;
    }
    const match = [...element.options].find((option) => Number(option.value) === Number(pin));
    return match ? String(match.value) : null;
  }

  function applyRealBindingPin(element, pin) {
    const optionValue = matchingOptionValue(element, pin);
    if (!optionValue) {
      return false;
    }
    const changed = String(element.value || "") !== optionValue;
    element.value = optionValue;
    return changed;
  }

  function rewireFromLabels(nodes = Object.values(state.peripheralDiagramNodeMap || {})) {
    const boardPinsBySignal = resolvedBoardSignalPins();
    const usedPins = new Set();
    let matchedAssignments = 0;

    for (const node of nodes) {
      const groupKey = String(node?.groupKey || "");
      const profileValue = String(node?.profileValue || "none");
      const index = Number(node?.index || 0);
      if (!groupKey || profileValue === "none") {
        continue;
      }

      const resolvedLabels = resolvePeripheralDiagramNodeLabels(state, node.id, defaultSignalLabelEntries(node));
      const labelsById = new Map(resolvedLabels.map((entry) => [entry.id, entry]));

      for (const definition of realPeripheralBindingDefinitions(groupKey, profileValue, state.settings || {}, index)) {
        const labelId = peripheralDiagramLabelId(normalizeSignalLabel(definition.label));
        const resolvedLabel = labelsById.get(labelId);
        const pin = boardPinsBySignal.get(signalKey(resolvedLabel?.label || definition.label));
        const optionValue = matchingOptionValue(definition.element, pin);
        if (!optionValue || usedPins.has(optionValue)) {
          continue;
        }
        if (applyRealBindingPin(definition.element, pin)) {
          matchedAssignments += 1;
        }
        usedPins.add(optionValue);
      }

      const realSignalKeys = new Set(
        realPeripheralBindingDefinitions(groupKey, profileValue, state.settings || {}, index)
          .map((definition) => signalKey(definition.label)),
      );
      for (const helperSignal of helperSignalLabels(groupKey, profileValue)) {
        if (realSignalKeys.has(signalKey(helperSignal))) {
          continue;
        }
        const labelId = peripheralDiagramLabelId(normalizeSignalLabel(helperSignal));
        const resolvedLabel = labelsById.get(labelId);
        const pin = boardPinsBySignal.get(signalKey(resolvedLabel?.label || helperSignal));
        const optionValue = String(pin || "").trim();
        if (!optionValue || usedPins.has(optionValue)) {
          continue;
        }
        const existingValue = String(peripheralHelperBindingValue(groupKey, index, helperSignal) || "").trim();
        setPeripheralHelperBindingValue(groupKey, index, helperSignal, optionValue);
        if (existingValue !== optionValue) {
          matchedAssignments += 1;
        }
        usedPins.add(optionValue);
      }
    }

    return { matchedAssignments };
  }

  function updateCurveGroupPath(group, controlPoint) {
    if (!group || !controlPoint) {
      return;
    }
    const nodeAnchor = {
      x: Number(group.dataset.nodeAnchorX || 0),
      y: Number(group.dataset.nodeAnchorY || 0),
      side: String(group.dataset.nodeAnchorSide || "right"),
    };
    const boardAnchor = {
      x: Number(group.dataset.boardAnchorX || 0),
      y: Number(group.dataset.boardAnchorY || 0),
      side: String(group.dataset.boardAnchorSide || "left"),
    };
    const nodeRect = {
      left: Number(group.dataset.nodeRectLeft || 0),
      top: Number(group.dataset.nodeRectTop || 0),
      width: Number(group.dataset.nodeRectWidth || 0),
      height: Number(group.dataset.nodeRectHeight || 0),
    };
    const boardRect = {
      left: Number(group.dataset.boardRectLeft || 0),
      top: Number(group.dataset.boardRectTop || 0),
      width: Number(group.dataset.boardRectWidth || 0),
      height: Number(group.dataset.boardRectHeight || 0),
    };
    const geometry = connectionGeometry(nodeAnchor, boardAnchor, nodeRect, boardRect, controlPoint);
    group.querySelector(".peripheral-diagram-wire-glow")?.setAttribute("d", geometry.path);
    group.querySelector(".peripheral-diagram-wire")?.setAttribute("d", geometry.path);
    group.querySelector(".peripheral-diagram-wire-hit")?.setAttribute("d", geometry.path);
    const handle = group.querySelector(".peripheral-diagram-wire-handle");
    handle?.setAttribute("cx", String(geometry.handlePoint.x));
    handle?.setAttribute("cy", String(geometry.handlePoint.y));
    group.dataset.controlX = String(geometry.controlPoint.x);
    group.dataset.controlY = String(geometry.controlPoint.y);
  }

  function beginCurvePointerDrag(event, overlay, connectionGroup, connectionKey, placeHandleUnderPointer = false) {
    event.preventDefault();
    event.stopPropagation();
    connectionGroup.classList.add("is-active", "is-dragging");
    setActiveConnection(overlay, connectionGroup);
    curveDragState.key = connectionKey;
    curveDragState.pointerId = event.pointerId;
    curveDragState.group = connectionGroup;

    if (placeHandleUnderPointer) {
      handleCurvePointerMove(event);
    }

    window.addEventListener("pointermove", handleCurvePointerMove);
    window.addEventListener("pointerup", finishCurvePointerDrag);
    window.addEventListener("pointercancel", finishCurvePointerDrag);
  }

  function handleCurvePointerMove(event) {
    if (curveDragState.pointerId !== event.pointerId || !curveDragState.key || !curveDragState.group) {
      return;
    }
    const stageRect = elements.peripheralDiagramStage?.getBoundingClientRect();
    if (!stageRect?.width || !stageRect?.height) {
      return;
    }
    const group = curveDragState.group;
    const nodeAnchor = {
      x: Number(group.dataset.nodeAnchorX || 0),
      y: Number(group.dataset.nodeAnchorY || 0),
      side: String(group.dataset.nodeAnchorSide || "right"),
    };
    const boardAnchor = {
      x: Number(group.dataset.boardAnchorX || 0),
      y: Number(group.dataset.boardAnchorY || 0),
      side: String(group.dataset.boardAnchorSide || "left"),
    };
    const nodeRect = {
      left: Number(group.dataset.nodeRectLeft || 0),
      top: Number(group.dataset.nodeRectTop || 0),
      width: Number(group.dataset.nodeRectWidth || 0),
      height: Number(group.dataset.nodeRectHeight || 0),
    };
    const boardRect = {
      left: Number(group.dataset.boardRectLeft || 0),
      top: Number(group.dataset.boardRectTop || 0),
      width: Number(group.dataset.boardRectWidth || 0),
      height: Number(group.dataset.boardRectHeight || 0),
    };
    const geometry = connectionGeometry(nodeAnchor, boardAnchor, nodeRect, boardRect);
    const handlePoint = {
      x: clampValue(event.clientX - stageRect.left, 0, stageRect.width),
      y: clampValue(event.clientY - stageRect.top, 0, stageRect.height),
    };
    updateCurveGroupPath(group, controlPointFromHandlePoint(geometry.startDetour, geometry.endDetour, handlePoint));
    event.preventDefault();
  }

  function finishCurvePointerDrag(event) {
    if (curveDragState.pointerId !== event.pointerId || !curveDragState.key || !curveDragState.group) {
      return;
    }
    const stageRect = elements.peripheralDiagramStage?.getBoundingClientRect();
    if (stageRect?.width && stageRect?.height) {
      writeStoredWireCurve(state, curveDragState.key, {
        x: Number(curveDragState.group.dataset.controlX || 0),
        y: Number(curveDragState.group.dataset.controlY || 0),
      }, stageRect);
      savePeripheralDiagramPositions?.();
    }
    curveDragState.group.classList.remove("is-dragging");
    curveDragState.key = "";
    curveDragState.pointerId = null;
    curveDragState.group = null;
    window.removeEventListener("pointermove", handleCurvePointerMove);
    window.removeEventListener("pointerup", finishCurvePointerDrag);
    window.removeEventListener("pointercancel", finishCurvePointerDrag);
    event.preventDefault();
  }

  function resetManualWireCurves(nodes = lastRenderedNodes.length ? lastRenderedNodes : Object.values(state.peripheralDiagramNodeMap || {})) {
    const cleared = clearWireCurveStore(state);
    if (cleared) {
      savePeripheralDiagramPositions?.();
    }
    render(nodes);
    return { cleared };
  }

  function ensureOverlay() {
    const stage = elements.peripheralDiagramStage;
    if (!stage) {
      return null;
    }

    let overlay = stage.querySelector(".peripheral-diagram-wiring-overlay");
    if (!overlay) {
      overlay = createSvgElement("svg");
      overlay.classList.add("peripheral-diagram-wiring-overlay");
      overlay.setAttribute("aria-hidden", "true");
      const boardImage = elements.peripheralDiagramBoardImage;
      if (boardImage?.parentElement === stage) {
        stage.insertBefore(overlay, boardImage.nextSibling);
      } else {
        stage.appendChild(overlay);
      }
    }
    return overlay;
  }

  function boardAnchors(stageRect, boardRect) {
    const boardProfile = activeGpioBoardProfile();
    const primary = gpioBoardLayouts[boardProfile] || { left: [], right: [] };
    const extra = gpioBoardExtraLayouts[boardProfile] || { left: [], right: [] };
    const calibration = boardAnchorCalibration(boardProfile);
    const anchorsByKey = new Map();

    const buildSideAnchors = (entries, side, lane) => {
      const validEntries = entries.filter((entry) => entry && (entry.pin !== undefined || entry.label));
      if (!validEntries.length) {
        return;
      }
      const topInset = boardRect.height * calibration.topInsetRatio;
      const bottomInset = boardRect.height * calibration.bottomInsetRatio;
      const usableHeight = Math.max(boardRect.height - topInset - bottomInset, 0);
      const step = validEntries.length > 1 ? (usableHeight / (validEntries.length - 1)) : 0;
      validEntries.forEach((entry, index) => {
        const y = boardRect.top + topInset + (step * index);
        const outerOffset = calibration.outerOffset + (lane * calibration.extraLaneGap);
        const x = side === "left"
          ? boardRect.left - outerOffset
          : boardRect.left + boardRect.width + outerOffset;
        const boardLabel = String(entry.label || (entry.pin != null ? `GPIO${entry.pin}` : "")).trim();
        if (!boardLabel) {
          return;
        }
        const key = entry.pin != null ? `gpio:${entry.pin}` : `rail:${boardLabel.toUpperCase()}`;
        if (!anchorsByKey.has(key)) {
          anchorsByKey.set(key, []);
        }
        anchorsByKey.get(key).push({ x, y, side, lane, boardLabel, pin: entry.pin, key });
      });
    };

    buildSideAnchors(primary.left || [], "left", 0);
    buildSideAnchors(primary.right || [], "right", 0);
    buildSideAnchors(extra.left || [], "left", 1);
    buildSideAnchors(extra.right || [], "right", 1);
    return anchorsByKey;
  }

  function editableBoardLabels(boardProfile) {
    const primary = gpioBoardLayouts[boardProfile] || { left: [], right: [] };
    const extra = gpioBoardExtraLayouts[boardProfile] || { left: [], right: [] };
    const labels = [];

    const pushLabels = (entries, side, lane) => {
      const validEntries = entries.filter((entry) => entry && (entry.pin !== undefined || entry.label));
      validEntries.forEach((entry, index) => {
        const label = String(entry.label || (entry.pin != null ? `GPIO${entry.pin}` : "")).trim();
        if (!label) {
          return;
        }
        labels.push({
          id: peripheralDiagramBoardLabelEntryId({ pin: entry.pin, label, side, lane, index }),
          label,
          pin: entry.pin,
          ...peripheralDiagramBoardLabelDefaultLayout({ side, lane, index, count: validEntries.length }),
          coordinateSpace: "visual",
        });
      });
    };

    pushLabels(primary.left || [], "left", 0);
    pushLabels(primary.right || [], "right", 0);
    pushLabels(extra.left || [], "left", 1);
    pushLabels(extra.right || [], "right", 1);
    return labels;
  }

  function collectConnections(nodes) {
    return nodes.flatMap((node) => {
      const groupKey = String(node?.groupKey || "");
      const profileValue = String(node?.profileValue || "none");
      const index = Number(node?.index || 0);
      if (!groupKey || profileValue === "none") {
        return [];
      }

      const connections = [];
      const usedSignals = new Set();
      const realBindings = realPeripheralBindingDefinitions(groupKey, profileValue, state.settings || {}, index);
      for (const binding of realBindings) {
        const pin = Number(binding?.element?.value ?? NaN);
        if (!Number.isFinite(pin) || pin < 0) {
          continue;
        }
        const signalLabel = normalizeSignalLabel(binding.label);
        connections.push({
          nodeId: node.id,
          signalLabel,
          pin,
          type: "gpio",
          boardLabel: selectedOptionText(binding.element, `GPIO${pin}`),
        });
        usedSignals.add(signalKey(signalLabel));
      }

      for (const signalLabel of helperSignalLabels(groupKey, profileValue)) {
        const normalizedSignal = normalizeSignalLabel(signalLabel);
        if (usedSignals.has(signalKey(normalizedSignal))) {
          continue;
        }
        const pinValue = peripheralHelperBindingValue(groupKey, index, signalLabel);
        const pin = Number(pinValue || NaN);
        if (!Number.isFinite(pin) || pin < 0) {
          continue;
        }
        connections.push({
          nodeId: node.id,
          signalLabel: normalizedSignal,
          pin,
          type: "gpio",
          boardLabel: `GPIO${pin}`,
        });
        usedSignals.add(signalKey(normalizedSignal));
      }

      for (const pinLabel of Array.isArray(node.pins) ? node.pins : []) {
        if (!isPositivePowerSignal(pinLabel) && !isGroundSignal(pinLabel)) {
          continue;
        }
        const normalizedSignal = normalizeSignalLabel(pinLabel);
        if (usedSignals.has(signalKey(normalizedSignal))) {
          continue;
        }
        const boardLabel = powerRailLabelForNode(node, pinLabel);
        if (!boardLabel) {
          continue;
        }
        connections.push({
          nodeId: node.id,
          signalLabel: normalizedSignal,
          type: "rail",
          boardLabel,
        });
        usedSignals.add(signalKey(normalizedSignal));
      }

      return connections;
    });
  }

  function chooseBoardAnchor(anchorCandidates, connection, nodeAnchor) {
    const candidates = anchorCandidates.get(boardTargetKey(connection)) || [];
    if (!candidates.length) {
      return null;
    }
    return [...candidates].sort((left, right) => {
      const leftScore = Math.abs(left.y - nodeAnchor.y) + (left.side === nodeAnchor.side ? 40 : 0) + (left.lane * 6);
      const rightScore = Math.abs(right.y - nodeAnchor.y) + (right.side === nodeAnchor.side ? 40 : 0) + (right.lane * 6);
      return leftScore - rightScore;
    })[0];
  }

  function drawSignalBadge(container, anchor, signalLabel, palette) {
    const group = createSvgElement("g");
    group.setAttribute("class", "peripheral-diagram-wire-badge");

    const label = normalizeSignalLabel(signalLabel) || "SIG";
    const width = Math.max(28, (label.length * 6.6) + 14);
    const height = 18;
    const rect = createSvgElement("rect");
    const text = createSvgElement("text");
    const sideOffset = anchor.side === "left"
      ? 8
      : (anchor.side === "right"
        ? -(width + 8)
        : -(width / 2));
    const verticalOffset = anchor.side === "top" ? 8 : -26;
    const x = anchor.x + sideOffset;
    const y = anchor.y + verticalOffset;

    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("rx", "9");
    rect.setAttribute("ry", "9");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", palette.badge);
    rect.setAttribute("fill-opacity", "0.94");

    text.setAttribute("x", String(x + (width / 2)));
    text.setAttribute("y", String(y + 12.2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", palette.text);
    text.textContent = label;

    group.append(rect, text);
    container.appendChild(group);
  }

  function drawBoardMarker(container, anchor, palette) {
    const ring = createSvgElement("circle");
    ring.setAttribute("cx", String(anchor.x));
    ring.setAttribute("cy", String(anchor.y));
    ring.setAttribute("r", "5.5");
    ring.setAttribute("class", "peripheral-diagram-wire-board-marker");
    ring.setAttribute("fill", "#ffffff");
    ring.setAttribute("stroke", palette.stroke);
    ring.setAttribute("stroke-width", "2.4");
    container.appendChild(ring);
  }

  function drawBoardBadge(container, anchor, boardLabel, palette) {
    const group = createSvgElement("g");
    group.setAttribute("class", "peripheral-diagram-wire-board-badge");

    const label = String(boardLabel || "").trim() || "GPIO";
    const width = Math.max(34, (label.length * 6.6) + 16);
    const height = 18;
    const rect = createSvgElement("rect");
    const text = createSvgElement("text");
    const sideOffset = anchor.side === "left" ? -(width + 10) : 10;
    const x = anchor.x + sideOffset;
    const y = anchor.y - 9;

    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("rx", "9");
    rect.setAttribute("ry", "9");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", "#ffffff");
    rect.setAttribute("stroke", palette.stroke);
    rect.setAttribute("stroke-width", "1.4");

    text.setAttribute("x", String(x + (width / 2)));
    text.setAttribute("y", String(y + 12.2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", palette.stroke);
    text.textContent = label;

    group.append(rect, text);
    container.appendChild(group);
  }

  function drawNodeMarker(container, anchor, palette) {
    const ring = createSvgElement("circle");
    ring.setAttribute("cx", String(anchor.x));
    ring.setAttribute("cy", String(anchor.y));
    ring.setAttribute("r", "4.2");
    ring.setAttribute("fill", palette.stroke);
    ring.setAttribute("fill-opacity", "0.98");
    container.appendChild(ring);
  }

  function render(nodes = Object.values(state.peripheralDiagramNodeMap || {})) {
    lastRenderedNodes = [...nodes];
    const overlay = ensureOverlay();
    const stage = elements.peripheralDiagramStage;
    const boardImage = elements.peripheralDiagramBoardImage;
    const labelLayer = ensureLabelLayer(stage);
    if (!overlay || !stage || !boardImage || !labelLayer) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const boardClientRect = boardImage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height || !boardClientRect.width || !boardClientRect.height) {
      overlay.innerHTML = "";
      labelLayer.innerHTML = "";
      return;
    }

    const boardRect = {
      left: boardClientRect.left - stageRect.left,
      top: boardClientRect.top - stageRect.top,
      width: boardClientRect.width,
      height: boardClientRect.height,
    };
    const anchorCandidates = boardAnchors(stageRect, boardRect);
    const nodeRects = new Map(
      nodes.map((node) => {
        const element = elements.peripheralDiagramItems?.querySelector(`[data-node-id="${node.id}"]`);
        const rect = relativeRectForElement(element, stageRect);
        return [
          node.id,
          rect,
        ];
      }),
    );

    const visualRects = new Map(
      nodes.map((node) => {
        const element = elements.peripheralDiagramItems?.querySelector(`[data-node-id="${node.id}"]`);
        return [
          node.id,
          nodeVisualRect(element, stageRect),
        ];
      }),
    );

    overlay.innerHTML = "";
    overlay.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
    overlay.setAttribute("width", String(stageRect.width));
    overlay.setAttribute("height", String(stageRect.height));

    const signalLabels = new Map();
    const boardProfile = activeGpioBoardProfile();
    const boardLabelDefaults = editableBoardLabels(boardProfile);
    const resolvedBoardLabels = resolvePeripheralDiagramNodeLabels(
      state,
      peripheralDiagramBoardNodeId(boardProfile),
      boardLabelDefaults,
    );
    const boardDefaultsById = new Map(boardLabelDefaults.map((entry) => [entry.id, entry]));
    const resolvedBoardLabelsByTarget = new Map();

    resolvedBoardLabels.forEach((entry, index) => {
      const fallback = boardDefaultsById.get(entry.id) || boardLabelDefaults[index];
      const resolvedEntry = {
        labelKey: entry.id,
        nodeId: peripheralDiagramBoardNodeId(boardProfile),
        label: entry.label,
        palette: peripheralDiagramLabelPalette(entry.label),
        nodeRect: boardRect,
        layout: {
          ...(fallback || { xFactor: 0, yFactor: 0, rotation: 0 }),
          xFactor: entry.xFactor,
          yFactor: entry.yFactor,
          rotation: entry.rotation,
        },
      };
      signalLabels.set(`board:${entry.id}`, resolvedEntry);

      if (Number.isFinite(Number(fallback?.pin))) {
        resolvedBoardLabelsByTarget.set(`gpio:${Number(fallback.pin)}`, resolvedEntry);
      } else {
        const railLabel = String(fallback?.label || entry.label || "").trim().toUpperCase();
        if (railLabel) {
          resolvedBoardLabelsByTarget.set(`rail:${railLabel}`, resolvedEntry);
        }
      }
    });

    const groupedConnections = new Map();
    for (const connection of collectConnections(nodes)) {
      if (!groupedConnections.has(connection.nodeId)) {
        groupedConnections.set(connection.nodeId, []);
      }
      groupedConnections.get(connection.nodeId).push(connection);
    }

    for (const node of nodes) {
      const nodeRect = nodeRects.get(node.id);
      const visualRect = visualRects.get(node.id) || nodeRect;
      const connections = groupedConnections.get(node.id) || [];
      if (!nodeRect) {
        continue;
      }

      const nodeSignalLabels = new Map();

      connections.forEach((connection, index) => {
        const defaultAnchor = nodeAnchorForConnection(nodeRect, boardRect, index, connections.length);
        const labelId = peripheralDiagramLabelId(connection.signalLabel);
        if (!nodeSignalLabels.has(labelId)) {
          nodeSignalLabels.set(labelId, {
            id: labelId,
            label: normalizeSignalLabel(connection.signalLabel),
            palette: classifyWireColor(connection),
            defaultLayout: signalLabelDefaultLayout(visualRect, defaultAnchor, connection.signalLabel),
          });
        }
      });

      const resolvedLabels = resolvePeripheralDiagramNodeLabels(state, node.id, [...nodeSignalLabels.values()].map((entry, index) => ({
        id: entry.id,
        label: entry.label,
        xFactor: entry.defaultLayout.xFactor,
        yFactor: entry.defaultLayout.yFactor,
        rotation: entry.defaultLayout.rotation,
        order: index,
      })));

      const resolvedLabelsById = new Map();
      resolvedLabels.forEach((entry, index) => {
        const source = nodeSignalLabels.get(entry.id);
        const baseLayout = {
          ...(source?.defaultLayout || floatingLabelDefaultLayout(nodeRect, index, resolvedLabels.length)),
          xFactor: entry.xFactor,
          yFactor: entry.yFactor,
          rotation: entry.rotation,
        };
        const layout = entry.coordinateSpace === "visual"
          ? baseLayout
          : convertLayoutToVisualSpace(baseLayout, nodeRect, visualRect);
        const resolvedEntry = {
          labelKey: entry.id,
          nodeId: node.id,
          label: entry.label,
          palette: peripheralDiagramLabelPalette(entry.label, source?.palette),
          nodeRect: visualRect,
          layout,
        };
        resolvedLabelsById.set(entry.id, resolvedEntry);
        signalLabels.set(`${node.id}:${entry.id}`, resolvedEntry);
      });

      connections.forEach((connection, index) => {
        const defaultAnchor = nodeAnchorForConnection(nodeRect, boardRect, index, connections.length);
        const boardLabelEntry = resolvedBoardLabelsByTarget.get(boardTargetKey(connection)) || null;
        const boardAnchor = boardLabelEntry
          ? labelAnchorAwayFromOwner(boardLabelEntry, boardRect, stageRect.width, stageRect.height)
          : chooseBoardAnchor(anchorCandidates, connection, defaultAnchor);
        if (!boardAnchor) {
          return;
        }
        const resolvedLabel = resolvedLabelsById.get(peripheralDiagramLabelId(connection.signalLabel));
        const nodeAnchor = resolvedLabel
          ? labelAnchorAwayFromOwner(resolvedLabel, visualRect, stageRect.width, stageRect.height)
          : defaultAnchor;
        const palette = classifyWireColor(connection);
        const connectionKey = connectionStorageKey(connection);
        const savedCurvePoint = readStoredWireCurve(state, connectionKey, stageRect);
        const geometry = connectionGeometry(nodeAnchor, boardAnchor, visualRect, boardRect, savedCurvePoint);

        const glow = createSvgElement("path");
        glow.setAttribute("class", "peripheral-diagram-wire peripheral-diagram-wire-glow");
        glow.setAttribute("d", geometry.path);
        glow.setAttribute("stroke", palette.glow);

        const path = createSvgElement("path");
        path.setAttribute("class", "peripheral-diagram-wire");
        path.setAttribute("d", geometry.path);
        path.setAttribute("stroke", palette.stroke);

        const connectionGroup = createSvgElement("g");
        connectionGroup.setAttribute("class", "peripheral-diagram-wire-connection");
        connectionGroup.dataset.signal = signalKey(connection.signalLabel);
        connectionGroup.dataset.board = String(boardAnchor.boardLabel || "");
        connectionGroup.dataset.connectionKey = connectionKey;
        connectionGroup.dataset.nodeAnchorX = String(nodeAnchor.x);
        connectionGroup.dataset.nodeAnchorY = String(nodeAnchor.y);
        connectionGroup.dataset.nodeAnchorSide = String(nodeAnchor.side || "right");
        connectionGroup.dataset.boardAnchorX = String(boardAnchor.x);
        connectionGroup.dataset.boardAnchorY = String(boardAnchor.y);
        connectionGroup.dataset.boardAnchorSide = String(boardAnchor.side || "left");
        connectionGroup.dataset.nodeRectLeft = String(visualRect.left);
        connectionGroup.dataset.nodeRectTop = String(visualRect.top);
        connectionGroup.dataset.nodeRectWidth = String(visualRect.width);
        connectionGroup.dataset.nodeRectHeight = String(visualRect.height);
        connectionGroup.dataset.boardRectLeft = String(boardRect.left);
        connectionGroup.dataset.boardRectTop = String(boardRect.top);
        connectionGroup.dataset.boardRectWidth = String(boardRect.width);
        connectionGroup.dataset.boardRectHeight = String(boardRect.height);
        connectionGroup.dataset.controlX = String(geometry.controlPoint.x);
        connectionGroup.dataset.controlY = String(geometry.controlPoint.y);

        const hit = createSvgElement("path");
        hit.setAttribute("class", "peripheral-diagram-wire-hit");
        hit.setAttribute("d", geometry.path);
        hit.addEventListener("pointerdown", (event) => beginCurvePointerDrag(event, overlay, connectionGroup, connectionKey, true));

        const title = createSvgElement("title");
        title.textContent = `${normalizeSignalLabel(connection.signalLabel)} -> ${boardAnchor.boardLabel}`;

        const handle = createSvgElement("circle");
        handle.setAttribute("class", "peripheral-diagram-wire-handle");
        handle.setAttribute("cx", String(geometry.handlePoint.x));
        handle.setAttribute("cy", String(geometry.handlePoint.y));
        handle.setAttribute("r", "6");
        handle.addEventListener("pointerdown", (event) => beginCurvePointerDrag(event, overlay, connectionGroup, connectionKey, false));

        connectionGroup.addEventListener("pointerenter", () => setActiveConnection(overlay, connectionGroup));
        connectionGroup.addEventListener("pointerleave", () => {
          if (curveDragState.key !== connectionKey) {
            setActiveConnection(overlay, null);
          }
        });

        connectionGroup.appendChild(title);
        connectionGroup.appendChild(glow);
        connectionGroup.appendChild(path);
        connectionGroup.appendChild(hit);
        connectionGroup.appendChild(handle);
        if (!boardLabelEntry) {
          drawBoardMarker(connectionGroup, boardAnchor, palette);
          drawBoardBadge(connectionGroup, boardAnchor, boardAnchor.boardLabel, palette);
        }
        drawNodeMarker(connectionGroup, nodeAnchor, palette);
        if (boardLabelEntry) {
          drawNodeMarker(connectionGroup, boardAnchor, palette);
        }
        overlay.appendChild(connectionGroup);
      });
    }

    renderSignalLabels(labelLayer, [...signalLabels.values()]);
  }

  return {
    render,
    rewireFromLabels,
    resetManualWireCurves,
  };
}
