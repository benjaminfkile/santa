import { Component } from "react"
import fundData from "./FundData"
import axios from "axios"
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'

interface FundsRingProps {
    message?: string
}

type FundsRingTypes = {

}

class FundsRing extends Component<FundsRingProps, FundsRingTypes> {

    progress = 0
    animationDex = 0;
    state = {
        progress: -1
    }

    componentDidMount() {
        if (fundData.percent === -1) {
            axios.get(`${process.env.REACT_APP_MRS_CLAUS_API_URL}/api/funds/get-fund-status`)
                .then(res => {
                    if (res.data.percent) {
                        fundData.percent = res.data.percent
                        this.animateProgress()
                    }
                })
        } else {
            this.animateProgress()
        }
    }

    animateProgress = () => {
        const self = this
        setTimeout(() => {
            if (this.animationDex < fundData.percent) {
                self.progress++
                self.setState({ progress: self.state.progress + 1 })
                self.animateProgress()
                this.animationDex++
            }
        }, 10)
    }

    render() {
        return (
            <div className="FundsRing">
                {this.state.progress > -1 && <div className="FundsRingContent">
                    <CircularProgressbar
                        value={this.state.progress + 1}
                        text={`${this.state.progress + 1}%`}
                        strokeWidth={5}
                        styles={buildStyles({
                            rotation: 0.25,
                            strokeLinecap: 'butt',
                            textSize: "30px",
                            pathTransitionDuration: 0.5,
                            pathColor: "#007bff",
                            textColor: "#fffffff5",
                            trailColor: '#242526',
                            // backgroundColor: '#242526',
                        })}
                    />
                    {this.props.message && <p>{this.props.message}</p>}
                </div>}
            </div>
        )
    }
}

export default FundsRing