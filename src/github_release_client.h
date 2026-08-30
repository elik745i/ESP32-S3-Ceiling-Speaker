#pragma once

#include <Arduino.h>
#include <vector>

struct GithubReleaseMetadata {
    String tag;
    String name;
    String publishedAt;
    bool prerelease = false;
    std::vector<String> assetNames;
};

// Reads GitHub's public releases feed. Unlike the REST releases API, the feed
// does not consume the shared 60-requests-per-hour unauthenticated API quota.
class GithubReleaseClient {
  public:
    bool fetch(
        const String& owner,
        const String& repository,
        bool allowInsecureTls,
        std::vector<GithubReleaseMetadata>& releases,
        String& error) const;
};
