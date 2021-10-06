import React from 'react'
import styleNormalizer from 'react-style-normalizer';
import 'react-compass/src/styles.scss';
import "./Compass.css"

export default class Compass extends React.Component {

    static defaultProps = {
        direction: 0,
        directionNames: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        theme: "night"
    };

    compassCircle
    myPoint
    startBtn
    isIOS
    pointDegree;

    constructor(props) {
        super(props);

        this.oldAngle = 0;

        this.state = {
            compassValue: 0
        }
    }


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
        // this.startBtn.addEventListener("click", this.startCompass);
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
        // this.compassCircle.style.transform = `translate(-50%, -50%) rotate(${-compass}deg)`;
        this.setState({ compassValue: -compass })
        // ±15 degree
        // if (
        //     (this.pointDegree < Math.abs(compass) &&
        //         this.pointDegree + 15 > Math.abs(compass)) ||
        //     this.pointDegree > Math.abs(compass + 15) ||
        //     this.pointDegree < Math.abs(compass)
        // ) {
        //     this.myPoint.style.opacity = 0;
        // } else if (this.pointDegree) {
        //     this.myPoint.style.opacity = 1;
        // }
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

    directionName(dir) {
        let sections = this.props.directionNames.length,
            sect = 360 / sections,
            x = Math.floor((dir + sect / 2) / sect);

        x = x >= sections ? 0 : x;

        return this.props.directionNames[x];
    }

    normalizeAngle(direction) {
        let newAngle = direction,
            rot = this.oldAngle || 0,
            ar = rot % 360;

        while (newAngle < 0) {
            newAngle += 360;
        }
        while (newAngle > 360) {
            newAngle -= 360;
        }
        while (rot < 0) {
            rot += 360;
        }
        while (rot > 360) {
            rot -= 360;
        }

        if (ar < 0) {
            ar += 360;
        }
        if (ar < 180 && newAngle > ar + 180) {
            rot -= 360;
        }
        if (ar >= 180 && newAngle <= ar - 180) {
            rot += 360;
        }

        rot += newAngle - ar;
        this.oldAngle = rot;

        return rot;
    }


    /////////////////////////////////////////////////////////////////////////////////////////////////////    


    render() {
        let dir = this.normalizeAngle(this.state.compassValue),
            name = this.directionName(dir);

        return (
            <div className="compass" id={`compass-${this.props.theme.toLowerCase()}`}>
                <div className="SantaRing"
                    style={styleNormalizer({ transform: `rotate(${dir - this.props.santaBearing}deg)` })}>
                    <div className="SantaRingMark">
                        <img id="santa-ring-icon" src="./res/santa-hat.png" alt=""></img>
                    </div>
                </div>
                <div className="compass__windrose"
                    style={styleNormalizer({ transform: `rotate(${dir}deg)` })}>
                    {[...Array(10)].map((k, i) => <div className="compass__mark" key={i + 1}></div>)}
                    <div className="compass__mark--direction-h"></div>
                    <div className="compass__mark--direction-v"></div>
                </div>
                <div className="compass__arrow-container">
                    <div className="compass__arrow"></div>
                    <div className="compass__labels">
                        <span>{name}</span>
                        <span>{Math.trunc(dir)}<sup>o</sup></span>
                    </div>
                </div>
            </div>
        );
    }
}