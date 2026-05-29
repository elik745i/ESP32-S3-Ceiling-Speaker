#pragma once

#include <Arduino.h>
#include <esp_heap_caps.h>

#include <new>
#include <utility>

template <typename T, typename... Args>
T* allocatePreferPsram(Args&&... args) {
    if (psramFound()) {
        void* memory = heap_caps_malloc(sizeof(T), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (memory != nullptr) {
            return new (memory) T(std::forward<Args>(args)...);
        }
    }

    return new (std::nothrow) T(std::forward<Args>(args)...);
}