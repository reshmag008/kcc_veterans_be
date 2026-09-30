const { app,server } = require('./app');
const port = process.env.PORT || 443;

// const socketConnection = require('./config/socketConnection');

// let socketConnect;
// socketConnection.socketConnection().then(socket=>{
//   console.log("socket== ")
//   socketConnect = socket;
//   console.log("socketConnect=== ", socketConnect);
// })

const startServer = async () => {

  // const server = app.listen(8443, () => {
  //     console.log(`Server is running on port ${8443}`);
  //   });

};

// Start the server and handle connections and errors
startServer();