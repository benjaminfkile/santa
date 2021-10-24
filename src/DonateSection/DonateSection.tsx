import { Component } from "react"
import { Button } from "react-bootstrap"
import NavMenu from "../NavMenu/NavMenu"
import MoneyTransferSVG from "../SVG/MoneyTransfer/MoneyTransferSVG"
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
                {/* <div className="PageMarkerSVG">
                    <MoneyTransferSVG />
                </div> */}
                <div className="DonateSectionHeader">
                    <p>Help Raise Money for Santas Flight</p>
                </div>
                <div className="DonateSectionContent">
                    <div className="DonateSectionContentImg1">
                        <img src="https://i.ibb.co/CHQgfv8/glass-jar-full-of-cois-with-donate-written-on-it-charity-donation-philanthropy-large.jpg" alt="" />
                        <p id="img-credit-donate-i-1">Credit: The Motley Fool</p>
                    </div>
                    <p>
                        As a non-profit organization, we depend on donations to help pay for the cost of the flight, the cost of storing Santa, and the cost of materials such as lights and generators.  100% of all donations go toward funding Santas flight.  Any donation made is tax-deductible.
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