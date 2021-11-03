import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import ContactParamTypes from "./ContactParamTypes"
import ContactParams from "./ContactParams"
import { Button, FormControl, Spinner } from "react-bootstrap"
import reggie from "../Utils/Reggie"
import axios from "axios"
import "./ContactSection.css"

type ContactSectionTypes = {
    params: ContactParamTypes
    eventType: string
    complete: boolean
    messageSuccess: boolean
    messageFailure: boolean
    saving: boolean
}

class ContactSection extends Component<{}, ContactSectionTypes> {

    state = {
        params: ContactParams,
        eventType: "",
        complete: false,
        messageSuccess: false,
        messageFailure: false,
        saving: false
    }

    componentDidMount() {
        for (const [key] of Object.entries(ContactParams)) {
            ContactParams[key] = null
        }
        this.setState({
            params: ContactParams,
            eventType: "",
            complete: false,
            messageSuccess: false,
            messageFailure: false,
            saving: false
        })
    }

    setEventType = (eventType: string) => {
        this.setState({ eventType: eventType })
    }

    handleChange = (event: { target: { value: string } }) => {
        let input = event.target.value
        let temp = this.state.params
        if (input.trim() !== "") {
            temp[this.state.eventType] = input
        } else {
            temp[this.state.eventType] = null
        }
        this.setState({ params: temp })
        this.submitCheck()
    }

    submitCheck = () => {
        let params = this.state.params
        if (params.name &&
            params.email &&
            params.message &&
            this.validMessageLength(params.message) &&
            reggie.validateMail(params.email)
        ) {
            this.setState({ complete: true })
        } else {
            this.setState({ complete: false })
        }
    }

    validMessageLength = (message: string) => {
        if (message) {
            let str = message.split(" ").join("") || ""
            if (str && (str.length > 1 && str.length <= 500)) {
                return true
            }
        }
        return false
    }

    sendMessage = () => {
        this.setState({ saving: true })
        let rb = this.state.params
        axios.post(`http://localhost:8000/api/contact`, rb)
            .then(res => {
                for (const [key] of Object.entries(ContactParams)) {
                    ContactParams[key] = null
                }
                this.setState({ messageSuccess: true, messageFailure: false, params: ContactParams, saving: false })
            }).catch(err => {
                console.log(err)
                this.setState({ messageSuccess: true, messageFailure: false, params: ContactParams, saving: false })
            })
    }

    openLink = (url: string) => {
        window.open(url, '_blank')
    }

    render() {

        // console.log("Params: ", this.state.params)
        // console.log("Event Type: " + this.state.eventType)
        // console.log("Form Complete: " + this.state.complete)

        return (
            <div className="ContactSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="ContactSectionHeader">
                    <p>Contact Us</p>
                </div>
                <div className="ContactSectionInputWrapper">
                    <div className="ContactSectionInputWrapperUpper">
                        <div className="ContactSectionInputWrapperUpperInput">
                            {this.state.params.name && <div className="ContactSectionValidField">
                                <span className="material-icons">done</span>
                            </div>}
                            {!this.state.params.name && <div className="ContactSectionInvalidField">
                                <span className="material-icons">close</span>
                            </div>}
                            <FormControl onFocus={() => this.setEventType("name")}
                                type="text"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={"Name"}
                                onChange={this.handleChange}
                                value={this.state.params.name || ""}
                            />
                        </div>
                        <div className="ContactSectionInputWrapperUpperInput">
                            {reggie.validateMail(this.state.params.email) && <div className="ContactSectionValidField">
                                <span className="material-icons">done</span>
                            </div>}
                            {!reggie.validateMail(this.state.params.email) && <div className="ContactSectionInvalidField">
                                <span className="material-icons">close</span>
                            </div>}
                            <FormControl onFocus={() => this.setEventType("email")}
                                type="text"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={"Email"}
                                onChange={this.handleChange}
                                value={this.state.params.email || ""}
                            />
                        </div>
                    </div>
                    <div className="ContactSectionMessageWrapper">
                        {this.validMessageLength(this.state.params.message) && <div className="ContactSectionValidField">
                            <span className="material-icons">done</span>
                        </div>}
                        {!this.validMessageLength(this.state.params.message) && <div className="ContactSectionInvalidField">
                            <span className="material-icons">close</span>
                        </div>}
                        <FormControl onFocus={() => this.setEventType("message")}
                            as="textarea"
                            rows={10}
                            placeholder={"Message (100-1000 characters)"}
                            onChange={this.handleChange}
                            value={this.state.params.message || ""}
                        />
                    </div>
                </div>
                {this.state.complete && !this.state.saving && <div className="ContactSectionSaveBtnWrapper">
                    <Button onClick={() => this.sendMessage()}>Send</Button>
                </div>}
                {this.state.saving && <div className="ContactSectionSavingBtnWrapper">
                    <Spinner animation="border" />
                </div>}

                <div className="OtherContactMethods">
                    <div className="OtherContactMethodsSocial">
                        <img src="/res/fb-icon.png" alt="" onClick={() => this.openLink("https://www.facebook.com/groups/374773957140495")} />
                    </div>
                    <div className="OtherContactMethodsEmail">
                        <span className="material-icons" onClick={() => this.openLink("mailto:wmsfo@gmail.com")}>email</span>
                    </div>
                </div>
            </div>
        )
    }
}

export default ContactSection