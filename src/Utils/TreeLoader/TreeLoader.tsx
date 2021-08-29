import { Component } from "react"
import "./TreeLoader.css"

class TreeLoader extends Component {

    render() {
        return (
            <div className="TreeLoader">
                <div className="tree">
                    <svg viewBox="0 0 120 140">
                        <polygon className="p" fill="none" strokeWidth="1" points="60,10 10,110 110,110 " />
                        <circle className="c c1" id="c1" cx="30" cy="100" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c2" id="c2" cx="65" cy="40" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c3" id="c3" cx="90" cy="90" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c4" id="c4" cx="50" cy="60" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c5" id="c5" cx="69" cy="102" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c6" id="c6" cx="45" cy="80" r="4" fill="none" strokeWidth="1" />
                        <circle className="c c7" id="c7" cx="75" cy="70" r="4" fill="none" strokeWidth="1" />
                    </svg>
                </div>
                <div className="TreeLoaderFooter">
                    <p>Looking for Rudolph...</p>
                </div>
            </div>
        )
    }
}

export default TreeLoader