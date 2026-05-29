#include "audio_player.h"

#include <Audio.h>
#include <driver/gpio.h>

#include "default_config.h"
#include "playback_text.h"
#include "psram_allocator.h"

namespace {
AudioPlayer::Impl* g_impl = nullptr;

constexpr unsigned long kSwitchFadeOutMs = 70UL;
constexpr unsigned long kStartFadeInMs = 90UL;
constexpr unsigned long kSwitchQuietTimeMs = 18UL;

constexpr uint32_t kPreferredDiagnosticSampleRateHz = DefaultConfig::AUDIO_DIAGNOSTIC_PREFERRED_SAMPLE_RATE_HZ;

uint8_t percentToLibraryVolume(uint8_t volumePercent) {
    const long scaled = map(volumePercent, 0, 100, 0, DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME);
    return constrain(static_cast<uint8_t>(scaled), static_cast<uint8_t>(0), DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME);
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
        uint32_t requestedSampleRateHz = kPreferredDiagnosticSampleRateHz;
        uint32_t activeSampleRateHz = 0;
        uint8_t bitsPerSample = 16;
        uint8_t channelCount = DefaultConfig::AUDIO_FORCE_MONO ? 1 : 2;
        bool diagnosticTestMode = false;
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
        setHardwareAudioVolume(percentToLibraryVolume(volumePercent));
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
    (void)sample;
    if (continueI2S != nullptr) {
        *continueI2S = true;
    }
}

void audio_id3data(const char* info) {
    if (info != nullptr) {
        Serial.printf("[audio] id3 %s\n", info);
    }
}

void audio_bitrate(const char* info) {
    if (info != nullptr) {
        Serial.printf("[audio] bitrate %s\n", info);
    }
}

void audio_commercial(const char* info) {
    if (info != nullptr) {
        Serial.printf("[audio] codec %s\n", info);
    }
}

void audio_eof_mp3(const char* info) {
    Serial.printf("[audio] eof mp3 %s\n", info == nullptr ? "" : info);
}

void audio_eof_speech(const char* info) {
    Serial.printf("[audio] eof speech %s\n", info == nullptr ? "" : info);
}

void AudioPlayer::begin(uint8_t bclkPin, uint8_t wsPin, uint8_t doutPin, uint8_t initialVolumePercent, AppState& appState) {
    if (impl_ == nullptr) {
        impl_ = allocatePreferPsram<Impl>();
    }
    if (impl_ == nullptr) {
        Serial.println("[audio] failed to allocate player implementation");
        return;
    }
    impl_->appState = &appState;
    g_impl = impl_;
    impl_->bclkPin = bclkPin;
    impl_->wsPin = wsPin;
    impl_->doutPin = doutPin;
    impl_->audio.setBufsize(DefaultConfig::AUDIO_BUFFER_SIZE_RAM, DefaultConfig::AUDIO_BUFFER_SIZE_PSRAM);
    impl_->audio.setI2SCommFMT_LSB(false);
    impl_->audio.setPinout(bclkPin, wsPin, doutPin);
    impl_->requestedSampleRateHz = kPreferredDiagnosticSampleRateHz;
    impl_->diagnosticTestMode = DefaultConfig::AUDIO_DIAGNOSTIC_TEST;
    impl_->audio.forceMono(DefaultConfig::AUDIO_FORCE_MONO);
    impl_->channelCount = DefaultConfig::AUDIO_FORCE_MONO ? 1 : 2;
    impl_->audio.setConnectionTimeout(8000, 8000);
    impl_->volume = constrain(initialVolumePercent, static_cast<uint8_t>(0), static_cast<uint8_t>(100));
    impl_->applyHardwareVolumePercent(impl_->volume);
    Serial.printf("[audio] init driver=ESP32-audioI2S target=MAX98357A fmt=std-i2s bclk=%u ws=%u dout=%u requested_rate=%lu volume_percent=%u lib_volume=%u mono=%s\n",
                  bclkPin,
                  wsPin,
                  doutPin,
                  static_cast<unsigned long>(impl_->requestedSampleRateHz),
                  impl_->volume,
                  impl_->hardwareAudioVolume,
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

    impl_->activeSampleRateHz = impl_->audio.getSampleRate();
    impl_->bitsPerSample = impl_->audio.getBitsPerSample();
    impl_->channelCount = impl_->audio.getChannels();
    Serial.printf("[audio] connecttohost ok for %s\n", normalizedUrl.c_str());
    Serial.printf("[audio] playback started rate=%lu bits=%u channels=%u lib_volume=%u\n",
                  static_cast<unsigned long>(impl_->activeSampleRateHz),
                  static_cast<unsigned>(impl_->bitsPerSample),
                  static_cast<unsigned>(impl_->channelCount),
                  static_cast<unsigned>(impl_->hardwareAudioVolume));
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
    Serial.println("[audio] playback stopped");
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
    impl_->channelCount = DefaultConfig::AUDIO_FORCE_MONO ? 1 : 2;
    impl_->applyHardwareVolumePercent(impl_->volume);
    impl_->bclkPin = bclkPin;
    impl_->wsPin = wsPin;
    impl_->doutPin = doutPin;
    Serial.printf("[audio] reconfigured target=MAX98357A fmt=std-i2s bclk=%u ws=%u dout=%u requested_rate=%lu lib_volume=%u mono=%s\n",
                  bclkPin,
                  wsPin,
                  doutPin,
                  static_cast<unsigned long>(impl_->requestedSampleRateHz),
                  impl_->hardwareAudioVolume,
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
    Serial.printf("[audio] volume percent=%u lib_volume=%u\n", impl_->volume, impl_->hardwareAudioVolume);
    impl_->publish();
}

void AudioPlayer::setDirectLibraryVolume(uint8_t libraryVolume) {
    if (impl_ == nullptr) {
        return;
    }
    impl_->setHardwareAudioVolume(libraryVolume);
    impl_->volume = static_cast<uint8_t>(constrain(map(impl_->hardwareAudioVolume, 0, DefaultConfig::AUDIO_MAX_HARDWARE_VOLUME, 0, 100), 0L, 100L));
    Serial.printf("[audio] direct lib_volume=%u mapped_percent=%u\n", impl_->hardwareAudioVolume, impl_->volume);
    impl_->publish();
}

uint8_t AudioPlayer::volumePercent() const {
    return impl_ == nullptr ? 0 : impl_->volume;
}

uint8_t AudioPlayer::libraryVolume() const {
    return impl_ == nullptr ? 0 : impl_->hardwareAudioVolume;
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

AudioPlayer::DiagnosticsSnapshot AudioPlayer::diagnostics() const {
    DiagnosticsSnapshot snapshot;
    if (impl_ == nullptr) {
        return snapshot;
    }

    snapshot.requestedSampleRateHz = impl_->requestedSampleRateHz;
    snapshot.activeSampleRateHz = impl_->activeSampleRateHz;
    snapshot.bitsPerSample = impl_->bitsPerSample;
    snapshot.channelCount = impl_->channelCount;
    snapshot.libraryVolume = impl_->hardwareAudioVolume;
    snapshot.stereoEnabled = impl_->channelCount >= 2;
    snapshot.diagnosticTestMode = impl_->diagnosticTestMode;
    return snapshot;
}

void AudioPlayer::onStationName(const char* text) { (void)text; }
void AudioPlayer::onStreamTitle(const char* text) { (void)text; }
void AudioPlayer::onInfo(const char* text) { (void)text; }
void AudioPlayer::onEof(const char* text) { (void)text; }
