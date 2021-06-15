import axios from 'axios'
import Reindeer from '../Reindeer/Reindeer'

let Santa: any = {
    hasError: false,
    location: {},
    getSantaData: () => {
        if (Reindeer.reindeerPick.length > 0) {
            axios.get(`${Reindeer.reindeerPick}/api/location-data`)
                .then(res =>
                    Santa.location = res.data
                )
                .then(() => {
                    Santa.hasError = false
                })
                .catch(err =>
                    Santa.hasError = true
                )
            console.log(`Getting Santa Data\nThrottle: ${Santa.location.throttle}`)
        }
    }
}

Reindeer.getReindeer()

export default Santa