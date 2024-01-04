// node module includes
var uuid = require('node-uuid');

// include our custom server configuration
var Server = require('./server.js');
var Room = require('./room.js');

// local variables
var rooms = {};
var clients = {};

var server = new Server();

server.on('connection', function (client) {
    clients[client.id] = {id: client.id, room: null, isHost: false, color: '#' + ('00000' + (Math.random() * 16777216 << 0).toString(16)).substr(-6)};
    client.emit('update', rooms);
    broadcastDebugMsg(client.id + ' has joined the server');

    client.on('disconnect', function() {
        if (clients[client.id]) {
            if (clients[client.id].isHost) {
                var room = findRoomByID(client.id, rooms);
                if (room) {
                    // Redirige a los jugadores a lobby
                    server.sockets.in(room.id).emit('lobby');
                    delete rooms[room.id];
                    server.sockets.emit('update', rooms);
                }
            }
            broadcastDebugMsg(client.id + ' has disconnected from the server');
            delete clients[client.id];
        }
    });
    client.on('host', function(data, callback) {
        var playerName = data.playerName;
        var newRoomID = uuid.v4();
        if (connectClientToRoom(newRoomID, client.id, playerName, true)) {
            callback(newRoomID);
        }
    });
    
    client.on('join', function(data, callback) {
        var playerName = data.playerName;
        var roomID = data.roomID;
        if (connectClientToRoom(roomID, client.id, playerName, false)) {
            callback(roomID);
        }
    });

    client.on('chatMessage', function(msg) {
    var room = findRoomByID(client.id, rooms);
    var playerName = clients[client.id].playerName; // Obtener el nombre del jugador
    server.sockets.in(room.id).emit('addChatMessage', msg, playerName, clients[client.id].color);
});


    function connectClientToRoom(roomID, clientID, playerName, isHost) {
        if (clients[clientID].isHost || clients[clientID].room) {
            return false;
        }
    
        client.join(roomID, function(err) {
            if (!err) {
                clients[client.id].isHost = isHost;
                clients[client.id].room = roomID;
                clients[client.id].playerName = playerName; // Guardar el nombre del jugador
    
                if (isHost) {
                    rooms[roomID] = new Room(roomID, clientID);
                    broadcastDebugMsg(playerName + ' has created room: ' + roomID);
                } else {
                    rooms[roomID].addClient(clientID);
                    broadcastDebugMsg(playerName + ' has joined room: ' + roomID);
                }
                server.sockets.emit('update', rooms);
            } else {
                // error
            }
        });
    
        return true;
    }

    function broadcastDebugMsg(msg) {
        server.sockets.emit('debugMessage', msg);
    }

    function findRoomByID(clientID, rooms) {
        var key, room;
        for (key in rooms) {
            if (rooms.hasOwnProperty(key)) {
                room = rooms[key];
                for (var i = 0; i < room.clients.length; i++) {
                    if (room.clients[i] === clientID) {
                        return room;
                    }
                }
            }
        }
        return null;
    }
});
