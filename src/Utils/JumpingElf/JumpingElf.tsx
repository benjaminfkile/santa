import { Component } from "react"
import "./JumpingElf.css"

class JumpingElf extends Component {

    render() {
        return (
            <div className="JumpingElf">
                <div className="fond">

                    <div className="contener_home_one">
                        <div className="fireplace">&nbsp;</div>
                        <div className="fireplace_top">&nbsp;</div>
                        <div className="triangle">&nbsp;</div>
                        <div className="parallelogram">&nbsp;</div>
                        <div className="door">&nbsp;</div>
                        <div className="window_one">&nbsp;</div>
                        <div className="window_two">&nbsp;</div>
                        <div className="home_base">&nbsp;</div>
                        <div className="christmas_tree"></div>
                        <div id="foo" className="christmas_tree"></div>
                        <div className="mountain_one"><div className="sub_mountain_one">&nbsp;</div></div>
                        <div className="mountain_two"><div className="sub_mountain_two">&nbsp;</div></div>
                        <div className="lutz">
                            <div className="lutin_pom">&nbsp;</div>
                            <div className="lutin_top">&nbsp;</div>
                            <div className="lutin_head">&nbsp;</div>
                            <div className="lutin_arm1">&nbsp;</div>
                            <div className="lutin_arm2">&nbsp;</div>
                            <div className="lutin_body">&nbsp;</div>
                            <div className="lutin_jb1">&nbsp;</div>
                            <div className="lutin_jb2">&nbsp;</div>
                        </div>
                    </div>
                    <div className="contener_snow">
                        <div className="snowflakes">
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                            <div className="snowflake">&nbsp;</div>
                        </div>
                    </div>

                    <div id="bar">&nbsp;</div>
                    {/* <div style=" padding:5px; color:#639da8; font-weight:300; font-size:55px; font-family:'Roboto';padding-top:20px;">Merry <font style="font-weight:400;">Christmas</font></div>
                    <a href="http://texxsmith.com" style="text-decoration:none;" target="_blank"><div style="  color:#639da8; font-weight:300; font-size:20px; font-family:'Roboto';">From the Smith Family</div></a> */}
                </div>

            </div>
        )
    }
}

export default JumpingElf