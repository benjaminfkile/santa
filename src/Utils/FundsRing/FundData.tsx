import axios from "axios";

let usingFallbackFund = false;

const fundData = {
    percent: -1,

    async getFundData() {
        const primary = process.env.REACT_APP_MRS_CLAUS_API_URL!;
        const fallback = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;

        const activeUrl = usingFallbackFund && fallback ? fallback : primary;

        try {
            const res = await axios.get(`${activeUrl}/api/funds/get-fund-status`);
            if (res.data?.percent !== undefined) {
                fundData.percent = res.data.percent;
            }
        } catch (err) {
            if (!usingFallbackFund && fallback) {
                console.warn(
                    `Primary funds URL failed (${primary}), switching permanently to fallback: ${fallback}`
                );
                usingFallbackFund = true;
            } else {
                console.error("Failed to fetch fund data:", err);
            }
        }
    },
};

export default fundData;
