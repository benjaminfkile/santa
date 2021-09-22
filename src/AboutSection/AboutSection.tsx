import { Component } from "react"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import LaughingSanta from "../Utils/LaughingSanta/LaughingSanta"
import NavMenu from "../NavMenu/NavMenu"
import "./AboutSection.css"
import Ornaments from "../Utils/Ornaments/Ornaments"
import Mistletoe from "../SVG/Mistletoe/Mistletoe"

class AboutSection extends Component {

    render() {
        return (
            <div className="AboutSection">
                <NavMenu />
                <div className="AboutSectionMistletoe">
                    <Mistletoe />
                </div>
                <JumpingElf />
                <Ornaments />
                <div className="LaughingSantaWrapper">
                    <LaughingSanta
                        message="406"
                    />
                </div>
                <div className="AboutHeader">
                    <p>Western Montana Santa Flyover</p>
                </div>
                <div className="AboutContent">
                    <div className="AboutContentR1">
                        <p>
                            Western Montana Santa Flyover is a non-profit organization devout to bringing back and keeping the tradition of the Santa Flyover in Missoula Mt.  Last year Missoula resident Lynn Lease started a Facebook group to get more people interested in seeing Santa fly again.  The group grew rapidly and received a tremendous amount of support throughout the community. With the help of volunteers and donations, Santa flew over Missoula for the first time in over a decade.
                        </p>
                    </div>
                    <div className="AboutContentR2">
                        <img src="https://i.ibb.co/YPh5L5k/133191519-10221868573215723-5050912979703431593-n.jpg" alt="Santa"/>
                        <img src="https://i.ibb.co/8gWYKhz/132043373-10221837913769256-4996238142914810894-n.jpg" alt="Santas Helicopter"/>
                    </div>
                </div>
            </div>
        )
    }
}

export default AboutSection

