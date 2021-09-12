import { Component } from "react"
import { Button } from "react-bootstrap"
import NavMenu from "../NavMenu/NavMenu"
import DonateToolkit from "../Utils/Donate/DonateToolkit"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./DonateSection.css"

class DonateSection extends Component {
    render() {
        return (
            <div className="DonateSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="DonateSectionHeader">
                    <p>Help Raise Money for Santas Flight</p>
                </div>
                <div className="DonateSectionText">
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Euismod quis viverra nibh cras pulvinar mattis nunc. Morbi tempus iaculis urna id volutpat lacus laoreet non curabitur. Et netus et malesuada fames ac turpis. Luctus venenatis lectus magna fringilla urna porttitor. Tellus rutrum tellus pellentesque eu tincidunt tortor aliquam nulla. Fringilla phasellus faucibus scelerisque eleifend. Lacus sed viverra tellus in hac habitasse platea dictumst. Nunc sed velit dignissim sodales ut eu sem. At erat pellentesque adipiscing commodo elit. In nibh mauris cursus mattis molestie a. Tincidunt nunc pulvinar sapien et ligula ullamcorper malesuada proin. Volutpat maecenas volutpat blandit aliquam etiam erat velit. Vel risus commodo viverra maecenas accumsan lacus vel facilisis volutpat. At in tellus integer feugiat.
                    </p>
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Platea dictumst vestibulum rhoncus est pellentesque. Sodales ut etiam sit amet nisl purus. Turpis egestas sed tempus urna. Ut pharetra sit amet aliquam id diam. Cras fermentum odio eu feugiat pretium nibh ipsum. Consectetur purus ut faucibus pulvinar elementum integer enim neque. Neque viverra justo nec ultrices dui sapien eget. Mauris augue neque gravida in fermentum et sollicitudin. Felis donec et odio pellentesque diam volutpat commodo sed. Nisl vel pretium lectus quam id leo in vitae. Sed libero enim sed faucibus.
                    </p>
                </div>
                <div className="DonateSectionDonateBtn">
                    <Button id="donate-section-donate-btn" onClick={() => DonateToolkit.toggleDonate()}>Donate</Button>
                </div>
            </div>
        )
    }
}

export default DonateSection