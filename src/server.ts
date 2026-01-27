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

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket)=>{
    console.log("User connected:", socket.id);

    socket.on('disconnect',()=>{
        console.log('User disconnected:', socket.id)
    });
})

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});