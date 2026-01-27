export interface Room {
    users: string[]; 
    capacity: number;
}

export interface RoomStore {
    [roomId: string]: Room;
}