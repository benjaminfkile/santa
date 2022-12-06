import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import Logo from "../Utils/Logo/Logo"
import mutator from "../Utils/mutator"
import SponsorTypes from "./SponsorTypes"
import "./SponsorsSection.css"


interface SponsorsSectionProps {
    sponsors: any
}

interface SponsorsSectionState {
    sponsors: Array<SponsorTypes> | []
}

class SponsorsSection extends Component<SponsorsSectionProps, SponsorsSectionState>{


    state = {
        sponsors: [],
    }

    componentDidMount(): void {
        this.awaitSposnors()
    }

    manageState = (keys: Array<{ key: string, value?: any }>) => {
        this.setState(mutator.mutate(this.state, keys))
    }

    awaitSposnors = () => {
        //@ts-ignore
        const sponsors = this.props.sponsors.length > 0 ? this.props.sponsors[this.props.sponsors.length - 1].sponsors : []
        setTimeout(() => {
            if (sponsors.length > 0) {
                this.manageState([{key: "sponsors", value: sponsors}])
            } else {
                this.awaitSposnors()
            }
        }, 50)
    }

    // shuffleSponosors = (sponsors: Array<SponsorTypes>) => {
    //     let currentIndex = sponsors.length, randomIndex;
    //     while (currentIndex !== 0) {
    //         randomIndex = Math.floor(Math.random() * currentIndex)
    //         currentIndex--
    //         [sponsors[currentIndex], sponsors[randomIndex]] = [
    //             sponsors[randomIndex], sponsors[currentIndex]]
    //     }
    //     return sponsors
    // }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {

        const state = this.state
        const sponsors = state.sponsors

        return (
            <div className="SponsorsSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="SposorSectionHeader">
                    <Logo />
                </div>
                {sponsors.length > 0 && <div className="SponsorList">
                    {sponsors.map((item: any, i: number) =>
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