
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('links', {
    url: { type: DataTypes.TEXT, unique: true, },
    channel: DataTypes.STRING,
  });
};
