var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 8000;

http.listen(port);

app.use(express.static(__dirname + '/app'));
app.use('/script', express.static(__dirname + '/node_modules'));

var connectedPlayers = {};

io.on('connection', function(socket){
    var id;
    socket.emit('ask name');
    socket.on('register', function(msg){
        id = msg;
        connectedPlayers[id] = {
            "name": undefined
        }
        io.emit('update players', connectedPlayers);
    });
    io.emit('update players', connectedPlayers);
    socket.broadcast.emit('new player');
    socket.on('player speech', function(data){
        var cleaned = escapeHtml(data.msg);
        if (cleaned === ""){
            return;
        }
        cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
        if (!(cleaned[cleaned.length - 1] === '.' || cleaned[cleaned.length - 1] === '?' || cleaned[cleaned.length - 1] === '!')){
            cleaned = cleaned + '.';
        }
        var punct = cleaned[cleaned.length - 1];
        var speechWord = "";
        switch(punct){
            case '?':
                speechWord = "asks";
                break;
            case '!':
                speechWord = "shouts";
                break;
            default:
                speechWord = "says";
                break;
        }
        socket.broadcast.emit('rec speech', data.name + " " + speechWord + ", \"" + cleaned + "\"");
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
