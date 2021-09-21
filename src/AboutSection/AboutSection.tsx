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
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ornare aenean euismod elementum nisi quis eleifend quam adipiscing vitae. Amet luctus venenatis lectus magna fringilla urna. Vel quam elementum pulvinar etiam non. Dictum varius duis at consectetur lorem. Tempor nec feugiat nisl pretium fusce. Adipiscing at in tellus integer feugiat scelerisque. Mauris augue neque gravida in. Tortor aliquam nulla facilisi cras fermentum odio eu feugiat. Eu augue ut lectus arcu bibendum.
                    </p>
                    <p>
                        Aliquam faucibus purus in massa tempor nec feugiat nisl. Tincidunt praesent semper feugiat nibh sed pulvinar. Elit eget gravida cum sociis. Quam nulla porttitor massa id. Vestibulum rhoncus est pellentesque elit. Metus vulputate eu scelerisque felis. Risus feugiat in ante metus dictum at tempor. Justo nec ultrices dui sapien eget mi proin sed libero. Purus gravida quis blandit turpis.
                    </p>
                </div>
            </div>
        )
    }
}

export default AboutSection

