const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
let app = express();
let server = http.createServer(app);
let io = socketIO(server);

const publicPath    = path.join(__dirname, '/public');
const port = process.env.PORT || 3000;
const parser = xml2js.Parser({explicitArray:false});

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
var autoready;

var everyone = [];
var players = [];
var spectators = [];
var currentPlayer=0;

var playAdvanced = false;
var spellsBasic = [];
var spellsAdvanced = [];
var deckSpells = [];
var deckArtifacts = [];
var deckMonsters = [];
var deckEvents = [];
var shuffledSpells = [];
var shuffledArtifacts = [];
var shuffledMonsters = [];
var shuffledEvents = [];



server.listen(port, "192.168.1.65", () => {
    console.log(`Listening on port ${port}`);
    console.log(`Type in "http://192.168.1.65:3000" to your browser's address bar to connect`);
});
process.on('exit', () => {
    io.emit('reset');
});

io.on('connection', (socket) => {
    connectedSockets[socket.id]=socket;
    addPlayer(socket.id,everyone,true);
    if(gameState!=states.JOINING){
        addPlayer(socket.id,spectators,false);
        console.log(`${spectators[spectators.length-1].name} is spectating.`);
    }else{
        console.log(`${everyone[everyone.length-1].name} has just joined.`)
    }

    socket.on('disconnect', () => {
        connectedSockets.splice(socket.id,1);
        if(players){
            remPlayer(socket.id,players,true);
            if(players.length == 0) newGame();
        }
        remPlayer(socket.id,spectators,false);
        remPlayer(socket.id,everyone,false);
        Names();
    });
    socket.on('rename', (data) => {
        console.log(`${findPlayer(socket.id, everyone).name} is now named ${data.newName}.`);
        findPlayer(socket.id, everyone).name = data.newName;
        Names();
    });
    socket.on('queue',(data) => {
        findPlayer(socket.id, everyone).queued = data.queued;
        console.log(`${findPlayer(socket.id, everyone).name} is${findPlayer(socket.id, everyone).queued ? "" : " not"} queued.`);
    });
    socket.on('layout', (data) => {
        console.log(`Screen dimensions: ${data.W}x${data.H}`)
    });
    socket.on('startGame', () => {
        if(gameState != states.JOINING) return;
        console.log(`${findPlayer(socket.id, everyone).name} is ready to start the game.`);
        findPlayer(socket.id, everyone).ready=1;
        if(Ready()){
            startGame();
        }
    });
    socket.on('leaveGame', () => {
        console.log(`${findPlayer(socket.id, everyone).name} left the game.`);
        findPlayer(socket.id, everyone).reset();
        remPlayer(socket.id,players,false);
        addPlayer(socket.id,spectators,false);
        if(players.length == 0) newGame();
    });
    socket.on('pickCards', (data) => {
        var p = findPlayer(socket.id, players);
        console.log(`${p.name} picked: ${data.list}.`);
        
        if(data.type == "skills"){
            p.skills.push(p.selecting[data.list[0]])
        }else if(data.type == "artifacts"){
            p.artifacts.push(p.selecting[data.list[1]])
        }
        p.selecting = [];
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
        findPlayer(socket.id, players).ready=1;
        findPlayer(socket.id, players).autoReady=0;
        if(Ready()) Next(true);
    });
    socket.on('decline', () => {
        findPlayer(socket.id, players).ready=1;
        findPlayer(socket.id, players).autoReady=0;
        if(Ready()) Next(false);
    });
});

function loadStuff(){
    XMLDict("cards-skills-basic.xml", spellsBasic);
    if(playAdvanced) XMLDict("cards-skills-advanced.xml", spellsAdvanced);
}
loadStuff();

function startGame(){
    console.log("A game has started");
    //console.log(cardsBasic);
    players = everyone.filter(p => p.queued);
    spectators = everyone.filter(s => !s.queued);
    console.log(`Players: ${players.map(p => p.name)}`);
    console.log(`Spectators: ${spectators.map(s => s.name)}`);

    if(autoready) clearInterval(autoready);
    autoready = setInterval(function(){
        for(i=0;i<players.length;i++){
            if(players[i].autoReady > 0){
                players[i].autoReady--;
                connectedSockets[players[i].id].emit('autoReady', {
                    readyIn: players[i].autoReady
                });
            }
        }
    },1000);

    next=0;
    gameState=states.STARTING;

    deckSpells = [...spellsBasic, ...spellsAdvanced];
    shuffledSpells = Shuffle(deckSpells);
    shuffledArtifacts = Shuffle(deckArtifacts);
    shuffledMonsters = Shuffle(deckMonsters);
    shuffledEvents = Shuffle(deckEvents);
    //console.log(shuffledSpells);

    io.emit('profiles', {
        players: players
    });
    io.emit('startGame');
    Next(true);
}

function newGame(){
    console.log("------------");
    console.log("Game reset");
    console.log("------------");
    clearInterval(autoready);
    gameState=states.JOINING;
    for(i=0;i<players.length;i++){
        players[i].reset();
    }
    for(i=0;i<spectators.length;i++){
        spectators[i].ready=0;
    }
    players=[];
    spectators=[];
    io.emit('reset');
}

function Names(){
    if(players && players.length) var names = players.map(p => p.name);
    else{
        var q = [...everyone].filter(p => p.queued);
        var names = q.map(p => p.name);
    }
    io.emit('names', {
        nameList: names
    });
    Ready();
}

function Ready(){
    if(players && players.length) {
        var ready = players.map(p => p.ready);
    }
    else {
        var q = [...everyone].filter(p => p.queued);
        var ready = q.map(p => p.ready);
    }
    io.emit('ready', {
        readyList: ready
    });
    for(i=0;i<ready.length;i++){
        if(ready[i]==0 || ready[i]==undefined){
            console.log("Waiting on someone still...");
            return false;
        }
    }
    if(ready.length==0) {
        console.log("No one is here!");
        return false;
    }
    console.log("Everyone is ready!");
    return true;
}

function Next(val){
    var C=connectedSockets[players[currentPlayer].id];

    for(i=0;i<players.length;i++){
        players[i].ready=0;
    }
    Ready();
    
    if(gameState==states.STARTING){
        switch(next){
            case 0: //Everyone draws 5 cards, then picks 2 and discards 3
                let dict = {};
                for(i=0;i<5;i++) {
                    players.forEach(function(player) {
                        var spellName = shuffledSpells.pop();
                        dict[spellName] = deckSpells.find(card => card.name == spellName);
                        player.selecting[player.selecting.length] = spellName;
                        if(i==4) {
                            console.log("Player "+player.name+": "+player.selecting);
                            connectedSockets[player.id].emit('pickCards', {
                                type: "spell",
                                draw: 5,
                                pick: 2,
                                cards: player.selecting
                            });
                            player.autoReady = 200;
                        }
                    });
                }
                io.emit("updateSpells",{dictItems: dict});
                break;
            case 1: //Everyone draws 3 cards, then picks 1 and discards 2
                players.forEach(function(player) {
                    player.selecting = [
                        artifactPool[Math.floor(Math.random()*artifactPool.length)].name,
                        artifactPool[Math.floor(Math.random()*artifactPool.length)].name,
                        artifactPool[Math.floor(Math.random()*artifactPool.length)].name
                    ];
                    connectedSockets[player.id].emit('pickCards', {
                        type: "artifact",
                        draw: 3,
                        pick: 1,
                        cards: player.selecting
                    });
                    player.autoReady = 10;
                });
                break;
            case 2: //Everyone draws 5 energy tokens
                players.forEach(function(player) {
                    energyDraw = drawEnergy(5);
                    player.energy.add(energyDraw);
                    connectedSockets[player.id].emit('drawTokens', {
                        draw: 5,
                        list: energyDraw
                    });
                    player.autoReady = 5;
                });
                break;
            case 3: //Everyone rolls a die for turn order
                players.forEach(function(player) {
                    connectedSockets[player.id].emit('roll', {
                        purpose: "Roll the dice to determine turn order",
                        rng: [
                            Math.floor(Math.random()*6)+1
                        ]
                    });
                    player.autoReady = 10;
                });
                break;
            case 4: //Everyone decides where to put skill cards: action or reaction
                io.emit('setCards');
                break;
            case 5:
                gameState++;
                next=0;
        }
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
                        skillPool[Math.floor(Math.random()*skillPool.length)].name,
                        skillPool[Math.floor(Math.random()*skillPool.length)].name,
                        skillPool[Math.floor(Math.random()*skillPool.length)].name
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
    }
    next++;
}

class Player {
    constructor(id) {
        this.id = id;
        this.profileID = genID();
        this.name = "Player " + this.profileID;
        this.queued = true;
        this.ready = 0;
        this.autoReady = 0;
        this.selecting = [];
        this.tokenRoll = [];

        this.health = 25;
        this.energy = new Energy(0, 0, 0, 0);
        this.skills = [];
        this.active = [];
        this.actions = [];
        this.reactions = [];
        this.artifacts = [];
        this.targets = [];
    }

    reset() {
        this.ready = 0;
        this.autoReady = 0;
        this.selecting = [];
        this.tokenRoll = [];

        this.health = 25;
        this.energy = new Energy(0, 0, 0, 0);
        this.skills = [];
        this.active = [];
        this.reactions = [];
        this.artifacts = [];
        this.targets = [];
    }
}

function genID() {
    var id = Math.floor(Math.random() * 10000);
    var curIDs = everyone.map(p => p.profileID);
    for(i=0;i<curIDs.length;i++){
        if(id == curIDs[i]) return genID();
    }
    return id;
}

class Card {
    constructor(name,type,deck){
        this.name = name;
        this.type = type;
        this.deckCount = deck;
    }
}

class Energy {
    constructor(fire, water, earth, air, any = 0) {
        this.fire = fire;
        this.water = water;
        this.earth = earth;
        this.air = air;
        this.any = any;

        this.subtract = function (Energy2, lockAny = false, player = players[currentPlayer]) {
            var en = new Energy(
                Math.min(this.fire - Energy2.fire,0), 
                Math.min(this.water - Energy2.water,0), 
                Math.min(this.earth - Energy2.earth,0), 
                Math.min(this.air - Energy2.air,0), 
                Math.min(this.any - Energy2.any,0)
            );
            if(!lockAny) {
                for(i=0;i<en.any;i++){
                    player.tokenRoll[player.tokenRoll.length] = ["air","fire","earth","water"][Math.floor(Math.random()*4)]
                    en[player.tokenRoll[player.tokenRoll.length-1]]++
                    en.any--;
                }
            }
            return en;
        };
        this.add = function (Energy2, lockAny = false, player = players[currentPlayer]) {
            var en = new Energy(
                Math.min(this.fire + Energy2.fire,0), 
                Math.min(this.water + Energy2.water,0), 
                Math.min(this.earth + Energy2.earth,0), 
                Math.min(this.air + Energy2.air,0),
                Math.min(this.any + Energy2.any,0)
            );
            if(!lockAny) {
                for(i=0;i<en.any;i++){
                    player.tokenRoll[player.tokenRoll.length] = ["air","fire","earth","water"][Math.floor(Math.random()*4)]
                    en[player.tokenRoll[player.tokenRoll.length-1]]++
                    en.any--;
                }
            }
            return en;
        };
        this.element = function () {
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

            const score = (this.air ? 1 : 0) | (this.earth ? 2 : 0) | (this.fire ? 4 : 0) | (this.water ? 8 : 0);
            return elements[score] || "none";
        }
    }
}

function drawEnergy(num){
    var draw = new Energy(0,0,0,0);
    options = [
        draw.fire,
        draw.water,
        draw.earth,
        draw.air
    ];
    for(i=0; i<num; i++){
        options[Math.floor(Math.random()*4)]++;
    }
    return draw;
}

function Shuffle(deck) {
    var working = [];
    deck.forEach(card => {
        for(i=0; i<card.count; i++){
            working.push(card.name);
        }
    });
    for(i=working.length-1;i>0;i--){
        j = Math.floor(Math.random() * (i + 1));
        [working[i],working[j]] = [working[j],working[i]];
    }
    return working;
}

function findPlayer(id, list){
    for(i=0;i<list.length;i++){
        if(list[i].id==id) return list[i];
    }
}

function addPlayer(id,list,newcomer){
    for(i=0;i<list.length;i++){
        if(list[i].id==id) return;
    }
    if(newcomer) {
        list[list.length]=new Player(id);
    } else {
        list[list.length]=findPlayer(id, everyone);
    }
    Names();
}

function remPlayer(id,list,disconnect){
    for(i=0;i<list.length;i++){
        if(list[i].id == id){
            if(disconnect) console.log(`${list[i].name} has disconnected.`);
            list.splice(i,1);
        }
    }
    Names();
    if(gameState==states.JOINING && Ready()) startGame();
}

const skillPool = [
    new Card("Fireball","skill",5),
    new Card("Icicle","skill",5),
    new Card("Fire Wall","skill",3)
];

var skillWeight=0;
for(i=0;i<skillPool.length;i++){
    skillWeight+=skillPool[i][1];
}

const artifactPool = [
    new Card("Magic Pendant","artifact",3),
    new Card("Spell Book","artifact",2)
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

function parseXMLFileToDictionary(xmlFilePath) {
    return new Promise((resolve, reject) => {
        // Read the XML file
        fs.readFile(xmlFilePath, 'utf-8', (err, xmlData) => {
            if (err) {
                return reject('Error reading XML file:', err);
            }

            // Parse XML to a JavaScript object (dictionary)
            parser.parseString(xmlData, (err, result) => {
                if (err) {
                    return reject('Error parsing XML:', err);
                }
                // Result is now a JavaScript object representing the XML
                resolve(result);
            });
        });
    });
}

function XMLDict(path, dict) {
    parseXMLFileToDictionary(path)
    .then(dictionary => {
        for(i=0;i<dictionary.cards.card.length;i++){
            dict[i] = dictionary.cards.card[i];
        }
    })
    .catch(error => {
        console.error(error);
    });
}