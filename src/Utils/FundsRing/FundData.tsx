import axios from "axios";

const fundData = {
  percent: -1,

  async getFundData() {
    const API = process.env.REACT_APP_API_URL!;
    const path = "api/funds-status";

    try {
      const res = await axios.get(`${API}/${path}`);
      if (res.data?.percent !== undefined) {
        this.percent = res.data.percent;
      }
    } catch (err) {
      console.error("[fundData] Failed to fetch fund data:", err);
    }
  },
};

export default fundData;
