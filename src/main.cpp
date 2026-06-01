#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
#include <Preferences.h>
#include <esp_ota_ops.h>
#include <esp_sleep.h>
#include <esp_system.h>

#include "default_config.h"
#include "storage_backend.h"

namespace {
void waitForSerialConsole(unsigned long timeoutMs = 1500) {
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    const unsigned long startedAt = millis();
    while (!Serial && (millis() - startedAt) < timeoutMs) {
        delay(10);
    }
#else
    (void)timeoutMs;
#endif
}

uint8_t activeStatusLedPin = DefaultConfig::STATUS_LED_PIN;
bool statusLedInitialized = false;

#if APP_STATUS_LED_IS_NEOPIXEL
Adafruit_NeoPixel statusLedPixel(1, DefaultConfig::STATUS_LED_PIN, NEO_GRB + NEO_KHZ800);

void initializeStatusLed() {
    statusLedPixel.setPin(activeStatusLedPin);
    statusLedPixel.begin();
    statusLedPixel.clear();
    statusLedPixel.show();
    statusLedInitialized = true;
}

void writeStatusLed(bool on) {
    if (!statusLedInitialized) {
        return;
    }
    statusLedPixel.setPixelColor(0, on ? statusLedPixel.Color(0, 24, 0) : 0);
    statusLedPixel.show();
}

#else
void initializeStatusLed() {
    pinMode(activeStatusLedPin, OUTPUT);
    digitalWrite(activeStatusLedPin, LOW);
    statusLedInitialized = true;
}

void writeStatusLed(bool on) {
    if (!statusLedInitialized) {
        return;
    }
    digitalWrite(activeStatusLedPin, on ? HIGH : LOW);
}

#endif

void applyStatusLedPin(uint8_t pin) {
    if (statusLedInitialized && pin == activeStatusLedPin) {
        return;
    }

    writeStatusLed(false);
#if !APP_STATUS_LED_IS_NEOPIXEL
    if (statusLedInitialized) {
        pinMode(activeStatusLedPin, INPUT);
    }
#endif
    activeStatusLedPin = pin;
    initializeStatusLed();
}

}

#ifdef SAFE_BOOT_DIAGNOSTIC
#include "version.h"

namespace {
const char* resetReasonToString(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_UNKNOWN:
            return "unknown";
        case ESP_RST_POWERON:
            return "poweron";
        case ESP_RST_EXT:
            return "external";
        case ESP_RST_SW:
            return "software";
        case ESP_RST_PANIC:
            return "panic";
        case ESP_RST_INT_WDT:
            return "interrupt watchdog";
        case ESP_RST_TASK_WDT:
            return "task watchdog";
        case ESP_RST_WDT:
            return "other watchdog";
        case ESP_RST_DEEPSLEEP:
            return "deepsleep";
        case ESP_RST_BROWNOUT:
            return "brownout";
        case ESP_RST_SDIO:
            return "sdio";
        default:
            return "unhandled";
    }
}

unsigned long lastHeartbeatAt = 0;
}

void setup() {
    Serial.begin(115200);
    waitForSerialConsole();
    delay(300);
    initializeStatusLed();
    writeStatusLed(false);

    Serial.printf("\n[safe-boot] app=%s version=%s built=%s\n", APP_NAME, APP_VERSION, APP_BUILD_DATE);
    Serial.printf("[safe-boot] reset reason=%s (%d)\n", resetReasonToString(esp_reset_reason()), static_cast<int>(esp_reset_reason()));
    Serial.printf("[safe-boot] free heap=%u\n", ESP.getFreeHeap());
    Serial.println("[safe-boot] minimal firmware is running");
    Serial.flush();
}

void loop() {
    static bool heartbeatLedOn = false;
    const unsigned long now = millis();
    if (now - lastHeartbeatAt >= 1000UL) {
        lastHeartbeatAt = now;
        heartbeatLedOn = !heartbeatLedOn;
        writeStatusLed(heartbeatLedOn);
        Serial.printf("[safe-boot] uptime=%lu free_heap=%u\n", now, ESP.getFreeHeap());
        Serial.flush();
    }
    delay(10);
}

#else
#include "app_state.h"
#include "battery_monitor.h"
#include "display_manager.h"
#include "mqtt_manager.h"
#include "ota_manager.h"
#include "playback_text.h"
#include "psram_allocator.h"
#include "settings_manager.h"
#include "sound_effects.h"
#include "system_metrics.h"
#include "version.h"
#include "web_server.h"
#include "wifi_manager.h"

#ifdef APP_DISABLE_AUDIO
class AudioPlayerStub {
  public:
    void begin(uint8_t, uint8_t, uint8_t, uint8_t initialVolumePercent, AppState& appState) {
        appState_ = &appState;
        volume_ = initialVolumePercent;
        state_ = "idle";
        type_ = "idle";
        title_ = "Audio disabled";
        url_ = "";
        source_ = "disabled";
        publish();
    }

    void loop() {}

    bool play(const String&, const String&, const String&, const String&) {
        return false;
    }

    bool playStorageFile(StorageTarget, const String&, const String&, const String&, const String&) {
        return false;
    }

    void stop() {
    state_ = "idle";
    type_ = "idle";
    title_ = "Audio disabled";
    url_ = "";
    source_ = "disabled";
    publish();
    }

    void setVolumePercent(uint8_t volumePercent) {
        volume_ = volumePercent;
        publish();
    }

    uint8_t volumePercent() const { return volume_; }
    String currentState() const { return state_; }

    private:
    void publish() {
        if (appState_ != nullptr) {
            appState_->setPlayback(state_, type_, title_, url_, source_, volume_);
        }
    }

    AppState* appState_ = nullptr;
        uint8_t volume_ = DefaultConfig::DEFAULT_VOLUME_PERCENT;
    String state_ = "idle";
    String type_ = "idle";
    String title_ = "Audio disabled";
    String url_;
    String source_ = "disabled";
};

using AudioPlayerType = AudioPlayerStub;
#else
#include "audio_player.h"
using AudioPlayerType = AudioPlayer;
#endif

namespace {
AppState* appState = nullptr;
SettingsManager* settingsManager = nullptr;
SettingsBundle* settings = nullptr;
WiFiManager* wifiManager = nullptr;
BatteryMonitor* batteryMonitor = nullptr;
DisplayManager* displayManager = nullptr;
AudioPlayerType* audioPlayer = nullptr;
OtaManager* otaManager = nullptr;
MqttManager* mqttManager = nullptr;
WebServerManager* webServer = nullptr;
SoundEffectsManager* soundEffects = nullptr;

struct DeferredActions {
    bool settingsApplyPending = false;
    SettingsBundle pendingSettings;
    bool mqttConnectionChangePending = false;
    bool mqttConnectRequested = false;
    bool playPending = false;
    bool playAddToHistory = true;
    bool playFromStorage = false;
    StorageTarget playStorageTarget = StorageTarget::Flash;
    bool stopPending = false;
    bool volumePending = false;
    bool volumeSavePending = false;
    uint8_t pendingVolume = 0;
    unsigned long volumeSaveAt = 0;
    String playUrl;
    String playStoragePath;
    String playLabel;
    String playType;
    String playSource;
};

DeferredActions* deferredActions = nullptr;

struct RuntimeAudioAutomation {
    bool bootUpdateCheckQueued = false;
    bool updateAvailableHandled = false;
    bool pendingAutoUpdateInstall = false;
    bool lowBatteryCueActive = false;
    bool ambientVolumeApplied = false;
    bool effectVolumeApplied = false;
    bool alarmActive = false;
    bool restartPending = false;
    bool restartFactoryReset = false;
    bool restartForcePending = false;
    bool webUiLockPending = false;
    bool pendingCommandAfterNotification = false;
    uint8_t ambientPreviousVolume = 0;
    unsigned long ambientEligibleAt = 0;
    unsigned long restartForceAt = 0;
    PlaybackCommand pendingCommand;
    String restartReason;
};

RuntimeAudioAutomation runtimeAudio;

struct PhysicalButtonState {
    uint8_t pin = 0;
    const char* label = "";
    bool lastSampledPressed = false;
    bool stablePressed = false;
    unsigned long lastTransitionAt = 0;
};

struct PlaybackHistoryEntry {
    String url;
    String label;
    String type;
    String source;
};

bool rebootRequested = false;
bool factoryResetRequested = false;
unsigned long rebootAt = 0;
unsigned long lastHeapUpdateAt = 0;
bool recoveryRebootScheduled = false;
bool wokeFromDeepSleep = false;
uint8_t activeI2sBclkPin = DefaultConfig::I2S_BCLK_PIN;
uint8_t activeI2sWsPin = DefaultConfig::I2S_WS_PIN;
uint8_t activeI2sDoutPin = DefaultConfig::I2S_DOUT_PIN;
uint8_t activeWapeTriggerPin = 0;
bool wapeTriggerInitialized = false;
bool wapePulseActive = false;
unsigned long wapePulseReleaseAt = 0;
unsigned long lowBatteryWakeStartedAt = 0;
unsigned long lastOtaMqttPublishAt = 0;
bool previousWifiConnected = false;
bool previousMqttConnected = false;
bool previousCharging = false;
String previousPlaybackState = "idle";
String previousPlaybackSource = "none";
String lastPublishedOtaSignature;
bool transitionStateInitialized = false;
bool otaPendingVerification = false;
bool otaHealthConfirmed = false;
unsigned long otaBootStartedAt = 0;
String otaPendingVersion;
String lastRolledBackVersion;
String lastRollbackReason;

constexpr float kBatteryPercentEmptyVoltage = 3.2f;
constexpr float kBatteryPercentFullVoltage = 4.2f;
constexpr unsigned long kLowBatteryWakeWindowMs = 30000UL;
constexpr unsigned long kVolumePersistDelayMs = 750UL;
constexpr unsigned long kButtonDebounceMs = 30UL;
constexpr size_t kPlaybackHistoryLimit = 12;
constexpr unsigned long kOtaHealthConfirmDelayMs = 8000UL;
constexpr unsigned long kWapePulseDurationMs = 500UL;
constexpr unsigned long kAmbientResumeDelayMs = 30000UL;
constexpr unsigned long kRestartEffectForceDelayMs = 7000UL;

constexpr char kOtaRollbackNamespace[] = "ota_state";
constexpr char kOtaPendingVersionKey[] = "pend_ver";
constexpr char kOtaPendingReasonKey[] = "pend_reason";
constexpr char kOtaLastBadVersionKey[] = "bad_ver";
constexpr char kOtaLastBadReasonKey[] = "bad_reason";

bool playRequest(const String& url, const String& label, const String& type, const String& source, String& error, bool addToHistory);
void flushPendingSettingsNow();
void restoreAmbientVolumeIfNeeded();

bool parseStorageFileReference(const String& raw, StorageTarget& target, String& path) {
    String value = raw;
    value.trim();
    value.replace('\\', '/');

    const int separatorIndex = value.indexOf(':');
    if (separatorIndex <= 0) {
        return false;
    }

    String targetId = value.substring(0, separatorIndex);
    targetId.trim();
    targetId.toLowerCase();
    if (targetId == "sd") {
        target = StorageTarget::Sd;
    } else if (targetId == "flash") {
        target = StorageTarget::Flash;
    } else {
        return false;
    }

    path = value.substring(separatorIndex + 1);
    path.trim();
    if (path.isEmpty()) {
        return false;
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    while (path.indexOf("//") >= 0) {
        path.replace("//", "/");
    }
    if (path.indexOf("..") >= 0) {
        return false;
    }

    return true;
}

PhysicalButtonState button1 { DefaultConfig::BUTTON1_PIN, "Button 1" };
PhysicalButtonState button2 { DefaultConfig::BUTTON2_PIN, "Button 2" };
PlaybackHistoryEntry playbackHistory[kPlaybackHistoryLimit];
size_t playbackHistoryCount = 0;
int playbackHistoryIndex = -1;

bool isBatterySamplingAllowed() {
    if (audioPlayer == nullptr) {
        return true;
    }

    const String audioState = audioPlayer->currentState();
    return audioState != "playing" && audioState != "buffering";
}

bool isPhysicalButtonEnabled(const PhysicalButtonState& button) {
    return !sdStorageUsesPin(button.pin);
}

const char* resetReasonToString(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_UNKNOWN:
            return "unknown";
        case ESP_RST_POWERON:
            return "poweron";
        case ESP_RST_EXT:
            return "external";
        case ESP_RST_SW:
            return "software";
        case ESP_RST_PANIC:
            return "panic";
        case ESP_RST_INT_WDT:
            return "interrupt watchdog";
        case ESP_RST_TASK_WDT:
            return "task watchdog";
        case ESP_RST_WDT:
            return "other watchdog";
        case ESP_RST_DEEPSLEEP:
            return "deepsleep";
        case ESP_RST_BROWNOUT:
            return "brownout";
        case ESP_RST_SDIO:
            return "sdio";
        default:
            return "unhandled";
    }
}

String normalizedAppVersion() {
    return String("v") + APP_VERSION;
}

void storeRollbackPendingInfo(const String& version, const String& reason) {
    Preferences prefs;
    if (!prefs.begin(kOtaRollbackNamespace, false)) {
        return;
    }
    prefs.putString(kOtaPendingVersionKey, version);
    prefs.putString(kOtaPendingReasonKey, reason);
    prefs.end();
}

void clearRollbackPendingInfo() {
    Preferences prefs;
    if (!prefs.begin(kOtaRollbackNamespace, false)) {
        return;
    }
    prefs.remove(kOtaPendingVersionKey);
    prefs.remove(kOtaPendingReasonKey);
    prefs.end();
}

void persistRollbackOutcome(const String& version, const String& reason) {
    Preferences prefs;
    if (!prefs.begin(kOtaRollbackNamespace, false)) {
        return;
    }
    prefs.putString(kOtaLastBadVersionKey, version);
    prefs.putString(kOtaLastBadReasonKey, reason);
    prefs.end();
}

void loadRollbackState() {
    Preferences prefs;
    if (!prefs.begin(kOtaRollbackNamespace, false)) {
        return;
    }

    otaPendingVersion = prefs.getString(kOtaPendingVersionKey, "");
    String pendingReason = prefs.getString(kOtaPendingReasonKey, "");
    lastRolledBackVersion = prefs.getString(kOtaLastBadVersionKey, "");
    lastRollbackReason = prefs.getString(kOtaLastBadReasonKey, "");

    const String currentVersion = normalizedAppVersion();
    const esp_partition_t* runningPartition = esp_ota_get_running_partition();
    esp_ota_img_states_t otaState = ESP_OTA_IMG_UNDEFINED;
    if (runningPartition != nullptr && esp_ota_get_state_partition(runningPartition, &otaState) == ESP_OK && otaState == ESP_OTA_IMG_PENDING_VERIFY) {
        otaPendingVerification = true;
        otaBootStartedAt = millis();
        otaHealthConfirmed = false;
        otaPendingVersion = currentVersion;
        if (pendingReason.isEmpty()) {
            pendingReason = "App booted but did not finish health confirmation.";
        }
        prefs.putString(kOtaPendingVersionKey, otaPendingVersion);
        prefs.putString(kOtaPendingReasonKey, pendingReason);
    } else {
        otaPendingVerification = false;
        otaHealthConfirmed = true;
        if (!otaPendingVersion.isEmpty() && otaPendingVersion != currentVersion) {
            lastRolledBackVersion = otaPendingVersion;
            if (pendingReason.isEmpty()) {
                pendingReason = "New firmware rebooted before health confirmation; bootloader rolled back.";
            }
            lastRollbackReason = pendingReason;
            prefs.putString(kOtaLastBadVersionKey, lastRolledBackVersion);
            prefs.putString(kOtaLastBadReasonKey, lastRollbackReason);
        }
        prefs.remove(kOtaPendingVersionKey);
        prefs.remove(kOtaPendingReasonKey);
        otaPendingVersion = "";
    }

    prefs.end();
}

void refreshRollbackStateInOtaManager() {
    if (otaManager == nullptr) {
        return;
    }
    otaManager->setRollbackState(otaPendingVerification && !otaHealthConfirmed, otaPendingVersion, lastRolledBackVersion, lastRollbackReason);
}

void initializeWapeTriggerPin() {
    if (activeWapeTriggerPin == 0) {
        wapeTriggerInitialized = false;
        return;
    }
    pinMode(activeWapeTriggerPin, OUTPUT);
    digitalWrite(activeWapeTriggerPin, HIGH);
    wapeTriggerInitialized = true;
}

void applyWapeTriggerPin(uint8_t pin) {
    if (wapeTriggerInitialized && activeWapeTriggerPin != 0 && activeWapeTriggerPin != pin) {
        digitalWrite(activeWapeTriggerPin, HIGH);
        pinMode(activeWapeTriggerPin, INPUT);
    }

    activeWapeTriggerPin = pin;
    wapePulseActive = false;

    if (pin == 0) {
        wapeTriggerInitialized = false;
        return;
    }

    initializeWapeTriggerPin();
}

bool isWapeDisplayActive() {
    return settings != nullptr && settings->oled.displayType == "wape" && activeWapeTriggerPin != 0;
}

void requestWapeTriggerPulse() {
    if (!isWapeDisplayActive()) {
        return;
    }
    if (!wapeTriggerInitialized) {
        initializeWapeTriggerPin();
    }
    digitalWrite(activeWapeTriggerPin, LOW);
    wapePulseActive = true;
    wapePulseReleaseAt = millis() + kWapePulseDurationMs;
}

void triggerWapeDisplay() {
    requestWapeTriggerPulse();
}

void serviceWapeTriggerPulse() {
    if (!wapePulseActive) {
        return;
    }
    if (static_cast<long>(millis() - wapePulseReleaseAt) < 0) {
        return;
    }
    if (wapeTriggerInitialized && activeWapeTriggerPin != 0) {
        digitalWrite(activeWapeTriggerPin, HIGH);
    }
    wapePulseActive = false;
}

[[noreturn]] void rollbackAndReboot(const String& reason) {
    const String version = otaPendingVersion.isEmpty() ? normalizedAppVersion() : otaPendingVersion;
    storeRollbackPendingInfo(version, reason);
    persistRollbackOutcome(version, reason);
    Serial.printf("[rollback] %s\n", reason.c_str());
    Serial.flush();
    const esp_err_t result = esp_ota_mark_app_invalid_rollback_and_reboot();
    Serial.printf("[rollback] esp_ota_mark_app_invalid_rollback_and_reboot failed: %d\n", static_cast<int>(result));
    Serial.flush();
    delay(1000);
    ESP.restart();
    for (;;) {
        delay(1000);
    }
}

void confirmOtaHealthIfReady() {
    if (!otaPendingVerification || otaHealthConfirmed) {
        return;
    }
    if ((millis() - otaBootStartedAt) < kOtaHealthConfirmDelayMs) {
        return;
    }
    if (rebootRequested || factoryResetRequested || recoveryRebootScheduled) {
        return;
    }

    const esp_err_t result = esp_ota_mark_app_valid_cancel_rollback();
    if (result == ESP_OK) {
        otaHealthConfirmed = true;
        otaPendingVerification = false;
        otaPendingVersion = "";
        clearRollbackPendingInfo();
        refreshRollbackStateInOtaManager();
        Serial.println("[rollback] OTA firmware marked healthy");
        Serial.flush();
    } else {
        Serial.printf("[rollback] failed to confirm OTA app: %d\n", static_cast<int>(result));
        Serial.flush();
    }
}

void scheduleReboot(uint32_t delayMs) {
    rebootRequested = true;
    rebootAt = millis() + delayMs;
}

String effectFileForSource(const String& source) {
    if (settings == nullptr) {
        return "";
    }
    if (source == "effect-startup") return settings->effects.startupFile;
    if (source == "effect-alarm") return settings->effects.alarmFile;
    if (source == "effect-notification") return settings->effects.notificationFile;
    if (source == "effect-ambient") return settings->effects.ambientSoundFile;
    if (source == "effect-low-battery") return settings->effects.lowBatteryFile;
    if (source == "effect-shutdown") return settings->effects.shutDownFile;
    if (source == "effect-update-available") return settings->effects.updateAvailableFile;
    if (source == "effect-update-success") return settings->effects.updateSuccessFile;
    return "";
}

uint8_t effectVolumeForSource(const String& source) {
    if (settings == nullptr) {
        return DefaultConfig::DEFAULT_VOLUME_PERCENT;
    }
    if (source == "effect-startup") return settings->effects.startupVolumePercent;
    if (source == "effect-alarm") return settings->effects.alarmVolumePercent;
    if (source == "effect-notification") return settings->effects.notificationVolumePercent;
    if (source == "effect-ambient") return settings->effects.ambientVolumePercent;
    if (source == "effect-low-battery") return settings->effects.lowBatteryVolumePercent;
    if (source == "effect-shutdown") return settings->effects.shutDownVolumePercent;
    if (source == "effect-update-available") return settings->effects.updateAvailableVolumePercent;
    if (source == "effect-update-success") return settings->effects.updateSuccessVolumePercent;
    return settings->device.savedVolumePercent;
}

void restoreEffectVolumeIfNeeded() {
    if (!runtimeAudio.effectVolumeApplied || audioPlayer == nullptr) {
        return;
    }
    audioPlayer->setVolumePercent(settings != nullptr ? settings->device.savedVolumePercent : DefaultConfig::DEFAULT_VOLUME_PERCENT);
    runtimeAudio.effectVolumeApplied = false;
}

bool playConfiguredEffect(const String& effectRef, const String& label, const String& source) {
    if (effectRef.isEmpty() || deferredActions == nullptr) {
        return false;
    }
    if (source.startsWith("effect-") && source != "effect-ambient" && audioPlayer != nullptr) {
        restoreAmbientVolumeIfNeeded();
        audioPlayer->setVolumePercent(effectVolumeForSource(source));
        runtimeAudio.effectVolumeApplied = true;
    }
    String ignored;
    if (playRequest(effectRef, label, "effect", source, ignored, false)) {
        return true;
    }
    restoreEffectVolumeIfNeeded();
    return false;
}

bool tryOverlayConfiguredEffect(const String& effectRef, uint8_t duckPercent = 35, uint8_t overlayPercent = 100) {
    if (effectRef.isEmpty() || audioPlayer == nullptr || appState == nullptr) {
        return false;
    }
    StorageTarget target = StorageTarget::Flash;
    String path;
    if (!parseStorageFileReference(effectRef, target, path)) {
        return false;
    }
    const AppStateSnapshot snapshot = appState->snapshot();
    if (snapshot.playback.state != "playing" || snapshot.playback.source.startsWith("effect-")) {
        return false;
    }
    return audioPlayer->playStorageOverlay(target, path, duckPercent, overlayPercent);
}

bool playConfiguredEffectSource(const String& source, const String& label) {
    return playConfiguredEffect(effectFileForSource(source), label, source);
}

uint8_t ambientPlaybackVolumePercent() {
    if (settings == nullptr) {
        return 20;
    }
    return effectVolumeForSource("effect-ambient");
}

void restoreAmbientVolumeIfNeeded() {
    if (!runtimeAudio.ambientVolumeApplied || audioPlayer == nullptr) {
        return;
    }
    audioPlayer->setVolumePercent(settings != nullptr ? settings->device.savedVolumePercent : runtimeAudio.ambientPreviousVolume);
    runtimeAudio.ambientVolumeApplied = false;
}

void startAmbientIfEligible(const AppStateSnapshot& snapshot) {
    if (settings == nullptr || audioPlayer == nullptr || runtimeAudio.alarmActive || runtimeAudio.restartPending ||
        settings->effects.ambientSoundFile.isEmpty() || snapshot.playback.state != "idle") {
        return;
    }
    if (runtimeAudio.ambientEligibleAt == 0 || static_cast<long>(millis() - runtimeAudio.ambientEligibleAt) < 0) {
        return;
    }
    runtimeAudio.ambientPreviousVolume = settings->device.savedVolumePercent;
    audioPlayer->setVolumePercent(ambientPlaybackVolumePercent());
    runtimeAudio.ambientVolumeApplied = true;
    if (!playConfiguredEffectSource("effect-ambient", "Ambient Sound")) {
        restoreAmbientVolumeIfNeeded();
        runtimeAudio.ambientEligibleAt = millis() + kAmbientResumeDelayMs;
    }
}

void scheduleAmbientResume(unsigned long delayMs = 0UL) {
    runtimeAudio.ambientEligibleAt = millis() + delayMs;
}

void applyWebUiLockNow() {
    if (webServer != nullptr) {
        webServer->setWebUiLocked(true);
    }
    if (appState != nullptr) {
        appState->setLastError("Web UI locked. Unlock it via MQTT command <baseTopic>/cmd/web_ui with payload unlock.");
    }
    if (mqttManager != nullptr) {
        mqttManager->publishState();
    }
}

void requestWebUiLockSequence() {
    runtimeAudio.webUiLockPending = true;
    runtimeAudio.pendingCommandAfterNotification = false;
    runtimeAudio.alarmActive = false;
    restoreAmbientVolumeIfNeeded();

    if (audioPlayer != nullptr) {
        audioPlayer->stop();
    }

    if (!playConfiguredEffectSource("effect-shutdown", "Shutting Down")) {
        runtimeAudio.webUiLockPending = false;
        applyWebUiLockNow();
    }
}

void requestRestartSequence(const String& reason, bool factoryResetAfterRestart) {
    runtimeAudio.restartPending = true;
    runtimeAudio.restartFactoryReset = factoryResetAfterRestart;
    runtimeAudio.restartReason = reason;
    runtimeAudio.restartForcePending = true;
    runtimeAudio.restartForceAt = millis() + kRestartEffectForceDelayMs;
    runtimeAudio.pendingCommandAfterNotification = false;
    runtimeAudio.alarmActive = false;
    restoreAmbientVolumeIfNeeded();

    if (audioPlayer != nullptr) {
        audioPlayer->stop();
    }

    const bool playedUpdateSuccess = reason == "ota" && playConfiguredEffectSource("effect-update-success", "Update Success");
    if (!playedUpdateSuccess && !playConfiguredEffectSource("effect-shutdown", "Restarting")) {
        if (factoryResetAfterRestart) {
            factoryResetRequested = true;
        }
        scheduleReboot(250);
    }
}

void handleOtaRestartRequest(const String& reason) {
    requestRestartSequence(reason, false);
}

uint8_t estimateBatteryPercent(float voltage) {
    const float normalized = (voltage - kBatteryPercentEmptyVoltage) / (kBatteryPercentFullVoltage - kBatteryPercentEmptyVoltage);
    const float clamped = normalized < 0.0f ? 0.0f : (normalized > 1.0f ? 1.0f : normalized);
    return static_cast<uint8_t>((clamped * 100.0f) + 0.5f);
}

String normalizedButtonAction(String action, const char* fallback) {
    action.trim();
    action.toLowerCase();
    action.replace('-', '_');
    action.replace(' ', '_');

    if (action == "none" || action == "previous" || action == "next" || action == "play_pause" ||
        action == "replay_current" || action == "stop" || action == "volume_up" || action == "volume_down" ||
        action == "ha_previous" || action == "ha_next") {
        return action;
    }

    return String(fallback);
}

String buttonActionFor(const PhysicalButtonState& button) {
    if (settings == nullptr) {
        return button.pin == DefaultConfig::BUTTON1_PIN ? String(DefaultConfig::BUTTON1_DEFAULT_ACTION) : String(DefaultConfig::BUTTON2_DEFAULT_ACTION);
    }

    return button.pin == DefaultConfig::BUTTON1_PIN
        ? normalizedButtonAction(settings->device.button1Action, DefaultConfig::BUTTON1_DEFAULT_ACTION)
        : normalizedButtonAction(settings->device.button2Action, DefaultConfig::BUTTON2_DEFAULT_ACTION);
}

String buttonActionDisplayLabel(const String& action) {
    if (action == "none") {
        return "Disabled";
    }
    if (action == "previous") {
        return "Previous";
    }
    if (action == "next") {
        return "Next";
    }
    if (action == "play_pause") {
        return "Play/Pause";
    }
    if (action == "replay_current") {
        return "Replay";
    }
    if (action == "stop") {
        return "Stop";
    }
    if (action == "volume_up") {
        return "Volume +";
    }
    if (action == "volume_down") {
        return "Volume -";
    }
    if (action == "ha_previous") {
        return "HA Prev";
    }
    if (action == "ha_next") {
        return "HA Next";
    }
    return action;
}

String buttonOverlayText(const String& action) {
    if ((action == "volume_up" || action == "volume_down") && settings != nullptr) {
        String label = "Volume ";
        label += settings->device.savedVolumePercent;
        label += "%";
        return label;
    }

    return buttonActionDisplayLabel(action);
}

void showS3ButtonActionOnDisplay(const String& action) {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    if (displayManager != nullptr) {
        displayManager->showTemporaryCenterText(buttonOverlayText(action));
    }
#else
    (void)action;
#endif
}

void initializeButtons() {
    const unsigned long now = millis();
    if (isPhysicalButtonEnabled(button1)) {
        pinMode(button1.pin, INPUT_PULLDOWN);
        button1.lastSampledPressed = digitalRead(button1.pin) == HIGH;
    } else {
        pinMode(button1.pin, INPUT);
        button1.lastSampledPressed = false;
    }
    button1.stablePressed = button1.lastSampledPressed;
    button1.lastTransitionAt = now;

    if (isPhysicalButtonEnabled(button2)) {
        pinMode(button2.pin, INPUT_PULLDOWN);
        button2.lastSampledPressed = digitalRead(button2.pin) == HIGH;
    } else {
        pinMode(button2.pin, INPUT);
        button2.lastSampledPressed = false;
    }
    button2.stablePressed = button2.lastSampledPressed;
    button2.lastTransitionAt = now;
}

void rememberPlaybackSelection(const String& url, const String& label, const String& type, const String& source) {
    const String normalizedUrl = PlaybackText::normalizeUrl(url);
    const String normalizedLabel = PlaybackText::normalizeTitle(label, normalizedUrl);

    if (normalizedUrl.isEmpty()) {
        return;
    }

    if (playbackHistoryIndex >= 0 && playbackHistoryIndex < static_cast<int>(playbackHistoryCount)) {
        PlaybackHistoryEntry& current = playbackHistory[playbackHistoryIndex];
        if (current.url == normalizedUrl && current.type == type) {
            current.label = normalizedLabel;
            current.source = source;
            return;
        }
    }

    if (playbackHistoryIndex >= 0 && playbackHistoryIndex < static_cast<int>(playbackHistoryCount - 1)) {
        playbackHistoryCount = static_cast<size_t>(playbackHistoryIndex + 1);
    }

    if (playbackHistoryCount > 0) {
        PlaybackHistoryEntry& last = playbackHistory[playbackHistoryCount - 1];
        if (last.url == normalizedUrl && last.type == type) {
            last.label = normalizedLabel;
            last.source = source;
            playbackHistoryIndex = static_cast<int>(playbackHistoryCount - 1);
            return;
        }
    }

    if (playbackHistoryCount == kPlaybackHistoryLimit) {
        for (size_t index = 1; index < playbackHistoryCount; ++index) {
            playbackHistory[index - 1] = playbackHistory[index];
        }
        playbackHistoryCount -= 1;
    }

    playbackHistory[playbackHistoryCount] = {normalizedUrl, normalizedLabel, type, source};
    playbackHistoryCount += 1;
    playbackHistoryIndex = static_cast<int>(playbackHistoryCount - 1);
}

bool replayPlaybackEntry(const PlaybackHistoryEntry& entry, bool addToHistory) {
    if (entry.url.isEmpty()) {
        return false;
    }

    String error;
    return playRequest(entry.url, entry.label, entry.type, entry.source, error, addToHistory);
}

bool replayCurrentPlaybackSelection(bool addToHistory) {
    if (playbackHistoryIndex >= 0 && playbackHistoryIndex < static_cast<int>(playbackHistoryCount)) {
        return replayPlaybackEntry(playbackHistory[playbackHistoryIndex], addToHistory);
    }

    if (appState == nullptr) {
        return false;
    }

    const AppStateSnapshot snapshot = appState->snapshot();
    if (snapshot.playback.url.isEmpty()) {
        return false;
    }

    String error;
    return playRequest(snapshot.playback.url, snapshot.playback.title, snapshot.playback.type, snapshot.playback.source, error, addToHistory);
}

bool stepPlaybackHistory(int direction) {
    if (playbackHistoryCount == 0 || direction == 0) {
        return false;
    }

    int nextIndex = playbackHistoryIndex;
    if (nextIndex < 0 || nextIndex >= static_cast<int>(playbackHistoryCount)) {
        nextIndex = direction > 0 ? 0 : static_cast<int>(playbackHistoryCount - 1);
    } else {
        nextIndex = (nextIndex + direction + static_cast<int>(playbackHistoryCount)) % static_cast<int>(playbackHistoryCount);
    }

    playbackHistoryIndex = nextIndex;
    return replayPlaybackEntry(playbackHistory[nextIndex], false);
}

void applyVolumePercent(uint8_t volumePercent) {
    if (settings == nullptr || audioPlayer == nullptr || soundEffects == nullptr || deferredActions == nullptr) {
        return;
    }

    settings->device.savedVolumePercent = volumePercent;
    audioPlayer->setVolumePercent(volumePercent);
    soundEffects->setVolumePercent(volumePercent);
    deferredActions->pendingVolume = volumePercent;
    deferredActions->volumePending = false;
    deferredActions->volumeSavePending = true;
    deferredActions->volumeSaveAt = millis() + kVolumePersistDelayMs;
    if (mqttManager != nullptr) {
        mqttManager->publishState();
    }
}

void changeVolumeBy(int delta) {
    if (settings == nullptr) {
        return;
    }

    int nextVolume = static_cast<int>(settings->device.savedVolumePercent) + delta;
    if (nextVolume < 0) {
        nextVolume = 0;
    }
    if (nextVolume > 100) {
        nextVolume = 100;
    }

    applyVolumePercent(static_cast<uint8_t>(nextVolume));
}

bool executeButtonAction(const PhysicalButtonState& button, const String& action) {
    if (action == "none") {
        return false;
    }

    if (displayManager != nullptr) {
        displayManager->markActivity();
    }

    if (action == "previous") {
        return stepPlaybackHistory(-1);
    }
    if (action == "next") {
        return stepPlaybackHistory(1);
    }
    if (action == "play_pause") {
        const AppStateSnapshot snapshot = appState->snapshot();
        if (snapshot.playback.state == "playing" || snapshot.playback.state == "buffering") {
            audioPlayer->stop();
            if (mqttManager != nullptr) {
                mqttManager->publishState();
            }
            return true;
        }
        return replayCurrentPlaybackSelection(false);
    }
    if (action == "replay_current") {
        return replayCurrentPlaybackSelection(false);
    }
    if (action == "stop") {
        audioPlayer->stop();
        if (mqttManager != nullptr) {
            mqttManager->publishState();
        }
        return true;
    }
    if (action == "volume_up") {
        changeVolumeBy(DefaultConfig::BUTTON_VOLUME_STEP_PERCENT);
        return true;
    }
    if (action == "volume_down") {
        changeVolumeBy(-static_cast<int>(DefaultConfig::BUTTON_VOLUME_STEP_PERCENT));
        return true;
    }
    if (action == "ha_previous" || action == "ha_next") {
        if (mqttManager == nullptr) {
            return false;
        }
        return mqttManager->publishButtonActionEvent(button.label, button.pin, action == "ha_previous" ? "previous" : "next");
    }

    return false;
}

void pollPhysicalButton(PhysicalButtonState& button) {
    if (!isPhysicalButtonEnabled(button)) {
        button.lastSampledPressed = false;
        button.stablePressed = false;
        return;
    }

    const bool pressed = digitalRead(button.pin) == HIGH;
    const unsigned long now = millis();

    if (pressed != button.lastSampledPressed) {
        button.lastSampledPressed = pressed;
        button.lastTransitionAt = now;
    }

    if ((now - button.lastTransitionAt) < kButtonDebounceMs || pressed == button.stablePressed) {
        return;
    }

    button.stablePressed = pressed;
    if (!button.stablePressed) {
        return;
    }

    const String action = buttonActionFor(button);
    const bool handled = executeButtonAction(button, action);
    if (handled || action == "none") {
        showS3ButtonActionOnDisplay(action);
    }
    Serial.printf("[input] %s on GPIO%u action=%s handled=%s\n",
                  button.label,
                  static_cast<unsigned>(button.pin),
                  action.c_str(),
                  handled ? "yes" : "no");
}

void pollPhysicalButtons() {
    pollPhysicalButton(button1);
    pollPhysicalButton(button2);
}

void enterLowBatteryDeepSleep(uint8_t batteryPercent, float voltage, const char* reason) {
    if (settings == nullptr) {
        return;
    }

    const uint16_t wakeIntervalMinutes = settings->device.lowBatteryWakeIntervalMinutes;
    Serial.printf("[power] entering deep sleep reason=%s battery=%u%% voltage=%.3f wake_interval_min=%u\n",
                  reason,
                  static_cast<unsigned>(batteryPercent),
                  voltage,
                  static_cast<unsigned>(wakeIntervalMinutes));
    Serial.flush();

    if (audioPlayer != nullptr) {
        audioPlayer->stop();
    }
    if (displayManager != nullptr) {
        displayManager->powerOff();
    }

    delay(100);
    esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
    if (wakeIntervalMinutes > 0) {
        const uint64_t wakeIntervalUs = static_cast<uint64_t>(wakeIntervalMinutes) * 60ULL * 1000000ULL;
        esp_sleep_enable_timer_wakeup(wakeIntervalUs);
    }

    WiFi.disconnect(true, true);
    WiFi.mode(WIFI_OFF);
    delay(100);
    esp_deep_sleep_start();
}

void handleLowBatterySleepPolicy(const AppStateSnapshot& snapshot) {
    if (settings == nullptr || snapshot.ota.busy || !settings->device.lowBatterySleepEnabled) {
        if (settings == nullptr || !settings->device.lowBatterySleepEnabled) {
            wokeFromDeepSleep = false;
            lowBatteryWakeStartedAt = 0;
        }
        return;
    }

    const uint8_t batteryPercent = estimateBatteryPercent(snapshot.battery.voltage);
    const uint8_t thresholdPercent = settings->device.lowBatterySleepThresholdPercent;
    if (batteryPercent > thresholdPercent) {
        wokeFromDeepSleep = false;
        lowBatteryWakeStartedAt = 0;
        return;
    }

    if (wokeFromDeepSleep) {
        if (lowBatteryWakeStartedAt == 0) {
            lowBatteryWakeStartedAt = millis();
            Serial.printf("[power] low-battery wake window started battery=%u%% threshold=%u%%\n",
                          static_cast<unsigned>(batteryPercent),
                          static_cast<unsigned>(thresholdPercent));
        }
        if (millis() - lowBatteryWakeStartedAt < kLowBatteryWakeWindowMs) {
            return;
        }
        enterLowBatteryDeepSleep(batteryPercent, snapshot.battery.voltage, "wake window elapsed while battery still low");
        return;
    }

    enterLowBatteryDeepSleep(batteryPercent, snapshot.battery.voltage, "battery threshold reached");
}

void publishOtaStateIfNeeded(const AppStateSnapshot& snapshot) {
    if (mqttManager == nullptr || !mqttManager->isConnected()) {
        return;
    }

    const String otaSignature = String(snapshot.ota.busy ? '1' : '0') + "|" + snapshot.ota.latestVersion + "|" +
        snapshot.ota.lastResult + "|" + snapshot.ota.lastError + "|" + snapshot.ota.phase + "|" + snapshot.ota.progressPercent;
    if (otaSignature == lastPublishedOtaSignature) {
        return;
    }

    const unsigned long now = millis();
    if ((now - lastOtaMqttPublishAt) < 500UL && snapshot.ota.busy) {
        return;
    }

    lastPublishedOtaSignature = otaSignature;
    lastOtaMqttPublishAt = now;
    mqttManager->publishState();
}

void pumpOtaDisplayProgress() {
    if (appState == nullptr || displayManager == nullptr) {
        return;
    }
    const AppStateSnapshot snapshot = appState->snapshot();
    displayManager->loop(snapshot);
    publishOtaStateIfNeeded(snapshot);
}

bool initializeRuntimeObjects() {
    if (appState == nullptr) {
        appState = allocatePreferPsram<AppState>();
    }
    if (settingsManager == nullptr) {
        settingsManager = allocatePreferPsram<SettingsManager>();
    }
    if (settings == nullptr) {
        settings = allocatePreferPsram<SettingsBundle>();
    }
    if (wifiManager == nullptr) {
        wifiManager = allocatePreferPsram<WiFiManager>();
    }
    if (batteryMonitor == nullptr) {
        batteryMonitor = allocatePreferPsram<BatteryMonitor>();
    }
    if (displayManager == nullptr) {
        displayManager = allocatePreferPsram<DisplayManager>();
    }
    if (audioPlayer == nullptr) {
        audioPlayer = allocatePreferPsram<AudioPlayerType>();
    }
    if (otaManager == nullptr) {
        otaManager = allocatePreferPsram<OtaManager>();
    }
    if (mqttManager == nullptr) {
        mqttManager = allocatePreferPsram<MqttManager>();
    }
    if (webServer == nullptr) {
        webServer = allocatePreferPsram<WebServerManager>();
    }
    if (soundEffects == nullptr) {
        soundEffects = allocatePreferPsram<SoundEffectsManager>();
    }
    if (deferredActions == nullptr) {
        deferredActions = allocatePreferPsram<DeferredActions>();
    }

    return appState != nullptr && settingsManager != nullptr && settings != nullptr && wifiManager != nullptr &&
           batteryMonitor != nullptr && displayManager != nullptr && audioPlayer != nullptr && otaManager != nullptr &&
           mqttManager != nullptr && webServer != nullptr && soundEffects != nullptr && deferredActions != nullptr;
}

void applyRuntimeSettings() {
    applyStorageSettings(*settings);
    initializeButtons();
    appState->setDevice(settings->device.deviceName, settings->device.friendlyName, settings->usingSavedSettings);
    applyStatusLedPin(settings->device.statusLedPin);
    applyWapeTriggerPin(settings->oled.displayType == "wape" ? settings->oled.wapeTriggerPin : 0);
    wifiManager->applySettings(*settings);
    batteryMonitor->applySettings(settings->battery, settings->battery.adcPin);
    displayManager->applySettings(settings->oled);
    if (settings->audio.bclkPin != activeI2sBclkPin || settings->audio.wsPin != activeI2sWsPin || settings->audio.doutPin != activeI2sDoutPin) {
        if (audioPlayer->reconfigureOutputPins(settings->audio.bclkPin, settings->audio.wsPin, settings->audio.doutPin)) {
            activeI2sBclkPin = settings->audio.bclkPin;
            activeI2sWsPin = settings->audio.wsPin;
            activeI2sDoutPin = settings->audio.doutPin;
        }
    }
#if APP_AUDIO_DIAGNOSTIC_TEST
    audioPlayer->setDirectLibraryVolume(DefaultConfig::AUDIO_DIAGNOSTIC_LIBRARY_VOLUME);
#else
    const AppStateSnapshot snapshot = appState->snapshot();
    if (snapshot.playback.source == "effect-ambient") {
        runtimeAudio.ambientPreviousVolume = settings->device.savedVolumePercent;
        audioPlayer->setVolumePercent(ambientPlaybackVolumePercent());
        runtimeAudio.ambientVolumeApplied = true;
        runtimeAudio.effectVolumeApplied = false;
    } else if (snapshot.playback.source.startsWith("effect-")) {
        audioPlayer->setVolumePercent(effectVolumeForSource(snapshot.playback.source));
        runtimeAudio.effectVolumeApplied = true;
        runtimeAudio.ambientVolumeApplied = false;
    } else {
        audioPlayer->setVolumePercent(settings->device.savedVolumePercent);
        runtimeAudio.ambientVolumeApplied = false;
        runtimeAudio.effectVolumeApplied = false;
    }
#endif
    soundEffects->applySettings(*settings);
    mqttManager->applySettings(*settings);
    otaManager->applySettings(*settings);
    runtimeAudio.ambientEligibleAt = millis() + kAmbientResumeDelayMs;
    runtimeAudio.updateAvailableHandled = false;
    sampleSystemMetrics();

    // Repaint the current status immediately on the newly selected LED pin so
    // the pin change is visible right after Save Device Settings.
    writeStatusLed((wifiManager->isConnected() && mqttManager->isConnected()) ? true : ((millis() / 300UL) % 2) != 0);
}

bool saveSettingsFromJson(JsonVariantConst root, String& error) {
    SettingsBundle updated = *settings;
    if (!settingsManager->updateFromJson(updated, root, error)) {
        return false;
    }
    updated.usingSavedSettings = true;
    *settings = updated;
    appState->setDevice(settings->device.deviceName, settings->device.friendlyName, true);
    deferredActions->pendingSettings = updated;
    deferredActions->settingsApplyPending = true;
    return true;
}

bool playRequest(const String& url, const String& label, const String& type, const String& source, String& error, bool addToHistory) {
    StorageTarget storageTarget = StorageTarget::Flash;
    String storagePath;
    const bool storageReference = parseStorageFileReference(url, storageTarget, storagePath);
    String normalizedUrl;
    if (!storageReference) {
        normalizedUrl = PlaybackText::normalizeUrl(url);
        if (normalizedUrl.isEmpty()) {
            error = "URL is required";
            return false;
        }
    }
#if APP_AUDIO_DIAGNOSTIC_TEST
    if (source != "diagnostic-test") {
        error = "Diagnostic audio test build only plays the configured MAX98357A test stream.";
        return false;
    }
#endif
#ifdef APP_DISABLE_AUDIO
    error = "Audio disabled in diagnostic build";
    return false;
#endif
    deferredActions->playFromStorage = storageReference;
    deferredActions->playStorageTarget = storageTarget;
    deferredActions->playStoragePath = storagePath;
    deferredActions->playUrl = storageReference ? String(url) : normalizedUrl;
    deferredActions->playLabel = storageReference
        ? PlaybackText::normalizeTitle(label, storagePath)
        : PlaybackText::normalizeTitle(label, normalizedUrl);
    deferredActions->playType = type;
    deferredActions->playAddToHistory = addToHistory;
    if (!source.isEmpty()) {
        deferredActions->playSource = source;
    } else {
        deferredActions->playSource = type == "tts" ? "home-assistant" : "manual";
    }
    deferredActions->playPending = true;
    deferredActions->stopPending = false;
    return true;
}

void stopAlarmPlayback() {
    runtimeAudio.alarmActive = false;
    if (audioPlayer != nullptr && appState != nullptr) {
        const AppStateSnapshot snapshot = appState->snapshot();
        if (snapshot.playback.source == "effect-alarm") {
            audioPlayer->stop();
        }
    }
    scheduleAmbientResume();
}

void startAlarmPlayback() {
    runtimeAudio.alarmActive = true;
    restoreAmbientVolumeIfNeeded();
    if (audioPlayer != nullptr) {
        audioPlayer->stop();
    }
    if (!playConfiguredEffectSource("effect-alarm", "Alarm")) {
        runtimeAudio.alarmActive = false;
    }
}

void executePlaybackCommand(const PlaybackCommand& command);

bool payloadEnablesSwitch(const String& value, bool& enabled) {
    if (value.isEmpty()) {
        return false;
    }

    String normalized = value;
    normalized.trim();
    normalized.toLowerCase();

    if (normalized == "on" || normalized == "true" || normalized == "1" || normalized == "enable" || normalized == "enabled") {
        enabled = true;
        return true;
    }

    if (normalized == "off" || normalized == "false" || normalized == "0" || normalized == "disable" || normalized == "disabled") {
        enabled = false;
        return true;
    }

    return false;
}

void handleMqttCommand(const PlaybackCommand& command) {
    if (!command.skipNotificationCue &&
        !settings->effects.notificationFile.isEmpty() &&
        (command.action == "play" || command.action == "tts" || command.action == "alarm_start" || command.action == "ota_install" ||
         command.action == "ota_install_latest" || command.action == "ota_install_selected")) {
        runtimeAudio.pendingCommand = command;
        runtimeAudio.pendingCommand.skipNotificationCue = true;
        runtimeAudio.pendingCommandAfterNotification = playConfiguredEffectSource("effect-notification", "MQTT Notification");
        if (runtimeAudio.pendingCommandAfterNotification) {
            return;
        }
    }
    executePlaybackCommand(command);
}

void executePlaybackCommand(const PlaybackCommand& command) {
    if (command.action == "ota_check") {
        String error;
        if (otaManager != nullptr && otaManager->triggerReleaseRefresh(error)) {
            appState->setLastError("");
        } else {
            const String message = error.isEmpty() ? String("OTA release refresh request was rejected.") : error;
            if (otaManager != nullptr) {
                otaManager->reportError(message);
            }
            appState->setLastError(message);
        }
        mqttManager->publishState();
    } else if (command.action == "ota_select_version") {
        String error;
        if (otaManager != nullptr && otaManager->selectReleaseOption(command.label, error)) {
            appState->setLastError("");
        } else {
            const String message = error.isEmpty() ? String("OTA firmware selection was rejected.") : error;
            if (otaManager != nullptr) {
                otaManager->reportError(message);
            }
            appState->setLastError(message);
        }
        mqttManager->publishState();
    } else if (command.action == "ota_auto_update") {
        bool enabled = false;
        if (!payloadEnablesSwitch(command.payload, enabled)) {
            const String message = "OTA auto-update MQTT payload must be ON or OFF.";
            appState->setLastError(message);
            mqttManager->publishState();
            return;
        }

        deferredActions->pendingSettings = *settings;
        deferredActions->pendingSettings.ota.autoUpdate = enabled;
        if (enabled) {
            deferredActions->pendingSettings.ota.autoCheck = true;
        }
        deferredActions->settingsApplyPending = true;
        appState->setLastError("");
    } else if (command.action == "ota_install_latest") {
        if (otaManager != nullptr && otaManager->triggerCheck(true)) {
            appState->setLastError("");
        } else {
            const String message = "OTA install request was rejected.";
            if (otaManager != nullptr) {
                otaManager->reportError(message);
            }
            appState->setLastError(message);
        }
        mqttManager->publishState();
    } else if (command.action == "ota_install_selected") {
        String error;
        if (otaManager != nullptr && otaManager->triggerInstallSelected(error)) {
            appState->setLastError("");
        } else {
            const String message = error.isEmpty() ? String("OTA install request was rejected.") : error;
            if (otaManager != nullptr) {
                otaManager->reportError(message);
            }
            appState->setLastError(message);
        }
        mqttManager->publishState();
    } else if (command.action == "ota_install") {
        String error;
        if (otaManager != nullptr && otaManager->triggerInstallVersion(command.version, command.assetName, error)) {
            appState->setLastError("");
        } else {
            const String message = error.isEmpty() ? String("OTA install request was rejected.") : error;
            if (otaManager != nullptr) {
                otaManager->reportError(message);
            }
            appState->setLastError(message);
        }
        mqttManager->publishState();
    } else if (command.action == "alarm_start") {
        startAlarmPlayback();
        mqttManager->publishState();
    } else if (command.action == "alarm_stop") {
        stopAlarmPlayback();
        mqttManager->publishState();
    } else if (command.action == "notify") {
        if (!tryOverlayConfiguredEffect(settings->effects.notificationFile, 35, effectVolumeForSource("effect-notification"))) {
            playConfiguredEffectSource("effect-notification", command.payload.isEmpty() ? "MQTT Notification" : command.payload);
        }
    } else if (command.action == "reboot") {
        appState->setLastError("");
        requestRestartSequence("mqtt", false);
        mqttManager->publishState();
    } else if (command.action == "web_ui_lock") {
        if (webServer != nullptr) {
            webServer->setWebUiLocked(true);
        }
        appState->setLastError("Web UI locked. Send MQTT payload 'unlock' to <baseTopic>/cmd/web_ui to restore access.");
        mqttManager->publishState();
    } else if (command.action == "web_ui_unlock") {
        if (webServer != nullptr) {
            webServer->setWebUiLocked(false);
        }
        appState->setLastError("");
        mqttManager->publishState();
    } else if (command.action == "stop" || command.action == "pause") {
        stopAlarmPlayback();
        audioPlayer->stop();
        mqttManager->publishState();
    } else if (command.action == "display_trigger") {
        triggerWapeDisplay();
    } else if (command.action == "volume") {
        settings->device.savedVolumePercent = command.volumePercent;
        audioPlayer->setVolumePercent(command.volumePercent);
        soundEffects->setVolumePercent(command.volumePercent);
        deferredActions->pendingVolume = command.volumePercent;
        deferredActions->volumePending = false;
        deferredActions->volumeSavePending = true;
        deferredActions->volumeSaveAt = millis() + kVolumePersistDelayMs;
        mqttManager->publishState();
    } else if (command.action == "play" && command.url.isEmpty()) {
        // Home Assistant media-source flows can emit a bare play command before
        // the real playmedia payload arrives. Replaying the current URL here
        // causes the previous source to start briefly and then switch.
        return;
    } else if (command.action == "playpause") {
        const AppStateSnapshot snapshot = appState->snapshot();
        if (snapshot.playback.state == "playing" || snapshot.playback.state == "buffering") {
            audioPlayer->stop();
            mqttManager->publishState();
        } else if (!snapshot.playback.url.isEmpty()) {
            String ignored;
            playRequest(snapshot.playback.url, snapshot.playback.title, snapshot.playback.type, snapshot.playback.source, ignored, true);
        }
    } else if (command.action == "next") {
        stepPlaybackHistory(1);
    } else if (command.action == "previous") {
        stepPlaybackHistory(-1);
    } else {
        runtimeAudio.alarmActive = false;
        restoreAmbientVolumeIfNeeded();
        scheduleAmbientResume();
        String ignored;
        playRequest(command.url, command.label, command.mediaType.isEmpty() ? command.action : command.mediaType, command.source, ignored, true);
    }
}

void processDeferredActions() {
    if (deferredActions == nullptr) {
        return;
    }

    if (deferredActions->settingsApplyPending) {
        flushPendingSettingsNow();
    }

    if (deferredActions->mqttConnectionChangePending) {
        String error;
        if (deferredActions->mqttConnectRequested) {
            if (!mqttManager->requestConnect(error) && appState != nullptr && !error.isEmpty()) {
                appState->setLastError(error);
            }
        } else {
            mqttManager->requestDisconnect(error);
        }
        deferredActions->mqttConnectionChangePending = false;
    }

    if (deferredActions->stopPending) {
        audioPlayer->stop();
        deferredActions->stopPending = false;
        mqttManager->publishState();
    }

    if (deferredActions->volumePending) {
        settings->device.savedVolumePercent = deferredActions->pendingVolume;
        audioPlayer->setVolumePercent(deferredActions->pendingVolume);
        soundEffects->setVolumePercent(deferredActions->pendingVolume);
        deferredActions->volumePending = false;
        deferredActions->volumeSavePending = true;
        deferredActions->volumeSaveAt = millis() + kVolumePersistDelayMs;
        mqttManager->publishState();
    }

    if (deferredActions->volumeSavePending && static_cast<long>(millis() - deferredActions->volumeSaveAt) >= 0) {
        settingsManager->save(*settings);
        deferredActions->volumeSavePending = false;
    }

    if (deferredActions->playPending) {
        if (deferredActions->playSource != "effect-ambient") {
            restoreAmbientVolumeIfNeeded();
        }
        if (deferredActions->playFromStorage) {
            audioPlayer->playStorageFile(
                deferredActions->playStorageTarget,
                deferredActions->playStoragePath,
                deferredActions->playLabel,
                deferredActions->playType,
                deferredActions->playSource);
        } else {
            audioPlayer->play(
                deferredActions->playUrl,
                deferredActions->playLabel,
                deferredActions->playType,
                deferredActions->playSource);
        }
        if (deferredActions->playAddToHistory) {
            rememberPlaybackSelection(
                deferredActions->playUrl,
                deferredActions->playLabel,
                deferredActions->playType,
                deferredActions->playSource);
        }
        deferredActions->playPending = false;
        mqttManager->publishState();
    }
}

}  // namespace

void setup() {
    Serial.begin(115200);
    waitForSerialConsole();
    delay(200);
    beginSystemMetrics();

    const esp_reset_reason_t resetReason = esp_reset_reason();
    loadRollbackState();
    wokeFromDeepSleep = resetReason == ESP_RST_DEEPSLEEP;
    Serial.printf("\n[boot] app=%s version=%s built=%s\n", APP_NAME, APP_VERSION, APP_BUILD_DATE);
    Serial.printf("[boot] reset reason=%s (%d)\n", resetReasonToString(resetReason), static_cast<int>(resetReason));
    if (!lastRolledBackVersion.isEmpty()) {
        Serial.printf("[rollback] previous OTA rollback detected: version=%s reason=%s\n", lastRolledBackVersion.c_str(), lastRollbackReason.c_str());
    }
    if (otaPendingVerification) {
        Serial.printf("[rollback] running pending-verify image %s\n", otaPendingVersion.c_str());
    }
    Serial.flush();

    if (!initializeRuntimeObjects()) {
        Serial.println("[boot] failed to construct runtime objects");
        Serial.flush();
        if (otaPendingVerification) {
            rollbackAndReboot("Runtime objects failed to initialize during OTA health check.");
        }
        delay(1000);
        ESP.restart();
    }

    if (!appState->begin()) {
        Serial.println("[boot] failed to initialize app state mutex");
        Serial.flush();
    }

    settingsManager->begin();
    *settings = settingsManager->load();
    beginStorageBackends(*settings);
    activeStatusLedPin = settings->device.statusLedPin;
    activeWapeTriggerPin = settings->oled.displayType == "wape" ? settings->oled.wapeTriggerPin : 0;

    initializeButtons();

    initializeStatusLed();
    writeStatusLed(false);
    initializeWapeTriggerPin();

    displayManager->begin(settings->oled);
    displayManager->setBootMessage("Booting");

    appState->setDevice(settings->device.deviceName, settings->device.friendlyName, settings->usingSavedSettings);

    wifiManager->begin(*settings, *appState);

    batteryMonitor->begin(settings->battery, settings->battery.adcPin, *appState);

    activeI2sBclkPin = settings->audio.bclkPin;
    activeI2sWsPin = settings->audio.wsPin;
    activeI2sDoutPin = settings->audio.doutPin;
    audioPlayer->begin(activeI2sBclkPin, activeI2sWsPin, activeI2sDoutPin, settings->device.savedVolumePercent, *appState);
#if APP_AUDIO_DIAGNOSTIC_TEST
    audioPlayer->setDirectLibraryVolume(DefaultConfig::AUDIO_DIAGNOSTIC_LIBRARY_VOLUME);
    Serial.printf("[audio-test] build enabled, waiting for Wi-Fi to start %s at library volume %u using BCLK=%u WS=%u DOUT=%u\n",
                  DefaultConfig::AUDIO_DIAGNOSTIC_STREAM_URL,
                  static_cast<unsigned>(DefaultConfig::AUDIO_DIAGNOSTIC_LIBRARY_VOLUME),
                  static_cast<unsigned>(activeI2sBclkPin),
                  static_cast<unsigned>(activeI2sWsPin),
                  static_cast<unsigned>(activeI2sDoutPin));
#endif

    soundEffects->begin(*settings);
    otaManager->begin(*settings, *appState);
    otaManager->setRestartHandler(handleOtaRestartRequest);
    refreshRollbackStateInOtaManager();
    otaManager->setProgressCallback(pumpOtaDisplayProgress);

    mqttManager->begin(*settings, *appState, *wifiManager, *otaManager, handleMqttCommand);

    webServer->begin(
        *appState,
        *wifiManager,
        *settingsManager,
        *otaManager,
        []() { return *settings; },
        saveSettingsFromJson,
        [](const String& url, const String& label, const String& type, String& error) {
            const bool effectSelection = type.startsWith("effect-");
            const bool addToHistory = !effectSelection;
            const String source = effectSelection ? type : String("");
            const String normalizedType = effectSelection ? String("effect") : type;
            return playRequest(url, label, normalizedType, source, error, addToHistory);
        },
        []() {
            deferredActions->stopPending = true;
            deferredActions->playPending = false;
        },
        [](uint8_t volume) {
            deferredActions->pendingVolume = volume;
            deferredActions->volumePending = true;
        },
        [](bool apply) { return otaManager->triggerCheck(apply); },
        [](const String& action, String& error) {
            if (action == "rediscover") {
                return mqttManager->requestRediscovery(error);
            }

            const bool connect = action != "disconnect";
            if (connect) {
                const String host = deferredActions->settingsApplyPending
                    ? deferredActions->pendingSettings.mqtt.host
                    : settings->mqtt.host;
                if (host.isEmpty()) {
                    error = "Enter an MQTT host first.";
                    return false;
                }
            }
            deferredActions->mqttConnectRequested = connect;
            deferredActions->mqttConnectionChangePending = true;
            error = "";
            return true;
        },
        []() { triggerWapeDisplay(); },
        []() {
            if (webServer != nullptr) {
                webServer->setWebUiLocked(true);
            }
            requestWebUiLockSequence();
        },
        []() { requestRestartSequence("manual", false); },
        []() { requestRestartSequence("factory_reset", true); });

    displayManager->setBootMessage("Idle");
#if !APP_AUDIO_DIAGNOSTIC_TEST
    playConfiguredEffectSource("effect-startup", "Startup");
#endif
    runtimeAudio.ambientEligibleAt = millis() + kAmbientResumeDelayMs;
    runtimeAudio.bootUpdateCheckQueued = settings->ota.autoCheck || settings->ota.autoUpdate;
    if (settings->oled.displayType == "wape" && settings->oled.wapeTriggerEvent == "device_start") {
        requestWapeTriggerPulse();
    }
}

namespace {
void flushPendingSettingsNow() {
    if (deferredActions == nullptr || !deferredActions->settingsApplyPending) {
        return;
    }
    settingsManager->save(deferredActions->pendingSettings);
    *settings = settingsManager->load();
    applyRuntimeSettings();
    deferredActions->settingsApplyPending = false;
    mqttManager->publishState();
}
}

void processSoundEffectTransitions(const AppStateSnapshot& snapshot) {
#if APP_AUDIO_DIAGNOSTIC_TEST
    (void)snapshot;
    return;
#endif
    if (soundEffects == nullptr || settings == nullptr) {
        return;
    }

    const bool nowPlaying = snapshot.playback.state == "playing" || snapshot.playback.state == "buffering";
    const bool wasPlaying = previousPlaybackState == "playing" || previousPlaybackState == "buffering";
    const bool playbackStopped = wasPlaying && !nowPlaying;
    const bool playbackStarted = !wasPlaying && nowPlaying;

    if (!transitionStateInitialized) {
        previousWifiConnected = snapshot.network.wifiConnected;
        previousMqttConnected = snapshot.network.mqttConnected;
        previousPlaybackState = snapshot.playback.state;
        previousPlaybackSource = snapshot.playback.source;
        previousCharging = snapshot.battery.charging;
        transitionStateInitialized = true;
        return;
    }

    if (!previousWifiConnected && snapshot.network.wifiConnected) {
        soundEffects->playWifiConnected();
    } else if (previousWifiConnected && !snapshot.network.wifiConnected) {
        soundEffects->playWifiDisconnected();
    }

    if (!previousMqttConnected && snapshot.network.mqttConnected) {
        soundEffects->playMqttConnected();
    }

    if (playbackStarted) {
        soundEffects->playPlaybackStart();
        if (snapshot.playback.source != "effect-ambient") {
            scheduleAmbientResume();
        }
        if (settings != nullptr && settings->oled.wapeTriggerEvent == "play_start") {
            requestWapeTriggerPulse();
        }
    } else if (playbackStopped) {
        soundEffects->playPlaybackStop();
    }

    if (playbackStopped) {
        restoreEffectVolumeIfNeeded();
        if (runtimeAudio.pendingCommandAfterNotification) {
            runtimeAudio.pendingCommandAfterNotification = false;
            executePlaybackCommand(runtimeAudio.pendingCommand);
        } else if (runtimeAudio.pendingAutoUpdateInstall) {
            runtimeAudio.pendingAutoUpdateInstall = false;
            String error;
            if (otaManager != nullptr && !snapshot.ota.latestVersion.isEmpty()) {
                otaManager->triggerInstallVersion(snapshot.ota.latestVersion, error);
            }
        } else if (runtimeAudio.restartPending) {
            if (previousPlaybackSource == "effect-update-success") {
                if (!playConfiguredEffectSource("effect-shutdown", "Restarting")) {
                    if (runtimeAudio.restartFactoryReset) {
                        factoryResetRequested = true;
                    }
                    runtimeAudio.restartPending = false;
                    runtimeAudio.restartForcePending = false;
                    scheduleReboot(250);
                }
            } else if (previousPlaybackSource == "effect-shutdown") {
                if (runtimeAudio.restartFactoryReset) {
                    factoryResetRequested = true;
                }
                runtimeAudio.restartPending = false;
                runtimeAudio.restartForcePending = false;
                scheduleReboot(250);
            }
        } else if (runtimeAudio.webUiLockPending && previousPlaybackSource == "effect-shutdown") {
            runtimeAudio.webUiLockPending = false;
            applyWebUiLockNow();
        } else if (runtimeAudio.alarmActive && previousPlaybackSource == "effect-alarm") {
            playConfiguredEffectSource("effect-alarm", "Alarm");
        } else if (previousPlaybackSource == "effect-ambient") {
            restoreAmbientVolumeIfNeeded();
            if (!runtimeAudio.alarmActive) {
                runtimeAudio.ambientPreviousVolume = settings->device.savedVolumePercent;
                audioPlayer->setVolumePercent(ambientPlaybackVolumePercent());
                runtimeAudio.ambientVolumeApplied = true;
                if (!playConfiguredEffectSource("effect-ambient", "Ambient Sound")) {
                    restoreAmbientVolumeIfNeeded();
                    scheduleAmbientResume(kAmbientResumeDelayMs);
                }
            }
        } else if (previousPlaybackSource == "effect-low-battery") {
            runtimeAudio.lowBatteryCueActive = false;
        }
    }

    if (!runtimeAudio.updateAvailableHandled && snapshot.ota.updateAvailable && !snapshot.ota.latestVersion.isEmpty()) {
        runtimeAudio.updateAvailableHandled = true;
        runtimeAudio.pendingAutoUpdateInstall = settings->ota.autoUpdate;
        const bool playedUpdateAvailableCue =
            tryOverlayConfiguredEffect(settings->effects.updateAvailableFile, 40, effectVolumeForSource("effect-update-available")) ||
            playConfiguredEffectSource("effect-update-available", "Update Available");
        if (!playedUpdateAvailableCue && runtimeAudio.pendingAutoUpdateInstall) {
            runtimeAudio.pendingAutoUpdateInstall = false;
            String error;
            if (otaManager != nullptr) {
                otaManager->triggerInstallVersion(snapshot.ota.latestVersion, error);
            }
        }
    } else if (!snapshot.ota.updateAvailable) {
        runtimeAudio.updateAvailableHandled = false;
    }

    if (!previousCharging && snapshot.battery.charging) {
        if (settings != nullptr && settings->oled.wapeTriggerEvent == "charging_start") {
            requestWapeTriggerPulse();
        }
    }

    previousWifiConnected = snapshot.network.wifiConnected;
    previousMqttConnected = snapshot.network.mqttConnected;
    previousPlaybackState = snapshot.playback.state;
    previousPlaybackSource = snapshot.playback.source;
    previousCharging = snapshot.battery.charging;
}

void serviceRuntimeAudioAutomation(const AppStateSnapshot& snapshot) {
    if (settings == nullptr) {
        return;
    }

    if (audioPlayer != nullptr && audioPlayer->consumeOverlayFinished() && runtimeAudio.pendingAutoUpdateInstall) {
        runtimeAudio.pendingAutoUpdateInstall = false;
        String error;
        if (otaManager != nullptr && !snapshot.ota.latestVersion.isEmpty()) {
            otaManager->triggerInstallVersion(snapshot.ota.latestVersion, error);
        }
    }

    if (runtimeAudio.bootUpdateCheckQueued && wifiManager != nullptr && wifiManager->isConnected() && otaManager != nullptr && !snapshot.ota.busy) {
        runtimeAudio.bootUpdateCheckQueued = false;
        otaManager->triggerCheck(false);
    }

    const uint8_t batteryPercent = estimateBatteryPercent(snapshot.battery.voltage);
    if (batteryPercent > settings->device.lowBatterySleepThresholdPercent) {
        runtimeAudio.lowBatteryCueActive = false;
    } else if (!runtimeAudio.lowBatteryCueActive && !settings->effects.lowBatteryFile.isEmpty() && !runtimeAudio.alarmActive && !runtimeAudio.restartPending) {
        runtimeAudio.lowBatteryCueActive =
            tryOverlayConfiguredEffect(settings->effects.lowBatteryFile, 40, effectVolumeForSource("effect-low-battery")) ||
            playConfiguredEffectSource("effect-low-battery", "Low Battery");
    }

    if (snapshot.playback.source != "effect-ambient") {
        startAmbientIfEligible(snapshot);
    }

    if (runtimeAudio.restartForcePending && static_cast<long>(millis() - runtimeAudio.restartForceAt) >= 0) {
        runtimeAudio.restartForcePending = false;
        runtimeAudio.restartPending = false;
        if (runtimeAudio.restartFactoryReset) {
            factoryResetRequested = true;
        }
        scheduleReboot(250);
    }
}

void serviceAudioDiagnosticTest() {
#if !APP_AUDIO_DIAGNOSTIC_TEST
    return;
#else
    static bool diagnosticAudioStartQueued = false;
    static unsigned long diagnosticAudioRetryAt = 0;

    if (appState == nullptr || audioPlayer == nullptr || wifiManager == nullptr) {
        return;
    }

    if (!wifiManager->isConnected()) {
        diagnosticAudioStartQueued = false;
        diagnosticAudioRetryAt = 0;
        return;
    }

    const AppStateSnapshot snapshot = appState->snapshot();
    if (snapshot.playback.state == "playing" || snapshot.playback.state == "buffering") {
        diagnosticAudioStartQueued = true;
        return;
    }

    if (diagnosticAudioRetryAt != 0 && static_cast<long>(millis() - diagnosticAudioRetryAt) < 0) {
        return;
    }

    audioPlayer->setDirectLibraryVolume(DefaultConfig::AUDIO_DIAGNOSTIC_LIBRARY_VOLUME);
    const AudioPlayer::DiagnosticsSnapshot diagnostics = audioPlayer->diagnostics();
    Serial.printf("[audio-test] init driver=ESP32-audioI2S fmt=std-i2s preferred_rate=%lu stereo=%s bclk=%u ws=%u dout=%u lib_volume=%u url=%s\n",
                  static_cast<unsigned long>(diagnostics.requestedSampleRateHz),
                  diagnostics.stereoEnabled ? "on" : "off",
                  static_cast<unsigned>(activeI2sBclkPin),
                  static_cast<unsigned>(activeI2sWsPin),
                  static_cast<unsigned>(activeI2sDoutPin),
                  static_cast<unsigned>(DefaultConfig::AUDIO_DIAGNOSTIC_LIBRARY_VOLUME),
                  DefaultConfig::AUDIO_DIAGNOSTIC_STREAM_URL);

    if (audioPlayer->play(DefaultConfig::AUDIO_DIAGNOSTIC_STREAM_URL, "MAX98357A Test Stream", "stream", "diagnostic-test")) {
        diagnosticAudioStartQueued = true;
        diagnosticAudioRetryAt = 0;
        return;
    }

    diagnosticAudioRetryAt = millis() + 5000UL;
    Serial.println("[audio-test] playback start failed, retrying in 5s");
#endif
}

void loop() {
    if (appState == nullptr || settingsManager == nullptr || wifiManager == nullptr || batteryMonitor == nullptr ||
        displayManager == nullptr || audioPlayer == nullptr || otaManager == nullptr || mqttManager == nullptr ||
        webServer == nullptr) {
        delay(100);
        return;
    }

    processDeferredActions();
    serviceWapeTriggerPulse();
    pollPhysicalButtons();
    wifiManager->loop();
    serviceAudioDiagnosticTest();
    audioPlayer->loop();
    pollStorageBackends();
    const bool batteryUpdated = batteryMonitor->loop(isBatterySamplingAllowed());
    otaManager->loop();
    mqttManager->loop();

    const AppStateSnapshot snapshot = appState->snapshot();
    processSoundEffectTransitions(snapshot);
    serviceRuntimeAudioAutomation(snapshot);
    displayManager->loop(snapshot);
    handleLowBatterySleepPolicy(snapshot);
    confirmOtaHealthIfReady();

    publishOtaStateIfNeeded(snapshot);

    if (millis() - lastHeapUpdateAt > 2000UL) {
        lastHeapUpdateAt = millis();
        sampleSystemMetrics();
        appState->setFreeHeap(getSystemMetricsSnapshot().freeHeapBytes);
        writeStatusLed((wifiManager->isConnected() && mqttManager->isConnected()) ? true : ((millis() / 300UL) % 2) != 0);
    }

    if (batteryUpdated) {
        const BatteryReading reading = batteryMonitor->latest();
        mqttManager->publishBattery(reading.filteredVoltage, reading.rawAdcVoltage, reading.rawAdc, reading.charging);
        mqttManager->publishState();
    }

    if (factoryResetRequested) {
        settingsManager->reset();
        factoryResetRequested = false;
    }

    if (!recoveryRebootScheduled && wifiManager->shouldRebootForRecovery()) {
        recoveryRebootScheduled = true;
        Serial.printf("[recovery] scheduling reboot after %u failed Wi-Fi attempts\n",
                      static_cast<unsigned>(wifiManager->consecutiveFailureCount()));
        Serial.flush();
        requestRestartSequence("wifi_recovery", false);
    }

    if (!recoveryRebootScheduled && mqttManager->shouldRebootForRecovery()) {
        recoveryRebootScheduled = true;
        Serial.printf("[recovery] scheduling reboot after %u failed MQTT attempts\n",
                      static_cast<unsigned>(mqttManager->consecutiveFailureCount()));
        Serial.flush();
        requestRestartSequence("mqtt_recovery", false);
    }

    if (rebootRequested && static_cast<long>(millis() - rebootAt) >= 0) {
        ESP.restart();
    }
}

#endif
