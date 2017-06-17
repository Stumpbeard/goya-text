module.exports = {
    toTitleCase: function(str){
        str = str.toLowerCase().split(' ');
        for (let i = 0; i < str.length; ++i){
            str[i] = str[i][0].toUpperCase() + str[i].slice(1);
        }
        return str.join(' ');
    },

    prepush: function(msgArray, msg){
        if(typeof msg === 'string'){
            msg = msg.replace(/\n/g, '<br>');
            msg = msg.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
            msgArray.push(msg)
        }
        else {
            for(let x in msg){
                if(msg.hasOwnProperty(x)) {
                    msg[x] = msg[x].replace(/\n/g, '<br>');
                    msg[x] = msg[x].replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                    msgArray.push(msg[x]);
                }
            }
        }
    },

    msgPackage: function(player, msg){
        global.connectedPlayers[player].roomContents = JSON.stringify(global.rooms[global.connectedPlayers[player].room]);
        return {state: global.connectedPlayers[player], messages: msg};
    }
};