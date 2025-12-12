import { Component } from "react";
import NavMenu from "../../NavMenu/NavMenu";
import Snow from "../../Utils/Snow/Snow";
import { ISantaFlyoverData } from "../../interfaces";
import { Link } from "react-router-dom";
import Logo from "../../Utils/Logo/Logo";
import "./PreShow.css";

const FORCED_TIMEZONE = process.env.REACT_APP_FORCED_TIMEZONE;
const FORCED_TIME_ABBR = process.env.REACT_APP_FORCED_TIME_ABBR;
interface PreShowProps {
    santaFlyoverData: ISantaFlyoverData | null;
}

interface PreShowState {
    now: number;
}

class PreShow extends Component<PreShowProps, PreShowState> {

    timer: any;

    constructor(props: PreShowProps) {
        super(props);
        this.state = {
            now: Date.now()
        };
    }

    componentDidMount() {
        this.timer = setInterval(() => {
            this.setState({ now: Date.now() });
        }, 1000);
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    render() {

        const eventUpdate = this.props.santaFlyoverData?.eventUpdate;

        let formattedTime: string | null = null;
        let countdown: string | null = null;

        if (eventUpdate?.time) {
            const target = new Date(eventUpdate.time);

            if (!isNaN(target.getTime())) {

                const options: Intl.DateTimeFormatOptions = {
                    dateStyle: "short",
                    timeStyle: "short",
                };

                if (FORCED_TIMEZONE) {
                    options.timeZone = FORCED_TIMEZONE;
                }

                formattedTime = target.toLocaleString("en-US", options);

                const diff = target.getTime() - this.state.now;

                if (diff <= 0) {
                    countdown = null;
                } else {
                    const seconds = Math.floor(diff / 1000);

                    const days = Math.floor(seconds / 86400);
                    const hours = Math.floor((seconds % 86400) / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    const parts: string[] = [];

                    if (days > 0) parts.push(`${days}d`);
                    if (hours > 0) parts.push(`${hours}h`);
                    if (minutes > 0) parts.push(`${minutes}m`);
                    parts.push(`${secs}s`);

                    if (parts.length === 0) {
                        countdown = null;
                    } else {
                        countdown = parts.join(" ");
                    }
                }

            }
        }

        return (
            <div className="PreShow"
                style={{ backgroundImage: `url("${process.env.REACT_APP_MAP_NOT_ALLOWED_IMG}")` }}
            >
                <div className="PreShowLogoWraper">
                    <Logo />
                </div>

                <NavMenu />
                <Snow />

                <div className="preshow-info-card">


                    {formattedTime && (
                        <div className="preshow-event-top">
                            <p className="event-time-label">Scheduled Event Time</p>

                            <p className="event-time-value">
                                {formattedTime}
                                {FORCED_TIME_ABBR ? ` ${FORCED_TIME_ABBR}` : ""}
                            </p>

                            {countdown && (
                                <p className="event-countdown">
                                    {countdown}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="preshow-info-card-header">
                        <p id="preshow-info-card-header-p1">
                            Looks like Santa is still at the North Pole.
                        </p>
                        <p id="preshow-info-card-header-p2">
                            When he starts to move, you can interact with the map.
                        </p>
                    </div>

                    <div className="preshow-info-card-message">
                        <div className="preshow-info-card-route">
                            <Link to='/route'>
                                To view his route, click here
                            </Link>
                        </div>

                        {!eventUpdate?.message && (
                            <p>
                                When he’s on the move, come back here—this page will turn into
                                a tracker to help you locate him.
                            </p>
                        )}

                        {eventUpdate?.message && <p>{eventUpdate.message}</p>}
                    </div>
                </div>
            </div>
        );
    }
}

export default PreShow;
