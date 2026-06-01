#pragma once

#include <Arduino.h>
#include <vector>

#include "settings_schema.h"

struct PlaybackCommand {
    String action;
    String url;
    String label;
    String source;
    String mediaType;
    String version;
    String assetName;
    String payload;
    bool skipNotificationCue = false;
    uint8_t volumePercent = 0;
};

namespace HaBridge {

String availabilityTopic(const SettingsBundle& settings);
String playbackStateTopic(const SettingsBundle& settings);
String networkStateTopic(const SettingsBundle& settings);
String batteryStateTopic(const SettingsBundle& settings);
String otaStateTopic(const SettingsBundle& settings);
#ifdef APP_ENABLE_HACS_MQTT
String hacsMediaPlayerDiscoveryTopic(const SettingsBundle& settings);
String hacsMediaPlayerStateTopic(const SettingsBundle& settings, const char* field);
String hacsMediaPlayerCommandTopic(const SettingsBundle& settings, const char* command);
#endif
String commandTopic(const SettingsBundle& settings, const char* command);
String entityUniqueId(const SettingsBundle& settings, const char* suffix);
String discoveryTopic(const SettingsBundle& settings, const char* component, const char* objectId);
String discoveryPayloadSensor(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* valueTemplate, const char* unit, const char* deviceClass, const char* stateClass, const char* icon = nullptr, int suggestedDisplayPrecision = -1, const String& configurationUrl = String());
String discoveryPayloadBinarySensor(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* valueTemplate, const char* deviceClass, const char* payloadOn = "ON", const char* payloadOff = "OFF", const char* icon = nullptr, const String& configurationUrl = String());
String discoveryPayloadSwitch(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* commandTopic, const char* valueTemplate, const char* icon = nullptr, const String& configurationUrl = String(), const char* payloadOn = "ON", const char* payloadOff = "OFF");
String discoveryPayloadNumber(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* commandTopic, int minValue, int maxValue, int step, const char* unit, const char* icon = nullptr, const String& configurationUrl = String());
String discoveryPayloadButton(const SettingsBundle& settings, const char* objectId, const char* name, const char* commandTopic, const char* payloadPress, const char* icon = nullptr, const String& configurationUrl = String());
String discoveryPayloadText(const SettingsBundle& settings, const char* objectId, const char* name, const char* commandTopic, const char* icon = nullptr, const char* stateTopic = nullptr, const char* valueTemplate = nullptr, const String& configurationUrl = String());
String discoveryPayloadSelect(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* commandTopic, const std::vector<String>& options, const char* icon = nullptr, const char* valueTemplate = nullptr, const String& configurationUrl = String());
#ifdef APP_ENABLE_HACS_MQTT
String discoveryPayloadHacsMediaPlayer(const SettingsBundle& settings);
#endif

}  // namespace HaBridge
