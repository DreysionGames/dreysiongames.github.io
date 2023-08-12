window.addEventListener('resize', setLayout);

title = document.getElementById("title");
setup = document.getElementById("setup");
profiles = document.getElementById("profiles");
room = document.getElementById("roomsettings");
bracket = document.getElementById("bracket");
hand = document.getElementById("hand");
phone = document.getElementById("phoneutil");

phoneActivated = "setup";
layoutGameStarted = false;

setLayout();

function setLayout(){
    W = window.innerWidth;
    H = window.innerHeight;

    title.style.height = Math.min(H / 5, 80) + "px";
    profiles.style.top = title.style.height;
    profiles.style.left = "0px";
    profiles.style.height = parseFloat(title.style.height) * 1.5 + "px";
    hand.style.top = parseFloat(title.style.height) * 2.5 + "px";

    room.style.right = "0px";
    hand.style.left = "0px";

    if(H<700) {
        //Use medium/small card images only
        if(H<300) {
            //Use small card images only
        }
    }

    profiles.style.display = layoutGameStarted ? "block" : "none";

    if(H > W) {tallLayout();}
    else {wideLayout();}
}

function tallLayout(){
    phone.style.display = "block";
    phone.style.height = title.style.height;
    profiles.style.width = "100%";

    setup.style.width="100%";
    room.style.width="100%";
    hand.style.width="100%";
    bracket.style.width="100%";
    
    setup.style.height= H - (parseFloat(title.style.height) * 3.5) + "px";
    room.style.height= H - (parseFloat(title.style.height) * 3.5) + "px";
    hand.style.height= H - (parseFloat(title.style.height) * 3.5) + "px";
    bracket.style.height= H - (parseFloat(title.style.height) * 3.5) + "px";

    setup.style.top = parseFloat(title.style.height) * 2.5 + "px";
    room.style.top = parseFloat(title.style.height) * 2.5 + "px";
    bracket.style.top = parseFloat(title.style.height) * 2.5 + "px";

    setup.style.left = "0px";
    setup.style.right = "";
    setup.style.transform = "none";

    bracket.style.left = "0px";
    bracket.style.transform = "none";

    phoneActivate(phoneActivated);
}

function wideLayout(){
    phone.style.display="none";
    setup.style.display="block";
    bracket.style.display="block";
    hand.style.display="block";
    room.style.display="block";
    profiles.style.width = "78%";

    setup.style.width = "20%";
    room.style.width = "20%";
    hand.style.width = "78%";
    bracket.style.width = "";

    setup.style.height = "40%";
    room.style.height = "40%";
    hand.style.height = H - (parseFloat(title.style.height) * 2.5) + "px";
    bracket.style.height = "";

    room.style.bottom = "0px";

    bracket.style.top = "50%";
    bracket.style.left = "50%";
    bracket.style.transform = "translate(-50%, -50%)";
    bracket.style.display = "none";

    if(layoutGameStarted) {
        setup.style.top = title.style.height;
        setup.style.right = "0px";
        setup.style.left = "";
        setup.style.transform = "none";
    } else {
        setup.style.top = "50%";
        setup.style.left = "50%";
        setup.style.right = "";
        setup.style.transform = "translate(-50%, -50%)";
    }
}

function phoneActivate(which) {
    phoneActivated=which;

    setup.style.display="none";
    bracket.style.display="none";
    hand.style.display="none";
    room.style.display="none";

    document.getElementById(which).style.display = "block";
}

function layoutReset() {
    layoutGameStarted = false;
    phoneActivate("setup");

    setLayout();
}

function layoutStart() {
    layoutGameStarted = true;
    phoneActivate("hand");

    setLayout();
}