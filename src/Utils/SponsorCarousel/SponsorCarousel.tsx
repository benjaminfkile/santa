import { Component } from "react"
import SponsorTypes from "../../SponsorsSection/SponsorTypes"
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
        const self = this
        setTimeout(() => {
            if (self.props.sponsors.length > 0) {
                self.setState({ sponsors: self.shuffleSponosors(self.props.sponsors) })
                self.handleCarousel()
            } else {
                self.awaitSposnors()
            }
        }, 500)
    }

    shuffleSponosors = (array: Array<SponsorTypes>) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex)
            currentIndex--
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]]
        }
        return array
    }

    handleCarousel = () => {
        const self = this
        setTimeout(() => {
            if (self.sponsorDex < self.state.sponsors.length - 1) {
                self.sponsorDex++
            } else {
                self.sponsorDex = 0
            }
            let sponsor: SponsorTypes = self.state.sponsors[self.sponsorDex]
            this.delay = sponsor.hangTime * 20
            self.setState({ sponsor: sponsor })
            self.handleCarousel()
        }, this.delay)
    }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {

        // console.log(this.state.sponsors)

        let sponsor: SponsorTypes | any = this.state.sponsor || null

        return (
            <div className="SponsorCarousel">
                {sponsor && <div id={`sponsor-carousel-item-${this.props.theme.toLowerCase()}`} className="SponsorCarouselItem">
                    <img src={sponsor.logo_small} onClick={() => this.openLink(sponsor.website_url)} alt="" />
                </div>}
            </div>
        )
    }
}

export default SponsorCarousel