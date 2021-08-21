import { Component } from "react";
import AnimatedSanta from "../Utils/AnimatedSanta/AnimatedSanta";
import "./PreShow.css"

interface PreShowProps {
    santaDat: any
}

type PreShowTypes = {

}

class Preshow extends Component<PreShowProps, PreShowTypes> {

    render() {
        return (
            <div className="PreShow">
                <div className="PreShowHeader">
                    <h1>Merry Christmas!</h1>
                    <p>Santa is on his way, this page will turn into a map when he takes off.</p>
                </div>
                <div className="PreShowSantaWrapper">
                    <AnimatedSanta />
                </div>
                <div className="PreShowMessage">
                    <p> Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go. Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.Weather looks good, flight looks like its a go.</p>
                </div>
            </div>
        )
    }
}

export default Preshow