let socket = io();

console.log("works");

start = document.getElementById("Start");
start.addEventListener('click', () => {
    console.log("pressed");
    socket.emit('startGame');
});

socket.on('startGame', () => {
    console.log('game Started');
});