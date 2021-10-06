const fullScreen = {
    open: () => {
        let elem = document.documentElement
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen();
        }
    },
    close: () => {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }, checkIfOpen: () => {
        const windowWidth = window.innerWidth * window.devicePixelRatio;
        const windowHeight = window.innerHeight * window.devicePixelRatio;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        // console.log(windowWidth / screenWidth);
        // console.log(windowHeight / screenHeight);
        if (((windowWidth / screenWidth) >= 0.95) && ((windowHeight / screenHeight) >= 0.95)) {
            return true
        }
        else {
            return false
        }
    }
}
export default fullScreen