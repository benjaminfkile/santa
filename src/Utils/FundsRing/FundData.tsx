import axios from "axios"
let fundData = {
    percent: -1,
    getFundData: () => {
        axios.get(`${process.env.REACT_APP_MRS_CLAUS_API_URL}/api/funds/get-fund-status`)
            .then(res => {
                if (res.data.percent) {
                    fundData.percent = res.data.percent
                }
            })
    }
}
export default fundData