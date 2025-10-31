import axios from "axios";

let lastPercent = -1;

/**
 * fundData
 * --------
 * Periodically fetches the latest fund status, with a one-time retry
 * using the fallback URL if the primary call fails.
 */
const fundData = {
  percent: lastPercent,

  async getFundData() {
    const primary = process.env.REACT_APP_MRS_CLAUS_API_URL!;
    const fallback = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;

    // Attempt primary first
    try {
      const res = await axios.get(`${primary}/api/funds/get-fund-status`);
      if (res.data?.percent !== undefined) {
        this.percent = res.data.percent;
      }
      return;
    } catch (primaryErr) {
      console.warn(`[fundData] Primary fetch failed (${primary}).`, primaryErr);
    }

    // If primary fails, try fallback once
    if (fallback) {
      try {
        console.log(`[fundData] Retrying with fallback: ${fallback}`);
        const res = await axios.get(`${fallback}/api/funds/get-fund-status`);
        if (res.data?.percent !== undefined) {
          this.percent = res.data.percent;
        }
      } catch (fallbackErr) {
        console.error("[fundData] Fallback fetch also failed:", fallbackErr);
      }
    } else {
      console.error("[fundData] No fallback URL configured");
    }
  },
};

export default fundData;
