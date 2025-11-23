import { useState, useEffect } from "react";
import LocationPrompt from "../../../Utils/UserLocation/LocationPrompt";
import userLocation from "../../../Utils/UserLocation/UserLocation";
import ChooseCookies from "../../../Utils/ChooseCookies/ChooseCookies";
import ToggleStatus from "./ToggleStatus/ToggleStatus";
import "./Menu.css";


const TrackerMenu = (props: {
    changeTheme: any;
    toggleMapTypes: any;
    toggleHistory: any;
    mapType: any;
    availableThemes: any;
    currentTheme: any;
    toggleSnow: any;
    menuOpen: any;
    santaDat: any;
    getUserLocation: any;
    DistanceFromUserToSanta: any;
}) => {
    const {
        changeTheme,
        toggleMapTypes,
        toggleHistory,
        mapType,
        availableThemes,
        currentTheme,
        toggleSnow,
        menuOpen: parentMenuOpen,
        santaDat,
        getUserLocation,
        DistanceFromUserToSanta,
    } = props;

    const [menuOpen, setMenuOpen] = useState(false);
    const [mapTypeId, setMapTypeId] = useState(mapType);
    const [snow, setSnow] = useState(false);
    const [locationPrompt, setLocationPrompt] = useState(false);
    const [chooseCookies, setChooseCookies] = useState(false);
    const [historyOn, setHistoryOn] = useState(false);

    useEffect(() => {
        setMapTypeId(mapType);
    }, [mapType]);

    const themeKey = currentTheme.toLowerCase();

    const cookieColors = {
        standard: { iconColor: "#A97458" },
        retro: { iconColor: "#A97458" },
        silver: { iconColor: "#000000ff" },
        dark: { iconColor: "#D2A679" },
        night: { iconColor: "#E1C18A" },
        aubergine: { iconColor: "#ffffffff" },
    };

    // @ts-ignore
    const cookieTheme = cookieColors[themeKey] || cookieColors.standard;

    const handleToggleMenu = () => {
        const next = !menuOpen;
        setMenuOpen(next);
        parentMenuOpen(next);
    };

    const handleToggleMapTypes = () => {
        setMapTypeId((prev: string) => (prev === "terrain" ? "roadmap" : "terrain"));
        toggleMapTypes();
    };

    const handleToggleSnow = () => {
        setSnow((prev) => !prev);
        toggleSnow();
    };

    const handleToggleLocationPrompt = () => {
        setLocationPrompt((prev) => !prev);
    };

    const handleToggleChooseCookies = () => {
        setChooseCookies((prev) => !prev);
    };

    const handleToggleHistory = () => {
        setHistoryOn((prev) => !prev);
        toggleHistory();
    };

    const handleHomeClick = () => {
        window.location.href = "/about";
    };



    const isTerrain = mapTypeId === "terrain";
    const isRoad = mapTypeId === "roadmap";

    return (
        <div className="TrackerMenu">
            {!menuOpen && (
                <div
                    className="TrackerMenuBtn"
                    id={`${themeKey}-theme-menu-btn`}
                    onClick={handleToggleMenu}
                >
                    <span className="material-icons">menu</span>
                </div>
            )}

            {menuOpen && (
                <div
                    className="TrackerMenuContent"
                    id={`${themeKey}-theme-menu-content`}
                >
                    {/* Map theme thumbnails */}
                    <div
                        className="TrackerMenuThemes"
                        id={`tracker-menu-themes-${themeKey}`}
                    >
                        {availableThemes.map(
                            (
                                theme: { title: string; nickName: {} | null | undefined },
                                index: any
                            ) => (
                                <div
                                    key={`tracker-menu-theme-${index}`}
                                    className={`TrackerMenuTheme ${currentTheme === theme.title
                                        ? "TrackerMenuThemeChecked"
                                        : "TrackerMenuThemeUnchecked"
                                        }`}
                                    id={`tracker-menu-theme-${theme.title.toLowerCase()}`}
                                    onClick={() => changeTheme(index)}
                                >
                                    <img
                                        src={`./res/map-theme-icons/${theme.title.toLowerCase()}.PNG`}
                                        // @ts-ignore
                                        alt={theme.nickName}
                                    />
                                    <p>{theme.nickName}</p>
                                    <ToggleStatus
                                        checked={currentTheme === theme.title}
                                        position="bottom"
                                        themeKey={themeKey}
                                        parentHeight={94}
                                        parentWidth={94}
                                    />
                                </div>
                            )
                        )}
                    </div>

                    {/* Map type / Snow row */}
                    <div className="TrackerMenuMapTypeRow">

                        {isTerrain ? (
                            <div className={`TRSToggle TRSToggle-${themeKey}`}>
                                <span className="material-icons">terrain</span>
                                <p>Terrain</p>

                                <ToggleStatus
                                    checked={true}
                                    position="bottom"
                                    themeKey={themeKey}
                                    parentHeight={28}
                                    parentWidth={92}
                                />
                            </div>
                        ) : (
                            <div
                                className={`TRSToggle TRSToggle-${themeKey}`}
                                onClick={handleToggleMapTypes}
                            >
                                <span className="material-icons">terrain</span>
                                <p>Terrain</p>
                            </div>
                        )}

                        {isRoad ? (
                            <div className={`TRSToggle TRSToggle-${themeKey}`}>
                                <span className="material-icons">map</span>
                                <p>Road</p>

                                <ToggleStatus
                                    checked={true}
                                    position="bottom"
                                    themeKey={themeKey}
                                    parentHeight={28}
                                    parentWidth={92}
                                />
                            </div>
                        ) : (
                            <div
                                className={`TRSToggle TRSToggle-${themeKey}`}
                                onClick={handleToggleMapTypes}
                            >
                                <span className="material-icons">map</span>
                                <p>Road</p>
                            </div>
                        )}

                        <div
                            className={`TRSToggle TRSToggle-${themeKey}`}
                            onClick={handleToggleSnow}
                        >
                            <span className="material-icons">ac_unit</span>
                            <p>Snow</p>

                            <ToggleStatus
                                checked={snow}
                                position="bottom"
                                themeKey={themeKey}
                                parentHeight={28}
                                parentWidth={92}
                            />
                        </div>

                    </div>

                    {/* Santa data row */}
                    <div
                        className={`TrackerMenuSantaData TrackerMenuSantaData${currentTheme}`}
                    >
                        {santaDat.speed && (
                            <div className="TrackerMenuSantaDataItem">
                                <span className="material-icons">speed</span>
                                <p>{santaDat?.speed}</p>
                            </div>
                        )}
                        {santaDat.bearing && (
                            <div className="TrackerMenuSantaDataItem">
                                <span className="material-icons">explore</span>
                                <p>{santaDat?.bearing}</p>
                            </div>
                        )}

                        {!userLocation.disable && DistanceFromUserToSanta && (
                            <div className="TrackerMenuSantaDataItem">
                                <span className="material-icons">person_pin_circle</span>
                                {DistanceFromUserToSanta < 5280 && (
                                    <p>
                                        {DistanceFromUserToSanta.toString().replace(
                                            /\B(?=(\d{3})+(?!\d))/g,
                                            ","
                                        )}{" "}
                                        ft
                                    </p>
                                )}
                                {DistanceFromUserToSanta >= 5280 && (
                                    <p>
                                        {(DistanceFromUserToSanta / 5280)
                                            .toFixed(2)
                                            .toString()
                                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}{" "}
                                        mi
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer area with two rows */}
                    <div className="TrackerMenuFooter">
                        {/* Row 1: location */}
                        <div className="TrackerMenuFooterRow TrackerMenuFooterRowPrimary">
                            <div className="TrackerMenuFooterRowGroup">
                                <div
                                    className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${themeKey}`}
                                    onClick={handleToggleLocationPrompt}
                                >
                                    <span className="material-icons">
                                        {userLocation.disable ? "location_disabled" : "my_location"}
                                    </span>

                                    <ToggleStatus
                                        checked={!userLocation.disable}
                                        position="bottom"
                                        themeKey={themeKey}
                                        parentHeight={50}
                                        parentWidth={50}
                                    />
                                </div>
                                <div
                                    className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${themeKey}`}
                                    onClick={handleToggleHistory}
                                >
                                    <span className="material-icons">
                                        {historyOn ? "history" : "history_toggle_off"}
                                    </span>

                                    <ToggleStatus
                                        checked={historyOn}
                                        position="bottom"
                                        themeKey={themeKey}
                                        parentHeight={50}
                                        parentWidth={50}
                                    />
                                </div>
                                <div
                                    className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${themeKey}`}
                                    onClick={handleToggleChooseCookies}
                                >
                                    <span
                                        className="material-icons"
                                        style={{ color: cookieTheme.iconColor }}
                                    >
                                        cookie
                                    </span>
                                </div>
                                <div
                                    className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${themeKey}`}
                                    onClick={handleHomeClick}
                                >
                                    <span className="material-icons">home</span>

                                </div>
                                <div
                                    className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${themeKey}`}
                                    id={`tracker-menu-close-btn-${themeKey}`}
                                    onClick={handleToggleMenu}
                                >
                                    <span className="material-icons">close</span>
                                </div>

                            </div>

                        </div>

                        {/* <div className="TrackerMenuFooterRow TrackerMenuFooterRowSecondary">
                            <div className="TrackerMenuFooterRowGroup">






                            </div>


                        </div> */}
                    </div>
                </div>
            )}

            {/* Modals */}
            {locationPrompt && (
                <LocationPrompt
                    toggleLocationPrompt={handleToggleLocationPrompt}
                    theme={currentTheme}
                    getUserLocation={getUserLocation}
                />
            )}

            {chooseCookies && (
                <ChooseCookies
                    onClose={handleToggleChooseCookies}
                    currentTheme={currentTheme}
                />
            )}
        </div>
    );
};

export default TrackerMenu;
