const fs = require('fs');
const jsonfile = require('jsonfile')
const sqlite3 = require('sqlite3').verbose();

const Discord = require('discord.js');
const client = new Discord.Client();
let auth = require('./auth.json');

const prefix = "!";

client.on("message", function(message) {
  if (message.author.bot) return;

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

    const outfile = 'links.jsonl'; 
    const words = message.content.split(' ');

    let count = 0;
    for (const s of words) {
      if (isValidHttpUrl(s)) {
        let stream = fs.createWriteStream("links.jsonl", {flags:'a'});
        let date = new Date().toISOString();
        console.log(date + " Saving this link from " + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ": " + s);
        let entry = { url: s, date: date, server: message.guild.name, channel: message.channel.name };
  
        jsonfile.writeFile(outfile, entry, { flag: 'a' }, function (err) {
          if (err) console.error(err)
        });
        count++; 
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
