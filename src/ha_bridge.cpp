#include "ha_bridge.h"

#include <ArduinoJson.h>

#include "version.h"

namespace {
void fillDevice(const SettingsBundle& settings, JsonObject device, const String& configurationUrl) {
    JsonArray ids = device["identifiers"].to<JsonArray>();
    ids.add(settings.device.deviceName);
    device["name"] = settings.device.friendlyName;
    device["manufacturer"] = "DIY";
    device["model"] = "ESP32 Wi-Fi Audio Notifier";
    device["sw_version"] = APP_VERSION;
    if (!configurationUrl.isEmpty()) {
        device["configuration_url"] = configurationUrl;
    }
}

String baseDiscoveryPrefix() {
    return "homeassistant";
}
}  // namespace

namespace HaBridge {

String availabilityTopic(const SettingsBundle& settings) {
    return settings.mqtt.baseTopic + "/availability";
}

String playbackStateTopic(const SettingsBundle& settings) {
    return settings.mqtt.baseTopic + "/state/playback";
}

String networkStateTopic(const SettingsBundle& settings) {
    return settings.mqtt.baseTopic + "/state/network";
}

String batteryStateTopic(const SettingsBundle& settings) {
    return settings.mqtt.baseTopic + "/state/battery";
}

String otaStateTopic(const SettingsBundle& settings) {
    return settings.mqtt.baseTopic + "/state/ota";
}

#ifdef APP_ENABLE_HACS_MQTT
String hacsMediaPlayerDiscoveryTopic(const SettingsBundle& settings) {
    return baseDiscoveryPrefix() + "/media_player/" + settings.device.deviceName + "/config";
}

String hacsMediaPlayerStateTopic(const SettingsBundle& settings, const char* field) {
    return settings.mqtt.baseTopic + "/hacs/" + field;
}

String hacsMediaPlayerCommandTopic(const SettingsBundle& settings, const char* command) {
    return settings.mqtt.baseTopic + "/hacs/cmd/" + command;
}
#endif

String commandTopic(const SettingsBundle& settings, const char* command) {
    return settings.mqtt.baseTopic + "/cmd/" + command;
}

String entityUniqueId(const SettingsBundle& settings, const char* suffix) {
    String id = settings.device.deviceName;
    id.replace(" ", "_");
    id.toLowerCase();
    id += "_";
    id += suffix;
    return id;
}

String discoveryTopic(const SettingsBundle& settings, const char* component, const char* objectId) {
    return baseDiscoveryPrefix() + "/" + component + "/" + settings.device.deviceName + "/" + objectId + "/config";
}

String discoveryPayloadSensor(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* valueTemplate, const char* unit, const char* deviceClass, const char* stateClass, const char* icon, int suggestedDisplayPrecision, const String& configurationUrl) {
    JsonDocument doc;
    doc["name"] = name;
    doc["uniq_id"] = entityUniqueId(settings, objectId);
    doc["stat_t"] = stateTopic;
    doc["avty_t"] = availabilityTopic(settings);
    doc["val_tpl"] = valueTemplate;
    if (unit != nullptr) doc["unit_of_meas"] = unit;
    if (deviceClass != nullptr) doc["dev_cla"] = deviceClass;
    if (stateClass != nullptr) doc["stat_cla"] = stateClass;
    if (icon != nullptr) doc["ic"] = icon;
    if (suggestedDisplayPrecision >= 0) doc["suggested_display_precision"] = suggestedDisplayPrecision;
    fillDevice(settings, doc["dev"].to<JsonObject>(), configurationUrl);
    String out;
    serializeJson(doc, out);
    return out;
}

String discoveryPayloadNumber(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* commandTopicValue, int minValue, int maxValue, int step, const char* unit, const char* icon, const String& configurationUrl) {
    JsonDocument doc;
    doc["name"] = name;
    doc["uniq_id"] = entityUniqueId(settings, objectId);
    doc["stat_t"] = stateTopic;
    doc["cmd_t"] = commandTopicValue;
    doc["avty_t"] = availabilityTopic(settings);
    doc["min"] = minValue;
    doc["max"] = maxValue;
    doc["step"] = step;
    doc["mode"] = "box";
    if (unit != nullptr) doc["unit_of_meas"] = unit;
    if (icon != nullptr) doc["ic"] = icon;
    fillDevice(settings, doc["dev"].to<JsonObject>(), configurationUrl);
    String out;
    serializeJson(doc, out);
    return out;
}

String discoveryPayloadButton(const SettingsBundle& settings, const char* objectId, const char* name, const char* commandTopicValue, const char* payloadPress, const char* icon, const String& configurationUrl) {
    JsonDocument doc;
    doc["name"] = name;
    doc["uniq_id"] = entityUniqueId(settings, objectId);
    doc["cmd_t"] = commandTopicValue;
    doc["pl_prs"] = payloadPress;
    doc["avty_t"] = availabilityTopic(settings);
    if (icon != nullptr) doc["ic"] = icon;
    fillDevice(settings, doc["dev"].to<JsonObject>(), configurationUrl);
    String out;
    serializeJson(doc, out);
    return out;
}

String discoveryPayloadText(const SettingsBundle& settings, const char* objectId, const char* name, const char* commandTopicValue, const char* icon, const char* stateTopic, const char* valueTemplate, const String& configurationUrl) {
    JsonDocument doc;
    doc["name"] = name;
    doc["uniq_id"] = entityUniqueId(settings, objectId);
    doc["cmd_t"] = commandTopicValue;
    doc["mode"] = "text";
    doc["avty_t"] = availabilityTopic(settings);
    if (stateTopic != nullptr) doc["stat_t"] = stateTopic;
    if (valueTemplate != nullptr) doc["val_tpl"] = valueTemplate;
    if (icon != nullptr) doc["ic"] = icon;
    fillDevice(settings, doc["dev"].to<JsonObject>(), configurationUrl);
    String out;
    serializeJson(doc, out);
    return out;
}

String discoveryPayloadSelect(const SettingsBundle& settings, const char* objectId, const char* name, const char* stateTopic, const char* commandTopic, const std::vector<String>& options, const char* icon, const char* valueTemplate, const String& configurationUrl) {
    JsonDocument doc;
    doc["name"] = name;
    doc["uniq_id"] = entityUniqueId(settings, objectId);
    doc["stat_t"] = stateTopic;
    doc["cmd_t"] = commandTopic;
    doc["avty_t"] = availabilityTopic(settings);
    if (valueTemplate != nullptr) doc["val_tpl"] = valueTemplate;
    if (icon != nullptr) doc["ic"] = icon;
    JsonArray optionArray = doc["options"].to<JsonArray>();
    for (const String& option : options) {
        optionArray.add(option);
    }
    fillDevice(settings, doc["dev"].to<JsonObject>(), configurationUrl);
    String out;
    serializeJson(doc, out);
    return out;
}

#ifdef APP_ENABLE_HACS_MQTT
String discoveryPayloadHacsMediaPlayer(const SettingsBundle& settings) {
    JsonDocument doc;
    doc["name"] = settings.device.friendlyName;
    doc["unique_id"] = entityUniqueId(settings, "mqtt_media_player");

    JsonObject availability = doc["availability"].to<JsonObject>();
    availability["topic"] = availabilityTopic(settings);
    availability["payload_available"] = "online";
    availability["payload_not_available"] = "offline";

    doc["state_state_topic"] = hacsMediaPlayerStateTopic(settings, "state");
    doc["state_title_topic"] = hacsMediaPlayerStateTopic(settings, "title");
    doc["state_mediatype_topic"] = hacsMediaPlayerStateTopic(settings, "mediatype");
    doc["state_volume_topic"] = hacsMediaPlayerStateTopic(settings, "volume");

    doc["command_play_topic"] = hacsMediaPlayerCommandTopic(settings, "play");
    doc["command_play_payload"] = "play";
    doc["command_pause_topic"] = hacsMediaPlayerCommandTopic(settings, "pause");
    doc["command_pause_payload"] = "pause";
    doc["command_playpause_topic"] = hacsMediaPlayerCommandTopic(settings, "playpause");
    doc["command_playpause_payload"] = "playpause";
    doc["command_next_topic"] = hacsMediaPlayerCommandTopic(settings, "next");
    doc["command_next_payload"] = "next";
    doc["command_previous_topic"] = hacsMediaPlayerCommandTopic(settings, "previous");
    doc["command_previous_payload"] = "previous";
    doc["command_stop_topic"] = hacsMediaPlayerCommandTopic(settings, "stop");
    doc["command_stop_payload"] = "stop";
    doc["command_volume_topic"] = hacsMediaPlayerCommandTopic(settings, "volume");
    doc["command_playmedia_topic"] = hacsMediaPlayerCommandTopic(settings, "playmedia");

    fillDevice(settings, doc["device"].to<JsonObject>(), String());

    String out;
    serializeJson(doc, out);
    return out;
}
#endif

}  // namespace HaBridge
