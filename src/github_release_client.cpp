#include "github_release_client.h"

#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "version.h"

namespace {
constexpr size_t MAX_RELEASES = 10;

String decodeXmlText(String value) {
    value.replace("&lt;", "<");
    value.replace("&gt;", ">");
    value.replace("&quot;", "\"");
    value.replace("&#39;", "'");
    value.replace("&amp;", "&");
    return value;
}

String elementText(const String& xml, const char* element, int from, int limit = -1) {
    const String opening = String("<") + element;
    int start = xml.indexOf(opening, from);
    if (start < 0 || (limit >= 0 && start >= limit)) {
        return "";
    }
    start = xml.indexOf('>', start + opening.length());
    if (start < 0 || (limit >= 0 && start >= limit)) {
        return "";
    }
    const String closing = String("</") + element + ">";
    const int end = xml.indexOf(closing, start + 1);
    if (end < 0 || (limit >= 0 && end > limit)) {
        return "";
    }
    return decodeXmlText(xml.substring(start + 1, end));
}

String releaseTagFromEntry(const String& entry) {
    String id = elementText(entry, "id", 0);
    const int slash = id.lastIndexOf('/');
    if (slash >= 0) {
        id = id.substring(slash + 1);
    }
    id.trim();
    if (!id.isEmpty()) {
        return id;
    }

    const int releasePath = entry.indexOf("/releases/tag/");
    if (releasePath < 0) {
        return "";
    }
    const int start = releasePath + 14;
    int end = entry.indexOf('"', start);
    if (end < 0) {
        end = entry.length();
    }
    return decodeXmlText(entry.substring(start, end));
}

bool isAssetNameCharacter(char value) {
    return isAlphaNumeric(value) || value == '-' || value == '_' || value == '.';
}

void appendUniqueAsset(std::vector<String>& assets, const String& candidate) {
    for (const String& existing : assets) {
        if (existing == candidate) {
            return;
        }
    }
    assets.push_back(candidate);
}

void parseBinaryAssetNames(const String& entry, std::vector<String>& assets) {
    String lowered = entry;
    lowered.toLowerCase();
    int cursor = 0;
    while (true) {
        const int extension = lowered.indexOf(".bin", cursor);
        if (extension < 0) {
            return;
        }
        int start = extension - 1;
        while (start >= 0 && isAssetNameCharacter(entry.charAt(start))) {
            --start;
        }
        const String candidate = entry.substring(start + 1, extension + 4);
        if (candidate.length() > 4) {
            appendUniqueAsset(assets, candidate);
        }
        cursor = extension + 4;
    }
}

bool isPrereleaseTag(String tag) {
    tag.trim();
    if (tag.startsWith("v") || tag.startsWith("V")) {
        tag.remove(0, 1);
    }
    return tag.indexOf('-') >= 0;
}
}  // namespace

bool GithubReleaseClient::fetch(
    const String& owner,
    const String& repository,
    bool allowInsecureTls,
    std::vector<GithubReleaseMetadata>& releases,
    String& error) const {
    releases.clear();
    error = "";
    if (owner.isEmpty() || repository.isEmpty()) {
        error = "GitHub release owner or repository is not configured.";
        return false;
    }

    const String url = String("https://github.com/") + owner + "/" + repository + "/releases.atom";
    WiFiClientSecure client;
    if (allowInsecureTls) {
        client.setInsecure();
    }
    HTTPClient http;
    http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
    http.setTimeout(10000);
    if (!http.begin(client, url)) {
        error = "Could not open GitHub releases feed.";
        return false;
    }
    http.addHeader("Accept", "application/atom+xml");
    http.addHeader("User-Agent", String(APP_NAME "/" APP_VERSION));
    const int code = http.GET();
    if (code != HTTP_CODE_OK) {
        error = String("GitHub releases feed HTTP ") + code;
        if (code < 0) {
            error += String(" (") + http.errorToString(code) + ")";
        }
        http.end();
        return false;
    }

    const String feed = http.getString();
    http.end();
    int cursor = 0;
    while (releases.size() < MAX_RELEASES) {
        const int entryStart = feed.indexOf("<entry>", cursor);
        if (entryStart < 0) {
            break;
        }
        const int entryEnd = feed.indexOf("</entry>", entryStart + 7);
        if (entryEnd < 0) {
            error = "GitHub releases feed is incomplete.";
            releases.clear();
            return false;
        }

        const String entry = feed.substring(entryStart, entryEnd + 8);
        GithubReleaseMetadata release;
        release.tag = releaseTagFromEntry(entry);
        release.name = elementText(entry, "title", 0);
        release.publishedAt = elementText(entry, "updated", 0);
        release.prerelease = isPrereleaseTag(release.tag);
        parseBinaryAssetNames(entry, release.assetNames);
        if (!release.tag.isEmpty()) {
            releases.push_back(release);
        }
        cursor = entryEnd + 8;
    }

    if (releases.empty()) {
        error = "GitHub releases feed contains no published releases.";
        return false;
    }
    return true;
}
