let socket = io.connect('http://localhost:3000');


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

socket.on('test', () => {
    console.log("TESTING");
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

socket.on('pickCards', (data) => {
    console.log(`drawing ${data.draw} cards from the ${data.type} pile, pick ${data.pick}`);
    popup(
        "Pick Cards",
        "You draw " + data.draw + " cards, pick " + data.pick + " to keep:"
    );
});

socket.on('drawCards', (data) => {
    console.log(`drawing ${data.draw} cards from the ${data.type} pile, received ${data.cardsList}`);
});

socket.on('drawTokens', (data) => {
    console.log(`drawing ${data.number} tokens, received ${data.tokensList}`);
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

function popup(title,description){
    p=document.getElementById("popup");
    t=document.getElementById("title");
    d=document.getElementById("description");
    v=document.getElementById("visual");
    a=document.getElementById("accept");

    t.innerHTML=title;
    d.innerHTML=description;

    p.style.display="visible";
}