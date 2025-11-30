import { Component } from "react";
import userLocation from "./UserLocation";
import { Button, Modal } from "react-bootstrap";
import "./LocationPromt.css";

interface LocationPromptProps {
    toggleLocationPrompt: Function;
    theme: string;
    getUserLocation: Function;
}

type LocationPromptTypes = {};

class LocationPrompt extends Component<LocationPromptProps, LocationPromptTypes> {
    getOSInstructions() {
        const ua = navigator.userAgent.toLowerCase();

        if (/iphone|ipad|ipod/.test(ua)) {
            return (
                <>
                    <p className="LocationPromtGreenParagraph">
                        iOS Instructions:
                    </p>
                    <ul>
                        <li>Open the <strong>Settings</strong> app.</li>
                        <li>Go to <strong>Privacy & Security → Location Services</strong>.</li>
                        <li>Find <strong>Safari</strong> (or your browser) and allow location.</li>
                        <li>Reload this page afterward.</li>
                    </ul>
                </>
            );
        }

        if (/android/.test(ua)) {
            return (
                <>
                    <p className="LocationPromtGreenParagraph">
                        Android Instructions:
                    </p>
                    <ul>
                        <li>Open your device <strong>Settings</strong>.</li>
                        <li>Go to <strong>Location</strong>.</li>
                        <li>Tap <strong>App Permissions</strong> and allow your browser.</li>
                        <li>Reload this page afterward.</li>
                    </ul>
                </>
            );
        }

        return (
            <>
                <p className="LocationPromtGreenParagraph">
                    Desktop Instructions:
                </p>
                <ul>
                    <li>Click the <strong>lock icon</strong> next to the URL.</li>
                    <li>Find <strong>Location</strong> and select <strong>Allow</strong>.</li>
                    <li>Reload this page afterward.</li>
                </ul>
            </>
        );
    }

    getBrowserWarning() {
        if (userLocation.inApp()) {
            return (
                <p className="LocationPromtYellowParagraph">
                    You are currently using Facebook or Instagram’s in-app browser.
                    Location updates may not work properly.
                    <strong>For best results, open this page in Safari, Chrome, or Edge.</strong>
                </p>
            );
        }
        return null;
    }

    handleUserRevokeLocation = () => {
        userLocation.disable = true;
        this.props.toggleLocationPrompt();
    };

    handleUserAllowLocation = () => {
        userLocation.disable = false;
        this.props.toggleLocationPrompt();

        if (!userLocation.inApp()) {
            userLocation.getUserLocation();
            setInterval(() => {
                userLocation.getUserLocation();
            }, 5000);
        } else {
            userLocation.getUserLocation();
        }
    };

    render() {
        const theme = this.props.theme.toLowerCase();

        return (
            <div className="LocationPrompt">
                {userLocation.disable && (
                    <Modal
                        id={`location-prompt-modal-${theme}`}
                        show={true}
                        keyboard={false}
                    >
                        <Modal.Header>
                            <div
                                className="LocationPromptCustomModalHeader"
                                id={`location-prompt-custom-modal-header-${theme}`}
                            >
                                <p>Enable Location Services?</p>
                            </div>
                        </Modal.Header>

                        <Modal.Body>
                            <div
                                className="LocationPromptCustomModalBody"
                                id={`location-prompt-custom-modal-body-${theme}`}
                            >
                                <p>
                                    Allowing your location enables real-time updates
                                    showing how far you are from Santa.
                                </p>

                                <p>
                                    After clicking <strong>“Ok”</strong>, your browser will ask
                                    whether to allow 406santa.org to access your location.
                                </p>

                                {this.getBrowserWarning()}

                                <p className="LocationPromtYellowParagraph">
                                    If you previously tapped “Block,” your browser will
                                    <strong> not show the permission popup again</strong>.
                                    You must re-enable location manually in settings:
                                </p>

                                {this.getOSInstructions()}

                                <p className="LocationPromtGreenParagraph">
                                    Location services work best in Chrome, Safari, and Edge.
                                </p>
                            </div>
                        </Modal.Body>

                        <Modal.Footer>
                            <div className="LocationPromptCustomModalFooter">
                                <Button
                                    variant="secondary"
                                    onClick={() => this.props.toggleLocationPrompt()}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={this.handleUserAllowLocation}>Enable</Button>
                            </div>
                        </Modal.Footer>
                    </Modal>
                )}

                {!userLocation.disable && (
                    <Modal
                        id={`location-prompt-modal-${theme}`}
                        show={true}
                        keyboard={false}
                        centered
                    >
                        <Modal.Header>
                            <div
                                className="LocationPromptCustomModalHeader"
                                id={`location-prompt-custom-modal-header-${theme}`}
                            >
                                <p>Disable Location Services?</p>
                            </div>
                        </Modal.Header>

                        <Modal.Body>
                            <div
                                className="LocationPromptCustomModalBody"
                                id={`location-prompt-custom-modal-body-${theme}`}
                            >
                                <p>You can re-enable location services anytime.</p>
                            </div>
                        </Modal.Body>

                        <Modal.Footer>
                            <div className="LocationPromptCustomModalFooter">
                                <Button
                                    variant="secondary"
                                    onClick={() => this.props.toggleLocationPrompt()}
                                >
                                    Back
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={this.handleUserRevokeLocation}
                                >
                                    Disable
                                </Button>
                            </div>

                        </Modal.Footer>
                    </Modal>
                )}
            </div>
        );
    }
}

export default LocationPrompt;
