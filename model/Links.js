
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Link', {
    url: DataTypes.TEXT,
    guild: DataTypes.STRING,
    channel: DataTypes.STRING,
    guild_id: DataTypes.STRING,
    channel_id: DataTypes.STRING, 
    description: DataTypes.STRING
  });
};
