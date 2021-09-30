/**
 * ReactCompass - a carefully crafted Compass component for React.
 * https://github.com/virtyaluk/react-compass
 *
 * Copyright (c) 2016 Bohdan Shtepan
 * http://modern-dev.com/
 *
 * Licensed under the MIT license.
 *
 * @flow
 */

import React from 'react';
import { FULLTILT } from 'fulltilt-ng';
import styleNormalizer from 'react-style-normalizer';
import 'react-compass/src/styles.scss';
import "./Compass.css"

export default class Compass extends React.Component {
    static defaultProps = {
        direction: 0,
        directionNames: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        theme: "night"
    };

    constructor(props) {
        super(props);

        this.oldAngle = 0;

        this.state = { quaternion: 0, matrix: 0, euler: 0, supported: false }

    }

    componentDidMount() {
        this.calcCompass()
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

    calcCompass = () => {

        (async () => {
            try {
                const deviceOrientation = await FULLTILT.getDeviceOrientation({
                    type: 'world'
                });

                const draw = () => {
                    if (deviceOrientation) {
                        const quaternion = deviceOrientation.getScreenAdjustedQuaternion();
                        const matrix = deviceOrientation.getScreenAdjustedMatrix();
                        const euler = deviceOrientation.getScreenAdjustedEuler();

                        console.log(
                            quaternion,
                            matrix,
                            euler
                        );

                        this.setState({ quaternion: quaternion, matrix: matrix, euler: euler, supported: true })
                    }

                    requestAnimationFrame(draw);
                };

                draw();
            } catch (err) {
                // device orientation not supported
                console.log("device orientation not supported")
                this.setState({ supported: false })
            }
        })();
    }

    render() {
        let dir = this.normalizeAngle(this.state.euler),
            name = this.directionName(dir);

        return (
            <div className>
                {/* {this.state.supported && <div className="compass" style={this.state.euler} id={`compass-${this.props.theme.toLowerCase()}`}>
                    <div className="compass__windrose"
                        style={styleNormalizer({ transform: `rotate(-${this.state.euler}deg)` })}>
                        {[...Array(10)].map((k, i) => <div className="compass__mark" key={i + 1}></div>)}
                        <div className="compass__mark--direction-h"></div>
                        <div className="compass__mark--direction-v"></div>
                    </div>
                    <div className="compass__arrow-container">
                        <div className="compass__arrow"></div>
                        <div className="compass__labels">
                            <span>{name}</span>
                            <span>{Math.trunc(this.state.euler)}<sup>o</sup></span>
                        </div>
                    </div>
                </div>} */}

                <div className="FML">
                    <p>{`quaternion: ${this.state.quaternion}`}</p>
                    <p>{`matrix: ${this.state.matrix}`}</p>
                    <p>{`euler: ${this.state.euler}`}</p>
                </div>
            </div>


        );
    }
}