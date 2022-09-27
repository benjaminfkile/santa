import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import Logo from "../Utils/Logo/Logo"
import "./SponsorsSection.css"
import mutator from "../Utils/mutator"

interface SponsorsSectionProps {
    sponsors: any
}

interface SponsorsSectionState {
    yearDex: number
}

class SponsorsSection extends Component<SponsorsSectionProps, SponsorsSectionState>{


    state = {
        yearDex: 0
    }

    manageState = (keys: Array<{ key: string, value?: any }>) => {
        this.setState(mutator.mutate(this.state, keys))
    }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {

        const state = this.state
        const props = this.props

        const sponsorList = props.sponsors

        return (
            <div className="SponsorsSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="SposorSectionHeader">
                    <Logo />
                </div>
                {sponsorList.length > 0 && <div className="SponsorList">
                    <div className="SponsorListYearWrapper">
                        {sponsorList.map((item: { year: string, sponsors: Array<any> }, i: number) =>
                            <div key={`SponsorListYearItem-${i}`} className={`SponsorListYearItem SponsorListYearItem${state.yearDex === i ? "Checked" : "Unchecked"}`} onClick={() => this.manageState([{ key: "yearDex", value: i }])}>
                                <p>{item.year}</p>
                            </div>)}
                    </div>
                    {sponsorList[this.state.yearDex].sponsors.map((item: any, i: number) =>
                        <div className="SponsorItem" key={i} id={item.sponsor_id.replace(/[0-9]/g, '')}>
                            <div className="SponsorItemHeader">
                                <p>{item.name}</p>
                            </div>
                            <div className="SponsorLogoWrapper">
                                <img src={item.logo} alt="" />
                            </div>
                            {(item.website_url || item.fb_url) && <div className="SponsorFooter">
                                {/* {sponsor.website_url && <span className="material-icons" onClick={() => this.openLink(sponsor.website_url)}>link</span>} */}
                                {item.website_url && <a href={item.website_url} target="_blank" rel="noreferrer">{item.name}</a>}
                                {/*@ts-ignore*/}
                                {item.fb_url && <img src="/res/fb-icon.png" alt="" onClick={() => this.openLink(item.fb_url)} />}
                            </div>}
                        </div>
                    )}
                </div>}
            </div>
        )
    }
}

export default SponsorsSection