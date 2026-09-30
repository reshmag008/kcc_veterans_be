const Sequelize = require('sequelize');
const dotenv = require('dotenv')
dotenv.config()
class ConfigConnection {

  // this.sequelize = new Sequelize('player_auction', 'admin', 'admin123', {
    // host: 'player-auction.cxue6q6m2f3h.us-east-1.rds.amazonaws.com',

  connectDB () {
    this.sequelize = new Sequelize('kcc_veterans', 'avnadmin', 'AVNS_zEZTWlYzZAqKd5A_H4Z', {
      host: 'mysql-n05-sports-n05-sports.d.aivencloud.com',
      port : 24760,
      dialect: 'mysql',
      operatorsAliases: true,
      freezeTableName: true,
    //   logging: true,
        pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000
    }
    })
    this.sequelize
      .authenticate()
      .then(() => {
        console.log('Connection has been established successfully.  ')
      })
      .catch(err => {
        console.error('Unable to connect to the database:', err)
      })
    return this.sequelize
  }
}

module.exports = ConfigConnection;



