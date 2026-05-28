#pragma once

#include <Arduino.h>

namespace PlaybackText {

String normalizeUrl(const String& rawUrl);
String fallbackTitleFromUrl(const String& url);
String normalizeTitle(const String& rawTitle, const String& fallbackUrl = String());

}  // namespace PlaybackText