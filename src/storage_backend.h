#pragma once

#include <Arduino.h>
#include <FS.h>

#include "settings_schema.h"

enum class StorageTarget {
    Flash,
    Sd,
};

struct StorageBackendSummary {
    bool available = false;
    bool mounted = false;
    uint32_t totalBytes = 0;
    uint32_t usedBytes = 0;
    uint32_t freeBytes = 0;
};

void beginStorageBackends(const SettingsBundle& settings);
void applyStorageSettings(const SettingsBundle& settings);
void pollStorageBackends();
StorageTarget parseStorageTarget(const String& rawTarget);
const char* storageTargetId(StorageTarget target);
const char* storageTargetLabel(StorageTarget target);
StorageBackendSummary getStorageSummary(StorageTarget target);
fs::FS* getStorageFs(StorageTarget target);
bool storageMounted(StorageTarget target);
bool storageConfigured(StorageTarget target);
bool storageExists(StorageTarget target, const String& path);
File storageOpen(StorageTarget target, const String& path, const char* mode = "r");
bool storageRemove(StorageTarget target, const String& path);
bool sdStorageUsesPin(uint8_t pin);