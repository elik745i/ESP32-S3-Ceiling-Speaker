#include "audio_player.h"

#include <Audio.h>
#include <driver/gpio.h>

#include "default_config.h"
#include "playback_text.h"

namespace {
AudioPlayer::Impl* g_impl = nullptr;

constexpr unsigned long kSwitchFadeOutMs = 70UL;
constexpr unsigned long kStartFadeInMs = 90UL;
constexpr unsigned long kSwitchQuietTimeMs = 18UL;

int16_t saturatingDouble(int16_t sample) {
    const int32_t boosted = static_cast<int32_t>(sample) * 2;
    if (boosted > INT16_MAX) {
        return INT16_MAX;
    }
    if (boosted < INT16_MIN) {
        return INT16_MIN;
    }
    return static_cast<int16_t>(boosted);
}
}  // namespace

class AudioPlayer::Impl {
  public:
    Audio audio;
    AppState* appState = nullptr;
        uint8_t bclkPin = DefaultConfig::I2S_BCLK_PIN;
        uint8_t wsPin = DefaultConfig::I2S_WS_PIN;
        uint8_t doutPin = DefaultConfig::I2S_DOUT_PIN;
    uint8_t volume = DefaultConfig::DEFAULT_VOLUME_PERCENT;
    uint8_t hardwareAudioVolume = 0;
    String state = "idle";
    String type = "idle";
    String title = "Idle";
    String url;
    String source = "none";
    bool retryPending = false;
    uint8_t retryCount = 0;
    unsigned long retryAt = 0;
    bool stopRequested = false;

    void publish() {
        if (appState != nullptr) {
            appState->setPlayback(state, type, title, url, source, volume);
        }
    }

    void markPlaying() {
        state = "playing";
        if (title.isEmpty()) {
            title = PlaybackText::fallbackTitleFromUrl(url);
        }
        publish();
    }

    void setHardwareAudioVolume(uint8_t audioVolume) {
        hardwareAudioVolume = constrain(audioVolume, static_cast<uint8_t>(0), DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME);
        audio.setVolume(hardwareAudioVolume);
    }

    void applyHardwareVolumePercent(uint8_t volumePercent) {
        setHardwareAudioVolume(map(volumePercent, 0, 100, 0, DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME));
    }

    void fadeToPercent(uint8_t targetVolumePercent, unsigned long durationMs) {
        const int targetAudioVolume = map(targetVolumePercent, 0, 100, 0, DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME);
        if (hardwareAudioVolume == targetAudioVolume) {
            return;
        }

        const int direction = hardwareAudioVolume < targetAudioVolume ? 1 : -1;
        const unsigned long steps = static_cast<unsigned long>(abs(targetAudioVolume - hardwareAudioVolume));
        const unsigned long stepDelayMs = steps == 0 ? 0 : max<unsigned long>(4UL, durationMs / steps);

        while (hardwareAudioVolume != targetAudioVolume) {
            setHardwareAudioVolume(static_cast<uint8_t>(hardwareAudioVolume + direction));
            delay(stepDelayMs);
            yield();
        }
    }
};

void audio_info(const char* info) {
    if (info != nullptr) {
        Serial.printf("[audio] %s\n", info);
    }
}

void audio_showstation(const char* info) {
    if (g_impl != nullptr && info != nullptr) {
        const String nextTitle = PlaybackText::normalizeTitle(String(info), g_impl->url);
        if (!nextTitle.isEmpty() && g_impl->title != nextTitle) {
            g_impl->title = nextTitle;
            g_impl->publish();
        }
    }
}

void audio_showstreamtitle(const char* info) {
    if (g_impl != nullptr && info != nullptr) {
        const String nextTitle = PlaybackText::normalizeTitle(String(info), g_impl->url);
        if (!nextTitle.isEmpty() && g_impl->title != nextTitle) {
            g_impl->title = nextTitle;
            g_impl->publish();
        }
    }
}

void audio_eof_stream(const char* info) {
    if (g_impl != nullptr) {
        g_impl->state = "idle";
        g_impl->publish();
        if (!g_impl->stopRequested && !g_impl->url.isEmpty() && g_impl->retryCount < 3) {
            g_impl->retryPending = true;
            g_impl->retryCount++;
            g_impl->retryAt = millis() + 2000UL * g_impl->retryCount;
        }
    }
    (void)info;
}

void audio_process_i2s(uint32_t* sample, bool* continueI2S) {
    if (sample == nullptr) {
        return;
    }

    const uint32_t packedSample = *sample;
    const int16_t left = static_cast<int16_t>(packedSample >> 16);
    const int16_t right = static_cast<int16_t>(packedSample & 0xFFFF);
    const uint16_t boostedLeft = static_cast<uint16_t>(saturatingDouble(left));
    const uint16_t boostedRight = static_cast<uint16_t>(saturatingDouble(right));

    *sample = (static_cast<uint32_t>(boostedLeft) << 16) | static_cast<uint32_t>(boostedRight);
    if (continueI2S != nullptr) {
        *continueI2S = true;
    }
}

void AudioPlayer::begin(uint8_t bclkPin, uint8_t wsPin, uint8_t doutPin, uint8_t initialVolumePercent, AppState& appState) {
    if (impl_ == nullptr) {
        impl_ = new Impl();
    }
    impl_->appState = &appState;
    g_impl = impl_;
    impl_->bclkPin = bclkPin;
    impl_->wsPin = wsPin;
    impl_->doutPin = doutPin;
    impl_->audio.setBufsize(DefaultConfig::AUDIO_BUFFER_SIZE_RAM, DefaultConfig::AUDIO_BUFFER_SIZE_PSRAM);
    impl_->audio.setI2SCommFMT_LSB(false);
    impl_->audio.setPinout(bclkPin, wsPin, doutPin);
    impl_->audio.forceMono(DefaultConfig::AUDIO_FORCE_MONO);
    impl_->audio.setConnectionTimeout(8000, 8000);
    impl_->volume = constrain(initialVolumePercent, static_cast<uint8_t>(0), static_cast<uint8_t>(100));
    impl_->applyHardwareVolumePercent(impl_->volume);
    Serial.printf("[audio] init target=MAX98357A fmt=std-i2s bclk=%u ws=%u dout=%u volume=%u mono=%s\n",
                  bclkPin,
                  wsPin,
                  doutPin,
                  impl_->volume,
                  DefaultConfig::AUDIO_FORCE_MONO ? "on" : "off");
    impl_->publish();
}

void AudioPlayer::loop() {
    if (impl_ == nullptr) {
        return;
    }
    impl_->audio.loop();
    if (impl_->retryPending && millis() >= impl_->retryAt) {
        impl_->retryPending = false;
        impl_->audio.stopSong();
        impl_->audio.connecttohost(impl_->url.c_str());
        impl_->state = "buffering";
        impl_->publish();
    }
}

bool AudioPlayer::play(const String& url, const String& title, const String& mediaType, const String& source) {
    if (impl_ == nullptr || url.isEmpty()) {
        return false;
    }

    const String normalizedUrl = PlaybackText::normalizeUrl(url);
    const String normalizedTitle = PlaybackText::normalizeTitle(title, normalizedUrl);

    if (impl_->audio.isRunning() || impl_->state == "playing" || impl_->state == "buffering") {
        impl_->fadeToPercent(0, kSwitchFadeOutMs);
        impl_->audio.stopSong();
        delay(kSwitchQuietTimeMs);
    }

    impl_->stopRequested = false;
    impl_->retryPending = false;
    impl_->retryCount = 0;
    impl_->url = normalizedUrl;
    impl_->title = normalizedTitle;
    impl_->type = mediaType;
    impl_->source = source;
    impl_->state = "buffering";
    impl_->publish();
    impl_->applyHardwareVolumePercent(0);

    bool connected = impl_->audio.connecttohost(normalizedUrl.c_str());
    if (!connected) {
        delay(120);
        connected = impl_->audio.connecttohost(normalizedUrl.c_str());
    }
    if (!connected) {
        impl_->applyHardwareVolumePercent(impl_->volume);
        impl_->state = "error";
        Serial.printf("[audio] connecttohost failed for %s\n", normalizedUrl.c_str());
        impl_->publish();
        return false;
    }

    Serial.printf("[audio] connecttohost ok for %s\n", normalizedUrl.c_str());
    impl_->markPlaying();
    impl_->fadeToPercent(impl_->volume, kStartFadeInMs);
    return true;
}

void AudioPlayer::stop() {
    if (impl_ == nullptr) {
        return;
    }

    impl_->stopRequested = true;
    impl_->retryPending = false;
    if (impl_->audio.isRunning() || impl_->state == "playing" || impl_->state == "buffering") {
        impl_->fadeToPercent(0, kSwitchFadeOutMs);
        delay(kSwitchQuietTimeMs);
    }
    impl_->audio.stopSong();
    impl_->state = "idle";
    impl_->type = "idle";
    impl_->title = "Idle";
    impl_->url = "";
    impl_->source = "manual";
    impl_->publish();
}

bool AudioPlayer::reconfigureOutputPins(uint8_t bclkPin, uint8_t wsPin, uint8_t doutPin) {
    if (impl_ == nullptr) {
        return false;
    }

    const bool resumePlayback = (impl_->audio.isRunning() || impl_->state == "playing" || impl_->state == "buffering") && !impl_->url.isEmpty();
    const String resumeUrl = impl_->url;
    const String resumeTitle = impl_->title;
    const String resumeType = impl_->type;
    const String resumeSource = impl_->source;

    impl_->retryPending = false;
    impl_->retryCount = 0;
    impl_->stopRequested = false;

    if (resumePlayback) {
        impl_->fadeToPercent(0, kSwitchFadeOutMs);
        impl_->audio.stopSong();
        delay(kSwitchQuietTimeMs);
    }

    gpio_reset_pin(static_cast<gpio_num_t>(impl_->bclkPin));
    gpio_reset_pin(static_cast<gpio_num_t>(impl_->wsPin));
    gpio_reset_pin(static_cast<gpio_num_t>(impl_->doutPin));

    impl_->audio.setI2SCommFMT_LSB(false);
    impl_->audio.setPinout(bclkPin, wsPin, doutPin);
    impl_->audio.forceMono(DefaultConfig::AUDIO_FORCE_MONO);
    impl_->applyHardwareVolumePercent(impl_->volume);
    impl_->bclkPin = bclkPin;
    impl_->wsPin = wsPin;
    impl_->doutPin = doutPin;
    Serial.printf("[audio] reconfigured target=MAX98357A fmt=std-i2s bclk=%u ws=%u dout=%u mono=%s\n",
                  bclkPin,
                  wsPin,
                  doutPin,
                  DefaultConfig::AUDIO_FORCE_MONO ? "on" : "off");

    if (!resumePlayback) {
        impl_->publish();
        return true;
    }

    return play(resumeUrl, resumeTitle, resumeType, resumeSource);
}

void AudioPlayer::setVolumePercent(uint8_t volumePercent) {
    if (impl_ == nullptr) {
        return;
    }
    const uint8_t nextVolume = constrain(volumePercent, static_cast<uint8_t>(0), static_cast<uint8_t>(100));
    if (impl_->volume == nextVolume) {
        return;
    }
    impl_->volume = nextVolume;
    impl_->applyHardwareVolumePercent(impl_->volume);
    impl_->publish();
}

uint8_t AudioPlayer::volumePercent() const {
    return impl_ == nullptr ? 0 : impl_->volume;
}

String AudioPlayer::currentTitle() const {
    return impl_ == nullptr ? String() : impl_->title;
}

String AudioPlayer::currentUrl() const {
    return impl_ == nullptr ? String() : impl_->url;
}

String AudioPlayer::currentState() const {
    return impl_ == nullptr ? String("idle") : impl_->state;
}

void AudioPlayer::onStationName(const char* text) { (void)text; }
void AudioPlayer::onStreamTitle(const char* text) { (void)text; }
void AudioPlayer::onInfo(const char* text) { (void)text; }
void AudioPlayer::onEof(const char* text) { (void)text; }
