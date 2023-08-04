const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
let app = express();
let server = http.createServer(app);
let io = socketIO(server);

const publicPath    = path.join(__dirname, '/public');
const port = process.env.PORT || 3000;

app.use(express.static(publicPath));

var gameState = "Starting";
var next;

var players = [];
var currentPlayer;

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

io.on('connection', (socket) => {
    players[players.length] = new Player(socket.id);
	console.log(`${players[players.length-1].name} just connected.`);
    Names();
    Ready();
    socket.on('disconnect', () => {
        for(i=0;i<players.length;i++){
            if(players[i].id == socket.id){
                console.log(`${players[i].name} has disconnected.`);
                players[i] = null;
                players=players.filter((player) => player !== null && player !== undefined);
            }
        }
        Names();
        Ready();
    });
    socket.on('rename', (data) => {
        console.log(`${findPlayer(socket.id).name} is now named ${data.newName}`);
        findPlayer(socket.id).name = data.newName;
        Names();
    });
    socket.on('startGame', () => {
        console.log(`${findPlayer(socket.id).name} is ready to start the game`)
        findPlayer(socket.id).ready=1;
        if(Ready()){
            next=0;
            io.emit('startGame');
        }
    });
    socket.on('pickCards', (data) => {
        //Check to see the picked cards match the list sent to them in the first place
        console.log("${data.player} picked: ${data.list}");
        //update player's card list
    });
    socket.on('endTurn', () => {
        //player++
        next=0;
        io.emit('switchTurn', {
            player: player
        });
    });
    socket.on('accept', () => {
        if(Ready()){Next(true);}
    });
    socket.on('decline', () => {
        Next(false);
    });
});

function Names(){
    var names = players.map((p) => p.name);
    io.emit('names', {
        nameList: names
    });
}

function Ready(){
    var ready = players.map((r) => r.ready);
    io.emit('ready', {
        readyList: ready
    });
    for(i=0;i<ready.length;i++){
        if(ready[i]==0 || ready[i]==undefined){return false;}
    }
    return true;
}

function Next(val){
    for(i=0;i<players.length;i++){
        players[i].ready=0;
        Ready();
    }
    if(gameState=="Starting"){
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
                io.emit('role'); //player turn order
                break;
            case 4:
                //set action/reaction cards
                io.emit('setCards');
                break;
            case 5:
                gameState="Training";
                next=0;
        }
        return;
    }
    if(gameState=="Training"){
        switch(next){
            case 0:
                io.emit('drawTokens', {
                    draw: 2,
                    list: [
                        tokenPool[Math.floor(Math.random()*4)],
                        tokenPool[Math.floor(Math.random()*4)]
                    ]
                })
                break;
            case 1:
                if(player.enemies){
                    //enemies attack
                    break;
                }
                next++;
            case 2:
                io.emit('role'); //check for encounters
                break;
            case 3:
                io.emit('skillOption');
                break;
            case 4:
                //only emit to single player if attack
                io.emit('reactOption', {
                    attacker: currentPlayer
                });
        }
        return;
    }
    if(gameState=="Competing"){
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
                io.emit('reactOption', {
                    attacker: currentPlayer
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
        this.health = 25;
        this.ready = 0;

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
}