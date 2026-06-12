#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

namespace MotorRuntimeConfig {

const char* channelKey(uint8_t channelIndex);
const char* directionKey(bool forward);
String normalizeLearnedState(String value);
String normalizeTouchAction(String value);
String normalizeMovementRole(String value);
size_t jsonCapacity(const String& rawConfig);
bool deserializeDocument(const String& rawConfig, DynamicJsonDocument& document);
void canonicalizeDocument(JsonObject root);
String normalizeJson(String value);
String movementRole(JsonObjectConst channelConfig, bool forward);

}  // namespace MotorRuntimeConfig