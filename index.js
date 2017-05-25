var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

http.listen(3000);

app.use(express.static(__dirname + '/app'));
app.use('/script', express.static(__dirname + '/node_modules'));

var connectedPlayers = {};

io.on('connection', function(socket){
    id = Math.random();
    socket.emit('ask name',id);
    connectedPlayers[id] = {
        'name': undefined
    };
    io.emit('update players', connectedPlayers);
    socket.broadcast.emit('new player');
    socket.on('player speech', function(data){
        var cleaned = escapeHtml(data.msg);
        if (cleaned === ""){
            return;
        }
        socket.broadcast.emit('rec speech', data.name + " says, \"" + cleaned + "\"");
    });
    socket.on('confirmed named', function(name){
        connectedPlayers[id].name = name;
        io.emit('update players', connectedPlayers);
        socket.broadcast.emit('server message', "A spirit takes form as " + name + ".");
    });

    socket.on('disconnect', function(){
        if (connectedPlayers[id].name === undefined){
            io.emit('disconnect message', "An unformed spirit has dissipated.");
        } else {
            io.emit('disconnect message', connectedPlayers[id].name + " has left.");
        }
        delete connectedPlayers[id];
        io.emit('update players', connectedPlayers);
    })
});

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "")
         .replace(/</g, "")
         .replace(/>/g, "")
         .replace(/"/g, "")
         .replace(/'/g, "");
 }
