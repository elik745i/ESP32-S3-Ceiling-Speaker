export function createDeviceTab({
  elements,
  activateTabByName,
  flashStorageAvailable,
  saveSettings,
  exportConfigurationBackup,
  restoreConfigurationBackup,
  requestDeviceRestart,
  handleError,
  confirmFactoryReset,
}) {
  function bindEvents() {
    elements.saveDeviceButton?.addEventListener("click", () => saveSettings({ silent: false }).catch(handleError));
    elements.backupConfigButton?.addEventListener("click", async () => {
      try {
        await exportConfigurationBackup();
      } catch (error) {
        handleError(error);
      }
    });
    elements.restoreConfigButton?.addEventListener("click", () => {
      if (!elements.restoreConfigFile) {
        return;
      }
      elements.restoreConfigFile.value = "";
      elements.restoreConfigFile.click();
    });
    elements.restoreConfigFile?.addEventListener("change", async () => {
      const file = elements.restoreConfigFile.files?.[0];
      if (!file) {
        return;
      }
      try {
        await restoreConfigurationBackup(file);
      } catch (error) {
        handleError(error);
      } finally {
        elements.restoreConfigFile.value = "";
      }
    });
    elements.deviceSpiffsCard?.addEventListener("click", () => {
      if (!flashStorageAvailable()) {
        return;
      }
      activateTabByName("storage-internal");
    });
    elements.rebootButton?.addEventListener("click", async () => {
      await requestDeviceRestart("/api/reboot", {
        title: "Rebooting device...",
        message: "Reboot requested",
        totalSeconds: 30,
      });
    });
    elements.factoryResetButton?.addEventListener("click", async () => {
      if (!confirmFactoryReset()) {
        return;
      }
      await requestDeviceRestart("/api/factory-reset", {
        title: "Factory reset in progress...",
        message: "Factory reset requested. Saved device configuration will be erased.",
        totalSeconds: 35,
        saveDirtySettingsBeforeRestart: false,
      });
    });
  }

  return {
    bindEvents,
  };
}