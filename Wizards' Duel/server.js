const os = require("os");                      //for finding ip address
const fs = require('fs');                      //for xml
const path = require('path');                  //for xml
const xml2js = require('xml2js');              //for xml
const http = require('http');                  //for server
const express = require('express');            //for server
const socketIO = require('socket.io');         //for signals
const qr = require('qrcode-terminal');
let app = express();                           //for server
let server = http.createServer(app);           //for server
let io = socketIO(server);                     //for signals


const publicPath    = path.join(__dirname, '/public');
const SERVER_PORT = process.env.PORT || 3000;
const parser = xml2js.Parser({explicitArray:false});

app.use(express.static(publicPath));


// CLI Commands
process.stdin.setEncoding("utf8");
process.stdin.on("data", (data) => {
    const input = data.trim();
    const [command, ...args] = input.split(" ");

    switch (command) {
        case "say":
            if(args.length === 0) {
                console.log("Usage: say <message>");
                break;
            }
            const message = args.join(" ");
            broadcastToAll(message);
            break;
        case "clients":
            if (args.length == 0) {
                const clientNames = Object.values(clients).map(c => c.id + " (" + (c.name || "(Unnamed client)")+")");
                console.log("Current clients:",clientNames);
                break;
            }
            possibleTargets = [];
            Object.keys(clients).forEach(function(client){
                if(client == args[0] || clients[client].name == args[0]){
                    possibleTargets.push(client);
                }
            });
            if (possibleTargets.length > 1) {
                const targetNames = Object.values(possibleTargets).map(t => t + " (" + clients[t].name + ")");
                console.log("Error: Multiple players with the same name",targetNames);
                break;
            }

            if (!clients[possibleTargets[0]]) {
                console.log(`Error finding Client ${args[0]}`);
                break;
            }
            
            console.log(`Client ${clients[possibleTargets[0]].name} (${clients[possibleTargets[0]].id})`);
            if (clients[possibleTargets[0]].lobby == null) {
                console.log("Lobby: none");
            } else {
                console.log(`Lobby: ${lobbies[clients[possibleTargets[0]].lobby].name} (${clients[possibleTargets[0]].lobby})`);
            }
            break;
        case "lobbies":
            if (args.length == 0) {
                const lobbyNames = Object.values(lobbies).map(l => l.id + "(" +(l.name || "(Unnamed lobby)")+")");
                console.log("Active lobbies:", lobbyNames);
                break;
            }
            possibleTargets = [];
            Object.keys(lobbies).forEach(function(lobb){
                if(lobb == args[0] || lobbies[lobb].name == args[0]){
                    possibleTargets.push(lobb);
                }
            });
            if (possibleTargets.length > 1) {
                const targetNames = Object.values(possibleTargets).map(t => t + " (" + lobbies[t].name + ")");
                console.log("Error: Multiple lobbies with the same name",targetNames);
                break;
            }

            if (!lobbies[possibleTargets[0]]) {
                console.log(`Error finding Lobby ${args[0]}`);
                break;
            }

            console.log(`Lobby: ${lobbies[possibleTargets[0]].name} (${lobbies[possibleTargets[0]].id})`);
            console.log(`Host: ${clients[lobbies[possibleTargets[0]].host].name} (${lobbies[possibleTargets[0]].host})`);
            console.log("Members:");
            console.table(lobbies[possibleTargets[0]].lobbyMembers);
            break;
        case "kick":
            possibleTargets = [];
            Object.keys(clients).forEach(function(client){
                if(client == args[0] || clients[client].name == args[0]){
                    possibleTargets.push(client);
                }
            });
            if(possibleTargets.length < 1) {
                console.log("Error: Player not found");
            }
            else if(possibleTargets.length == 1) {
                const message = args.slice(1).join(" ");
                console.log("Kicking ", possibleTargets[0], "("+clients[possibleTargets[0]].name+")");
                clients[possibleTargets[0]].socket.emit('kicked',message);
                clients[possibleTargets[0]].socket.disconnect(true);
                delete clients[possibleTargets[0]];
            }
            else if(possibleTargets.length > 1) {
                const targetNames = Object.values(possibleTargets).map(t => t + " (" + clients[t].name + ")");
                console.log("Error: Multiple players with the same name",targetNames);
            }

            break;
        case "help":
            const comm = args[0];
            if(!comm){
                console.log("Current commands: say, clients, lobbies, kick, help, exit");
            } else if (comm == "say") {
                console.log("say <message>");
            } else if (comm == "clients") {
                console.log("Use 'clients' with no arguments for a list of clients.");
                console.log("clients (client id | client name) for details on a particular client.");
            } else if (comm == "lobbies") {
                console.log("Use 'lobbies' with no arguments for a list of lobbies.");
                console.log("lobbies (lobby id | lobby name) for details on a particular lobby.");
            } else if (comm == "kick") {
                console.log("kick (client id | client name) <message>");
            } else if (comm == "help") {
                console.log("help (command) for more information on command usage");
            } else if (comm == "exit") {
                console.log("Exits the server, does not currently support any arguments.");
            } else {
                console.log(`${args[0]} is not a valid command, use 'help' to get a list of commands.`);
            }
            break;
        case "exit":
            console.log("Shutting down the server...");
            process.exit(0);
        default:
            console.log("Unkown command, try 'help' to get a list of functions");
    }
});


const clients = {};
const lobbies = {};

const states = {
    STARTING: 0,
    TRAINING: 1,
    COMPETING: 2
}



function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // Filter out internal (127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback
}

server.listen(SERVER_PORT, "0.0.0.0", () => {
    ipaddress = getLocalIP();

    console.log(`Listening on port ${SERVER_PORT}`);
    console.log(`Type in "http://${ipaddress}:${SERVER_PORT}" to your browser's address bar to connect`);
    qr.generate(`http://${ipaddress}:${SERVER_PORT}`,{small:true});
});
process.on('exit', () => {
    io.emit('reset');
});


io.on('connection', (socket) => {
    clients[socket.id] = {
        socket: socket,
        id: socket.id,
        name: "Player " + Math.floor(Math.random() * 10000),
        lobby: null
    }
    console.log(`${clients[socket.id].name} joined the server with id ${socket.id}`);

    socket.on('disconnect', () => {
        if(clients[socket.id].lobby) {
            lobbies[clients[socket.id].lobby].playerLeave(socket.id);
        }
        console.log(`${clients[socket.id].name} disconnected`);
        delete clients[socket.id];
    });

    /* ChatGPT:
socket.on('disconnect', () => {
    for (const [lobbyId, lobby] of Object.entries(lobbies)) {
      const i = lobby.players.indexOf(socket.id);
      if (i !== -1) {
        lobby.players.splice(i, 1);
        io.to(lobbyId).emit('playerLeft', socket.id);

        if (lobby.players.length === 0) {
          delete lobbies[lobbyId];
        } else if (socket.id === lobby.host) {
          lobby.host = lobby.players[0]; // promote someone else
          io.to(lobbyId).emit('hostChanged', lobby.host);
        }
      }
    }
  });
    */


    socket.on('createLobby', (data, callback) => {
        if(clients[socket.id].lobby) {
            lobbies[clients[socket.id].lobby].playerLeave(socket.id);
        }

        const newlobbyId = generateLobbyID(); // e.g., random 6-letter code
        lobbies[newlobbyId] = new Lobby(newlobbyId, data.name, socket.id, data);
        clients[socket.id].lobby = newlobbyId;
        //lobbies[newlobbyId].lobbyMembers[socket.id] = clients[socket.id]};
        socket.join(newlobbyId);
        
        callback({ success: true, lobbyID: newlobbyId });
    });

    // JOIN LOBBY
    socket.on('joinLobby', (lobbyId, callback) => {
        if (!lobbies[lobbyId]) return callback({ success: false, error: 'Lobby not found' });

        lobbies[lobbyId].lobbyMembers[socket.id] = {name: clients[socket.id].name, joining: false, nominated: false};
        clients[socket.id].lobby = lobbyId;
        socket.join(lobbyId);
        callback({ success: true, name: lobbies[lobbyId].name });

        // Notify others
        socket.to(lobbyId).emit('playerJoined', socket.id);
    });

    socket.on('sendMessage', ({ lobbyId, message }) => {
        socket.to(lobbyId).emit('message', { sender: socket.id, message });
    });



    socket.on('rename', (data) => {
        clients[socket.id].name = data.newName;
        if(clients[socket.id].lobby) {
            lobbies[clients[socket.id].lobby].updateNames(socket.id, data.newName);
        }
        console.log(`Player with id ${socket.id} is now named ${clients[socket.id].name}`);
    });
    socket.on('queue',(data) => {
        findPlayer(socket.id, everyone).queued = data.queued;
        console.log(`${findPlayer(socket.id, everyone).name} is${findPlayer(socket.id, everyone).queued ? "" : " not"} queued.`);
    });
    socket.on('layout', (data) => {
        console.log(`Screen dimensions: ${data.W}x${data.H}`)
    });
    socket.on('requestLobbies', () => {
        socket.emit('lobbiesList', lobbies);
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

function broadcastToAll(message) {
    io.emit('message', message);
}


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
                io.emit('updateSpells',{dictItems: dict});
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



function generateLobbyID() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

class Lobby {
    constructor(id, name, host, settings) {
        this.id = id;
        this.name = name ?? "(Unnamed Lobby)";
        this.host = host;
        this.lobbyMembers = {};
        this.lobbyMembers[host] = {name: clients[host].name, joining: false, nominated: true};
        this.activePlayers = [];
        this.spectators = [];

        this.setSettings(settings);
        this.engine = null;
    }

    setSettings(newSettings = {}) {
        const current = this.settings ?? {};

        this.settings = {
            openJoin: newSettings.openJoin ?? current.openJoin ?? true, //join next game, not lobby
            playersCanChat: newSettings.playersCanChat ?? current.playersCanChat ?? true,
            playersCanEmote: newSettings.playersCanEmote ?? current.playersCanEmote ?? true,
            openSpectate: newSettings.openSpectate ?? current.openSpectate ?? true,
            spectatorsCanChat: newSettings.spectatorsCanChat ?? current.spectatorsCanChat ?? false,
            spectatorsCanEmote: newSettings.spectatorsCanEmote ?? current.spectatorsCanEmote ?? true,
            openInvite: newSettings.openInvite ?? current.openInvite ?? false,
            enableTier1Magic: newSettings.enableTier1Magic ?? current.enableTier1Magic ?? true,
            enableTier2Magic: newSettings.enableTier2Magic ?? current.enableTier2Magic ?? true,
            enableTier3Magic: newSettings.enableTier3Magic ?? current.enableTier3Magic ?? true,
            enableCustomMagic: newSettings.enableCustomMagic ?? current.enableCustomMagic ?? false,
            enableCustomArtifacts: newSettings.enableCustomArtifacts ?? current.enableCustomArtifacts ?? false,
            enableCustomEvents: newSettings.enableCustomEvents ?? current.enableCustomEvents ?? false,
            enableCustomEncounters: newSettings.enableCustomEncounters ?? current.enableCustomEncounters ?? false,
            trainingPhaseParallel: newSettings.trainingPhaseParallel ?? current.trainingPhaseParallel ?? false,
            trainingPhaseRounds: newSettings.trainingPhaseRounds ?? current.trainingPhaseRounds ?? 20,
            tournamentPhaseParallel: newSettings.tournamentPhaseParallel ?? current.tournamentPhaseParallel ?? false,
            tournamentPhaseRounds: newSettings.tournamentPhaseRounds ?? current.tournamentPhaseRounds ?? 15,
            startingHealth: newSettings.startingHealth ?? current.startingHealth ?? 25,
            startingSpells: newSettings.startingSpells ?? current.startingSpells ?? 2,
            startingArtifacts: newSettings.startingArtifacts ?? current.startingArtifacts ?? 1,
            startingEnergy: newSettings.startingEnergy ?? current.startingEnergy ?? 5,
            newPhaseEnergy: newSettings.newPhaseEnergy ?? current.newPhaseEnergy ?? 2,
            allowedActionSpells: newSettings.allowedActionSpells ?? current.allowedActionSpells ?? 3,
            allowedReactionSpells: newSettings.allowedReactionSpells ?? current.allowedReactionSpells ?? 2,
            allowedArtifacts: newSettings.allowedArtifacts ?? current.allowedArtifacts ?? 1,
            trainingPhaseFullHealth: newSettings.trainingPhaseFullHealth ?? current.trainingPhaseFullHealth ?? true,
            trainingPhaseRemoveDebuffs: newSettings.trainingPhaseRemoveDebuffs ?? current.trainingPhaseRemoveDebuffs ?? true,
            tournamentPhaseFullHealth: newSettings.tournamentPhaseFullHealth ?? current.tournamentPhaseFullHealth ?? true,
            tournamentPhaseRemoveDebuffs: newSettings.tournamentPhaseRemoveDebuffs ?? current.tournamentPhaseRemoveDebuffs ?? true,
        }
    }

    playerJoin(player) {
        this.lobbyMembers[player] = {
            name: "Player " + generatePlayerID(), 
            joining: false, 
            nominated: this.settings.openJoin
        };
        this.broadcastServerMessage(`${this.lobbyMembers[player].name} has joined the lobby`);
    }

    playerLeave(player) {
        this.broadcastServerMessage(`${this.lobbyMembers[player].name} has left the lobby`);
        
        delete this.lobbyMembers[player];
        delete this.activePlayers[player];
        delete this.spectators[player];

        if(Object.keys(this.lobbyMembers).length < 1) {
            delete lobbies[this.id];
            return;
        }
        if(this.engine && Object.keys(this.activePlayers).length < 1) {
            this.gameEnd();
        }
        
        if(player == this.host) {
            this.host = Object.keys(this.lobbyMembers)[0];
            this.broadcastServerMessage(`${this.lobbyMembers[this.host].name} is now the host`);
        }
    }

    playerRequestJoinNextGame(player) {
        if(this.lobbyMembers[player].nominated) this.lobbyMembers[player].joining = true;
    }

    gameStart() {
        this.broadcastServerMessage("A game is starting");
        //Start countdown?

        this.lobbyMembers.forEach(member => {
            if(member.joining) this.activePlayers[this.activePlayers.length] = new Player(member, this.settings.startingHealth);
            else this.spectators[this.spectators.length] = member;
        });

        this.engine = new GameEngine(this.activePlayers, this.settings);
    }

    gameEnd() {
        this.activePlayers = [];
        this.spectators = [];
        this.engine = null;
    }

    updateNames(id, name) {
        console.log(id);
        this.lobbyMembers[id].name = name;
        //send update to other clients with clients[socket.id].to(room).emit
    }
    updatePlayerStatus(player) {

    }
    broadcastServerMessage(message) {
        console.log("Broadcast: "+message);
        //Client commands?
    }
    broadcastChatMessage(player, message) {

    }
    broadCastEmote(player, emote) {

    }
}

class GameEngine {
    constructor(players, settings) {
        this.players = players;
        this.settings = settings;
        this.state = states.STARTING;

        this.currentPlayer = 0;
        this.round = 0;

        if(this.settings.enableTier1Magic) {
            //this.deckSpells.push(tier1);
        }
        if(this.settings.enableTier2Magic) {
            //this.deckSpells.push(tier2);
        }
        if(this.settings.enableTier3Magic) {
            //this.deckSpells.push(tier3);
        }
        if(this.settings.enableCustomMagic) {
            //this.deckSpells.push(custom);
        }
        //this.deckArtifacts = artifacts;
        if(this.settings.enableCustomArtifacts) {
            //this.deckArtifacts.push(custom);
        }
        //this.deckEvents = events;
        if(this.settings.enableCustomEvents) {
            //this.deckEvents.push(custom);
        }
        //this.deckEncounters = encounters;
        if(this.settings.enableCustomEncounters) {
            //this.deckEncounters.push(custom);
        }

        this.deckSpells = Shuffle(this.deckSpells);
        this.deckArtifacts = Shuffle(this.deckArtifacts);
        this.deckEvents = Shuffle(this.deckEvents);
        this.deckEncounters = Shuffle(this.deckEncounters);
    }
}



class Player {
    constructor(member, startingHealth) {
        this.id = member.id;
        this.name = member.name;
        
        this.reset();
    }

    reset() {
        this.ready = 0;
        this.autoReady = 0;
        this.selecting = [];
        this.tokenRoll = [];

        this.health = 25;
        this.manaPool = {
            air: 0,
            earth: 0,
            fire: 0,
            water: 0,
        };
        this.spells = [];
        this.active = [];
        this.reactions = [];
        this.artifacts = [];
        this.targets = [];
    }
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
                9: "ice", //air, water
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