const fs = require('fs');
const _ = require('lodash');

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const helper = require('./helper-functions.js');
const parse = require('./message-parsing.js');

const pg = require('pg');
pg.defaults.ssl = true;
pg.connect(process.env.DATABASE_URL, function(err, client) {
    if (err) throw err;
    console.log('Connected to postgres! Getting schemas...');
});

const port = process.env.PORT || 8000;
http.listen(port);

app.use(express.static(__dirname + '/app'));
app.use('/script', express.static(__dirname + '/node_modules'));

global.connectedPlayers = {};
global.playerNames = {};

//
// LOAD ROOMS
//

const roomFiles = fs.readdirSync('rooms');
global.rooms = {};
for(let file in roomFiles){
    let room = fs.readFileSync('rooms/' + roomFiles[file]);
    let roomParsed = JSON.parse(room);
    global.rooms[roomParsed.id] = roomParsed;
}

io.on('connection', function(socket){
    let id = socket.id;
    console.log("Player connected. Id: " + id);
    global.connectedPlayers[id] = {
        name: '',
        nameConfirmed: false,
        id: id,
        room: 0,
        roomContents: JSON.stringify('')
    };
    global.playerNames[id] = {
        name: ''
    };
    socket.broadcast.emit('server message', {messages: "A new spirit manifests."});
    io.emit('update players', global.playerNames);
    socket.emit('send id', id);
    socket.emit('server message', helper.msgPackage(id, intro));

    socket.on('client message', function(data){
        let incPlayer = data.player;
        let matchPlayer = global.connectedPlayers[incPlayer.id];
        if(!(_.isEqual(matchPlayer, incPlayer))){
            console.log('DESYNC');
            console.log('inc = ' + JSON.stringify(incPlayer));
            for(let key in incPlayer){
                if(incPlayer.hasOwnProperty(key)) {
                    console.log('typeof ' + key + ' = ' + typeof(incPlayer[key]));
                }
            }
            console.log('match = ' + JSON.stringify(matchPlayer));
            for(let key in matchPlayer){
                if(matchPlayer.hasOwnProperty(key)) {
                    console.log('typeof ' + key + ' = ' + typeof(matchPlayer[key]));
                }
            }

        }
        let msg = escapeHtml(data.msg);
        msg = msg.trim();
        let msgWords = msg.split(' ');
        msgWords[0] = msgWords[0].toLowerCase();
        msg = msgWords.join(' ');
        let pushMsgs = [];

        // If the name is confirmed, do normal parsing
        if(matchPlayer.name !== '' && matchPlayer.nameConfirmed) {
            let match = [];
            if (msg.slice(0, 4) === 'say ') {
                parse.speech(msg, socket, matchPlayer, pushMsgs);
            } else if(msg.slice(0, 5) === '!help') {
                helper.prepush(pushMsgs, 'Typical commands:\n\t<em>say {your message here}</em> to speak.\n\t<em>d</em> or <em>desc</em> to see room description.\n\t<em>go {direction}</em> or just <em>{direction}</em> to move between locations.');
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
            } else if(msg.split(' ')[0] === 'd' || msg.split(' ')[0] === 'desc'){
                helper.prepush(pushMsgs, parse.newRoomMessages(matchPlayer));
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
            } else if(match = roomRe.exec(msg)) {
                let exit = msg.slice(match[0].length + 1).toLowerCase();
                let dirFound = parse.roomChange(exit, matchPlayer, pushMsgs, socket);
                if(!dirFound){
                    helper.prepush(pushMsgs, 'There is no exit in that direction.');
                }
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
            } else {
                let dirFound = parse.roomChange(msg, matchPlayer, pushMsgs, socket);
                if(!dirFound) {
                    helper.prepush(pushMsgs, 'Not understood. Try typing !help for basic commands.');
                }
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
            }
            pg.connect(process.env.DATABASE_URL, function(err, client) {
                if (err) throw err;

                let params = [matchPlayer.name, matchPlayer.id, msg];
                let sql = 'INSERT INTO chatlog (username, player_id, message, time) VALUES ($1, $2, $3, current_timestamp);';
                client.query(sql, params);
            });
        } else {
            parse.nameSetting(incPlayer, pushMsgs, msg, socket, io, matchPlayer, id);
        }
    });

    socket.on('disconnect', function(){
        console.log(id + " has disconnected.");
        let pushMsgs = [];
        if(global.connectedPlayers[id].nameConfirmed === false){
            helper.prepush(pushMsgs, 'A nameless spirit dissipates.');
        } else {
            helper.prepush(pushMsgs, global.connectedPlayers[id].name + ' returns to nothingness.');
        }
        for(let key in global.rooms){
            if(global.rooms.hasOwnProperty(key)) {
                let room = global.rooms[key];
                let playerIndex = room.entities.indexOf(global.playerNames[id]);
                if (playerIndex > -1) {
                    room.entities.splice(playerIndex, 1);
                }
            }
        }
        delete global.playerNames[id];
        delete global.connectedPlayers[id];
        io.emit('update players', global.playerNames);
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
        .replace(/"/g, "")
        .replace(/\[/g, "")
        .replace(/]/g, "");
}