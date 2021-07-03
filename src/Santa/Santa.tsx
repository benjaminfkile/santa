const signalR = require("@microsoft/signalr");
const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://wmsfo-fn-app.azurewebsites.net/api")
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build()
connection.onclose(() => userDisconect())
connection.start()
    .then(() => userConnect())
    .catch(console.error)
export default connection


function userConnect() {
    console.log("user connect")
}

function userDisconect() {
    console.log("user disconect")
}