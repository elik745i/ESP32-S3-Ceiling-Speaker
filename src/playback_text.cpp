#include "playback_text.h"

namespace {

bool isHexDigit(char value) {
    return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f') || (value >= 'A' && value <= 'F');
}

uint8_t hexValue(char value) {
    if (value >= '0' && value <= '9') {
        return static_cast<uint8_t>(value - '0');
    }
    if (value >= 'a' && value <= 'f') {
        return static_cast<uint8_t>(10 + (value - 'a'));
    }
    return static_cast<uint8_t>(10 + (value - 'A'));
}

String collapseWhitespace(String value) {
    value.trim();
    String collapsed;
    collapsed.reserve(value.length());
    bool previousWasWhitespace = false;
    for (size_t index = 0; index < value.length(); ++index) {
        const char current = value[index];
        const bool isWhitespace = current == ' ' || current == '\t' || current == '\r' || current == '\n';
        if (isWhitespace) {
            if (!previousWasWhitespace) {
                collapsed += ' ';
            }
            previousWasWhitespace = true;
            continue;
        }
        collapsed += current;
        previousWasWhitespace = false;
    }
    collapsed.trim();
    return collapsed;
}

String decodePercentEncoding(const String& value, bool plusAsSpace) {
    String decoded;
    decoded.reserve(value.length());

    for (size_t index = 0; index < value.length(); ++index) {
        const char current = value[index];
        if (current == '+' && plusAsSpace) {
            decoded += ' ';
            continue;
        }
        if (current == '%' && (index + 2) < value.length() && isHexDigit(value[index + 1]) && isHexDigit(value[index + 2])) {
            const uint8_t decodedByte = static_cast<uint8_t>((hexValue(value[index + 1]) << 4) | hexValue(value[index + 2]));
            decoded += static_cast<char>(decodedByte);
            index += 2;
            continue;
        }
        decoded += current;
    }

    return decoded;
}

String decodeHtmlEntities(String value) {
    value.replace("&amp;", "&");
    value.replace("&quot;", "\"");
    value.replace("&#39;", "'");
    value.replace("&apos;", "'");
    value.replace("&lt;", "<");
    value.replace("&gt;", ">");
    value.replace("&nbsp;", " ");
    return value;
}

String stripQuotes(String value) {
    value.trim();
    while (value.length() >= 2) {
        const char first = value[0];
        const char last = value[value.length() - 1];
        if ((first == '\'' && last == '\'') || (first == '"' && last == '"')) {
            value = value.substring(1, value.length() - 1);
            value.trim();
            continue;
        }
        break;
    }
    return value;
}

bool looksLikeUrl(const String& value) {
    return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("www.");
}

String titleFromStreamMetadata(const String& value) {
    String normalized = value;
    const String marker = "StreamTitle=";
    const int markerIndex = normalized.indexOf(marker);
    if (markerIndex < 0) {
        return normalized;
    }

    String extracted = normalized.substring(markerIndex + marker.length());
    const int semicolonIndex = extracted.indexOf(';');
    if (semicolonIndex >= 0) {
        extracted = extracted.substring(0, semicolonIndex);
    }
    return stripQuotes(extracted);
}

String stripQueryAndFragment(const String& url) {
    int cutAt = url.length();
    const int queryIndex = url.indexOf('?');
    if (queryIndex >= 0 && queryIndex < cutAt) {
        cutAt = queryIndex;
    }
    const int fragmentIndex = url.indexOf('#');
    if (fragmentIndex >= 0 && fragmentIndex < cutAt) {
        cutAt = fragmentIndex;
    }
    return url.substring(0, cutAt);
}

}  // namespace

namespace PlaybackText {

String normalizeUrl(const String& rawUrl) {
    String url = rawUrl;
    url.trim();
    url.replace(" ", "%20");
    return url;
}

String fallbackTitleFromUrl(const String& url) {
    String normalizedUrl = normalizeUrl(url);
    if (normalizedUrl.isEmpty()) {
        return String();
    }

    normalizedUrl = stripQueryAndFragment(normalizedUrl);
    const int lastSlash = normalizedUrl.lastIndexOf('/');
    String title = lastSlash >= 0 ? normalizedUrl.substring(lastSlash + 1) : normalizedUrl;
    title = decodePercentEncoding(title, false);
    title = decodeHtmlEntities(title);
    title.replace('_', ' ');
    title = stripQuotes(title);
    title = collapseWhitespace(title);
    return title;
}

String normalizeTitle(const String& rawTitle, const String& fallbackUrl) {
    String title = rawTitle;
    title.trim();

    if (title.isEmpty()) {
        return fallbackTitleFromUrl(fallbackUrl);
    }

    title = titleFromStreamMetadata(title);
    title = decodePercentEncoding(title, true);
    title = decodeHtmlEntities(title);
    title = stripQuotes(title);
    title = collapseWhitespace(title);

    if (title.isEmpty()) {
        return fallbackTitleFromUrl(fallbackUrl);
    }

    if (looksLikeUrl(title) || title.indexOf("authSig=") >= 0) {
        const String derived = fallbackTitleFromUrl(title);
        if (!derived.isEmpty()) {
            return derived;
        }
    }

    const String fallbackTitle = fallbackTitleFromUrl(fallbackUrl);
    if (!fallbackTitle.isEmpty() && title == normalizeUrl(fallbackUrl)) {
        return fallbackTitle;
    }

    return title;
}

}  // namespace PlaybackText