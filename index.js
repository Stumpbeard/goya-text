var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

http.listen(8000);

app.use(express.static(__dirname + '/app'));
app.use('/script', express.static(__dirname + '/node_modules'));

io.on('connection', function(socket){
    socket.emit('ask name');
    socket.broadcast.emit('new player');
    socket.on('player speech', function(data){
        socket.broadcast.emit('rec speech', data.name + " says, \"" + data.msg + "\"");
    });
});

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "")
         .replace(/</g, "")
         .replace(/>/g, "")
         .replace(/"/g, "")
         .replace(/'/g, "");
 }
