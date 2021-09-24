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

                <div className="AboutHeader">
                    <p>Western Montana Santa Flyover</p>
                </div>
                <div className="AboutContent">
                    <p>
                        Western Montana Santa Flyover is a non-profit organization devout to bringing back and keeping the tradition of the Santa Flyover in Missoula Mt. Hearing the kids, and adults, screaming “Santa” with cheer is what makes this event a true Christmas Miracle.
                    </p>
                    <div className="AboutSectionContentImg1">
                        <img src="https://i.ibb.co/CBx9nSr/unnamed.jpg" alt="Santa" />
                    </div>
                    <p>
                    Last year Missoula resident Lynn Lease started a Facebook group to get more people interested in seeing Santa fly again.  The group grew rapidly and received a tremendous amount of support throughout the community. With the help of volunteers and donations, Santa flew over Missoula for the first time in over a decade.
                    </p>
                </div>
            </div>
        )
    }
}

export default AboutSection

