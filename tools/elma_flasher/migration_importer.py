"""Import GPIO/peripheral metadata from firmware being replaced by ELMA.

The importer deliberately produces a preview instead of mutating designer state.
Only assignments that can be tied to a physical GPIO are translated.  Unknown
or virtual components remain in ``unresolved`` for the operator to review.
"""

from __future__ import annotations

import json
import re
import urllib.parse
from typing import Any

import yaml


SUPPORTED_CHIPS = {"esp32", "esp32s3", "esp32c3"}

ESP32_TEMPLATE_GPIO_ORDER = [
    0, 1, 2, 3, 4, 5, 9, 10, 12, 13, 14, 15, 16, 17,
    18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 6, 7, 8, 11,
    32, 33, 34, 35, 36, 37, 38, 39,
]


def _clone(value: Any) -> Any:
    return json.loads(json.dumps(value))


def _chip_from_text(value: Any) -> str:
    text = str(value or "").lower().replace("-", "").replace("_", "")
    if "esp32s3" in text:
        return "esp32s3"
    if "esp32c3" in text:
        return "esp32c3"
    if "esp32" in text and not any(part in text for part in ("esp32s2", "esp32c6", "esp32h2")):
        return "esp32"
    return ""


def board_profile(chip: str, board: str = "", hardware: str = "") -> tuple[str, str, str]:
    """Return ELMA board profile, confidence and human-readable reason."""
    text = f"{board} {hardware}".lower().replace("_", "-")
    if chip == "esp32c3":
        return "esp32-c3", "high", "ESP32-C3 uses the ELMA C3 board profile."
    if chip == "esp32s3":
        if "zero" in text:
            return "esp32-s3-zero", "high", "The source identifies an ESP32-S3 Zero board."
        if "devkit" in text:
            return "esp32-s3-devkit-c1", "high", "The source identifies an ESP32-S3 DevKit board."
        if "n16r8" in text or "16mb" in text:
            return "esp32-s3-psram", "medium", "The source reports an ESP32-S3 large-flash/PSRAM build."
        return "esp32-s3-super-mini", "medium", "The chip is known, but the exact S3 carrier board is not exposed."
    if chip == "esp32":
        if "wrover" in text or "psram" in text:
            return "esp32-wrover", "high", "The source identifies an ESP32-WROVER/PSRAM module."
        if "lolin" in text or "d1-mini32" in text or "wemos" in text:
            return "wemos-lolin32-mini", "high", "The source identifies a Wemos/Lolin ESP32 board."
        if "pico" in text or "mini" in text:
            return "esp32-mini", "medium", "The source identifies a compact classic ESP32 board."
        return "esp32-wroom", "medium", "The chip is classic ESP32; the exact carrier is not exposed."
    return "", "none", "The source MCU is not supported by this ELMA release."


def _command(client: Any, command: str) -> dict:
    return client.json(f"/cm?cmnd={urllib.parse.quote(command, safe='')}")


def _gpio_assignments_from_response(response: Any) -> list[dict]:
    assignments: list[dict] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                match = re.fullmatch(r"GPIO\s*(\d+)", str(key), re.I)
                if match:
                    pin = int(match.group(1))
                    if isinstance(child, dict):
                        for code, label in child.items():
                            label_text = str(label or "").strip()
                            if label_text and label_text.lower() not in {"none", "user"}:
                                assignments.append({"pin": pin, "code": str(code), "function": label_text})
                    elif str(child or "").strip().lower() not in {"", "none", "user"}:
                        assignments.append({"pin": pin, "code": "", "function": str(child).strip()})
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(response)
    unique: dict[tuple[int, str], dict] = {}
    for item in assignments:
        unique[(item["pin"], item["function"].lower())] = item
    return sorted(unique.values(), key=lambda item: (item["pin"], item["function"]))


def _template_assignments(template_response: dict) -> list[dict]:
    template = template_response.get("NAME") is not None and template_response or template_response.get("Template", {})
    if not isinstance(template, dict):
        return []
    gpio_values = template.get("GPIO")
    if not isinstance(gpio_values, list):
        return []
    result = []
    for pin, code in zip(ESP32_TEMPLATE_GPIO_ORDER, gpio_values):
        try:
            numeric = int(code)
        except (TypeError, ValueError):
            continue
        if numeric not in (0, 1):
            result.append({"pin": pin, "code": str(numeric), "function": f"Tasmota component {numeric}"})
    return result


def _append_profile(profiles: dict, group: str, profile: str, bindings: dict[str, Any]) -> int:
    items = profiles.setdefault(group, [])
    index = len(items)
    items.append(profile)
    return index


def _translate_components(components: list[dict], board: str) -> tuple[dict, dict, list[dict], list[str]]:
    settings: dict = {"ui": {"gpioBoardAutodetect": False, "gpioBoardSelection": board}}
    profile_groups: dict[str, list[str]] = {
        "sensors": [], "inputs": [], "controls": [], "expansions": [],
        "storage": [], "communication": [], "power": [],
    }
    bindings: dict[str, dict[str, str]] = {}
    mapped: list[dict] = []
    unresolved: list[str] = []
    bus_slots: dict[str, int] = {}

    def add(group: str, profile: str, pin: int, signal: str, source: dict, confidence: str = "high") -> None:
        index = _append_profile(profile_groups, group, profile, {})
        bindings[f"{group[:-1] if group.endswith('s') else group}:{index}"] = {signal: str(pin)}
        mapped.append({
            "pin": pin, "source": source.get("function", ""), "target": f"{profile} {signal}",
            "confidence": confidence,
        })

    def add_bus(group: str, profile: str, signal: str, pin: int, source: dict) -> None:
        slot_key = f"{group}:{profile}"
        if slot_key not in bus_slots:
            bus_slots[slot_key] = _append_profile(profile_groups, group, profile, {})
        index = bus_slots[slot_key]
        binding_key = f"{group[:-1] if group.endswith('s') else group}:{index}"
        bindings.setdefault(binding_key, {})[signal] = str(pin)
        mapped.append({"pin": pin, "source": source.get("function", ""), "target": f"{profile} {signal}", "confidence": "high"})

    for component in sorted(components, key=lambda item: (int(item.get("pin", -1)), str(item.get("function", "")))):
        pin = int(component.get("pin", -1))
        label = str(component.get("function", "")).strip()
        normalized = re.sub(r"[^a-z0-9]+", "", label.lower())
        if pin < 0 or not normalized:
            continue
        if normalized.startswith("button"):
            add("inputs", "physical-button", pin, "SIG", component)
        elif normalized.startswith("switch"):
            add("inputs", "toggle-switch", pin, "SIG", component)
        elif normalized.startswith("relay"):
            add("controls", "relay-module", pin, "IN", component)
        elif normalized.startswith("pwm"):
            add("controls", "led-pwm-dimmer", pin, "PWM", component)
        elif "neopixel" in normalized or "ws2812" in normalized or normalized.startswith("ledlink"):
            settings.setdefault("device", {})["statusLedPin"] = pin
            settings["device"]["statusLedType"] = "neopixel" if ("neo" in normalized or "ws2812" in normalized) else "digital"
            mapped.append({"pin": pin, "source": label, "target": "Status LED", "confidence": "medium"})
        elif normalized.startswith("led"):
            add("controls", "led-pwm-dimmer", pin, "PWM", component, "medium")
        elif "i2csda" in normalized:
            add_bus("communication", "i2c", "SDA", pin, component)
        elif "i2cscl" in normalized:
            add_bus("communication", "i2c", "SCL", pin, component)
        elif "spiclk" in normalized or "spisck" in normalized:
            add_bus("communication", "spi", "SCK", pin, component)
        elif "spimosi" in normalized:
            add_bus("communication", "spi", "MOSI", pin, component)
        elif "spimiso" in normalized:
            add_bus("communication", "spi", "MISO", pin, component)
        elif "spics" in normalized:
            add_bus("communication", "spi", "CS", pin, component)
        elif "ds18" in normalized or "onewire" in normalized:
            add("sensors", "ds18b20", pin, "DQ", component)
        elif normalized.startswith("irrecv"):
            add("inputs", "ir-receiver", pin, "OUT", component)
        elif normalized.startswith("counter"):
            add("inputs", "flow-meter-pulse-sensor", pin, "OUT", component, "medium")
        elif normalized.startswith("uarttx") or normalized == "txd":
            add_bus("communication", "uart", "TX", pin, component)
        elif normalized.startswith("uartrx") or normalized == "rxd":
            add_bus("communication", "uart", "RX", pin, component)
        elif "dht" in normalized or "am230" in normalized or "sensor" in normalized or "adc" in normalized:
            add("sensors", "custom", pin, "SIG", component, "medium")
        elif not normalized.startswith("tasmotacomponent"):
            add("controls", "custom", pin, "SIG", component, "low")
        else:
            unresolved.append(f"GPIO{pin}: {label} needs manual component selection.")

    # Keep the UI schema complete without inventing peripherals.
    for key, items in profile_groups.items():
        if not items:
            items.append("none")
    peripheral_profiles = {
        "audioProfile": "none", "audioProfiles": ["none"],
        "audioInProfile": "none", "audioInProfiles": ["none"],
        "displayProfile": "none", "displayProfiles": ["none"],
        **profile_groups,
    }
    settings["ui"]["peripheralProfiles"] = peripheral_profiles
    settings["ui"]["peripheralHelperBindings"] = bindings
    return settings, peripheral_profiles, mapped, unresolved


class EspHomeLoader(yaml.SafeLoader):
    pass


def _unknown_yaml(loader: EspHomeLoader, node: yaml.Node) -> Any:
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


EspHomeLoader.add_constructor(None, _unknown_yaml)


def _pin_number(value: Any) -> int | None:
    if isinstance(value, dict):
        value = value.get("number", value.get("pin"))
    if isinstance(value, int):
        return value
    match = re.fullmatch(r"(?:GPIO)?\s*(\d+)", str(value or "").strip(), re.I)
    return int(match.group(1)) if match else None


def _as_items(value: Any) -> list[dict]:
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _esphome_yaml_components(document: dict) -> tuple[list[dict], str, list[str]]:
    components: list[dict] = []
    unresolved: list[str] = []
    esp32 = document.get("esp32", {}) if isinstance(document.get("esp32"), dict) else {}
    board = str(esp32.get("board", ""))

    def append(pin_value: Any, function: str, name: str = "") -> None:
        pin = _pin_number(pin_value)
        if pin is None:
            unresolved.append(f"{name or function}: GPIO is templated, included, or not present in this YAML.")
            return
        components.append({"pin": pin, "code": "", "function": function, "name": name})

    for section, function in (("binary_sensor", "Button"), ("switch", "Relay"), ("output", "PWM")):
        for item in _as_items(document.get(section)):
            platform = str(item.get("platform", "")).lower()
            if platform in {"gpio", "ledc", "esp8266_pwm"}:
                append(item.get("pin"), function, str(item.get("name") or item.get("id") or section))

    for item in _as_items(document.get("status_led")):
        append(item.get("pin"), "LedLink", "Status LED")
    for item in _as_items(document.get("i2c")):
        append(item.get("sda"), "I2C SDA", "I2C SDA")
        append(item.get("scl"), "I2C SCL", "I2C SCL")
    for item in _as_items(document.get("spi")):
        append(item.get("clk_pin"), "SPI CLK", "SPI CLK")
        append(item.get("mosi_pin"), "SPI MOSI", "SPI MOSI")
        append(item.get("miso_pin"), "SPI MISO", "SPI MISO")
    for item in _as_items(document.get("uart")):
        append(item.get("tx_pin"), "UART TX", "UART TX")
        append(item.get("rx_pin"), "UART RX", "UART RX")
    for section in ("one_wire", "dallas"):
        for item in _as_items(document.get(section)):
            append(item.get("pin"), "DS18B20", str(item.get("id") or "OneWire"))

    for item in _as_items(document.get("sensor")):
        platform = str(item.get("platform", "")).lower()
        if "dht" in platform:
            append(item.get("pin"), "DHT Sensor", str(item.get("name") or platform))
        elif platform == "adc":
            append(item.get("pin"), "ADC Sensor", str(item.get("name") or platform))
    return components, board, unresolved


def import_tasmota(client: Any, detected: dict) -> dict:
    raw: dict[str, Any] = {}
    for key, command in (
        ("status", "Status 0"), ("template", "Template"), ("gpio", "GPIO All"),
        ("switchMode", "SwitchMode"), ("interlock", "Interlock"), ("pulseTime", "PulseTime"),
    ):
        try:
            raw[key] = _command(client, command)
        except (RuntimeError, OSError) as error:
            raw[key] = {"error": str(error)}

    status = raw.get("status", {})
    firmware = status.get("StatusFWR", {}) if isinstance(status, dict) else {}
    hardware = str(firmware.get("Hardware") or firmware.get("ESP") or detected.get("hardware") or "")
    chip = str(detected.get("chip") or _chip_from_text(hardware))
    board, board_confidence, board_reason = board_profile(chip, hardware=hardware)
    if chip not in SUPPORTED_CHIPS:
        raise RuntimeError(f"Tasmota device hardware '{hardware or 'unknown'}' is not an ELMA-supported ESP32, ESP32-S3 or ESP32-C3 target.")

    assignments = _gpio_assignments_from_response(raw.get("gpio"))
    if not assignments:
        assignments = _template_assignments(raw.get("template", {}))
    settings, profiles, mapped, unresolved = _translate_components(assignments, board)
    status_base = status.get("Status", {}) if isinstance(status.get("Status"), dict) else {}
    status_network = status.get("StatusNET", {}) if isinstance(status.get("StatusNET"), dict) else {}
    status_mqtt = status.get("StatusMQT", {}) if isinstance(status.get("StatusMQT"), dict) else {}
    friendly = status_base.get("FriendlyName", [])
    if isinstance(friendly, list):
        friendly = next((str(item) for item in friendly if str(item).strip()), "")
    friendly = str(friendly or status_base.get("DeviceName") or detected.get("name") or "Imported Tasmota Device")
    settings.setdefault("device", {})["friendlyName"] = friendly
    ssid = str(status_network.get("SSId") or "")
    if ssid:
        settings.setdefault("wifi", {})["ssid"] = ssid
    mqtt_host = str(status_mqtt.get("MqttHost") or "")
    if mqtt_host and mqtt_host != "0.0.0.0":
        settings.setdefault("mqtt", {}).update({
            "host": mqtt_host,
            "port": int(status_mqtt.get("MqttPort") or 1883),
            "username": str(status_mqtt.get("MqttUser") or ""),
            "baseTopic": str(status_mqtt.get("Topic") or ""),
        })
    warnings = [
        "Wi-Fi, MQTT and web passwords are not exported by Tasmota and were not changed.",
        "Review inverted relay/button assignments and behavioral rules before flashing.",
    ]
    if board_confidence != "high":
        warnings.append(board_reason)
    return {
        "kind": "tasmota", "chip": chip, "boardProfile": board,
        "boardConfidence": board_confidence, "boardReason": board_reason,
        "name": friendly, "settingsPatch": settings,
        "uiState": {
            "gpioBoard": {"autodetect": False, "selectedBoard": board},
            "peripherals": {**profiles, "helperBindings": settings["ui"]["peripheralHelperBindings"]},
        },
        "mappings": mapped, "unresolved": unresolved, "warnings": warnings,
        "rawSnapshot": raw,
    }


def import_esphome(detected: dict, yaml_text: str = "") -> dict:
    chip = str(detected.get("chip") or "")
    discovered_board = str(detected.get("board") or "")
    components: list[dict] = []
    yaml_board = ""
    unresolved: list[str] = []
    raw: dict[str, Any] = {"discovery": _clone(detected)}
    if yaml_text.strip():
        try:
            parsed = yaml.load(yaml_text, Loader=EspHomeLoader)
        except yaml.YAMLError as error:
            raise ValueError(f"ESPHome YAML could not be parsed: {error}") from error
        if not isinstance(parsed, dict):
            raise ValueError("ESPHome YAML must contain a top-level mapping.")
        raw["yaml"] = parsed
        components, yaml_board, yaml_unresolved = _esphome_yaml_components(parsed)
        unresolved.extend(yaml_unresolved)
        esp32 = parsed.get("esp32", {}) if isinstance(parsed.get("esp32"), dict) else {}
        chip = chip or _chip_from_text(f"{yaml_board} {esp32.get('variant', '')}")
    if chip not in SUPPORTED_CHIPS:
        raise RuntimeError("The ESPHome source does not expose a supported ESP32, ESP32-S3 or ESP32-C3 chip. Supply its YAML so ELMA can verify the target.")
    board, board_confidence, board_reason = board_profile(chip, yaml_board or discovered_board)
    settings, profiles, mapped, translation_unresolved = _translate_components(components, board)
    unresolved.extend(translation_unresolved)
    friendly = str(detected.get("name") or "Imported ESPHome Device")
    settings.setdefault("device", {})["friendlyName"] = friendly
    warnings = []
    if not yaml_text.strip():
        warnings.append("ESPHome's device API exposes entities but not their physical GPIOs. Select the original YAML to import wiring.")
    else:
        warnings.append("Review substitutions, !include values, inverted pins and virtual/template entities before flashing.")
    if board_confidence != "high":
        warnings.append(board_reason)
    return {
        "kind": "esphome", "chip": chip, "boardProfile": board,
        "boardConfidence": board_confidence, "boardReason": board_reason,
        "name": friendly, "settingsPatch": settings,
        "uiState": {
            "gpioBoard": {"autodetect": False, "selectedBoard": board},
            "peripherals": {**profiles, "helperBindings": settings["ui"]["peripheralHelperBindings"]},
        },
        "mappings": mapped, "unresolved": unresolved, "warnings": warnings,
        "rawSnapshot": raw,
    }


def import_device(client: Any, detected: dict, yaml_text: str = "") -> dict:
    kind = str(detected.get("kind") or "").lower()
    if kind == "tasmota":
        return import_tasmota(client, detected)
    if kind == "esphome":
        return import_esphome(detected, yaml_text)
    raise RuntimeError("Configuration migration currently supports Tasmota and ESPHome sources.")
