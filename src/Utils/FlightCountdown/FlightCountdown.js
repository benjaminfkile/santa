

function calc() {
    today = new Date();

    xmas = new Date("December 25, " + today.getFullYear());

    if (today > xmas) {
        xmas.setYear(today.getFullYear() + 1);
    }

    msPerDay = 24 * 60 * 60 * 1000;
    timeLeft = (xmas.getTime() - today.getTime());
    e_daysLeft = timeLeft / msPerDay;
    daysLeft = Math.floor(e_daysLeft);
    e_hrsLeft = (e_daysLeft - daysLeft) * 24;
    hrsLeft = Math.floor(e_hrsLeft);
    e_minsLeft = (e_hrsLeft - hrsLeft) * 60;
    minsLeft = Math.floor(e_minsLeft);
    e_secsLeft = (e_minsLeft - minsLeft) * 60;
    secsLeft = Math.floor(e_secsLeft);

    var c = document.getElementsByClassName("xmas");
    var i;
    for (i = 0; i < c.length; i++) {

        c[i].innerHTML = "There are " + daysLeft + " days, " + hrsLeft + " hours, " + minsLeft + " minutes, and " + secsLeft + " seconds until Santa launches!";
    }
    
}
setInterval(calc, 0);