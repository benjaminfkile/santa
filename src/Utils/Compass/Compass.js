import React from 'react'
import 'react-compass/src/styles.scss'
import "./Compass.css"

export default class Compass extends React.Component {

    compassCircle
    myPoint
    startBtn
    isIOS
    pointDegree;


    componentDidMount() {

        this.compassCircle = document.querySelector(".compass-circle");
        this.myPoint = document.querySelector(".my-point");
        this.startBtn = document.querySelector(".start-btn");
        this.isIOS =
            navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
            navigator.userAgent.match(/AppleWebKit/);
        this.init();
    }

    init = () => {
        this.startBtn.addEventListener("click", this.startCompass);
        this.startCompass()
        const self = this

        setInterval(() => {
            navigator.geolocation.getCurrentPosition(self.locationHandler);
        }, 1000)
        if (!this.isIOS) {
            window.addEventListener("deviceorientationabsolute", this.handler, true);
        }
    }

    startCompass = () => {
        if (this.isIOS) {
            DeviceOrientationEvent.requestPermission()
                .then((response) => {
                    console.log(response)
                    if (response === "granted") {
                        window.addEventListener("deviceorientation", this.handler, true);
                    } else {
                        alert("has to be allowed!");
                    }
                })
                .catch(() => alert("not supported"));
        }
    }

    handler = (e) => {
        let compass = e.webkitCompassHeading || Math.abs(e.alpha - 360);
        this.compassCircle.style.transform = `translate(-50%, -50%) rotate(${-compass}deg)`;

        // ±15 degree
        if (
            (this.pointDegree < Math.abs(compass) &&
                this.pointDegree + 15 > Math.abs(compass)) ||
            this.pointDegree > Math.abs(compass + 15) ||
            this.pointDegree < Math.abs(compass)
        ) {
            this.myPoint.style.opacity = 0;
        } else if (this.pointDegree) {
            this.myPoint.style.opacity = 1;
        }
    }


    locationHandler = (position) => {
        console.log(position)
        const { latitude, longitude } = position.coords;
        this.pointDegree = this.calcDegreeToPoint(latitude, longitude);

        if (this.pointDegree < 0) {
            this.pointDegree = this.pointDegree + 360;
        }
    }

    calcDegreeToPoint = (latitude, longitude) => {
        // Qibla geolocation
        const point = {
            lat: 21.422487,
            lng: 39.826206
        };

        const phiK = (point.lat * Math.PI) / 180.0;
        const lambdaK = (point.lng * Math.PI) / 180.0;
        const phi = (latitude * Math.PI) / 180.0;
        const lambda = (longitude * Math.PI) / 180.0;
        const psi =
            (180.0 / Math.PI) *
            Math.atan2(
                Math.sin(lambdaK - lambda),
                Math.cos(phi) * Math.tan(phiK) -
                Math.sin(phi) * Math.cos(lambdaK - lambda)
            );
        return Math.round(psi);
    }


    render() {

        return (
            <div>
                <div className="compass" id={`compass-${this.props.theme.toLowerCase()}`}>
                    <div className="arrow"></div>
                    <div className="compass-circle"></div>
                    <div className="my-point"></div>
                </div>
                <button className="start-btn">Start compass</button>

            </div>

        )
    }
}