let socket = io.connect();


const DEVCLIENT = true;

var profiles = [];
var pName;
var pIcon;
var cardsVis = [];
var selected = [];
var picking=0;
var rolling=[];
var sType;

var SpellDict = {};


socket.on('connect', () => {
    console.log("Successful connection");
    if(pName) {
        socket.emit('rename', {newName: pName});
    }
    if(DEVCLIENT) {
        document.querySelectorAll(".devmode").forEach(el => el.classList.remove("hidden"));
    }
});
socket.on('connect_error', (err) => {
    console.log(`connect_error: ${err.message}`);
});
socket.on('disconnect', () => {
    console.log("Connection interrupted");
    Reset();
});


function menu(which) {
    document.querySelectorAll('.menu').forEach(el => el.classList.add('hidden'));
    document.getElementById(which).classList.remove('hidden');

    if (which=="EditProfile") {
        document.getElementById("nameSelect").focus();
    } else if (which == "CreateLobby") {
        document.getElementById("lobbyName").focus();
    } else if (which == "JoinLobby") {
        socket.emit('requestLobbies');
    }
}

function updateProfile(bool) {
    if(bool){
        if(document.getElementById("nameSelect").value != pName) {
            pName = document.getElementById("nameSelect").value;
            playername = document.getElementsByClassName("profileName client");
            for (i=0;i<playername.length; i++) {
                playername[i].textContent = pName;
            }
            socket.emit('rename', {
                newName: pName
            });
        }
        if(document.getElementById("iconSelectImage").src != pIcon) {
            pIcon = document.getElementById("iconSelectImage").src;
        }
    }

    document.getElementById("nameSelect").blur();
    document.getElementById("EditProfile").classList.add("hidden");
}

function iconsMenu() {

}

function startLobby(bool) {
    if(bool) {
        socket.emit('createLobby', {
            name: document.getElementById("lobbyName").value,
            openjoin: document.getElementById("s-openjoin").checked,
            playersCanChat: document.getElementById("s-playerscanchat").checked,
            playersCanEmote: document.getElementById("s-playerscanemote").checked,
            openSpectate: document.getElementById("s-openspectate").checked,
            spectatorsCanChat: document.getElementById("s-spectatorscanchat").checked,
            spectatorsCanEmote: document.getElementById("s-spectatorscanemote").checked,
            openInvite: document.getElementById("s-openinvite").checked,
            enableTier1Magic: document.getElementById("s-enabletier1magic").checked,
            enableTier2Magic: document.getElementById("s-enabletier2magic").checked,
            enableTier3Magic: document.getElementById("s-enabletier3magic").checked,
            enableCustomMagic: document.getElementById("s-enablecustommagic").checked,
            enableCustomArtifacts: document.getElementById("s-enablecustomartifacts").checked,
            enableCustomEvents: document.getElementById("s-enablecustomevents").checked,
            enableCustomEncounters: document.getElementById("s-enablecustomencounters").checked,
            trainingPhaseParallel: document.getElementById("s-trainingphaseparallel").checked,
            trainingPhaseRounds: document.getElementById("s-trainingphaserounds").value,
            tournamentPhaseParallel: document.getElementById("s-tournamentphaseparallel").checked,
            tournamentPhaseRounds: document.getElementById("s-tournamentphaserounds").value,
            startingHealth: document.getElementById("s-startinghealth").value,
            startingSpells: document.getElementById("s-startingspells").value,
            startingArtifacts: document.getElementById("s-startingartifacts").value,
            startingEnergy: document.getElementById("s-startingenergy").value,
            newPhaseEnergy: document.getElementById("s-newphaseenergy").value,
            allowedActionSpells: document.getElementById("s-allowedactionspells").value,
            allowedReactionSpells: document.getElementById("s-allowedreactionspells").value,
            allowedArtifacts: document.getElementById("s-allowedartifacts").value,
            trainingPhaseFullHealth: document.getElementById("s-trainingphasefullhealth").checked,
            trainingPhaseRemoveDebuffs: document.getElementById("s-trainingphaseremovedebuffs").checked,
            tournamentPhaseFullHealth: document.getElementById("s-tournamentphasefullhealth").checked,
            tournamentPhaseRemoveDebuffs: document.getElementById("s-tournamentphaseremovedebuffs").checked,
        }, response => {
            console.log(response.success);
            console.log(response.lobbyID);
        });
    }

    document.getElementById("lobbyName").blur();
    document.getElementById("CreateLobby").classList.add("hidden");

    lobbyScreen(document.getElementById("lobbyName").value, true);
}

function joinLobby(e) {
    socket.emit('joinLobby', e.target.dataset.id, response => {
        console.log(response.success);
        lobbyScreen(response.name);
    });
    console.log(e.target.dataset.id);
}

function lobbyScreen(name, host = false) {
    document.getElementById("LobbyName").textContent = "Lobby: "+name;

    document.getElementById("MainMenu").classList.add("hidden");
    document.getElementById("LobbyHome").classList.remove("hidden");
    if(host) document.getElementsByClassName("admin").classList.remove("hidden");
}


socket.on('names', (data) => {
    document.getElementById("names").innerHTML=data.nameList.map(p => p).join('<br>');
});
socket.on('ready', (data) => {
    ready=[];
    for(i=0;i<data.readyList.length;i++){
        ready[i]="❌";
        if(data.readyList[i]==1) ready[i]="✅";
    }
    document.getElementById("ready").innerHTML=ready.map(r=>r).join('<br>');
});
socket.on('autoReady', (data) => {
    if(data.readyIn > 0) document.getElementById("readyin").innerHTML = data.readyIn;
    if(rolling.length > 0 && data.readyIn == 5) roll();
    if(data.readyIn == 0){
        document.getElementById("readyin").innerHTML = "";
        if(selected.length) acceptPick();
        accept();
    }
});
socket.on('profiles', (data) => {
    profiles = [];
    console.log(data.players);
    data.players.forEach(player => {
        let newProf = profile(player.name);
        profiles[player.profileID] = newProf;
    });
});
socket.on('changeProfile', (data) => {
    modProfile(
        data.player.profileID, 
        data.player.name, 
        data.player.active, 
        data.player.actions,
        data.player.reactions,
        data.player.artifacts);
});
socket.on('lobbiesList',(data) => {
    document.getElementById("Overlay").textContent = JSON.stringify(data);

    const template = document.getElementById("template-lobbyentry");
    const container = document.getElementById("lobbies-list");

    container.innerHTML = "";

    Object.keys(data).forEach(lobby => {
        const clone = template.content.cloneNode(true);

        clone.querySelector(".t-lobbyname").textContent = "Lobby name: "+data[lobby].name;
        clone.querySelector(".t-hostname").textContent = "Host name: "+data[lobby].lobbyMembers[data[lobby].host].name;
        clone.querySelector(".t-playercount").textContent = "Player count: "+Object.keys(data[lobby].lobbyMembers).length;
        clone.querySelector(".t-active").textContent = "Active game: "+ data[lobby].engine == true;
        clone.querySelector(".button").dataset.id = data[lobby].id;

        container.appendChild(clone);
    });
});
socket.on('message', message => {
    console.log("Server message:");
    console.log(message);
});
socket.on('kicked', message => {
    console.log("You were kicked!");
    console.log(message);
});
socket.on('startGame', () => {
    console.log('game Started');
    layoutStart();
});
socket.on('reset', () => {
    Reset();
});

socket.on('pickCards', (data) => {
    console.log(`drawing ${data.draw} cards from the ${data.type} pile, pick ${data.pick}`);
    console.log(data.cards);
    picking = data.pick;
    cardsVis = data.cards;
    popup(
        "Pick Cards",
        "You draw " + data.draw + " cards, pick " + data.pick + " to keep:",
        data.type,
        data.draw,
        data.pick
    );
});

socket.on('drawCards', (data) => {
    console.log(`drawing ${data.draw} cards from the ${data.type} pile, received ${data.cardsList}`);
    popup(
        "Draw Cards",
        "You drew " + data.draw + " cards.",
        data.type,
        data.draw,
        0
    );
});

socket.on('drawTokens', (data) => {
    console.log(`drawing ${data.draw} tokens, received ${data.list}`);
    popup(
        "Draw Energy Tokens",
        "You drew " + data.draw + " tokens,",
        "token",
        data.draw,
        0
    );
});

socket.on('drawEvent', (data) => {
    if(data.event=="monster"){
        console.log("A monster is attacking you!");
        return;
    }
    if(data.event=="artifact"){
        console.log("You discovered a new artifact!");
        return;
    }
    if(data.event=="skill"){
        console.log("You're learning a new skill!");
        return;
    }
    console.log("A special event is occurring!");
});

socket.on('roll', (data) => {
    console.log(`Rolled ${data.rng}`);
    rolling=data.rng;
    popup(
        "Roll the Dice",
        data.purpose,
        "dice",
        0,
        0,
    );
});

socket.on('switchTurn', (data) => {
    console.log(`It's ${data.player}'s turn now!`);
});

socket.on('skillOption', () => {
    console.log("It's your turn to use a skill, do you want to?");
});

socket.on('reactOption', (data) => {
    console.log(`${data.attacker} is using a skill against you, do you want to react?`);
});

socket.on('continueOption', (data) => {
    console.log(`Your ${data.skill} is activated and consuming energy. Do you want to keep it going?`);
});

socket.on('updateSpells', (data => {
    for(const key in data.dictItems) {
        SpellDict[key] = data.dictItems[key];
    }
}));

function popup(title,description,type,draw,pick){
    p=document.getElementById("popup");
    t=document.getElementById("title");
    d=document.getElementById("description");
    v=document.getElementById("visual");
    a=document.getElementById("accept");

    t.innerHTML=title;
    d.innerHTML=description;

    if(pick>0) {
        sType = type;
        a.addEventListener('click',acceptPick);
    }
    if(type=="dice"){
        c=document.createElement("div");
        cc=document.createAttribute("class");
        cc.value="dice";
        c.setAttributeNode(cc);
        c.innerHTML=1;
        v.appendChild(c);
        c.addEventListener('click',roll);
    }

    if(type!="token"){
        for(i=0;i<draw;i++){
            //card
            let c=document.createElement("div");
            c.dataset.spellName = cardsVis[i];
            c.className = "card-container";
            //background
            let bg = document.createElement("img");
            bg.classList.add("card","back");
            bg.id = i;
            bgs=document.createAttribute("src");
            bgs.value="Images/back1.png";
            bg.setAttributeNode(bgs);
            c.appendChild(bg);
            //title
            let ct = document.createElement("div");
            ct.className = "card-title";
            c.appendChild(ct);
            //description
            let cd = document.createElement("div");
            cd.className = "card-description";
            c.appendChild(cd);

            v.appendChild(c);
            let cIndex = i;
            c.addEventListener('click',function() {selectCard(cIndex)});
            let time = 0;
            

            function animate() {
                time++;
                mod = 0;
                //if(bg.classList.contains("selected")) mod = 6;

                if(bg.classList.contains("back") && time>=6*(bg.id+1)) {
                    w = bg.getBoundingClientRect().width;
                    bg.style.width = w-5-mod + "px";
                    if(w-10 <= 0) {
                        bg.classList.remove("back");
                        bg.classList.add("front");
                        if(type=="spell"){
                            ct.innerHTML = c.dataset.spellName;
                            cd.innerHTML = SpellDict[c.dataset.spellName].description;
                            var dictentry = SpellDict[c.dataset.spellName].elementTokens;
                            var el = getElement(
                                dictentry.air?1:0,
                                dictentry.earth?1:0,
                                dictentry.fire?1:0,
                                dictentry.water?1:0
                            );
                            bg.src = "Images/"+el+".png";
                        } else {
                            bg.src = "Images/default.png";
                        }
                    }
                }else if(bg.classList.contains("front")) {
                    w = bg.getBoundingClientRect().width;
                    bg.style.width = w+5-mod + "px";
                    if(w+10 >= 250) {
                        bg.classList.remove("front");
                        return;
                    }
                }
                requestAnimationFrame(animate);
            }
            requestAnimationFrame(animate);
        }
    }

    for(var i=pick;i>0;i--){
        selectCard(i-1);
    }

    p.style.display="block";
}

function profile(name){
    var profdiv = document.createElement("div");
    var profclass = document.createAttribute("class");
    profclass.value = "profile-card";
    var profname = document.createElement("h3");
    profname.innerHTML = name;
    var profhand = document.createElement("div");

    profdiv.class = profclass;
    profdiv.appendChild(profname);
    profdiv.appendChild(profhand);
    document.getElementById("profiles").appendChild(profdiv);

    return profdiv;
}

function modProfile(id, name, active, actions, reactions, artifacts) {
    var prof = profiles[id];
    prof.children[0].innerHTML = name;
    prof.children[1].innerHTML;
}

function accept(){
    picking=0;
    document.getElementById("popup").style.display="none";
    document.getElementById("readyin").innerHTML = "";
    [...document.getElementById("visual").children].forEach(element => {
        removeElementWithListeners(element);
    });
    socket.emit('accept');
}

function acceptPick(type){
    document.getElementById("accept").removeEventListener('click',acceptPick);
    socket.emit('pickCards',{
        type: sType,
        list: selected
    });
    selected = [];
}

function roll(){
    var dice = document.getElementsByClassName("dice");
    rollAnim = [];
    for(i=0;i<dice.length;i++){
        dice[i].removeEventListener('click',roll);
        let dIndex = i;
        rollAnim[i]=setInterval(function(){
            dice[dIndex].innerHTML=Math.floor(Math.random()*6);
            if(Math.random() < 0.05){
                dice[dIndex].innerHTML=rolling[dIndex];
                clearInterval(rollAnim[dIndex]);
                rolling=[];
            }
        },150);
    }
}

function selectCard(card){
    if(selected.includes(card)) return;
    var v = document.getElementById("visual");

    if(selected.length>=picking){
        selected.splice(0,1);
        selected.length=picking-1;
    }
    selected[selected.length] = card;
    for(var i=0;i<v.children.length;i++){
        if(selected.includes(i)) v.children[i].classList.add("selected");
        else if(v.children[i].classList.contains("selected")) v.children[i].classList.remove("selected");
    }
}

function Reset(){
    document.getElementById("popup").style.display="none";
    document.getElementById("profiles").innerHTML="";
    if(document.getElementById("visual").innerHTML!=""){
        [...document.getElementById("visual").children].forEach(element => {
            removeElementWithListeners(element);
        });
    }
    layoutReset();
}

function animCard(card){
    console.log(card.classList);
    if(card.getBoundingClientRect().width > 0) {
        card.classList.add("back");
    }else if(card.classList.contains("back")) {
        w = card.getBoundingClientRect().width;
        card.style.width = w-10 + "px";
        if(w-10 <= 0) {
            card.classList.remove("back");
            card.classList.add("front");
            card.innerHTML = "hi";
        }
    }else if(card.classList.contains("front")) {
        w = card.getBoundingClientRect().width;
        card.style.width = w+10 + "px";
        if(w+10 >= 250) {
            card.classList.remove("front");
            return;
        }
    }
    window.requestAnimationFrame(animCard(card));
}

function getElement(air, earth, fire, water){
    const elements = {
        1: "air",
        2: "earth",
        4: "fire",
        8: "water",
        3: "sand", //air, earth
        5: "lightning", //air, fire
        6: "lava",  //fire, earth
        9: "ice", //air, ice
        10: "plant", //earth, water
        12: "poison", //fire, water
        7: "metal", //air, earth, fire
        11: "crystal", //air, earth, water
        13: "miasma", //air, fire, water
        14: "slime", //earth, fire, water
        15: "ultimate" //air, earth, fire, water
    };

    const score = (air ? 1 : 0) | (earth ? 2 : 0) | (fire ? 4 : 0) | (water ? 8 : 0);
    return elements[score] || "none";
}

function removeElementWithListeners(element){
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    clone.parentNode.removeChild(clone);
}

function keyPress(e) {
    switch(e.key) {
        case "o":
            document.getElementById("Overlay").classList.toggle("hidden");
            break;
    }
}