import { FunctionComponent } from "react"
import "./Cat.css"

const Cat: FunctionComponent<{}> = () => {
    return (
        <div className="cat">
            <div className="head">
                <div className="left-ear">
                    <div className="ear-inside"></div>
                </div>
                <div className="right-ear">
                    <div className="ear-inside"></div>
                </div>
                <div className="left-eye"></div>
                <div className="right-eye"></div>
                <div className="nose"></div>
                <div className="mouth"></div>
                <div className="right-cheek"></div>
                <div className="left-cheek"></div>
            </div>
            <div className="body"></div>
            <div className="right-paw"></div>
            <div className="left-paw"></div>
            <div className="tail"></div>
        </div>
    )
}

export default Cat;