const DEVICE_KEY = "wmsfo_device_id";
const DEVICE_TS_KEY = "wmsfo_device_id_ts";
//const DEVICE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const DEVICE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const authService = {
  deviceId: null as string | null,
  token: null as string | null,

  /**
   * Returns the existing deviceId OR generates a new one.
   * Regenerates if older than 3 hours.
   */
  getDeviceId() {
    // Already loaded into memory?
    if (this.deviceId) {
      return this.deviceId;
    }

    const storedId = localStorage.getItem(DEVICE_KEY);
    const storedTs = localStorage.getItem(DEVICE_TS_KEY);

    const now = Date.now();

    if (storedId && storedTs) {
      const age = now - parseInt(storedTs, 10);

      if (age < DEVICE_TTL_MS) {
        // Still valid
        this.deviceId = storedId;
        return this.deviceId;
      }
    }

    // Otherwise generate a fresh device ID
    const newId = crypto.randomUUID();
    this.deviceId = newId;

    localStorage.setItem(DEVICE_KEY, newId);
    localStorage.setItem(DEVICE_TS_KEY, now.toString());

    return newId;
  },

  /**
   * Returns current token
   */
  getToken() {
    return this.token;
  },

  /**
   * Saves the cookie authentication token
   */
  setToken(token: string) {
    this.token = token;
  }
};

export default authService;
