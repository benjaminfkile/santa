import { Component } from "react"
import { Modal, Spinner } from "react-bootstrap"
import { Link } from "react-router-dom"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./EndShow.css"

interface EndShowProps {
}

type EndShowTypes = {

}

class Endshow extends Component<EndShowProps, EndShowTypes> {



    state = {

    }



    openLink = (url: string) => {
        if (url) {
            window.open(url, '_blank')
        }
    }

    render() {


        return (
            <div className="EndShow">
                <div className="SemiSantaHeader">
                    <p>Semi Santa</p>
                </div>
                {/* <NavMenu /> */}
                <div className="EndShowModalBodyLaughingSantaWrapper">
                </div>
                <Modal id="endshow-modal"
                    show={true}
                    keyboard={false}
                    centered={true}
                >
                    <Modal.Header>
                        <div className="EndShowModalHeader">
                            <p className="EndShowModalHeaderP1">Semi Santa has left Missoula!</p>
                            {/* <p className="EndShowModalHeaderP2">Thank you to all our sponsors and donors.</p> */}
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="EndShowModalBody">
                            end show
                        </div>
                    </Modal.Body>
                </Modal>
                <Snow />
            </div>
        )
    }
}

export default Endshow