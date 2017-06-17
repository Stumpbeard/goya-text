const helper = require('./helper-functions.js');

module.exports = {
    nameSetting: function(incPlayer, pushMsgs, msg, socket, io, matchPlayer, id) {
        if (incPlayer.name === '' && !incPlayer.nameConfirmed) {
            helper.prepush(pushMsgs, "&gt; " + msg);
            if (msg.length > 25) {
                helper.prepush(pushMsgs, "Please limit name to 25 characters or less.");
                helper.prepush(pushMsgs, "What's your name?");
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
                return;
            }
            matchPlayer.name = helper.toTitleCase(msg);
            helper.prepush(pushMsgs, "Your name is " + matchPlayer.name + "? Are you sure? &lt;y/n&gt;");

            socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
        }

        else if (incPlayer.name !== '' && !incPlayer.nameConfirmed) {
            helper.prepush(pushMsgs, "&gt; " + msg);
            if (msg === 'y' || msg === 'Y') {
                matchPlayer.nameConfirmed = true;
                helper.prepush(pushMsgs, "Alright. Welcome, " + matchPlayer.name + ".");
                playerNames[id].name = matchPlayer.name;
                io.emit('update players', playerNames);
                matchPlayer.room = rooms[0].id;
                rooms[0].entities.push(playerNames[matchPlayer.id]);
                helper.prepush(pushMsgs, "Your body takes shape...");
                helper.prepush(pushMsgs, this.newRoomMessages(matchPlayer));
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
                socket.broadcast.emit('server message', {messages: 'A spirit takes form as ' + matchPlayer.name + '.'});
            } else {
                matchPlayer.name = '';
                helper.prepush(pushMsgs, 'Alright.');
                helper.prepush(pushMsgs, 'What\'s your name?');
                socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
            }
        }
    },

    cleanForSpeech: function(msg) {
        msg = msg.slice(4);
        msg = msg[0].toUpperCase() + msg.slice(1);
        if(!(msg[msg.length-1] === '.' || msg[msg.length-1] === '!' ||msg[msg.length-1] === '?')){
            msg = msg + '.';
        }
        return msg;
    },

    speech: function(msg, socket, matchPlayer, pushMsgs) {
        msg = this.cleanForSpeech(msg);
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
            if(connectedPlayers.hasOwnProperty(key)) {
                let player = connectedPlayers[key];
                if (player.room === matchPlayer.room) {
                    socket.broadcast.to(player.id).emit('server message', {messages: matchPlayer.name + punct + 's, <strong>"' + msg + '"</strong>'});
                } else if (shouting) {
                    let adjacents = rooms[matchPlayer.room].exits;
                    for (let i = 0; i < adjacents.length; ++i) {
                        if (player.room === adjacents[i].id) {
                            socket.broadcast.to(player.id).emit('server message', {messages: 'Someone shouts, <strong>"' + msg + '"</strong>' + ' from somewhere nearby.'});
                        }
                    }
                }
            }
        }
        // socket.broadcast.emit('server message', {messages: matchPlayer.name + punct + 's, <strong>"' + msg + '"</strong>'});
        helper.prepush(pushMsgs, 'You' + punct + ', <strong>"' + msg + '"</strong>');
        socket.emit('server message', helper.msgPackage(matchPlayer.id, pushMsgs));
        return msg;
    },

    roomChange: function(exit, matchPlayer, pushMsgs, socket) {
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
                    if(connectedPlayers.hasOwnProperty(key)) {
                        let player = connectedPlayers[key];
                        if (oldRoom.id === player.room) {
                            helper.prepush(pushMsgs, matchPlayer.name + ' exits to the ' + exit + '.');
                            socket.broadcast.to(player.id).emit('server message', helper.msgPackage(player.id, pushMsgs));
                        } else if (newRoom.id === player.room) {
                            let enterDir = '';
                            for (let j = 0; j < newRoom.exits.length; ++j) {
                                if (newRoom.exits[j].id === oldRoom.id) {
                                    enterDir = newRoom.exits[j].dir;
                                }
                            }
                            helper.prepush(pushMsgs, matchPlayer.name + ' enters from the ' + enterDir + '.');
                            socket.broadcast.to(player.id).emit('server message', helper.msgPackage(player.id, pushMsgs));
                        }
                    }
                }
                helper.prepush(pushMsgs, 'You exit to the ' + exits[i]['dir'] + '...');
                helper.prepush(pushMsgs, this.newRoomMessages(matchPlayer));
                break;
            }
        }
        return dirFound;
    },

    newRoomMessages: function(player){
        let room = global.rooms[player.room];
        let others = [];
        for(let i = 0; i < room.entities.length; ++i){
            if(room.entities[i].name !== player.name){
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
};