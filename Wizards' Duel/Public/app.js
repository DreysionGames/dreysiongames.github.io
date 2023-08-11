let socket = io.connect('http://192.168.1.65:3000');

socket.on('connect', () => {
    if(pName) {
        socket.emit('rename', {newName: pName});
    }
    socket.emit('queue', {queued: document.getElementById("queue").checked});
});
socket.on('connect_error', (err) => {
    console.log(`connect_error due to ${err.message}`);
});
socket.on('disconnect', () => {
    console.log("Connection interrupted");
    Reset();
});

var pName;
var selected = [];
var picking=0;
var rolling=0;

document.getElementById("rename").addEventListener('click', () => {
    pName = document.getElementById("newname").value;
    socket.emit('rename', {
        newName: document.getElementById("newname").value
    });
});
document.getElementById("queue").addEventListener('click', () => {
    socket.emit('queue', {queued: document.getElementById("queue").checked});
});
document.getElementById("Start").addEventListener('click', () => {
    socket.emit('startGame');
});


socket.on('names', (data) => {
    document.getElementById("names").innerHTML=data.nameList.map(p => p).join('<br>');
})
socket.on('ready', (data) => {
    ready=[];
    for(i=0;i<data.readyList.length;i++){
        ready[i]="❌";
        if(data.readyList[i]==1) ready[i]="✅";
    }
    document.getElementById("ready").innerHTML=ready.map(r=>r).join('<br>');
});
socket.on('startGame', () => {
    console.log('game Started');
});
socket.on('reset', () => {
    Reset();
});

socket.on('pickCards', (data) => {
    console.log(`drawing ${data.draw} cards from the ${data.type} pile, pick ${data.pick}`);
    picking = data.pick;
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

function popup(title,description,type,draw,pick){
    p=document.getElementById("popup");
    t=document.getElementById("title");
    d=document.getElementById("description");
    v=document.getElementById("visual");
    a=document.getElementById("accept");

    t.innerHTML=title;
    d.innerHTML=description;

    if(pick>0) a.addEventListener('click',acceptPick);
    if(type=="dice"){
        c=document.createElement("div");
        ci=document.createAttribute("id");
        ci.value="dice";
        c.setAttributeNode(ci);
        c.innerHTML=1;
        v.appendChild(c);
        c.addEventListener('click',roll);
    }

    if(type!="token"){
        for(i=0;i<draw;i++){
            c=document.createElement("img");
            cc=document.createAttribute("class");
            cc.value="card";
            cs=document.createAttribute("src");
            cs.value="Images/back1.png"; //Change image based on card type when other images are available
            c.setAttributeNode(cc);
            c.setAttributeNode(cs);
            v.appendChild(c);
            let index = i;
            c.addEventListener('click',function() {selectCard(index)});
        }
    }

    for(var i=pick;i>0;i--){
        selectCard(i-1);
    }

    p.style.display="block";
}

function accept(){
    picking=0;
    document.getElementById("popup").style.display="none";
    [...document.getElementById("visual").children].forEach(element => {
        removeElementWithListeners(element);
    });
    socket.emit('accept');
}

function acceptPick(){
    document.getElementById("accept").removeEventListener('click',acceptPick);
    socket.emit('pickCards',{
        list: selected
    });
    selected = [];
}

function roll(){
    document.getElementById("dice").removeEventListener('click',roll);
    rollAnim=setInterval(function(){
        document.getElementById("dice").innerHTML=Math.floor(Math.random()*6);
        if(Math.random() < 0.05){
            document.getElementById("dice").innerHTML=rolling;
            clearInterval(rollAnim);
            rolling=0;
        }
    },150);
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
    if(document.getElementById("visual").innerHTML!=""){
        [...document.getElementById("visual").children].forEach(element => {
            removeElementWithListeners(element);
        });
    }
}

function removeElementWithListeners(element){
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    clone.parentNode.removeChild(clone);
}