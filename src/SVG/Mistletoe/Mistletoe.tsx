import { Component } from "react"

interface MistletoeProps {
    id: string
}

class Mistletoe extends Component<MistletoeProps, {}> {

    render() {
        return (
            <div className="Mistletoe" id={this.props.id}>
                <svg version="1.1" id="leaves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 100" enableBackground="new 0 0 100 100" xmlSpace="preserve">
                    <path fill="#468967" d="M66,63.5c-0.1,0-0.9,0.1-2.1,0.5C52.2,65.4,40.2,46.7,40,47.1c3.6,10.4-18.8,14.3-19.5,14
	c3.2,9.4-11.7,22.4-11.7,22.4s19.5,0.4,22.7,9.8c0.3-0.7,20.4-11.4,24-1c0.4,0.2-1.7-21.7,8.2-27.9C65.1,63.9,65.9,63.5,66,63.5
	 M53.1,67.9C37,75.9,18.7,79.7,18.7,79.7C23.8,78,53.1,67.8,53.1,67.9z"></path>
                    <path fill="#468967" d="M63.2,66.6c0-0.1,0.2-0.9,0.3-2.2c3.2-11.3,25.1-15.2,24.8-15.5c-11-0.7-6-22.9-5.4-23.4
	C72.9,24.9,66.6,6.2,66.6,6.2s-7.8,17.9-17.7,17.3c0.5,0.5,2.7,23.2-8.3,22.5c-0.3,0.3,20.7,6.8,22.7,18.3
	C63.2,65.7,63.2,66.5,63.2,66.6 M64.1,53c-1.3-18,2.2-36.3,2.2-36.3C65.9,22.1,64.1,53,64.1,53z"></path>
                    <circle fill="#C95964" cx="66.1" cy="62.3" r="4.5"></circle>
                    <ellipse transform="matrix(0.9869 -0.1616 0.1616 0.9869 -9.2629 11.3133)" fill="#E9656B" cx="64.9" cy="62.6" rx="1.5" ry="2.9"></ellipse>
                    <circle fill="#C95964" cx="60.4" cy="67" r="4.5"></circle>
                    <ellipse transform="matrix(0.9869 -0.1616 0.1616 0.9869 -10.1498 10.3594)" fill="#E9656B" cx="58.6" cy="67.6" rx="1.5" ry="2.9"></ellipse>
                    <circle fill="#C95964" cx="59.9" cy="60.7" r="4.5"></circle>
                    <ellipse transform="matrix(0.9869 -0.1616 0.1616 0.9869 -9.1538 10.1793)" fill="#E9656B" cx="58" cy="61.4" rx="1.5" ry="2.9"></ellipse>
                </svg>
            </div>
        )
    }
}

export default Mistletoe