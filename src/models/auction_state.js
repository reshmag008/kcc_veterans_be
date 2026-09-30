module.exports = (sequelize, type) => {

  return sequelize.define(

    'auction_state',

    {

      id: {
        type: type.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },

      playerId: {
        type: type.INTEGER,
        allowNull: true
      },

      roomId: {
        type: type.STRING,
        allowNull: true
      },

      currentBid: {
        type: type.INTEGER,
        allowNull: true,
        defaultValue: 0
      },

      teamId: {
        type: type.INTEGER,
        allowNull: true
      },

      remainingMs : {
        type: type.BIGINT,
        allowNull: true
      },

      teamName: {
        type: type.STRING,
        allowNull: true
      },

      endsAt: {
        type: type.DATE,
        allowNull: true
      },

      startedAt: {
        type: type.DATE,
        allowNull: true
      },

      status: {
        type: type.ENUM(
          'IDLE',
          'BIDDING',
          'PAUSED',
          'SOLD',
          'UNSOLD'
        ),
        allowNull: false,
        defaultValue: 'IDLE'
      }

    },

    {

      timestamps: true,

      freezeTableName: true,

      createdAt: 'createdAt',

      updatedAt: 'updatedAt',

      deletedAt: 'deletedAt',

      paranoid: true

    }

  )

}