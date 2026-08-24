import json
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform
from homeassistant.components.mqtt import async_subscribe, async_publish

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.MEDIA_PLAYER]


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the integration using YAML (if needed)."""
    discovery_topic = "homeassistant/media_player/#"
    removals_in_progress: set[str] = set()

    async def mqtt_discovery_callback(message):
        """Handle MQTT discovery messages."""
        if not message.topic.endswith("/config"):
            return

        topic_parts = message.topic.split("/")
        if len(topic_parts) < 4:
            return
        device_id = topic_parts[-2]

        if not message.payload or message.payload.strip() == "":
            # An empty retained MQTT discovery payload is a tombstone. The
            # firmware sends one when an audio peripheral is disabled. Leaving
            # the config entry behind produces a permanent Unknown media player
            # and an otherwise empty device card in Home Assistant.
            matching_entries = [
                entry
                for entry in hass.config_entries.async_entries(DOMAIN)
                if entry.data.get("discovery_topic") == message.topic
                or ("discovery_topic" not in entry.data and entry.title == device_id)
            ]
            for entry in matching_entries:
                if entry.entry_id in removals_in_progress:
                    continue
                removals_in_progress.add(entry.entry_id)
                try:
                    _LOGGER.info(
                        "Removing MQTT media player %s after discovery tombstone on %s",
                        entry.title,
                        message.topic,
                    )
                    await hass.config_entries.async_remove(entry.entry_id)
                finally:
                    removals_in_progress.discard(entry.entry_id)
            return

        try:
            json.loads(message.payload)

            _LOGGER.info(f"Discovered MQTT media player: {device_id} from topic {message.topic}")

            current_entries = hass.config_entries.async_entries(DOMAIN)
            for entry in current_entries:
                if entry.title == device_id:
                    _LOGGER.debug(f"Device {device_id} already configured")
                    return

            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": "mqtt"},
                    data={"name": device_id, "discovery_topic": message.topic},
                )
            )
        except json.JSONDecodeError as error:
            _LOGGER.error(f"Failed to parse MQTT discovery JSON from {message.topic}: {error}")
        except Exception as error:
            _LOGGER.error(f"Error processing MQTT discovery: {error}")

    await async_subscribe(hass, discovery_topic, mqtt_discovery_callback)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up the integration from the UI."""
    hass.async_create_task(hass.config_entries.async_forward_entry_setups(entry, PLATFORMS))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Handle removal of the integration."""
    if "discovery_topic" in entry.data:
        config_topic = entry.data["discovery_topic"]
    else:
        config_topic = f"homeassistant/media_player/{entry.title}/config"

    try:
        await async_publish(hass, config_topic, "", retain=True)
        _LOGGER.info(f"Cleared MQTT config for {entry.title} at {config_topic}")
    except Exception as error:
        _LOGGER.error(f"Failed to clear MQTT config: {error}")

    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
