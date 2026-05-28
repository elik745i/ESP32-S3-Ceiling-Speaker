import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from homeassistant.const import CONF_NAME
from .const import DOMAIN


@config_entries.HANDLERS.register(DOMAIN)
class MqttMediaPlayerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_mqtt(self, discovery_info=None):
        """Handle MQTT discovery."""
        if discovery_info is None:
            return self.async_abort(reason="no_discovery_info")

        device_name = discovery_info.get("name", "MQTT Media Player")

        await self.async_set_unique_id(device_name)
        self._abort_if_unique_id_configured()

        return self.async_create_entry(title=device_name, data=discovery_info)

    async def async_step_user(self, user_input=None):
        """Handle manual configuration."""
        errors = {}
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_NAME])
            self._abort_if_unique_id_configured()

            return self.async_create_entry(title=user_input[CONF_NAME], data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Required(CONF_NAME): str}),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(step_id="init", data_schema=vol.Schema({}))