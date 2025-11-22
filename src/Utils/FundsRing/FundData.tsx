import axios from "axios";

let lastPercent = -1;

const fundData = {
  percent: lastPercent,

  async getFundData() {
    const primary = process.env.REACT_APP_MRS_CLAUS_API_URL!;
    const fallback = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;

    const primaryPath = "api/funds-status-cache";
    const fallbackPath = "api/funds/get-fund-status";

    // 1. Try PRIMARY
    try {
      const res = await axios.get(`${primary}/${primaryPath}`);
      if (res.data?.percent !== undefined) {
        this.percent = res.data.percent;
      }
      return; // success → done
    } catch (err) {
      console.warn("[fundData] Primary failed, trying fallback...");
    }

    // 2. Try FALLBACK
    if (fallback) {
      try {
        const res = await axios.get(`${fallback}/${fallbackPath}`);
        if (res.data?.percent !== undefined) {
          this.percent = res.data.percent;
        }
      } catch (fallbackErr) {
        console.error("[fundData] Fallback failed:", fallbackErr);
      }
    } else {
      console.error("[fundData] No fallback URL configured");
    }
  },
};

export default fundData;
