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

server.listen(port, () => {
    console.log("Listening on port ${port}");
});

io.on('connection', (socket) => {
	console.log('A user just connected.');
    socket.on('disconnect', () => {
        console.log('A user has disconnected.');
    });
    socket.on('startGame', () => {
        io.emit('startGame');
    });
});


/*app.get('/', (req, res) => res.send('Welcome To Nodejs!'));
app.listen(3000, () => console.log(`Example app listening on port ${port}!`));*/

/*var server = require("http").createServer(app).listen(process.env.PORT || 8080);
var io = require("socket.io").listen(server);

io.sockets.on("connection", function(socket) {

    console.log("test");
});*/