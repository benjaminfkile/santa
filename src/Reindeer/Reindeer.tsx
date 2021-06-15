const Reindeer = {
    reindDeerList: ["dasher", "dancer", "prancer"],
    reindeerPick: "",
    getReindeer: () => {
        Reindeer.reindeerPick = `https://wmsfo-${Reindeer.reindDeerList[Math.floor(Math.random()*Reindeer.reindDeerList.length)]}.herokuapp.com`
    }
}

export default Reindeer