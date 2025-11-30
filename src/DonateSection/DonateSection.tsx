import { Component } from "react"
import { Button } from "react-bootstrap"
import NavMenu from "../NavMenu/NavMenu"
import FundsRing from "../Utils/FundsRing/FundsRing"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Logo from "../Utils/Logo/Logo"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./DonateSection.css"

class DonateSection extends Component {


    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {


        return (
            <div className="DonateSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="FundsRaisedRingWrapper">
                    <FundsRing
                        message={"Funds Raised"}
                    />
                </div>
                <div className="DonateSectionHeader">
                    <Logo />
                </div>
                <div className="DonateSectionContent">
                    <div className="DonateSectionContentImg1">
                        <img src={`${process.env.REACT_APP_DONATE}`} alt="" />
                    </div>
                    <p>
                        We depend on donations to cover the costs of flight, storage, maintenance, and improvements. 100% of all donations go toward making the Santa flyover happen. We have partnered with the Missoula Downtown Foundation, ensuring that any donation made is tax-deductible. To donate, please click the <strong>Donate</strong> button below.
                    </p>
                    {/* <div className="DonateSectionDonateForm">
                        <Button variant="secondary" id="donate-section-donate-btn" onClick={() => this.openLink("https://www.406santa.com/docs/WMSFO%20Donation%20Form.pdf?fbclid=IwAR2ewnMp31T43IrJ_flL_pDqk6-wjnMOiVQUBwOGdqQz6p3uG-mbYqRkJTo")}>Donation Form</Button>
                    </div> */}
                </div>
                <div className="DonateSectionDonateBtn">
                    <Button id="donate-section-donate-btn" onClick={() => this.openLink("https://donate.stripe.com/cN2eY1aQF9jqgyA7sv")}>Donate</Button>
                </div>

            </div>
        )
    }
}

export default DonateSection