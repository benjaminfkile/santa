//place this in index.js file: <div id="snackbar">snacks</div>

const snackBar = (config: { text: string, type: string, timeout: number }, styles?: any) => {

    let snack: any = document.getElementById("snackbar")
    snack.innerHTML = config.text
    snack.className = "show"
    snack.style.color = "#fff"
    if (config.type === "plain") {
        snack.style.backgroundColor = "#696969"
        snack.style.color = "#fff"
    }
    if (config.type === "primary") {
        snack.style.backgroundColor = "#007bff"
        snack.style.color = "#fff"
    }
    if (config.type === "error") {
        snack.style.backgroundColor = "#dc3545"
    }
    if (config.type === "warning") {
        snack.style.backgroundColor = "#ffc107"
    }
    if (config.type === "success") {
        snack.style.backgroundColor = "#28a745"
    }
    if (config.type === "custom") {
        snack.style.backgroundColor = styles.bg;
        snack.style.color = styles.color;
        snack.style.zIndex = styles.zIndex || 1;
    }

    setTimeout(function () {
        snack.className = snack.className.replace("show", "")
    }, config.timeout);

}
export default snackBar;