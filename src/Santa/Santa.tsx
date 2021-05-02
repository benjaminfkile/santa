import axios from 'axios'
import Reindeer from '../Reindeer/Reindeer'

let Santa = {
    hasError: false,
    location: {},
    getSantaData: () => {
        if (Reindeer.reindeerPick.length > 0) {
            axios.get(Reindeer.reindeerPick + "/api/gps-data")
                .then(res =>
                    Santa.location = res.data
                ).then(res =>{
                    Santa.hasError = false
                })
                .catch(err =>
                    Santa.hasError = true
                )
        }
    }
}

Reindeer.getReindeer()

export default Santa