#include "system_metrics.h"

#include <esp_heap_caps.h>
#include <esp_ota_ops.h>

#include "storage_backend.h"

#if __has_include(<esp_freertos_hooks.h>)
#include <esp_freertos_hooks.h>
#define APP_HAS_FREERTOS_IDLE_HOOKS 1
#else
#define APP_HAS_FREERTOS_IDLE_HOOKS 0
#endif

namespace {
SystemMetricsSnapshot metricsSnapshot;
bool metricsInitialized = false;
uint32_t lastIdleCounts[portNUM_PROCESSORS] = {0};
uint32_t peakIdleDeltas[portNUM_PROCESSORS] = {1};
volatile uint32_t idleCounts[portNUM_PROCESSORS] = {0};

#ifndef APP_BOARD_PROFILE
#define APP_BOARD_PROFILE ""
#endif

#if APP_HAS_FREERTOS_IDLE_HOOKS
bool idleHookCpu0() {
    ++idleCounts[0];
    return false;
}

#if portNUM_PROCESSORS > 1
bool idleHookCpu1() {
    ++idleCounts[1];
    return false;
}
#endif
#endif

uint64_t clampUsedBytes(uint64_t totalBytes, uint64_t freeBytes) {
    return totalBytes > freeBytes ? totalBytes - freeBytes : 0;
}

uint8_t approximateCpuLoadPercent() {
    uint32_t totalIdlePercent = 0;
    for (size_t cpuIndex = 0; cpuIndex < portNUM_PROCESSORS; ++cpuIndex) {
        const uint32_t currentIdleCount = idleCounts[cpuIndex];
        const uint32_t idleDelta = currentIdleCount - lastIdleCounts[cpuIndex];
        lastIdleCounts[cpuIndex] = currentIdleCount;

        if (idleDelta > peakIdleDeltas[cpuIndex]) {
            peakIdleDeltas[cpuIndex] = idleDelta;
        } else if (peakIdleDeltas[cpuIndex] > 8) {
            peakIdleDeltas[cpuIndex] -= max<uint32_t>(1U, peakIdleDeltas[cpuIndex] / 128U);
            if (idleDelta > peakIdleDeltas[cpuIndex]) {
                peakIdleDeltas[cpuIndex] = idleDelta;
            }
        }

        const uint32_t referenceIdle = max<uint32_t>(peakIdleDeltas[cpuIndex], 1U);
        const uint32_t idlePercent = min<uint32_t>(100U, (idleDelta * 100U) / referenceIdle);
        totalIdlePercent += idlePercent;
    }

    const uint32_t averageIdlePercent = totalIdlePercent / max<size_t>(1, portNUM_PROCESSORS);
    return static_cast<uint8_t>(100U - min<uint32_t>(100U, averageIdlePercent));
}

void populateStaticHardwareInfo(HardwareInfoSnapshot& hardware) {
    hardware.chipModel = ESP.getChipModel();
    hardware.boardProfile = APP_BOARD_PROFILE;
    hardware.chipRevision = ESP.getChipRevision();
    hardware.cpuCores = ESP.getChipCores();
    hardware.cpuFreqMHz = ESP.getCpuFreqMHz();
    hardware.flashSizeBytes = ESP.getFlashChipSize();
    hardware.sketchSizeBytes = ESP.getSketchSize();

    const esp_partition_t* runningPartition = esp_ota_get_running_partition();
    hardware.appPartitionSizeBytes = runningPartition != nullptr ? static_cast<uint32_t>(runningPartition->size) : 0;
}

void assignResourceSummary(ResourceMetricSnapshot& destination, const StorageBackendSummary& source) {
    destination.available = source.available;
    destination.mounted = source.mounted;
    destination.cardSizeBytes = source.cardSizeBytes;
    destination.totalBytes = source.totalBytes;
    destination.usedBytes = source.usedBytes;
    destination.freeBytes = source.freeBytes;
}

void populateStorageMetrics(SystemMetricsSnapshot& snapshot) {
    snapshot.spiffs = {};
    snapshot.sd = {};
    assignResourceSummary(snapshot.spiffs, getStorageSummary(StorageTarget::Flash));
    assignResourceSummary(snapshot.sd, getStorageSummary(StorageTarget::Sd));
}
}  // namespace

void beginSystemMetrics() {
    if (metricsInitialized) {
        return;
    }

    metricsSnapshot = {};
    populateStaticHardwareInfo(metricsSnapshot.hardware);

#if APP_HAS_FREERTOS_IDLE_HOOKS
    esp_register_freertos_idle_hook_for_cpu(idleHookCpu0, 0);
#if portNUM_PROCESSORS > 1
    esp_register_freertos_idle_hook_for_cpu(idleHookCpu1, 1);
#endif
#endif

    metricsInitialized = true;
    sampleSystemMetrics();
}

void sampleSystemMetrics() {
    if (!metricsInitialized) {
        beginSystemMetrics();
    }

    SystemMetricsSnapshot next = metricsSnapshot;
    next.cpuLoadPercent = approximateCpuLoadPercent();
#if defined(ARDUINO_ARCH_ESP32)
    next.chipTemperatureC = temperatureRead();
    next.chipTemperatureAvailable = isfinite(next.chipTemperatureC);
#else
    next.chipTemperatureC = 0.0f;
    next.chipTemperatureAvailable = false;
#endif
    next.freeHeapBytes = ESP.getFreeHeap();
    next.minFreeHeapBytes = ESP.getMinFreeHeap();
    next.largestHeapBlockBytes = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);

    next.sram.available = true;
    next.sram.totalBytes = ESP.getHeapSize();
    next.sram.freeBytes = next.freeHeapBytes;
    next.sram.usedBytes = clampUsedBytes(next.sram.totalBytes, next.sram.freeBytes);

    const bool psramAvailable = psramFound();
    next.psram.available = psramAvailable;
    next.psram.mounted = psramAvailable;
    next.psram.totalBytes = psramAvailable ? ESP.getPsramSize() : 0;
    next.psram.freeBytes = psramAvailable ? ESP.getFreePsram() : 0;
    next.psram.usedBytes = clampUsedBytes(next.psram.totalBytes, next.psram.freeBytes);

    populateStorageMetrics(next);
    metricsSnapshot = next;
}

SystemMetricsSnapshot getSystemMetricsSnapshot() {
    return metricsSnapshot;
}

void appendSystemMetricsJson(JsonObject root) {
    const SystemMetricsSnapshot snapshot = getSystemMetricsSnapshot();

    JsonObject hardware = root["hardware"].to<JsonObject>();
    hardware["chipModel"] = snapshot.hardware.chipModel;
    hardware["boardProfile"] = snapshot.hardware.boardProfile;
    hardware["chipRevision"] = snapshot.hardware.chipRevision;
    hardware["cpuCores"] = snapshot.hardware.cpuCores;
    hardware["cpuFreqMHz"] = snapshot.hardware.cpuFreqMHz;
    hardware["flashSizeBytes"] = snapshot.hardware.flashSizeBytes;
    hardware["appPartitionSizeBytes"] = snapshot.hardware.appPartitionSizeBytes;
    hardware["sketchSizeBytes"] = snapshot.hardware.sketchSizeBytes;

    JsonObject system = root["system"].to<JsonObject>();
    system["freeHeap"] = snapshot.freeHeapBytes;
    system["minFreeHeapBytes"] = snapshot.minFreeHeapBytes;
    system["largestHeapBlockBytes"] = snapshot.largestHeapBlockBytes;
    system["cpuLoadPercent"] = snapshot.cpuLoadPercent;
    system["chipTemperatureAvailable"] = snapshot.chipTemperatureAvailable;
    if (snapshot.chipTemperatureAvailable) {
        system["chipTemperatureC"] = snapshot.chipTemperatureC;
    } else {
        system["chipTemperatureC"] = nullptr;
    }

    JsonObject sram = system["sram"].to<JsonObject>();
    sram["available"] = snapshot.sram.available;
    sram["mounted"] = snapshot.sram.mounted;
    sram["cardSizeBytes"] = snapshot.sram.cardSizeBytes;
    sram["totalBytes"] = snapshot.sram.totalBytes;
    sram["usedBytes"] = snapshot.sram.usedBytes;
    sram["freeBytes"] = snapshot.sram.freeBytes;

    JsonObject psram = system["psram"].to<JsonObject>();
    psram["available"] = snapshot.psram.available;
    psram["mounted"] = snapshot.psram.mounted;
    psram["cardSizeBytes"] = snapshot.psram.cardSizeBytes;
    psram["totalBytes"] = snapshot.psram.totalBytes;
    psram["usedBytes"] = snapshot.psram.usedBytes;
    psram["freeBytes"] = snapshot.psram.freeBytes;

    JsonObject spiffs = system["spiffs"].to<JsonObject>();
    spiffs["available"] = snapshot.spiffs.available;
    spiffs["mounted"] = snapshot.spiffs.mounted;
    spiffs["cardSizeBytes"] = snapshot.spiffs.cardSizeBytes;
    spiffs["totalBytes"] = snapshot.spiffs.totalBytes;
    spiffs["usedBytes"] = snapshot.spiffs.usedBytes;
    spiffs["freeBytes"] = snapshot.spiffs.freeBytes;

    JsonObject sd = system["sd"].to<JsonObject>();
    sd["available"] = snapshot.sd.available;
    sd["mounted"] = snapshot.sd.mounted;
    sd["cardSizeBytes"] = snapshot.sd.cardSizeBytes;
    sd["totalBytes"] = snapshot.sd.totalBytes;
    sd["usedBytes"] = snapshot.sd.usedBytes;
    sd["freeBytes"] = snapshot.sd.freeBytes;
}
