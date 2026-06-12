#include "motor_runtime_config.h"

namespace MotorRuntimeConfig {

namespace {
constexpr uint32_t kDefaultDurationMs = 5000U;

void canonicalizeDirection(JsonObject channel, const char* directionKeyName) {
    JsonObject direction = channel[directionKeyName].as<JsonObject>();
    if (direction.isNull()) {
        direction = channel[directionKeyName].to<JsonObject>();
    }
    const uint32_t fallbackDuration = direction["durationMs"].isNull()
        ? static_cast<uint32_t>(channel["durationMs"] | kDefaultDurationMs)
        : static_cast<uint32_t>(direction["durationMs"] | kDefaultDurationMs);
    direction["durationMs"] = fallbackDuration < 100U ? kDefaultDurationMs : fallbackDuration;

    if (direction["limitInputIndex"].isNull() && !channel["limitInputIndex"].isNull()) {
        direction["limitInputIndex"] = channel["limitInputIndex"];
    }

    const String role = normalizeMovementRole(String(static_cast<const char*>(direction["movementRole"] | "none")));
    const bool explicitRole = direction["movementRoleExplicit"].is<bool>()
        ? direction["movementRoleExplicit"].as<bool>()
        : (role == "opening" || role == "closing");
    direction["movementRole"] = explicitRole ? role : String("none");
    direction["movementRoleExplicit"] = explicitRole;
}

void canonicalizeChannel(JsonObject root, const char* channelKeyName) {
    JsonObject channel = root[channelKeyName].as<JsonObject>();
    if (channel.isNull()) {
        channel = root[channelKeyName].to<JsonObject>();
    }
    channel["learnedState"] = normalizeLearnedState(String(static_cast<const char*>(channel["learnedState"] | "unknown")));
    canonicalizeDirection(channel, "forward");
    canonicalizeDirection(channel, "backward");
}

void canonicalizeTouchButtons(JsonObject root) {
    JsonObject touchButtons = root["touchButtons"].as<JsonObject>();
    if (touchButtons.isNull()) {
        touchButtons = root["touchButtons"].to<JsonObject>();
    }
    JsonObject button1 = touchButtons["button1"].as<JsonObject>();
    if (button1.isNull()) {
        button1 = touchButtons["button1"].to<JsonObject>();
    }
    JsonObject button2 = touchButtons["button2"].as<JsonObject>();
    if (button2.isNull()) {
        button2 = touchButtons["button2"].to<JsonObject>();
    }
    button1["action"] = normalizeTouchAction(String(static_cast<const char*>(button1["action"] | "none")));
    button2["action"] = normalizeTouchAction(String(static_cast<const char*>(button2["action"] | "none")));
}
}  // namespace

const char* channelKey(uint8_t channelIndex) {
    return channelIndex == 0 ? "a" : "b";
}

const char* directionKey(bool forward) {
    return forward ? "forward" : "backward";
}

String normalizeLearnedState(String value) {
    value.trim();
    value.toLowerCase();
    return value == "open" || value == "closed" ? value : String("unknown");
}

String normalizeTouchAction(String value) {
    value.trim();
    value.toLowerCase();
    value.replace('-', '_');
    value.replace(' ', '_');
    value.replace('/', '_');
    while (value.indexOf("__") >= 0) {
        value.replace("__", "_");
    }
    if (value == "toggle_open" || value == "toggle_close" || value == "toggle_open_close" || value == "none") {
        return value;
    }
    return "none";
}

String normalizeMovementRole(String value) {
    value.trim();
    value.toLowerCase();
    if (value == "opening" || value == "closing" || value == "none") {
        return value;
    }
    return "none";
}

size_t jsonCapacity(const String& rawConfig) {
    const size_t configLength = rawConfig.isEmpty() ? 2U : rawConfig.length();
    // Motor config is frequently reparsed from Arduino String storage, which
    // forces ArduinoJson to duplicate keys and string values instead of using
    // zero-copy parsing from a mutable request buffer.
    const size_t scaledCapacity = configLength * 4U + 1024U;
    return scaledCapacity < 4096U ? 4096U : scaledCapacity;
}

bool deserializeDocument(const String& rawConfig, DynamicJsonDocument& document) {
    const DeserializationError error = deserializeJson(document, rawConfig.isEmpty() ? String("{}") : rawConfig);
    if (error || document.overflowed() || !document.is<JsonObject>()) {
        return false;
    }
    canonicalizeDocument(document.as<JsonObject>());
    return true;
}

void canonicalizeDocument(JsonObject root) {
    canonicalizeChannel(root, "a");
    canonicalizeChannel(root, "b");
    canonicalizeTouchButtons(root);
}

String normalizeJson(String value) {
    value.trim();
    if (value.isEmpty()) {
        return "{}";
    }

#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
    DynamicJsonDocument document(jsonCapacity(value));
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
    if (!deserializeDocument(value, document)) {
        return "{}";
    }

    String normalized;
    serializeJson(document.as<JsonObjectConst>(), normalized);
    return normalized;
}

String movementRole(JsonObjectConst channelConfig, bool forward) {
    if (channelConfig.isNull()) {
        return "none";
    }

    JsonObjectConst direction = channelConfig[directionKey(forward)].as<JsonObjectConst>();
    return normalizeMovementRole(String(static_cast<const char*>(direction["movementRole"] | "none")));
}

}  // namespace MotorRuntimeConfig