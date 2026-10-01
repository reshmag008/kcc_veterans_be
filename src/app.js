const http = require("http");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes");
const models = require("./models");
const path = require('path');

const teams = require("./services/teams");
const player = require("./services/player");

require("./config/db_connection");

const auctionTimers = new Map();
const auctionRemaining = new Map();

const ROOM_ID = "kcc_auction_room";

const app = express();

const allowedOrigins = [
  "http://localhost:8080","http://localhost:8081","https://kcc-veterens-fe-204746249106.europe-west1.run.app/"
];

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  })
);

app.use(express.static('public'))

/* =======================
   MIDDLEWARE
   ======================= */
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(routes);
app.disable("x-powered-by");

/* =======================
   HEALTH CHECK
   ======================= */
app.get("/", (req, res) => {
  res.send("Server is up");
});

/* =======================
   HTTP SERVER (IMPORTANT)
   ======================= */
const server = http.createServer(app);

/* =======================
   SOCKET.IO
   ======================= */
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

global.io = io;

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

  socket.on("team_call", (data) => {

    console.log("team_call---")
    const roomId = data?.roomId || ROOM_ID;

    io.to(roomId).emit("team_call", data);
  });

  socket.on("player_sold", (data) => {

    console.log("player_sold---")
    const roomId = data?.roomId || ROOM_ID;

    io.to(roomId).emit("player_sold", data);
  });

  socket.on("player_unsold", (data) => {

    console.log("player_unsold---")
    const roomId = data?.roomId || ROOM_ID;

    io.to(roomId).emit("player_unsold", data);
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



/* =======================
   START SERVER
   ======================= */
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "my_verify_token";

app.get("/webhook/whatsapp", (req, res) => {
  console.log("req== ", req.query);
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("WhatsApp webhook verification request");
  console.log("VERIFY_TOKEN== ", VERIFY_TOKEN)
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WhatsApp webhook verified successfully");

    return res.status(200).send(challenge);
  }

  console.log("WhatsApp webhook verification failed");

  return res.sendStatus(403);
});


app.post("/webhook/whatsapp", (req, res) => {
  try {
    console.log(
      "WhatsApp webhook received:",
      JSON.stringify(req.body, null, 2)
    );

    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entries = body.entry || [];

    entries.forEach((entry) => {
      const changes = entry.changes || [];

      changes.forEach((change) => {
        const value = change.value;

        // Message status updates
        const statuses = value?.statuses || [];

        statuses.forEach((status) => {
          console.log("=================================");
          console.log("WhatsApp Message Status");
          console.log("Message ID:", status.id);
          console.log("Status:", status.status);
          console.log("Recipient:", status.recipient_id);
          console.log("Timestamp:", status.timestamp);

          if (status.errors) {
            console.log(
              "Errors:",
              JSON.stringify(status.errors, null, 2)
            );
          }

          console.log("=================================");

          switch (status.status) {
            case "sent":
              console.log("Message sent to WhatsApp");
              break;

            case "delivered":
              console.log("Message delivered to recipient");
              break;

            case "read":
              console.log("Message read by recipient");
              break;

            case "failed":
              console.log("Message delivery failed");

              if (status.errors) {
                status.errors.forEach((error) => {
                  console.log("Error code:", error.code);
                  console.log("Error title:", error.title);
                  console.log("Error message:", error.message);
                });
              }

              break;

            default:
              console.log("Unknown status:", status.status);
          }
        });

        // Incoming WhatsApp messages
        const messages = value?.messages || [];

        messages.forEach((message) => {
          console.log("Incoming WhatsApp message");

          console.log("Message ID:", message.id);
          console.log("From:", message.from);
          console.log("Type:", message.type);

          if (message.text) {
            console.log("Text:", message.text.body);
          }
        });
      });
    });

    // IMPORTANT:
    // Respond quickly to WhatsApp
    return res.sendStatus(200);

  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return res.sendStatus(500);
  }
});





module.exports = { app, server, io };