import { Component } from "react"
import { Button } from "react-bootstrap"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Logo from "../Utils/Logo/Logo"
import Ornaments from "../Utils/Ornaments/Ornaments"
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import "./DonateSection.css"
import axios from "axios"

interface DonateProps {

}

type DonateTypes = {
    progress: number
}

class DonateSection extends Component<DonateProps, DonateTypes> {

    percent = -1
    progress = 0

    animationDex = 0;

    state = {
        progress: -1
    }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    componentDidMount() {
        axios.get(`${process.env.REACT_APP_MRS_CLAUS_API_URL}/api/funds/get-fund-status`)
            .then(res => {
                if (res.data.percent) {
                    this.percent = res.data.percent
                    this.animateProgress()
                }
            })
    }

    animateProgress = () => {
        const self = this
        setTimeout(() => {
            if (this.animationDex < this.percent) {
                self.progress++
                self.setState({ progress: self.state.progress + 1 })
                self.animateProgress()
                this.animationDex++
            }
        }, 10)
    }

    render() {
        return (
            <div className="DonateSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                {this.state.progress > -1 && <div className="FundsRaised">
                    <p>Funds Raised</p>
                    <div className="FundsRaisedRingWrapper">
                        <CircularProgressbar
                            value={this.state.progress + 1}
                            text={`${this.state.progress + 1}%`}
                            strokeWidth={5}
                            styles={buildStyles({
                                // Rotation of path and trail, in number of turns (0-1)
                                rotation: 0.25,

                                // Whether to use rounded or flat corners on the ends - can use 'butt' or 'round'
                                strokeLinecap: 'butt',

                                // Text size
                                textSize: "30px",

                                // How long animation takes to go from one percentage to another, in seconds
                                pathTransitionDuration: 0.5,

                                // Can specify path transition in more detail, or remove it entirely
                                // pathTransition: 'none',

                                // Colors
                                pathColor: "#007bff",
                                textColor: "#fffffff5",
                                trailColor: '#242526',
                                backgroundColor: '#3e98c7',
                            })}
                        />
                    </div>
                </div>}
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
                    <div className="DonateSectionDonateForm">
                        <Button variant="secondary" id="donate-section-donate-btn" onClick={() => this.openLink("https://www.406santa.com/docs/WMSFO%20Donation%20Form.pdf?fbclid=IwAR2ewnMp31T43IrJ_flL_pDqk6-wjnMOiVQUBwOGdqQz6p3uG-mbYqRkJTo")}>Donation Form</Button>
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