import { createServer } from "http";
import { Server } from "socket.io";
import { parse } from "cookie";
import { deck as initDeck } from "./deck";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    credentials: true,
  },
});

function publicRooms(id: any) {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = io;

  const publicRooms = [];
  rooms.forEach((room, key) => {
    if (sids.get(key) === undefined) {
      if (room.has(`${id}`)) {
        publicRooms.push(key);
      }
    }
  });

  return publicRooms[0];
}

const rn = [0];
const roomsInfo: {
  id: number;
  roomName: string;
  people: string[];
  started: boolean;
}[] = [];

io.on("connection", (socket) => {
  // const cookies = parse(socket.request.headers.cookie || "");
  // const { token } = socket.handshake.auth;
  const rooms = io.sockets.adapter.rooms;
  socket.onAny((event: any) => {
    console.log(`Socket Event : ${event}`);
  });

  socket.on("enter_lobby", async (done: any) => {
    console.log("enter_lobby", { socketId: socket.id, rooms });
    socket.join("lobby");

    console.log("enter_lobby 끝", { socketId: socket.id, rooms });
    done(roomsInfo);
  });

  socket.on("create_room", async (done) => {
    console.log("create_room", { socketId: socket.id, rooms });
    rn.sort((a, b) => {
      return b - a;
    });
    let roomId = rn.pop();
    if (rn.length < 1) {
      rn.push(roomId + 1);
    }

    socket.join(String(roomId));
    roomsInfo[roomId] = {
      id: roomId,
      roomName: `${roomId}번방`,
      people: [],
      started: false,
    };
    console.log("create_room 끝", { socketId: socket.id, rooms });
    done(roomId);
  });

  socket.on("enter_room", async (id, done) => {
    try {
      console.log("enter_room", { id, socketId: socket.id, rooms });
      socket.leave("lobby");
      socket.join(id);
      !roomsInfo[id].people.includes(socket.id) && roomsInfo[id].people.push(socket.id);
      socket.to("lobby").emit("update_roomList", roomsInfo);

      io.sockets.in(id).emit("count", roomsInfo[id].people);

      console.log("enter_room끝", { id, socketId: socket.id, rooms });
      done(socket.id);
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("start_room", async (id) => {
    try {
      roomsInfo[id].started = true;
      socket.to("lobby").emit("update_roomList", roomsInfo);
      let deck = JSON.parse(JSON.stringify(initDeck));

      let assets: { img: string; type: string; cnt: number }[][] = [[], [], [], []];
      let size = roomsInfo[id].people.length;

      if (deck.length > 0) {
        for (let i = 0; i < 14; i++) {
          for (let j = 0; j < size; j++) {
            let random = Math.floor(Math.random() * deck.length);
            assets[j].push(deck[random]);
            deck.splice(random, 1);
          }
        }
      }

      io.sockets.in(id).emit("distribute", assets);

      io.sockets.in(id).emit("turn");
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("turnRe", (id) => {
    try {
      io.sockets.in(id).emit("turn");
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("bell", (id, result) => {
    try {
      console.log("bell", { id, result });
      io.sockets.in(id).emit("bellResult", socket.id, result);
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("end_room", async (id) => {
    try {
      console.log("end_room", { id, socketId: socket.id, rooms });
      roomsInfo[id].started = false;
      socket.to("lobby").emit("update_roomList", roomsInfo);
      console.log("end_roomd 끝 ", { id, socketId: socket.id, rooms });

      io.sockets.in(id).emit("count", roomsInfo[id].people);
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("new_message", async (productId: string, name: string, content: string, done: any) => {});

  socket.on("out_room", (roomId: string) => {
    try {
      console.log("out_room", { id: roomId, socketId: socket.id, rooms });
      socket.leave(roomId);
      if (roomsInfo[roomId].people.length === 1) {
        rn.push(Number(roomId));
        delete roomsInfo[roomId];
      } else {
        roomsInfo[roomId].people = roomsInfo[roomId].people.filter((el: string) => el !== socket.id);
        console.log("@@@");
        if (!roomsInfo[roomId]?.started) {
          console.log("###");
          io.sockets.in(roomId).emit("count", roomsInfo[roomId].people);
        } else {
          io.sockets.in(roomId).emit("update_users", roomsInfo[roomId].people);
        }
      }
      socket.to("lobby").emit("update_roomList", roomsInfo);
      console.log("out_room 끝", { id: roomId, socketId: socket.id, rooms });
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("disconnecting", function () {
    try {
      console.log("disconnecting");

      console.log("disconnecting", { socketId: socket.id, rooms });
      // socket.leave(socket.id);
      const roomId = publicRooms(socket.id);
      if (roomId !== "lobby" && roomId !== undefined) {
        roomsInfo[roomId].people = roomsInfo[roomId].people.filter((el: string) => el !== socket.id);
      }

      socket.to("lobby").emit("update_roomList", roomsInfo);
      // socket.off("enter_lobby", () => {});
      console.log("disconnecting 끝", { socketId: socket.id, rooms });
    } catch (e) {
      console.log(e);
    }
  });

  socket.on("disconnect", function () {
    console.log("디스커넥트");
  });
});

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`listening on port http://localhost:${PORT}`);
});
