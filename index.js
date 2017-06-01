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
// MESSAGE PARSING
//

function nameSetting(incPlayer, pushMsgs, msg, socket, matchPlayer, id) {
    if (incPlayer.name === undefined && !incPlayer.nameConfirmed) {
        pushMsgs.push("&gt; " + msg);
        if (msg.length > 25) {
            pushMsgs.push("Please limit name to 25 characters or less.");
            pushMsgs.push("What's your name?");
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            return;
        }
        matchPlayer.name = toTitleCase(msg);
        pushMsgs.push("Your name is " + matchPlayer.name + "? Are you sure? &lt;y/n&gt;");

        socket.emit('server message', message(matchPlayer.id, pushMsgs));
    }

    else if (incPlayer.name !== undefined && !incPlayer.nameConfirmed) {
        pushMsgs.push("&gt; " + msg);
        if (msg === 'y' || msg === 'Y') {
            matchPlayer.nameConfirmed = true;
            pushMsgs.push("Alright. Welcome, " + matchPlayer.name + ".");
            pushMsgs.push("You may now speak.");
            playerNames[id].name = matchPlayer.name;
            io.emit('update players', playerNames);
            socket.emit('server message', message(matchPlayer.id, pushMsgs));
            socket.broadcast.emit('server message', {messages: 'A spirit takes form as ' + matchPlayer.name + '.'});
        } else {
            matchPlayer.name = undefined;
            pushMsgs.push('Alright.');
            pushMsgs.push('What\'s your name?');
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
io.on('connection', function(socket){
    let id;
    console.log("Player connected.");
    id = Math.floor(Math.random()*Math.pow(2, 16));
    connectedPlayers[id] = {
        name: undefined,
        nameConfirmed: false,
        id: id
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
                pushMsgs.push('You' + punct + ', <strong>"' + msg + '"</strong>');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else if(msg.slice(0, 5) === '!help'){
                pushMsgs.push('Type <em>say {your message here}</em> to speak.');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            } else {
                pushMsgs.push('Not understood. Try typing !help for basic commands.');
                socket.emit('server message', message(matchPlayer.id, pushMsgs));
            }
        } else {
            nameSetting(incPlayer, pushMsgs, msg, socket, matchPlayer, id);
        }
    });

    socket.on('disconnect', function(){
        let pushMsgs = [];
        if(connectedPlayers[id].name === undefined){
            pushMsgs.push('A nameless spirit dissipates.');
        } else {
            pushMsgs.push(connectedPlayers[id].name + ' returns to nothingness.');
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
