import { Component } from "react"
import "./Ornaments.css"

class Ornaments extends Component {

    render() {

        return (
            <div className="Ornaments">
                <div id="the-wrap">
                    {/*red ball*/}
                    <div className="ball-wrapper">
                        <div className="string"></div>
                        <div className="ring"></div>
                        <div id="rb-btn" className="button"></div>
                        <div className="red-ball"></div>
                    </div>


                    {/*green ball*/}
                    <div className="ball-wrapper">
                        <div className="string"></div>
                        <div className="ring"></div>
                        <div id="gb-btn" className="button"></div>
                        <div className="green-ball"></div>
                    </div>


                    {/*blue ball*/}
                    <div className="ball-wrapper">
                        <div className="string"></div>
                        <div className="ring"></div>
                        <div id="bb-btn" className="button"></div>
                        <div className="blue-ball"></div>
                    </div>

                    {/*white ball*/}
                    <div className="ball-wrapper">
                        <div className="string"></div>
                        <div className="ring"></div>
                        <div id="wb-btn" className="button"></div>
                        <div className="white-ball"></div>
                    </div>
                </div>
            </div>
        )
    }
}

export default Ornaments