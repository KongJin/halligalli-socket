import { createServer } from "http";
import { Server } from "socket.io";

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

const deletedId = [];
const roomsInfo = [];

io.on("connection", (socket) => {
  const { token } = socket.handshake.auth;
  const rooms = io.sockets.adapter.rooms;
  socket.onAny((event: any) => {
    console.log(`Socket Event : ${event}`);
  });

  socket.on("enter_lobby", async (done: any) => {
    console.log("몇명있나");
    socket.leave(socket.id);
    socket.join("lobby");
    console.log("enter_lobby", { roomsInfo });
    done(roomsInfo);
  });

  socket.on("create_room", async (done) => {
    socket.leave("lobby");

    let roomId = String(rooms.size + 1);
    console.log("create_room", { roomId });
    if (deletedId.includes(roomId)) {
      deletedId.splice(deletedId.indexOf(roomId));
    }
    if (deletedId.length > 0) {
      roomId = deletedId.pop();
    }

    socket.join(roomId);
    roomsInfo[roomId] = { id: roomId, roomName: "test", started: false };
    done();
  });

  socket.on("enter_room", async (id, done: any) => {
    console.log({ size: io.sockets.adapter.rooms });
    socket.leave("lobby");

    socket.join(id);

    // count[] = io.sockets.adapter.rooms.get(productId)?.size;

    // done(count[productId]);
    console.log("몇명있나");
    console.log(io.sockets.adapter.rooms);
  });

  socket.on(
    "new_message",
    async (productId: string, name: string, content: string, done: any) => {}
  );

  socket.on("out_room", (roomName: string, done) => {
    socket.leave(roomName);

    console.log("나기가 방");
    done();
  });

  socket.on("delete_room", async (productId: string, done) => {
    socket.leave(productId);

    try {
      socket.to("lobby").emit("receive_message");
      done();

      console.log("방 삭제");
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("disconnecting", function () {
    const roomName = publicRooms(socket.id);
    socket.leave(roomName);
    console.log("디스커넥팅");
  });

  socket.on("disconnect", function () {
    console.log("user disconnected: ", socket.id);
  });
});

const PORT = 5000;

httpServer.listen(PORT, () => {
  console.log(`listening on port http://localhost:${PORT}`);
});
