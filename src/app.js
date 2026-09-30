
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const routes = require("./routes");
const teams = require("./services/teams");
const player = require("./services/player");
require("./config/db_connection");

const auctionTimers = new Map();
const auctionRemaining = new Map();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8080;
const ROOM_ID = "kcc_auction_room";

/* =========================
   CORS
========================= */

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:8081",
  "https://kizhakenni-pl-fe-204746249106.europe-west1.run.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  })
);

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES
========================= */

app.use(express.static("public"));

/* =========================
   ROUTES
========================= */

app.use(routes);

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.status(200).send("Server is up");
});

app.disable("x-powered-by");

/* =========================
   SOCKET.IO
========================= */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: ["websocket", "polling"],
});

/* =========================
   REDIS
========================= */

const pubClient = createClient({
  url: process.env.REDIS_URL,
});

const subClient = pubClient.duplicate();

pubClient.on("error", (error) => {
  console.error("Redis Pub Client Error:", error);
});

subClient.on("error", (error) => {
  console.error("Redis Sub Client Error:", error);
});

/* =========================
   SOCKET EVENTS
========================= */

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId = ROOM_ID) => {
    console.log("joined room")
    socket.join(roomId);

    console.log(
      `Socket ${socket.id} joined room ${roomId}`
    );
  });

  const AUCTION_DURATION = 20 * 1000;

  socket.on("start-auction", async ({ roomId, playerId }) => {
  const startedAt = Date.now();
  const endsAt = startedAt + AUCTION_DURATION;

  const auctionState = {
    roomId,
    playerId,
    status: "BIDDING",
    startedAt,
    endsAt,
    currentBid: 0,
    teamId: null,
    teamName:null
  };

  // Save this in Redis / DB
  teams.addAuctionState(auctionState);

  scheduleAuctionFinalization(roomId, playerId, endsAt);

  // Send to every connected client
  io.to(roomId).emit("auction-started", auctionState);
});






  /* =========================
     BID
  ========================= */

  socket.on("place-bid", async ({ roomId, playerId, teamId, teamName, bidAmount }) => {

    console.log("bidAmount in place bid=== ", bidAmount);

    // const auction = await teams.getAuctionState(playerId);
   
    //   if (!auction || auction.status !== "BIDDING") {
    //     return;
    //   }

    //   if (Date.now() >= auction.endsAt) {
    //     return;
    //   }
     const nextBid = (bidAmount || 0) + 1000;

    const newEndsAt = Date.now() + 20 * 1000;

    io.to(roomId).emit("bid-updated", {
      playerId,
      teamId,
      teamName,
      currentBid: bidAmount,
      endsAt: newEndsAt,
      nextBid : nextBid,
      status: "BIDDING"
    });



  // Validate and save the bid
  await teams.addBidHistory({
    player_id : playerId,
    team_id : teamId,
    team_name : teamName,
    bid_amount : bidAmount
  });

  // Restart timer
  

  await teams.updateAuctionState({
    playerId:playerId,
    currentBid: bidAmount,
    teamId: teamId,
    teamName:teamName,
    endsAt: newEndsAt
  });

  scheduleAuctionFinalization(roomId, playerId, newEndsAt,teamId,bidAmount);

  // Tell ALL clients about the new bid + new timer
  
});



  /* =========================
     PLAYER SELECTED
  ========================= */

  socket.on("current_player", (data) => {
    const roomId = data?.roomId || ROOM_ID;

    io.to(roomId).emit("current_player", data);
  });

  /* =========================
     AUCTION CALL
  ========================= */

  socket.on("auction-call", (data) => {
    const roomId = data?.roomId || ROOM_ID;

    io.to(roomId).emit("auction-call", data);
  });


  socket.on("get-auction-state", async ({ roomId }) => {

  const result = await teams.getAuctionStateByRoom(roomId)

  if(result){

  const state = result?.toJSON();

state.endsAt = state?.endsAt
  ? state.endsAt.getTime()
  : null;

console.log("timestamp:", state.endsAt);
console.log("state:", state);

  socket.emit("auction-state", state);
  }
});


function pauseAuctionTimer(playerId, endsAt) {
  const existingTimer = auctionTimers.get(playerId);

  if (existingTimer) {
    clearTimeout(existingTimer);
    auctionTimers.delete(playerId);
  }

  const remainingMs = Math.max(
    0,
    new Date(endsAt).getTime() - Date.now()
  );

  auctionRemaining.set(playerId, remainingMs);

  return remainingMs;
}


socket.on("pause-auction", async ({ roomId, playerId }) => {

  const state = await teams.getAuctionStateByRoom(roomId);

  if (!state) return;

  if (state.status !== "BIDDING") {
    return;
  }

  const remainingMs = pauseAuctionTimer(
    playerId,
    state.endsAt
  );

  console.log("remainingMs == ", remainingMs);

  await teams.updateAuctionState({
    roomId,
    playerId,
    status: "PAUSED",
    remainingMs,
    endsAt: null
  });

  const updatedState =
    await teams.getAuctionStateByRoom(roomId);

  const response = updatedState.toJSON();

  if (response.endsAt) {
    response.endsAt = new Date(response.endsAt).getTime();
  }

  console.log("response in pause == ", response);

  io.to(roomId).emit("auction-state", response);
});


socket.on("resume-auction", async ({ roomId,playerId }) => {
  const state = await teams.getAuctionStateByRoom(roomId);

  if (!state) return;

  if (state.status !== "PAUSED") {
    return;
  }

  const remainingMs = Number(state.remainingMs || 0);

  if (remainingMs <= 0) {
    return;
  }

  const newEndsAt = Date.now() + remainingMs;

  await teams.updateAuctionState({
    roomId,
    playerId,
    status: "BIDDING",
    endsAt: new Date(newEndsAt),
    remainingMs: null
  });

  const updatedState = await teams.getAuctionStateByRoom(roomId);

  const response = updatedState.toJSON();

  if (response.endsAt) {
    response.endsAt = new Date(response.endsAt).getTime();
  }

  scheduleAuctionFinalization(roomId, playerId, newEndsAt,response.teamId,response.currentBid);


  io.to(roomId).emit("auction-state", response);
});



  /* =========================
     DISCONNECT
  ========================= */

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id}`,
      reason
    );
  });
});

/* =========================
   START SERVER
========================= */

function scheduleAuctionFinalization(
  roomId,
  playerId,
  endsAt,
  teamId,
  bidAmount
) {
  // Clear previous timer
  const existingTimer = auctionTimers.get(playerId);

  if (existingTimer) {
    clearTimeout(existingTimer);
    console.log("Cleared existing timer:", playerId);
  }

  const delay = Math.max(
    0,
    new Date(endsAt).getTime() - Date.now()
  );

  console.log(
    "Scheduling timer:",
    playerId,
    "delay:",
    delay
  );

  const timer = setTimeout(async () => {

    console.log(
      "🔥 TIMER FIRED:",
      playerId
    );

    auctionTimers.delete(playerId);

    // VERY IMPORTANT:
    // Check DB before finalizing
    const state = await teams.getAuctionStateByRoom(roomId);

    if (!state) return;

    if (state.status !== "BIDDING") {
      console.log(
        "Timer fired but auction is:",
        state.status
      );
      return;
    }

    await finalizeAuction(
      roomId,
      playerId,
      teamId,
      bidAmount
    );

  }, delay);

  auctionTimers.set(playerId, timer);
}


async function finalizeAuction(roomId, playerId,teamId,bidAmount) {

  console.log("finalizeAuction called with:", { roomId, playerId, teamId, bidAmount });

  
  const auction = await teams.getAuctionState(playerId);

  console.log("auction in finalise== ", auction)

   io.to(roomId).emit("auction-ended", {
    playerId
  });


  if (!auction) return;

  // // Important: another process may have already finalized it
  // if (auction.status !== "BIDDING") {
  //   return;
  // }

  // Timer hasn't actually expired
  // if (Date.now() < auction.endsAt) {
  //   return;
  // }


  if(teamId){

    console.log("inside iffffff")

    let updatePlayer = await player.updatePlayers({id:playerId, team_id:teamId, bid_amount:bidAmount});
    console.log("updatePlayer==after timer= when sold", updatePlayer)
    io.to(roomId).emit('player_sold', JSON.stringify({id:playerId, team_id:teamId, bid_amount:bidAmount}))

  }else{

    console.log("inside elseeeeeeeeeeeee")
    let updatePlayer = await player.updatePlayers({id:playerId , un_sold:true});
    console.log("updatePlayer==after timer= when unsold", updatePlayer)  
    io.to(roomId).emit('player_unsold',  JSON.stringify({id:playerId, team_id:teamId, bid_amount:bidAmount}))                                                                        
  }
   await teams.updateAuctionState({
    roomId,
    playerId,
    status: "SOLD",
    endsAt:null,
    remainingMs: null
  });
 
}





async function startServer() {
  try {
    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO enabled`);
      console.log(`Auction room: ${ROOM_ID}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

/* =========================
   GRACEFUL SHUTDOWN
========================= */

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    await pubClient.quit();
    await subClient.quit();

    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* =========================
   EXPORTS
========================= */

module.exports = {
  app,
  server,
  io,
  ROOM_ID,
};

/* =========================
   START
========================= */

startServer();

