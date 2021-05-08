const fs = require('fs');
const jsonfile = require('jsonfile')

const Discord = require('discord.js');
const client = new Discord.Client();
let auth = require('./auth.json');

const { sequelize, Links } = require('./dbObjects');

const prefix = "!";

client.on("message", async message => {

  // TODO: add config mechanism for channels to explicitly watch, ignoring others?

  if (message.author.bot) return;

  // Commands section. To generalize.
  if (message.content.startsWith(prefix)) {

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if (command === "ping") {
      const timeTaken = Date.now() - message.createdTimestamp;
      message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
    } else if (command === "help") {
      message.reply(`I grab links every time someone shares them in here. Pretty soon I'll be able to present them back to you in various ways. Stay tuned!`);
    }
  } else {

    // Someone said something! Let's see if there are links to grab.

    const words = message.content.split(' ');

    let count = 0;
    for (const s of words) {
      if (isValidHttpUrl(s)) {

      // There's a link in the message! Let's try to save it.

        let date = new Date().toISOString();

        try {

        	const link = await Links.create({
        		url: s,
            server: message.guild.name,
            channel: message.channel.name
        	});

          console.log(date + " Saved this link from " + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ": " + s);
          count++;

        } catch (e) {

          if (e.name === 'SequelizeUniqueConstraintError') {
            console.log(date + ' ' + e + ': Not saving this duplicate link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s);
	        } else {
          console.error(date + ' Got exception ' + e + ' while trying to save this link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s);
          }
        }
      }
    } 
    if (count > 0) {
      let links = ' link.';
      if (count > 1) {
        links = ' links.';
      }
      message.reply('Saved ' + count + links);
    }
  }
});

client.once('ready', () => {
  sequelize.sync();
	console.log('Aggrejag ready.');
});

client.login(auth.token);

function isValidHttpUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

