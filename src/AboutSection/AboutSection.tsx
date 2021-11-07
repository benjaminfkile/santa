import { Component } from "react"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import NavMenu from "../NavMenu/NavMenu"
import Ornaments from "../Utils/Ornaments/Ornaments"
import Mistletoe from "../SVG/Mistletoe/Mistletoe"
import "./AboutSection.css"

class AboutSection extends Component {

    render() {
        return (
            <div className="AboutSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="AboutHeader">
                    {/* <p>Western Montana Santa Flyover</p> */}
                    <img src="/res/wmsfo-logo.png" alt="" />
                </div>
                <div className="AboutContent">
                    <p>
                        We are a non-profit organization devout to bringing back and keeping the tradition of the Santa Flyover in Missoula Mt. Hearing the kids, and adults, screaming “Santa” with cheer is what makes this event a true Christmas Miracle.
                    </p>
                    <div className="AboutSectionContentImg1">
                        <img src="https://i.ibb.co/QrCcpqC/e353718c-01b2-46dc-b52a-7853c976bf66-750x422.jpg" alt="Santa" />
                        <p id="img-credit-about-i-1">Credit: Getty Images/iStockphoto</p>
                    </div>
                    <p>
                        In 2020, after a rough year of lockdowns and school closures, a group of Missoula residents started a Facebook group to get more people interested in seeing Santa fly again. The group grew rapidly and received a tremendous amount of support throughout the community. With the help of volunteers and donations, Santa flew over Missoula for the first time in over a decade. This group has now gone on to create a non-profit for the purpose of bringing Joy and Christmas Spirit to Missoula and as many surrounding Cities as possible.
                    </p>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Some Elves working on getting Santa ready to fly</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/g4NDrCL/working-on-santa.jpg" alt="elves-working" />
                    </div>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Santa getting ready to take off</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/h73Bk7D/pre-flight.jpg" alt="pre-flight" />
                    </div>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Santas light controler</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/TMNDYyL/santa-light-controler.jpg" alt="light-controler" />
                    </div>
                </div>
            </div>
        )
    }
}

export default AboutSection

