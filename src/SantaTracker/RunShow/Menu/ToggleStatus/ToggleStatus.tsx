import { FC } from "react";
import "./ToggleStatus.css";

interface Props {
    checked: boolean;
    position?: "bottom" | "left";
    themeKey: string;
    className?: string;
    parentHeight: number
    parentWidth: number
}

const ToggleStatus: FC<Props> = ({
    checked,
    position = "bottom",
    themeKey,
    className = "",
    parentHeight,
    parentWidth
}) => {

    return (
        <div
            className={[
                "ToggleStatus",
                checked ? "ToggleStatusChecked" : "ToggleStatusUnchecked",
                `ToggleStatus-${position}`,
                `ToggleStatus-theme-${themeKey}`,
                className
            ].join(" ")}
            style={{ width: `${parentWidth}px`,  marginTop: `${(parentHeight) - 3}px` }}
        />
    );
};

export default ToggleStatus;
