import { Component } from "react"
import { Button } from "react-bootstrap"
import NavMenu from "../NavMenu/NavMenu"
// import DonateToolkit from "../Utils/Donate/DonateToolkit"
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
                <div className="DonateSectionHeader">
                    <Logo />
                </div>
                <div className="DonateSectionContent">
                    <div className="DonateSectionContentImg1">
                        <img src="https://i.ibb.co/CHQgfv8/glass-jar-full-of-cois-with-donate-written-on-it-charity-donation-philanthropy-large.jpg" alt="" />
                        <p id="img-credit-donate-i-1">Credit: The Motley Fool</p>
                    </div>
                    <p>
                        We depend on donations to pay for the cost of the flight, the cost of storing Santa, and the cost of materials such as lights and generators. 100% of all donations go toward funding Santa’s flight. We have partnered with the Missoula Downtown Foundation so that any donation made is tax-deductible. To donate, please click the Donate button below to be redirected to the Missoula Downtown Foundation donation page and select “Santa Flyover” in the “Project” drop-down menu.
                    </p>
                    <div className="DonateSectionDonateLetter">
                        <Button variant="secondary" id="donate-section-donate-btn" onClick={() => this.openLink("https://www.406santa.com/docs/WMSFO%20Donation%20Letter.pdf?fbclid=IwAR3qMCWcNUJflYBNdA5dhYohdYS9FdZIm-PqyCdYjaJKsSAEtPli7bt8jvM")}>Donation Letter</Button>
                    </div>
                </div>
                <div className="DonateSectionDonateBtn">
                    <Button id="donate-section-donate-btn" onClick={() => this.openLink("https://donations.missouladowntown.com/")}>Donate</Button>
                </div>

            </div>
        )
    }
}

export default DonateSection