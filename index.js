const fs = require('fs');
const _ = require('lodash');

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
    connectedPlayers[player].roomContents = JSON.stringify(rooms[connectedPlayers[player].room]);
    console.log(JSON.stringify(rooms[connectedPlayers[player].room]));
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
    if (incPlayer.name === '' && !incPlayer.nameConfirmed) {
        prepush(pushMsgs, "&gt; " + msg);
        if (msg.length > 25) {
            prepush(pushMsgs, "Please limit name to 25 characters or less.");
            prepush(pushMsgs, "What's your name?");
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            return;
        }
        matchPlayer.name = toTitleCase(msg);
        prepush(pushMsgs, "Your name is " + matchPlayer.name + "? Are you sure? &lt;y/n&gt;");

        socket.emit('server message', message(matchPlayer.id, pushMsgs));
    }

    else if (incPlayer.name !== '' && !incPlayer.nameConfirmed) {
        prepush(pushMsgs, "&gt; " + msg);
        if (msg === 'y' || msg === 'Y') {
            matchPlayer.nameConfirmed = true;
            prepush(pushMsgs, "Alright. Welcome, " + matchPlayer.name + ".");
            playerNames[id].name = matchPlayer.name;
            io.emit('update players', playerNames);
            matchPlayer.room = rooms[0].id;
            rooms[0].entities.push(playerNames[matchPlayer.id]);
            prepush(pushMsgs, "Your body takes shape...");
            prepush(pushMsgs, newRoomMessages(matchPlayer));
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            socket.broadcast.emit('server message', {messages: 'A spirit takes form as ' + matchPlayer.name + '.'});
        } else {
            matchPlayer.name = '';
            prepush(pushMsgs, 'Alright.');
            prepush(pushMsgs, 'What\'s your name?');
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
    let shouting = msg.indexOf('!') > -1;
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
    for(let key in connectedPlayers){
        let player = connectedPlayers[key];
        if(player.room === matchPlayer.room){
            socket.broadcast.to(player.id).emit('server message', {messages: matchPlayer.name + punct + 's, <strong>"' + msg + '"</strong>'});
        } else if(shouting) {
            let adjacents = rooms[matchPlayer.room].exits;
            for (let i = 0; i < adjacents.length; ++i) {
                if (player.room === adjacents[i].id) {
                    socket.broadcast.to(player.id).emit('server message', {messages: 'Someone shouts, <strong>"' + msg + '"</strong>' + ' from somewhere nearby.'});
                }
            }
        }
    }
    // socket.broadcast.emit('server message', {messages: matchPlayer.name + punct + 's, <strong>"' + msg + '"</strong>'});
    prepush(pushMsgs, 'You' + punct + ', <strong>"' + msg + '"</strong>');
    socket.emit('server message', message(matchPlayer.id, pushMsgs));
    return msg;
}
function roomChange(exit, matchPlayer, pushMsgs, socket) {
    let dirFound = false;
    switch (exit) {
        case 'n':
            exit = 'north';
            break;
        case 'e':
            exit = 'east';
            break;
        case 's':
            exit = 'south';
            break;
        case 'w':
            exit = 'west';
            break;
        case 'u':
            exit = 'up';
            break;
        case 'd':
            exit = 'down';
            break;
        default:
            break;
    }
    const exits = rooms[matchPlayer.room].exits;
    for (let i = 0; i < exits.length; ++i) {
        if (exit.match(exits[i]['dir'])) {
            dirFound = true;
            let oldRoom = rooms[matchPlayer.room];
            let newRoom = rooms[exits[i]['id']];
            let index = oldRoom.entities.indexOf(playerNames[matchPlayer.id]);
            if(index > -1){
                oldRoom.entities.splice(index, 1);
            }
            matchPlayer.room = newRoom.id;
            newRoom.entities.push(playerNames[matchPlayer.id]);
            for(let key in connectedPlayers){
                let player = connectedPlayers[key];
                if(oldRoom.id === player.room){
                    prepush(pushMsgs, matchPlayer.name + ' exits to the ' + exit + '.');
                    socket.broadcast.to(player.id).emit('server message', message(player.id, pushMsgs));
                } else if (newRoom.id === player.room){
                    let enterDir = '';
                    for(let j = 0; j < newRoom.exits.length; ++j){
                        if(newRoom.exits[j].id === oldRoom.id){
                            enterDir = newRoom.exits[j].dir;
                        }
                    }
                    prepush(pushMsgs, matchPlayer.name + ' enters from the ' + enterDir + '.');
                    socket.broadcast.to(player.id).emit('server message', message(player.id, pushMsgs));
                }
            }
            prepush(pushMsgs, 'You exit to the ' + exits[i]['dir'] + '...');
            prepush(pushMsgs, newRoomMessages(matchPlayer));
            break;
        }
    }
    return dirFound;
}

io.on('connection', function(socket){
    let id = socket.id;
    console.log("Player connected.");
    connectedPlayers[id] = {
        name: '',
        nameConfirmed: false,
        id: id,
        room: 0,
        roomContents: JSON.stringify('')
    };
    playerNames[id] = {
        name: ''
    };
    socket.broadcast.emit('server message', {messages: "A new spirit manifests."});
    io.emit('update players', playerNames);
    socket.emit('send id', id);
    socket.emit('server message', message(id, intro));

    socket.on('client message', function(data){
        let incPlayer = data.player;
        let matchPlayer = connectedPlayers[incPlayer.id];
        if(!(_.isEqual(matchPlayer, incPlayer))){
            console.log('DESYNC');
            console.log('inc = ' + JSON.stringify(incPlayer));
            for(let key in incPlayer){
                console.log('typeof ' + key + ' = ' + typeof(incPlayer[key]));
            }
            console.log('match = ' + JSON.stringify(matchPlayer));
            for(let key in matchPlayer){
                console.log('typeof ' + key + ' = ' + typeof(matchPlayer[key]));
            }

        }
        let msg = escapeHtml(data.msg);
        let msgWords = msg.split(' ');
        msgWords[0] = msgWords[0].toLowerCase();
        msg = msgWords.join(' ');
        let pushMsgs = [];

        // If the name is confirmed, do normal parsing
        if(matchPlayer.name !== '' && matchPlayer.nameConfirmed) {
            let match = [];
            if (msg.slice(0, 4) === 'say ') {
                speech(msg, socket, matchPlayer, pushMsgs);
            } else if(msg.slice(0, 5) === '!help') {
                prepush(pushMsgs, 'Typical commands:\n\t<em>say {your message here}</em> to speak.\n\t<em>d</em> or <em>desc</em> to see room description.\n\t<em>go {direction}</em> or just <em>{direction}</em> to move between locations.');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else if(msg.split(' ')[0] === 'd' || msg.split(' ')[0] === 'desc'){
                prepush(pushMsgs, newRoomMessages(matchPlayer));
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else if(match = roomRe.exec(msg)) {
                let exit = msg.slice(match[0].length + 1).toLowerCase();
                let dirFound = roomChange(exit, matchPlayer, pushMsgs, socket);
                if(!dirFound){
                    prepush(pushMsgs, 'There is no exit in that direction.');
                }
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else {
                let exit = msg;
                let dirFound = roomChange(exit, matchPlayer, pushMsgs, socket);
                if(!dirFound) {
                    prepush(pushMsgs, 'Not understood. Try typing !help for basic commands.');
                }
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            }
        } else {
            nameSetting(incPlayer, pushMsgs, msg, socket, matchPlayer, id);
        }
    });

    socket.on('disconnect', function(){
        let pushMsgs = [];
        if(connectedPlayers[id].nameConfirmed === false){
            prepush(pushMsgs, 'A nameless spirit dissipates.');
        } else {
            prepush(pushMsgs, connectedPlayers[id].name + ' returns to nothingness.');
        }
        for(let key in rooms){
            let room = rooms[key];
            let playerIndex = room.entities.indexOf(playerNames[id]);
            if(playerIndex > -1){
                room.entities.splice(playerIndex, 1);
            }
        }
        delete playerNames[id];
        delete connectedPlayers[id];
        io.emit('update players', playerNames);
        io.emit('server message', {messages: pushMsgs});
    });
});

const intro = ['Welcome.', 'What\'s your name?'];
const roomRe = /^go|^walk|^exit/;

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "")
         .replace(/</g, "")
         .replace(/>/g, "")
         .replace(/"/g, "");
 }

 function toTitleCase(str){
     str = str.toLowerCase().split(' ');
     for (let i = 0; i < str.length; ++i){
         str[i] = str[i][0].toUpperCase() + str[i].slice(1);
     }
     return str.join(' ');
 }

 function newRoomMessages(player){
     let room = rooms[player.room];
     let others = [];
     for(let i = 0; i < room.entities.length; ++i){
         if(room.entities[i].name != player.name){
             others.push(room.entities[i].name);
         }
     }
     let roomEnts = 'Others in area: ';
     if(others.length === 0){
         roomEnts = 'No one else is around.';
     } else {
         roomEnts = roomEnts + others.join(', ');
     }
     return ['\n' + room.title + '\n----------------------------------------\n' + room.desc, room.exitDesc, roomEnts];
 }

 function prepush(msgArray, msg){
     if(typeof msg === 'string'){
         msg = msg.replace(/\n/g, '<br>');
         msg = msg.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
         msgArray.push(msg)
     }
     else {
         for(let x in msg){
             msg[x] = msg[x].replace(/\n/g, '<br>');
             msg[x] = msg[x].replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
             msgArray.push(msg[x]);
         }
     }
 };