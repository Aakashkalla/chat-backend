import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { RoomStore } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer,{
    cors:{
        origin : "*",
        methods:["GET", "POST"]
    }
});

const rooms: RoomStore = {};

const userRooms : {[socketId : string] : string} = {};

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket)=>{
    console.log("User connected:", socket.id);

    socket.on('create_room', (capacity : number)=>{
        const roomID = generateRoomId();
        rooms[roomID] = {
            users : [],
            capacity
        }

        socket.emit('room_created', {roomId : roomID});

        console.log(`Room ${roomID} created with capacity ${capacity}`);
    })

    socket.on('join_room',(data:{roomId: string; username: string})=>{
        const {roomId, username} = data;

        if(!rooms[roomId]){
            return socket.emit('join_error', {message : 'Room does not exist!'});
        }

        if(rooms[roomId].users.length>= rooms[roomId].capacity){
            return socket.emit('join_error', {message : 'Room is full!'} );
        }

        rooms[roomId].users.push(socket.id);
        socket.join(roomId);

        userRooms[socket.id] = roomId;

        socket.emit('join_success',{roomId})
        socket.to(roomId).emit('user_joined',{username, socketId: socket.id})

        console.log(`${username} joined room ${roomId}`)
    })


    socket.on('send_message', (data : {roomId : string, username:string, message : string})=>{
        const {username, roomId, message} = data;

        if(!rooms[roomId]){
            return socket.emit('error',{message: "Room does not exist!"});
        }

        const messageData = {username, message, timestamp : new Date().toISOString()};

        io.to(roomId).emit('receive_message', messageData);

        console.log(`Message in room ${roomId} from ${username}: ${message}`);
    })

    socket.on('disconnect',()=>{
        console.log('User disconnected:', socket.id);

        const roomId = userRooms[socket.id];

        if(!roomId){
            return;
        }

        if(!rooms[roomId]){
            delete userRooms[socket.id];
            return;
        }
        const userIndex = rooms[roomId].users.indexOf(socket.id);
        if(userIndex!==-1){
            rooms[roomId].users.splice(userIndex,1);
        }

        socket.to(roomId).emit('user_left', {socketId : socket.id});

        if(rooms[roomId].users.length===0){
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted`);
        }else{
            console.log(`User left the Room ${roomId}`);
        }
        delete userRooms[socket.id];

    });
})

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});