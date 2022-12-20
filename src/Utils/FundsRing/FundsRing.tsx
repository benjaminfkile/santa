import { Component } from "react"
import fundData from "./FundData"
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'

interface FundsRingProps {
    message?: string
    ringStrokeWidth?: number
}

type FundsRingTypes = {

}

class FundsRing extends Component<FundsRingProps, FundsRingTypes> {

    progress = 0
    animationDex = -1;
    state = {
        progress: -1
    }

    componentDidMount() {
        fundData.getFundData()
        this.checkForFunds()
    }

    checkForFunds = () => {
        if (fundData.percent < 0) {
            setTimeout(() => {
                this.checkForFunds()
            }, 500);
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
                        value={this.state.progress}
                        text={`${this.state.progress}%`}
                        strokeWidth={this.props.ringStrokeWidth || 5}
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