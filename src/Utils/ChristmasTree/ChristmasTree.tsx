import { Component } from "react"
import "./ChristmasTree.css"

class ChristmasTree extends Component {

    render() {
        return (
            <div className="container">
                <div className="star"></div>
                <div className="pressie">
                    <div className="cover"></div>
                    <div className="wrap"> </div>
                    <div className="ribbon"></div>
                </div>
                <div className="tree">
                    <div className="base"> </div>
                    <div className="layer">
                        <div className="line"> </div>
                        <div className="bauble one"></div></div>
                    <div className="layer two">
                        <div className="line two"> </div>
                        <div className="bauble two"></div>
                        <div className="socks">
                            <div className="top"> </div>
                            <div className="foot"></div></div>
                    </div>
                    <div className="layer three">
                        <div className="line three"> </div>
                        <div className="bauble three"></div>
                        <div className="socks two">
                            <div className="top"> </div>
                            <div className="foot two"></div></div>
                    </div>
                </div>
                <div className="layer four">
                    <div className="bauble four"></div>
                    <div className="star two"></div>
                    <div className="line four"> </div>
                </div>
            </div>
        )
    }
}

export default ChristmasTree