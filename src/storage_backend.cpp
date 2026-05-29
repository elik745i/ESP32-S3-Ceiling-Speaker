#include "storage_backend.h"

#include <LittleFS.h>
#include <SD.h>
#include <SPI.h>
#include <esp_partition.h>

namespace {
constexpr uint32_t kSdFrequenciesHz[] = {1000000UL, 400000UL, 4000000UL, 10000000UL};
constexpr unsigned long kSdHotplugPollIntervalMs = 2000UL;

bool flashMounted = false;
bool sdMounted = false;
bool sdSpiStarted = false;
unsigned long lastSdHotplugPollAt = 0;
SdSettings activeSdSettings;

#if defined(CONFIG_IDF_TARGET_ESP32S3)
SPIClass sdSpi(FSPI);
#else
SPIClass sdSpi(HSPI);
#endif

bool sameSdSettings(const SdSettings& left, const SdSettings& right) {
    return left.enabled == right.enabled && left.csPin == right.csPin && left.sckPin == right.sckPin &&
        left.mosiPin == right.mosiPin && left.misoPin == right.misoPin;
}

bool sdSettingsUsePin(const SdSettings& settings, uint8_t pin) {
    if (!settings.enabled) {
        return false;
    }
    return settings.csPin == pin || settings.sckPin == pin || settings.mosiPin == pin || settings.misoPin == pin;
}

bool sdFilesystemHealthy() {
    if (!sdMounted) {
        return false;
    }

    const uint64_t cardBytes = SD.cardSize();
    const size_t totalBytes = SD.totalBytes();
    if (cardBytes == 0 || totalBytes == 0) {
        return false;
    }

    File root = SD.open("/");
    const bool healthy = root && root.isDirectory();
    if (root) {
        root.close();
    }
    return healthy;
}

const esp_partition_t* flashFilesystemPartition() {
    return esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_SPIFFS, nullptr);
}

void mountFlashStorage() {
    if (flashFilesystemPartition() == nullptr) {
        flashMounted = false;
        Serial.println("[storage] Flash filesystem disabled by partition table");
        return;
    }

    flashMounted = LittleFS.begin(false);
    if (!flashMounted) {
        Serial.println("[storage] LittleFS mount failed, attempting format");
        flashMounted = LittleFS.begin(true);
    }

    if (flashMounted) {
        Serial.printf("[storage] LittleFS mounted total=%u used=%u\n",
                      static_cast<unsigned>(LittleFS.totalBytes()),
                      static_cast<unsigned>(LittleFS.usedBytes()));
    } else {
        Serial.println("[storage] LittleFS mount failed");
    }
}

void unmountSdStorage() {
    if (sdMounted) {
        SD.end();
        sdMounted = false;
    }
    if (sdSpiStarted) {
        sdSpi.end();
        sdSpiStarted = false;
    }
}

void mountSdStorage(const SdSettings& settings) {
    unmountSdStorage();
    activeSdSettings = settings;
    lastSdHotplugPollAt = millis();

    if (!settings.enabled) {
        return;
    }

    pinMode(settings.csPin, OUTPUT);
    digitalWrite(settings.csPin, HIGH);
    sdSpi.begin(settings.sckPin, settings.misoPin, settings.mosiPin, settings.csPin);
    sdSpiStarted = true;

    for (const uint32_t frequencyHz : kSdFrequenciesHz) {
        if (!SD.begin(settings.csPin, sdSpi, frequencyHz, "/sd", 5, false)) {
            Serial.printf("[storage] SD begin failed cs=%u sck=%u mosi=%u miso=%u freq=%lu\n",
                          static_cast<unsigned>(settings.csPin),
                          static_cast<unsigned>(settings.sckPin),
                          static_cast<unsigned>(settings.mosiPin),
                          static_cast<unsigned>(settings.misoPin),
                          static_cast<unsigned long>(frequencyHz));
            continue;
        }

        const uint64_t cardBytes = SD.cardSize();
        const size_t totalBytes = SD.totalBytes();
        if (cardBytes == 0 || totalBytes == 0) {
            Serial.printf("[storage] SD detected but filesystem unavailable cs=%u sck=%u mosi=%u miso=%u freq=%lu card=%llu total=%u\n",
                          static_cast<unsigned>(settings.csPin),
                          static_cast<unsigned>(settings.sckPin),
                          static_cast<unsigned>(settings.mosiPin),
                          static_cast<unsigned>(settings.misoPin),
                          static_cast<unsigned long>(frequencyHz),
                          static_cast<unsigned long long>(cardBytes),
                          static_cast<unsigned>(totalBytes));
            SD.end();
            continue;
        }

        sdMounted = true;
        Serial.printf("[storage] SD mounted cs=%u sck=%u mosi=%u miso=%u freq=%lu total=%u used=%u\n",
                      static_cast<unsigned>(settings.csPin),
                      static_cast<unsigned>(settings.sckPin),
                      static_cast<unsigned>(settings.mosiPin),
                      static_cast<unsigned>(settings.misoPin),
                      static_cast<unsigned long>(frequencyHz),
                      static_cast<unsigned>(totalBytes),
                      static_cast<unsigned>(SD.usedBytes()));
        break;
    }

    if (!sdMounted) {
        Serial.printf("[storage] SD mount failed cs=%u sck=%u mosi=%u miso=%u\n",
                      static_cast<unsigned>(settings.csPin),
                      static_cast<unsigned>(settings.sckPin),
                      static_cast<unsigned>(settings.mosiPin),
                      static_cast<unsigned>(settings.misoPin));
    }
}
}  // namespace

void beginStorageBackends(const SettingsBundle& settings) {
    mountFlashStorage();
    mountSdStorage(settings.sd);
}

void applyStorageSettings(const SettingsBundle& settings) {
    if (!flashMounted) {
        mountFlashStorage();
    }
    if (!sameSdSettings(activeSdSettings, settings.sd)) {
        mountSdStorage(settings.sd);
    } else if (settings.sd.enabled && !sdMounted) {
        mountSdStorage(settings.sd);
    }
}

void pollStorageBackends() {
    if (!activeSdSettings.enabled) {
        return;
    }

    const unsigned long now = millis();
    if (static_cast<unsigned long>(now - lastSdHotplugPollAt) < kSdHotplugPollIntervalMs) {
        return;
    }
    lastSdHotplugPollAt = now;

    if (sdMounted) {
        if (!sdFilesystemHealthy()) {
            Serial.println("[storage] SD card removed or became unavailable");
            unmountSdStorage();
        }
        return;
    }

    mountSdStorage(activeSdSettings);
}

StorageTarget parseStorageTarget(const String& rawTarget) {
    String target = rawTarget;
    target.trim();
    target.toLowerCase();
    return target == "sd" ? StorageTarget::Sd : StorageTarget::Flash;
}

const char* storageTargetId(StorageTarget target) {
    return target == StorageTarget::Sd ? "sd" : "flash";
}

const char* storageTargetLabel(StorageTarget target) {
    return target == StorageTarget::Sd ? "SD card" : "Flash filesystem";
}

StorageBackendSummary getStorageSummary(StorageTarget target) {
    StorageBackendSummary summary;

    if (target == StorageTarget::Flash) {
        const esp_partition_t* partition = flashFilesystemPartition();
        summary.available = partition != nullptr;
        summary.totalBytes = partition != nullptr ? static_cast<uint32_t>(partition->size) : 0;
        summary.freeBytes = summary.totalBytes;

        const size_t mountedTotal = LittleFS.totalBytes();
        if (mountedTotal > 0) {
            summary.mounted = true;
            summary.totalBytes = static_cast<uint32_t>(mountedTotal);
            summary.usedBytes = static_cast<uint32_t>(LittleFS.usedBytes());
            summary.freeBytes = summary.totalBytes > summary.usedBytes ? summary.totalBytes - summary.usedBytes : 0;
        }
        return summary;
    }

    summary.available = activeSdSettings.enabled;
    if (!sdMounted) {
        return summary;
    }

    summary.mounted = true;
    summary.totalBytes = static_cast<uint32_t>(SD.totalBytes());
    summary.usedBytes = static_cast<uint32_t>(SD.usedBytes());
    summary.freeBytes = summary.totalBytes > summary.usedBytes ? summary.totalBytes - summary.usedBytes : 0;
    return summary;
}

fs::FS* getStorageFs(StorageTarget target) {
    if (target == StorageTarget::Sd) {
        return sdMounted ? static_cast<fs::FS*>(&SD) : nullptr;
    }
    return LittleFS.totalBytes() > 0 ? static_cast<fs::FS*>(&LittleFS) : nullptr;
}

bool storageMounted(StorageTarget target) {
    return getStorageSummary(target).mounted;
}

bool storageConfigured(StorageTarget target) {
    return target == StorageTarget::Sd ? activeSdSettings.enabled : flashFilesystemPartition() != nullptr;
}

bool storageExists(StorageTarget target, const String& path) {
    fs::FS* fs = getStorageFs(target);
    return fs != nullptr && fs->exists(path);
}

File storageOpen(StorageTarget target, const String& path, const char* mode) {
    fs::FS* fs = getStorageFs(target);
    if (fs == nullptr) {
        return File();
    }
    return fs->open(path, mode);
}

bool storageRemove(StorageTarget target, const String& path) {
    fs::FS* fs = getStorageFs(target);
    return fs != nullptr && fs->remove(path);
}

bool sdStorageUsesPin(uint8_t pin) {
    return sdSettingsUsePin(activeSdSettings, pin);
}