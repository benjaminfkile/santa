import { Component } from "react"
import SponsorTypes from "../../SponsorsSection/SponsorTypes"
import Cat from "../Cat/Cat"
import "./SponsorCarousel.css"

interface SponsorCarouselProps {
    sponsors: Array<SponsorTypes> | []
    theme: string
}

type SponsorCarouselTypes = {
    sponsors: Array<SponsorTypes> | []
    sponsor: SponsorTypes | null
}

class SponsorCarousel extends Component<SponsorCarouselProps, SponsorCarouselTypes> {

    sponsorDex = 0
    delay = 0;

    state = {
        sponsors: [],
        sponsor: null
    }

    componentDidMount() {
        this.awaitSposnors()
    }

    awaitSposnors = () => {
        //@ts-ignore
        const sponsors = this.props.sponsors ? this.props.sponsors[this.props.sponsors.length - 1].sponsors : []
        setTimeout(() => {
            if (sponsors.length > 0) {
                this.setState({ sponsors: this.shuffleSponosors(sponsors) })
                this.handleCarousel()
            } else {
                this.awaitSposnors()
            }
        }, 500)
    }

    shuffleSponosors = (sponsors: Array<SponsorTypes>) => {
        let currentIndex = sponsors.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex)
            currentIndex--
            [sponsors[currentIndex], sponsors[randomIndex]] = [
                sponsors[randomIndex], sponsors[currentIndex]]
        }
        return sponsors
    }

    handleCarousel = () => {
        if (this.sponsorDex < this.state.sponsors.length - 1) {
            this.sponsorDex++
        } else {
            this.sponsorDex = 0
        }
        let sponsor: SponsorTypes = this.state.sponsors[this.sponsorDex]
        this.delay = sponsor.hangTime * 20
        this.setState({ sponsor: sponsor })
        setTimeout(() => {
            this.handleCarousel()
        }, this.delay)
    }

    openLink = (url: string) => {
        if (url) {
            window.open(url, '_blank')
        }
    }

    render() {

        let sponsor: SponsorTypes | any = this.state.sponsor || null

        return (
            <div className="SponsorCarousel">
                {sponsor && <div id={`sponsor-carousel-item-${this.props.theme.toLowerCase()}`} className="SponsorCarouselItem">
                    {sponsor.sponsor_id === "2a56681e-b68f-4e88-afc5-44c4a18475bf" && <Cat/>}
                    <img src={sponsor.logo} onClick={() => this.openLink(sponsor.website_url)} alt="" />
                </div>}
            </div>
        )
    }
}

export default SponsorCarousel