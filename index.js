const fs = require('fs');
const jsonfile = require('jsonfile')
const outfile = 'links.jsonl'

const Discord = require('discord.js');
const client = new Discord.Client();
let auth = require('./auth.json');

const prefix = "!";

client.on("message", function(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    const timeTaken = Date.now() - message.createdTimestamp;
    message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
  }
  else if (command === "link") {
    const u = args.shift();
    if (isValidHttpUrl(u)) {
      let stream = fs.createWriteStream("links.jsonl", {flags:'a'});
      let date = new Date().toISOString();
      console.log(date + " Saving this link from " + message.author.tag + ": " + u);
      let entry = { url: u, user: message.author.tag, date: date };

      jsonfile.writeFile(outfile, entry, { flag: 'a' }, function (err) {
        if (err) console.error(err)
      });

      message.reply(`Saved.`);
    } else {
      message.reply(`Sorry, that doesn't look like a valid URL.`);
    }
  }
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
