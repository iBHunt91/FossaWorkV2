// Pushover API functions
export const getPushoverSettings = async () => {
  return await window.electron.invoke('settings:pushover:get');
};

export const savePushoverSettings = async (settings) => {
  return await window.electron.invoke('settings:pushover:save', settings);
};

export const testPushoverNotification = async (settings) => {
  return await window.electron.invoke('settings:pushover:test', settings);
};

// Pushover Open Client functions
export const setupPushoverOpenClient = async (email, password) => {
  return await window.electron.invoke('settings:pushover:openclient:setup', { email, password });
};

export const startPushoverOpenClient = async () => {
  return await window.electron.invoke('settings:pushover:openclient:start');
};

export const stopPushoverOpenClient = async () => {
  return await window.electron.invoke('settings:pushover:openclient:stop');
};

export const getPushoverOpenClientStatus = async () => {
  return await window.electron.invoke('settings:pushover:openclient:status');
};

// General API functions
export const getServerPort = async () => {
  return await window.electron.getServerPort();
};

export const updateFossaCredentials = async (email, password) => {
  return await window.electron.updateFossaCredentials(email, password);
}; 