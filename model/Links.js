
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Link', {
    url: { type: DataTypes.TEXT, unique: true, },
    server: DataTypes.STRING,
    channel: DataTypes.STRING,
    description: DataTypes.STRING
  });
};
