const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
let players = {};
let foods = [];

for (let i = 0; i < 300; i++) spawnFood();

function spawnFood(x, y) {
    foods.push({
        id: Math.random().toString(36).substr(2, 9),
        x: x || Math.random() * WORLD_WIDTH,
        y: y || Math.random() * WORLD_HEIGHT,
        radius: 8,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
}

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id, name: "İsimsiz", x: Math.random() * (WORLD_WIDTH - 200) + 100, y: Math.random() * (WORLD_HEIGHT - 200) + 100,
        radius: 15, score: 0, color: "#00ffcc", history: [], isPlaying: false
    };

    socket.emit('init', { id: socket.id, players: players, foods: foods });

    socket.on('joinGame', (playerData) => {
        players[socket.id].name = playerData.name || "Misafir";
        players[socket.id].color = playerData.color || "#00ffcc";
        players[socket.id].isPlaying = true; players[socket.id].score = 0;
        players[socket.id].history = []; players[socket.id].radius = 15;
        io.emit('playerJoined', players[socket.id]);
    });

    socket.on('updateLocation', (data) => {
        if(players[socket.id] && players[socket.id].isPlaying) {
            players[socket.id].x = data.x; players[socket.id].y = data.y;
            players[socket.id].history = data.history; players[socket.id].radius = data.radius;
        }
    });

    socket.on('eatFood', (foodId) => {
        const foodIndex = foods.findIndex(f => f.id === foodId);
        if (foodIndex !== -1 && players[socket.id]) {
            foods.splice(foodIndex, 1);
            players[socket.id].score += 10;
            spawnFood();
            io.emit('foodEaten', { foodId: foodId, playerId: socket.id, newScore: players[socket.id].score, newFoods: foods });
        }
    });
    
    socket.on('playerDied', () => {
        if(players[socket.id]) {
            if(players[socket.id].history.length > 0) {
                 for (let m = 0; m < players[socket.id].history.length; m += 2) spawnFood(players[socket.id].history[m].x, players[socket.id].history[m].y);
                 io.emit('foodsUpdated', foods);
            }
            players[socket.id].isPlaying = false;
            io.emit('playerDiedBroadcast', socket.id);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

setInterval(() => {
    io.emit('updateState', players);
}, 1000 / 60); 

http.listen(3000, () => { console.log('🚀 SUNUCU AKTİF! http://localhost:3000'); });
