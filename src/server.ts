import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RoomStore } from './types.js';

const app = express();
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigin,
        methods: ["GET", "POST"],
    },
});

const rooms: RoomStore = {};

const userRooms : {[socketId : string] : string} = {};

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket)=>{

    socket.on('create_room', (capacity : number)=>{
        const roomID = generateRoomId();
        rooms[roomID] = {
            users : [],
            capacity
        }

        socket.emit('room_created', {roomId : roomID});

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
    })


    socket.on('send_message', (data : {roomId : string, username:string, message : string})=>{
        const {username, roomId, message} = data;

        if(!rooms[roomId]){
            return socket.emit('error',{message: "Room does not exist!"});
        }

        const messageData = {username, message, timestamp : new Date().toISOString()};

        io.to(roomId).emit('receive_message', messageData);

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
        }
        delete userRooms[socket.id];
    });
})

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const defaultClientPath = path.resolve(__dirname, '../../chat-frontend/dist');
    const clientDistPath = process.env.CLIENT_DIST_PATH ?? defaultClientPath;

    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});