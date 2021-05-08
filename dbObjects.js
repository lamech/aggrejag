const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const Links = require('./model/Links')(sequelize, Sequelize.DataTypes);

module.exports = { sequelize, Op, Links };
