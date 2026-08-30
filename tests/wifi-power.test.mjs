import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../web/modules/wifi-power-controls.js", import.meta.url), "utf8");
const { normalizeWifiPower, wifiPowerStatusText, createWifiPowerControls } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

function fixture(designer = false) {
  const field = (value) => ({ value, events: {}, style: { setProperty() {} }, setAttribute() {}, addEventListener(name, fn) { this.events[name] = fn; } });
  const sta = field("19.5"), ap = field("8"), button = field("");
  const nodes = { wifiApplyPowerButton: button, wifiPowerStatus: {}, wifiSTAPowerValue: {}, wifiAPPowerValue: {} };
  globalThis.document = {
    body: { classList: { contains: () => designer } },
    querySelector: (query) => query.includes("staTx") ? sta : ap,
    querySelectorAll: () => [sta, ap],
    getElementById: (id) => nodes[id],
  };
  const network = { txPowerAvailable: true, txPowerDbm: 18, txPowerMode: "AP+STA", staTxPowerDbm: 19.5, apTxPowerDbm: 8 };
  const state = { settings: { wifi: { ssid: "preserved", password: "not-posted", staTxPowerDbm: 15, apTxPowerDbm: 15 } }, status: { network } };
  const calls = [], messages = [];
  let fullSaves = 0;
  const controls = createWifiPowerControls({ state, request: async (url, options) => { calls.push({ url, options }); return { network }; }, saveSettings: async () => { fullSaves++; }, waitForSettingsIdle: async () => {}, setMessage: (s) => messages.push(s), handleError: (e) => { throw e; } });
  return { state, calls, messages, controls, sta, ap, nodes, network, fullSaves: () => fullSaves };
}

test("normalizes legacy defaults, nonfinite inputs and limits", () => {
  for (const value of [undefined, null, "", "bad", NaN, Infinity]) assert.equal(normalizeWifiPower(value), 15);
  assert.equal(normalizeWifiPower(-10), 2);
  assert.equal(normalizeWifiPower(30), 19.5);
  assert.equal(normalizeWifiPower(10.26), 10.5);
});
test("reports actual driver limit, not a fabricated requested/RSSI value", () => {
  assert.match(wifiPowerStatusText({ txPowerAvailable: true, txPowerDbm: 18, txPowerMode: "STA" }), /limit: 18 dBm/);
  assert.match(wifiPowerStatusText({}, true), /do not change this PC/);
  assert.match(wifiPowerStatusText({}), /unavailable/);
});
test("dragging bars updates labels without network requests or form reload", () => {
  const f = fixture(); f.controls.bindEvents(); f.sta.events.input();
  assert.equal(f.calls.length, 0); assert.equal(f.fullSaves(), 0);
  assert.equal(f.state.settingsEditRevision, 1);
  assert.equal(f.nodes.wifiSTAPowerValue.textContent, "19.5 dBm");
});
test("live Apply only posts two power fields and preserves credentials", async () => {
  const f = fixture(); await f.controls.apply();
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { wifi: { staTxPowerDbm: 19.5, apTxPowerDbm: 8 } });
  assert.equal(f.calls[1].url, "/api/status");
  assert.equal(f.state.settings.wifi.ssid, "preserved");
  assert.equal(f.state.settings.wifi.password, "not-posted");
  assert.match(f.messages[0], /limit: 18 dBm/);
});
test("desktop Apply uses the existing full-document saver", async () => {
  const f = fixture(true); await f.controls.apply();
  assert.equal(f.fullSaves(), 1); assert.equal(f.calls.length, 0);
});
test("radio rejection is surfaced and Apply is re-enabled", async () => {
  const f = fixture(); f.network.txPowerApplyError = 123;
  await assert.rejects(f.controls.apply(), /radio rejected/);
  assert.equal(f.nodes.wifiApplyPowerButton.disabled, false);
});
test("older live firmware disables Apply rather than pretending it works", () => {
  const f = fixture(); f.state.status = { network: {} }; f.controls.renderStatus();
  assert.equal(f.nodes.wifiApplyPowerButton.disabled, true);
});
