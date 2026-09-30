module.exports = (sequelize, type) => {
    return sequelize.define(
      'bid_history',
      {
        id: {
          type: type.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        player_id: { type: type.INTEGER, allowNull: false },
        team_id: { type: type.INTEGER, allowNull: false },
        team_name: { type: type.STRING, allowNull: false },
        bid_amount: { type: type.INTEGER, allowNull: true }
      },
      {
        timestamps: true,
        freezeTableName: true, // Model tableName will be the same as the model name
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        deletedAt: 'deletedAt',
        paranoid : true
        // validate
      }
    )
  }
  