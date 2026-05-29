#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

struct ResourceMetricSnapshot {
    bool available = false;
    bool mounted = false;
    uint32_t totalBytes = 0;
    uint32_t usedBytes = 0;
    uint32_t freeBytes = 0;
};

struct HardwareInfoSnapshot {
    String chipModel;
    uint16_t chipRevision = 0;
    uint8_t cpuCores = 0;
    uint32_t cpuFreqMHz = 0;
    uint32_t flashSizeBytes = 0;
    uint32_t appPartitionSizeBytes = 0;
    uint32_t sketchSizeBytes = 0;
};

struct SystemMetricsSnapshot {
    uint8_t cpuLoadPercent = 0;
    uint32_t freeHeapBytes = 0;
    uint32_t minFreeHeapBytes = 0;
    uint32_t largestHeapBlockBytes = 0;
    ResourceMetricSnapshot sram;
    ResourceMetricSnapshot psram;
    ResourceMetricSnapshot spiffs;
    ResourceMetricSnapshot sd;
    HardwareInfoSnapshot hardware;
};

void beginSystemMetrics();
void sampleSystemMetrics();
SystemMetricsSnapshot getSystemMetricsSnapshot();
void appendSystemMetricsJson(JsonObject root);