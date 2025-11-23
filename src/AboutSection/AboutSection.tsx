import { Component } from "react"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import NavMenu from "../NavMenu/NavMenu"
import Ornaments from "../Utils/Ornaments/Ornaments"
import Mistletoe from "../SVG/Mistletoe/Mistletoe"
import Logo from "../Utils/Logo/Logo"
import "./AboutSection.css"

class AboutSection extends Component {

    render() {
        return (
            <div className="AboutSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                <div className="AboutHeader">
                    <Logo />
                </div>
                <div className="AboutContent">
                    <p>
                        Western Montana Santa Flyover is a non-profit organization that, with the help of the Missoula Downtown Foundation,
                        is keeping the tradition of having Santa do a flight over Missoula Mt.
                        Throughout the years this flight has evolved and is now known as Santa’s Dash
                        Through the Big Sky Flyover. This flyover will take place several days before
                        Christmas Eve and will only happen ONCE. Updates about this flyover can be found on our official <a href="https://www.facebook.com/WesternMontanaSantaFlyover" target="_blank" rel="noreferrer">Facebook page</a>.
                    </p>
                    <p>
                        Santa’s Dash Through the Big Sky Flyover is only possible with the help of our sponsors and community.
                        To see how you can help, you can click <a href="/donate">here</a> to be directed to the donation page. Hearing the kids, and adults,
                        screaming “Santa” with cheer is what makes this flight a true Christmas Miracle.
                    </p>
                    <div className="AboutSectionContentImg1">
                        <img id="idfk" src="https://api.benkile.com/wmsfo-api/api/images/sponsors/18/1763941064281-mdf_lettermark_wordmark_2line_fullcolor.png" alt="" />
                    </div>
                    <h3>
                        How the Western Montana Santa Flyover organization started:
                    </h3>
                    <p>
                        In 2020, after a rough year of lockdowns and school closures, a group of Missoula residents
                        started a Facebook group to get more people interested in seeing Santa fly again. The group
                        grew rapidly and received a tremendous amount of support throughout the community. With
                        the help of the Missoula Downtown Foundation, volunteers and from your donations, Santa
                        flew over Missoula for the first time in over a decade. This group's plan is to continue this
                        tradition of bringing joy and Christmas spirit to Western Montana for years to come.
                    </p>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Some Elves working on getting Santa ready to fly</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/g4NDrCL/working-on-santa.jpg" alt="elves-working" />
                    </div>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Santa getting ready to take off</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/h73Bk7D/pre-flight.jpg" alt="pre-flight" />
                    </div>
                    <div className="AboutContentLowerItem">
                        <div className="AboutContentLowerItemHeader">
                            <Mistletoe id="about-lower-content-mistltoe" />
                            <p>Santa's light controller</p>
                            <Mistletoe id="about-lower-content-mistltoe" />
                        </div>
                        <img src="https://i.ibb.co/TMNDYyL/santa-light-controler.jpg" alt="light-controler" />
                    </div>
                </div>
            </div>
        )
    }
}

export default AboutSection

