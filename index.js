const fs = require('fs');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;

http.listen(port);

app.use(express.static(__dirname + '/app'));
app.use('/script', express.static(__dirname + '/node_modules'));

let connectedPlayers = {};
let playerNames = {};

function message(player, msg){
    return {state: connectedPlayers[player], messages: msg};
}

//
// LOAD ROOMS
//

const roomFiles = fs.readdirSync('rooms');
let rooms = {};
for(let file in roomFiles){
    let room = fs.readFileSync('rooms/' + roomFiles[file]);
    let roomParsed = JSON.parse(room);
    rooms[roomParsed.id] = roomParsed;
}

//
// MESSAGE PARSING
//

function nameSetting(incPlayer, pushMsgs, msg, socket, matchPlayer, id) {
    if (incPlayer.name === undefined && !incPlayer.nameConfirmed) {
        pushMsgs.prepush("&gt; " + msg);
        if (msg.length > 25) {
            pushMsgs.prepush("Please limit name to 25 characters or less.");
            pushMsgs.prepush("What's your name?");
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            return;
        }
        matchPlayer.name = toTitleCase(msg);
        pushMsgs.prepush("Your name is " + matchPlayer.name + "? Are you sure? &lt;y/n&gt;");

        socket.emit('server message', message(matchPlayer.id, pushMsgs));
    }

    else if (incPlayer.name !== undefined && !incPlayer.nameConfirmed) {
        pushMsgs.prepush("&gt; " + msg);
        if (msg === 'y' || msg === 'Y') {
            matchPlayer.nameConfirmed = true;
            pushMsgs.prepush("Alright. Welcome, " + matchPlayer.name + ".");
            playerNames[id].name = matchPlayer.name;
            io.emit('update players', playerNames);
            matchPlayer.room = rooms['intro0'];
            pushMsgs.prepush("Your body takes shape...");
            pushMsgs.prepush(matchPlayer.room.desc);
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            socket.broadcast.emit('server message', {messages: 'A spirit takes form as ' + matchPlayer.name + '.'});
        } else {
            matchPlayer.name = undefined;
            pushMsgs.prepush('Alright.');
            pushMsgs.prepush('What\'s your name?');
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
        }
    }
}

function cleanForSpeech(msg) {
    msg = msg.slice(4);
    msg = msg[0].toUpperCase() + msg.slice(1);
    if(!(msg[msg.length-1] === '.' || msg[msg.length-1] === '!' ||msg[msg.length-1] === '?')){
        msg = msg + '.';
    }
    return msg;
}
function speech(msg, socket, matchPlayer, pushMsgs) {
    msg = cleanForSpeech(msg);
    let punct = msg[msg.length - 1];
    switch (punct) {
        case '?':
            punct = ' ask';
            break;
        case '!':
            punct = ' shout';
            break;
        default:
            punct = ' say';
            break;
    }
    socket.broadcast.emit('server message', {messages: matchPlayer.name + punct + 's, <strong>"' + msg + '"</strong>'});
    pushMsgs.prepush('You' + punct + ', <strong>"' + msg + '"</strong>');
    socket.emit('server message', message(matchPlayer.id, pushMsgs));
    return msg;
}
io.on('connection', function(socket){
    let id;
    console.log("Player connected.");
    id = Math.floor(Math.random()*Math.pow(2, 16));
    connectedPlayers[id] = {
        name: undefined,
        nameConfirmed: false,
        id: id,
        room: undefined
    };
    playerNames[id] = {
        name: undefined
    };
    socket.broadcast.emit('server message', {messages: "A new spirit manifests."});
    io.emit('update players', playerNames);
    socket.emit('send id', id);
    socket.emit('server message', message(id, intro));

    socket.on('client message', function(data){
        let incPlayer = data.player;
        let matchPlayer = connectedPlayers[incPlayer.id];
        let msg = escapeHtml(data.msg);
        let pushMsgs = [];

        // If the name is confirmed, do normal parsing
        if(matchPlayer.name !== undefined && matchPlayer.nameConfirmed) {
            if (msg.slice(0, 4) === 'say ') {
                speech(msg, socket, matchPlayer, pushMsgs);
            } else if(msg.slice(0, 5) === '!help'){
                pushMsgs.prepush('Typical commands:\n\t<em>say {your message here}</em> to speak.\n\t<em>d</em> or <em>desc</em> to see room description.\n\t<em>go {direction}</em> or just <em>{direction}</em> to move between locations.');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else {
                pushMsgs.prepush('Not understood. Try typing !help for basic commands.');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            }
        } else {
            nameSetting(incPlayer, pushMsgs, msg, socket, matchPlayer, id);
        }
    });

    socket.on('disconnect', function(){
        let pushMsgs = [];
        if(connectedPlayers[id].name === undefined){
            pushMsgs.prepush('A nameless spirit dissipates.');
        } else {
            pushMsgs.prepush(connectedPlayers[id].name + ' returns to nothingness.');
        }
        delete playerNames[id];
        delete connectedPlayers[id];
        io.emit('update players', playerNames);
        io.emit('server message', {messages: pushMsgs});
    });
    // socket.on('register', function(msg){
    //     id = msg;
    //     connectedPlayers[id] = {
    //         "name": undefined
    //     }
    //     io.emit('update players', connectedPlayers);
    // });
    // io.emit('update players', connectedPlayers);
    // socket.broadcast.emit('new player');
    // socket.on('player speech', function(data){
    //     var cleaned = escapeHtml(data.msg);
    //     if (cleaned === ""){
    //         return;
    //     }
    //     cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    //     if (!(cleaned[cleaned.length - 1] === '.' || cleaned[cleaned.length - 1] === '?' || cleaned[cleaned.length - 1] === '!')){
    //         cleaned = cleaned + '.';
    //     }
    //     var punct = cleaned[cleaned.length - 1];
    //     var speechWord = "";
    //     switch(punct){
    //         case '?':
    //             speechWord = "asks";
    //             break;
    //         case '!':
    //             speechWord = "shouts";
    //             break;
    //         default:
    //             speechWord = "says";
    //             break;
    //     }
    //     socket.broadcast.emit('rec speech', data.name + " " + speechWord + ", \"" + cleaned + "\"");
    // });
    // socket.on('confirmed named', function(name){
    //     connectedPlayers[id].name = name;
    //     io.emit('update players', connectedPlayers);
    //     socket.broadcast.emit('server message', "A spirit takes form as " + name + ".");
    // });
    //
    // socket.on('disconnect', function(){
    //     if (connectedPlayers[id].name === undefined){
    //         io.emit('disconnect message', "An unformed spirit has dissipated.");
    //     } else {
    //         io.emit('disconnect message', connectedPlayers[id].name + " has left.");
    //     }
    //     delete connectedPlayers[id];
    //     io.emit('update players', connectedPlayers);
    // })
});

const intro = ['Welcome.', 'What\'s your name?'];

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "")
         .replace(/</g, "")
         .replace(/>/g, "")
         .replace(/"/g, "")
         .replace(/'/g, "");
 }

 function toTitleCase(str){
     str = str.toLowerCase().split(' ');
     for (let i = 0; i < str.length; ++i){
         str[i] = str[i][0].toUpperCase() + str[i].slice(1);
     }
     return str.join(' ');
 }

 Array.prototype.prepush = function(msg){
     "use strict";
     if(typeof msg === 'string'){
         msg = msg.replace(/\n/g, '<br>');
         msg = msg.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
         this.push(msg)
     }
     else {
         for(let x in msg){
             msg[x] = msg[x].replace(/\n/g, '<br>');
             msg[x] = msg[x].replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
             this.push(msg[x]);
         }
     }
 };