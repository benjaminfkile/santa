import { FunctionComponent, useState, useEffect } from "react";
import { ICookieType } from "../interfaces";
import ChocolateChip from "../SVG/Cookies/ChocolateChip";
import "./Cookies.css";
import Gingerbread from "../SVG/Cookies/Gingerbread";
import Sugar from "../SVG/Cookies/Sugar";
import Snickerdoodle from "../SVG/Cookies/Snickerdoodle";

interface Props {
    cookies: ICookieType[] | undefined
    theme: "night" | "standard" | "retro" | "siver" | "dark" | "aubergine"
}

const Cookies: FunctionComponent<Props> = ({ cookies, theme }) => {

    const [expanded, setExpanded] = useState(false);

    // Decide what to show
    const visibleCookies = expanded
        ? cookies ?? []
        : cookies
            ? cookies.slice(0, 1)
            : [];

    return (
        <div className={`Cookies Cookies-${theme}`}>

            {visibleCookies.map((cookie, i) => (
                <div key={`cookie.name-${i}`} className={`CookiesItem CookiesItem-${theme}`}>
                    <div className="CookiesItemLeft">
                        <div className="CookiesItemIcon">
                            {cookie.cookie_type_id === 1 && <ChocolateChip />}
                            {cookie.cookie_type_id === 2 && <Sugar />}
                            {cookie.cookie_type_id === 3 && <Snickerdoodle />}
                            {cookie.cookie_type_id === 4 && <Gingerbread />}
                        </div>
                        {expanded && <div className="CookiesItemName">{cookie.name}</div>}
                    </div>

                    <div className="CookiesItemRight">
                        <div className="CookiesItemCount">{cookie.total}</div>
                    </div>
                </div>
            ))}

            {cookies && cookies.length > 1 && (
                <div className={`CookieControls CookieControls${expanded ? "Expanded" : "Collapsed"} CookieControls-${theme}`} onClick={() => setExpanded(!expanded)}>
                    <span className="material-icons">{`${expanded ? "close" : "expand_more"}`}</span>
                </div>
            )}

        </div>
    );
}

export default Cookies;
