import React, { Component } from 'react'
import './Snow.css'

class Snow extends Component {
    
    //make it snow
    render() {

        return (

            <div className="Snow">
                <div className="snowflakes" aria-hidden="true">
                    <div className="snowflake" key={Math.random}>
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                    <div className="snowflake">
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                    <div className="snowflake">
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                    <div className="snowflake">
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                    <div className="snowflake">
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                    <div className="snowflake">
                        ❅
            </div>
                    <div className="snowflake">
                        ❆
            </div>
                </div>
            </div>

        )
    }
}

export default Snow;