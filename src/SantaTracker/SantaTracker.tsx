import { Component } from "react";
import Runshow from "./RunShow/Runshow"
import cookies from "../Utils/Cookies/Cookies"
import NoSleep from 'nosleep.js';

interface SantaTrackerProps {
    santaDat: any
}

type SantaTrackerTypes = {
    preShow: boolean
    runShow: boolean
    endShow: boolean
    returnUser: boolean
}

class SantaTracker extends Component<SantaTrackerProps, SantaTrackerTypes> {

    noSleep = new NoSleep();

    state = {
        preShow: false,
        runShow: true,
        endShow: false,
        returnUser: false,
    }

    componentDidMount() {

        if (cookies.getCookie("ReturnUser")) {
            this.setState({ returnUser: true })
        } else {
            cookies.setCookie("ReturnUser", "true", 8)
        }
        try {
            setTimeout(() => {
                this.noSleep.enable()
            }, 5000)
        } catch (err) {
            console.log("failed to enable no-sleep")
        }
    }

    componentWillUnmount() {
        this.noSleep.disable()
    }

    render() {
        return (
            <div className="SantaTracker">
                {this.state.runShow && this.props.santaDat && <div className="RunShow">
                    <Runshow
                        santaDat={this.props.santaDat}
                    />
                </div>}
            </div>
        )
    }
}

export default SantaTracker