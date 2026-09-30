const { app,server } = require('./app');
const port = process.env.PORT || 8080;

// const socketConnection = require('./config/socketConnection');

// let socketConnect;
// socketConnection.socketConnection().then(socket=>{
//   console.log("socket== ")
//   socketConnect = socket;
//   console.log("socketConnect=== ", socketConnect);
// })

const startServer = async () => {

 app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});

};

// Start the server and handle connections and errors
startServer();