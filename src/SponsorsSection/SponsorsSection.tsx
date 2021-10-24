import { Component } from "react"
import axios from "axios"
import SponsorTypes from "./SponsorTypes"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./SponsorsSection.css"
import Logo from "../Utils/Logo/Logo"


interface SponsorsSectionProps {

}

type SponsorsSectionTypes = {
    sponsors: Array<SponsorTypes> | null
}

class SponsorsSection extends Component<SponsorsSectionProps, SponsorsSectionTypes>{

    state = {
        sponsors: []
    }

    componentDidMount() {
        axios.get("https://wmsfo-ms-claus.herokuapp.com/api/sponsors/get-sponsors")
            .then(res => {
                this.setState({ sponsors: res.data })
            }).catch(err => {
                console.log(err)
            })
    }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {

        return (
            <div className="SponsorsSection">
                <NavMenu />
                <Logo />
                <JumpingElf />
                <Ornaments />
                <div className="SponsorsHeader">
                    <p>Our Sponsors</p>
                </div>
                {this.state.sponsors.length > 0 && <div className="SponsorList">
                    {this.state.sponsors.map((sponsor: SponsorTypes, i: number) =>
                        <div className="SponsorItem" key={i}>
                            <div className="SponsorItemHeader">
                                <p>{sponsor.name}</p>
                            </div>
                            <div className="SponsorLogoWrapper">
                                <img src={sponsor.logo} alt="" />
                            </div>
                            {(sponsor.website_url || sponsor.fb_url) && <div className="SponsorFooter">
                                {/* {sponsor.website_url && <span className="material-icons" onClick={() => this.openLink(sponsor.website_url)}>link</span>} */}
                                {sponsor.website_url && <a href={sponsor.website_url} target="_blank" rel="noreferrer">{sponsor.name}</a>}
                                {sponsor.fb_url && <img src="/res/fb-icon.png" alt="" onClick={() => this.openLink(sponsor.fb_url)} />}
                            </div>}
                        </div>
                    )}
                </div>}
            </div>
        )
    }
}

export default SponsorsSection