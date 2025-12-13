import axios from "axios";
import snackBar from "../snackBar/SnackBar";

const fundData = {
  percent: -1,

  async getFundData() {
    const API = process.env.REACT_APP_API_URL!;
    const path = "api/funds-status";

    try {
      const res = await axios.get(`${API}/${path}`);
      if (res.data?.percent !== undefined) {
        fundData.percent = res.data.percent;
      }
      return res.data;
    } catch (err) {
      snackBar({ text: "Failed to fetch funds", type: "error", timeout: 3000 })
      console.error("[fundData] Failed to fetch fund data:", err);
      throw err;
    }
  },
};

export default fundData;
