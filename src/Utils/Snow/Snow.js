import React, { Component } from 'react'
import './Snow.css'

class Snow extends Component {
    
    //make it snow
    render() {

        return (

            <div className="Snow">
                <div className="flakes" aria-hidden="true">
                    <div className="flake" key={Math.random}>
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                    <div className="flake">
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                    <div className="flake">
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                    <div className="flake">
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                    <div className="flake">
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                    <div className="flake">
                        ❅
            </div>
                    <div className="flake">
                        ❆
            </div>
                </div>
            </div>

        )
    }
}

export default Snow;