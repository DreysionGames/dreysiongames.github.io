const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { stat } = require('fs');
let app = express();
let server = http.createServer(app);
let io = socketIO(server);

const publicPath    = path.join(__dirname, '/public');
const port = process.env.PORT || 3000;

app.use(express.static(publicPath));

var connectedSockets =[];

const states = {
    JOINING: 0,
    STARTING: 1,
    TRAINING: 2,
    COMPETING: 3
}
var gameState = states.JOINING;

var next;

var players = [];
var spectators = [];
let PLAYERS;
var currentPlayer=0;

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

io.on('connection', (socket) => {
    connectedSockets[socket.id]=socket;
    if(gameState!=states.JOINING){
        addPlayer(socket.id,spectators,true);
        console.log(`${spectators[spectators.length-1].name} is spectating.`);
        return;
    }
    addPlayer(socket.id,players,true);
	console.log(`${players[players.length-1].name} just connected.`);
    socket.on('disconnect', () => {
        connectedSockets.splice(socket.id,1);
        remPlayer(socket.id,PLAYERS,true);
        remPlayer(socket.id,players,true);
        remPlayer(socket.id,spectators,true);
        /*for(i=0;i<players.length;i++){
            if(players[i].id == socket.id){
                console.log(`${players[i].name} has disconnected.`);
                players[i] = null;
                players=players.filter((player) => player !== null && player !== undefined);
            }
        }*/
        Names();
        Ready();
    });
    socket.on('rename', (data) => {
        console.log(`${findPlayer(socket.id).name} is now named ${data.newName}`);
        findPlayer(socket.id).name = data.newName;
        Names();
    });
    socket.on('queue',(data) => {
        findPlayer(socket.id).queued = data.queued;
        console.log(`${findPlayer(socket.id).name} is${findPlayer(socket.id).queued ? "" : " not"} queued`);
        if(findPlayer(socket.id).queued) {
            addPlayer(socket.id,players,false);
            remPlayer(socket.id,spectators,false);
        } else {
            addPlayer(socket.id,spectators,false);
            remPlayer(socket.id,players,false);
        }
    });
    socket.on('startGame', () => {
        console.log(`${findPlayer(socket.id).name} is ready to start the game`)
        findPlayer(socket.id).ready=1;
        if(Ready()){
            console.log("A game has started");
            var p = players;
            var s = spectators;
            players=[...p,...s].filter(p => p.queued = true);
            spectators = [...p,...s].filter(s => s.queued = false);
            console.log(`Players: ${players.map((p) => p.name)}`);
            console.log(`Spectators: ${spectators.map(s => s.name)}`);
            
            PLAYERS=players;
            next=0;
            gameState=states.STARTING;
            Next(true);
        }
    });
    socket.on('pickCards', (data) => {
        //Check to see the picked cards match the list sent to them in the first place
        console.log("${data.player} picked: ${data.list}");
        //update player's card list
    });
    socket.on('endTurn', () => {
        currentPlayer++;
        if(currentPlayer==players.length) currentPlayer=0;
        next=0;
        io.emit('switchTurn', {
            player: currentPlayer
        });
    });
    socket.on('accept', () => {
        findPlayer(socket.id).ready=1;
        if(Ready()){Next(true);}
    });
    socket.on('decline', () => {
        findPlayer(socket.id).ready=1;
        if(Ready()){Next(false);}
    });
});

function Names(){
    if(PLAYERS.length) var names = PLAYERS.map(p => p.name);
    else var names = players.map((p) => p.name);
    io.emit('names', {
        nameList: names
    });
}

function Ready(){
    if(PLAYERS.length) var ready = PLAYERS.map(r => r.ready);
    else var ready = players.map((r) => r.ready);
    io.emit('ready', {
        readyList: ready
    });
    for(i=0;i<ready.length;i++){
        if(ready[i]==0 || ready[i]==undefined){return false;}
    }
    return true;
}

function Next(val){
    var C=connectedSockets[players[currentPlayer].id];

    for(i=0;i<PLAYERS.length;i++){
        PLAYERS[i].ready=0;
    }
    Ready();
    
    if(gameState==states.STARTING){
        switch(next){
            case 0:
                //except need different cards for each player, cache the results for later verification
                io.emit('pickCards', {
                    type: "skill",
                    draw: 5,
                    pick: 2,
                    list: [
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)]
                    ]
                });
                break;
            case 1:
                io.emit('pickCards', {
                    type: "artifact",
                    draw: 3,
                    pick: 1,
                    list: [
                        artifactPool[Math.floor(Math.random()*artifactPool.length)],
                        artifactPool[Math.floor(Math.random()*artifactPool.length)],
                        artifactPool[Math.floor(Math.random()*artifactPool.length)]
                    ]
                });
                break;
            case 2:
                io.emit('drawTokens', {
                    draw: 5,
                    list: [
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)]
                    ]
                });
                break;
            case 3:
                io.emit('roll'); //player turn order
                break;
            case 4:
                //set action/reaction cards
                io.emit('setCards');
                break;
            case 5:
                gameState++;
                next=0;
        }
        return;
    }
    if(gameState==states.TRAINING){
        switch(next){
            case 0: //Draw tokens
                C.emit('drawTokens', {
                    draw: 2,
                    list: [
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)]
                    ]
                })
                break;
            case 1: //Monsters attack the player, if there are any monsters
                if(players[currentPlayer].targets.length){
                    //should have a react option for each target
                    //includes attack used, but not damage. That needs logic not yet included
                    C.emit('reactOption', {
                        attacker: currentPlayer
                    });
                }
                break;
            case 2: //check for events/encounters
                C.emit('roll');
                break;
            case 3: //Player can activate an artifact or a continuous spell, or attack a monster if there are any
                C.emit('skillOption');
                break;
        }
        return;
    }
    if(gameState==states.COMPETING){
        switch(next){
            case 0:
                //announce bracket
                break;
            case 1:
                io.emit('pickCards',{
                    type: "skill",
                    draw: 3,
                    pick: 1,
                    list: [
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)],
                        skillPool[Math.floor(Math.random()*skillPool.length)]
                    ]
                });
                break;
            case 2:
                io.emit('skillOption');
                break;
            case 3:
                //if applicable
                connectedSockets[players[currentPlayer].target.id].emit('reactOption', {
                    attacker: players[currentPlayer].name
                });
        }
        return;
    }
    next++;
}

const skillPool = [
    ["Fireball", 5],
    ["Icicle", 5]
];

var skillWeight=0;
for(i=0;i<skillPool.length;i++){
    skillWeight+=skillPool[i][1];
}

const artifactPool = [
    
];

var artifactWeight=0;
for(i=0;i<artifactPool.length;i++){
    artifactWeight+=artifactPool[i][1];
}

const eventPool = [

];

var eventWeight=0;
for(i=0;i<eventPool.length;i++){
    eventWeight+=eventPool[i][1];
}

const tokenPool = [
    "fire",
    "water",
    "earth",
    "air"
];

const enemyPool = [

];

class Player {
    constructor(id) {
        this.id = id;
        this.name = "Player " + Math.floor(Math.random()*10000);
        this.queued = true;
        this.ready = 0;

        this.health = 25;
        this.energy = new Energy(0, 0, 0, 0);
        this.skills = [];
        this.active = [];
        this.actions = [];
        this.reacions = [];
        this.artifacts = [];
        this.targets = [];
    }
}

class Energy {
    constructor(fire, water, earth, air) {
        this.fire = fire;
        this.water = water;
        this.earth = earth;
        this.air = air;

        this.subtract = function (Energy2) {
            return new Energy(this.fire - Energy2.fire, this.water - Energy2.water, this.earth - Energy2.earth, this.air - Energy2.air);
        };
        this.add = function (Energy2) {
            return new Energy(this.fire + Energy2.fire, this.water + Energy2.water, this.earth + Energy2.earth, this.air + Energy2.air);
        };
    }
}

function findPlayer(id){
    for(i=0;i<players.length;i++){
        if(players[i].id==id) return players[i];
    }
    for(i=0;i<spectators.length;i++){
        if(spectators[i].id==id) return spectators[i];
    }
    for(i=0;i<PLAYERS.length;i++){
        if(PLAYERS[i].id==id) return PLAYERS[i];
    }
    console.log(`Could not find player with id ${id}`);
}

function addPlayer(id,list,newcomer){
    for(i=0;i<list.length;i++){
        if(list[i]==findPlayer(id)) return;
    }
    if(newcomer) {
        list[list.length]=new Player(id);
    } else {
        list[list.length]=findPlayer(id);
    }
    Names();
    Ready();
}

function remPlayer(id,list,disconnect){
    for(i=0;i<list.length;i++){
        if(list[i].id == id){
            if(disconnect) console.log(`${list[i].name} has disconnected.`);
            list.splice(i,1);
        }
    }
    Names();
    Ready();
}