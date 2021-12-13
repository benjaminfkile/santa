import { Component } from "react"
import { Modal, Spinner } from "react-bootstrap"
import { Link } from "react-router-dom"
import SponsorTypes from "../../SponsorsSection/SponsorTypes"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./EndShow.css"

interface EndShowProps {
    sponsors: Array<SponsorTypes> | []
}

type EndShowTypes = {

}

class Endshow extends Component<EndShowProps, EndShowTypes> {

    sponsorDex = 0
    delay = 0

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
        }, 100)
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

        let sponsor: SponsorTypes | any = this.state.sponsor || null

        return (
            <div className="EndShow">
                <div className="EndShowModalBodyLaughingSantaWrapper">
                    <LaughingSanta
                        message={"406"}
                    />
                </div>
                <Modal id="endshow-modal"
                    show={true}
                    keyboard={false}
                    centered={true}
                >
                    <Modal.Header>
                        <div className="EndShowModalHeader">
                            <p className="EndShowModalHeaderP1">Santa has left Missoula!</p>
                            <p className="EndShowModalHeaderP2">Thank you to all our sponsors and donors.</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="EndShowModalBody">
                            {!sponsor && <Spinner id="endshow-waiting-for-images" animation="border" />}
                            {sponsor && <img src={sponsor.logo_small} alt="" />}
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <div className="EndShowModalFooter">
                            <div id="end-show-sponsor-link">
                                {sponsor && <p onClick={() => this.openLink(sponsor.website_url)}>{sponsor.name}</p>}
                            </div>
                            <Link to='/about'>
                                <span id="endshow-home-btn" className="material-icons">home</span>
                            </Link>
                        </div>
                    </Modal.Footer>
                </Modal>
                <Snow />
            </div>
        )
    }
}

export default Endshow