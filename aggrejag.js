const fs = require('fs');
const cheerio = require ('cheerio');
const got = require('got');
const Discord = require('discord.js');
const client = new Discord.Client();
let auth = require('./auth.json');

const { sequelize, Op, Links } = require('./dbObjects');

const prefix = "!";

client.on("message", async message => {

  // TODO: add config mechanism for channels to explicitly watch, ignoring others?

  if (message.author.bot) return;

  // TODO: Commands section. To generalize.
  if (message.content.startsWith(prefix)) {

    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    if (command === "ping") {
      const timeTaken = Date.now() - message.createdTimestamp;
      message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);

    } else if (command === "linklist") {

      let links = await Links.findAll();
      
      if (links.length > 0) { 
        message.channel.send({ embed: linksToEmbed(links) });
      } else {
        message.reply('Sorry, no links to share right now; wait for someone to post something.');
      }

    } else if (command === "ytlist") {

      let links = await Links.findAll({
        order: [['createdAt', 'DESC']],
        where: {
          url: { 
            [Op.or]: {
              [Op.startsWith]: 'https://youtube.com/', 
              [Op.startsWith]: 'https://www.youtube.com/' 
            }
          }
        }
      });

      // Only grab the most recent 50 links, if there are more than 50,
      // due to Youtube's limit on this way of anonymously creating a playlist:
      links = links.slice(-50); 

      let ids = [];

      for (const link of links) {
        let url = new URL(link.url);
        let id = url.searchParams.get('v'); 
        if (id != null) {
         ids.push(id); 
        }
      }

      if (ids.length > 0) {
        message.reply('https://www.youtube.com/watch_videos?video_ids=' + ids.join(','));
      } else {
        message.reply('Sorry, no Youtube links to share right now; try !linklist instead.');
      }
      

    } else if (command === "help") {
      // TODO: Generate help message dynamically.
      message.reply(`I grab links every time someone shares them in here. If you tell me '!ytlist' I will return a Youtube playlist of the most recent 50 Youtube links I've seen.`);
    }
  } else {

    // Someone said something (and it wasn't a command)! Let's see if there are links to grab.

    const words = message.content.split(' ');

    let count = 0;
    for (const s of words) {
      if (isValidHttpUrl(s)) {
      // There's a link in the message! Let's try to save it.

        let date = new Date().toISOString();
        let title;

        // Fetch title
        got(s).then(response => {
          const $ = cheerio.load(response.body);
          console.log("\n##############################################\n");
          const titleData = $('title')[0];
          console.log(titleData);
          console.log("\n##############################################\n");
          title = $('title')[0].children[0].data;
          console.log(title);
          console.log("\n##############################################\n");
        }).catch(err => {
          console.error(date + 'Error trying to get title of ' + s + ': ' + err);
        });
   
        try {
          const link = Links.create({
          	url: s,
            server: message.guild.name,
            channel: message.channel.name,
            description: title
          });
          console.log(date + " Saved this link from " + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ": " + s + " | " + title);
        } catch (e) {
          if (e.name === 'SequelizeUniqueConstraintError') {
            console.log(date + ' ' + e + ': Not saving this duplicate link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s + " | " + title);
  	      } else {
            console.error(date + ' Got exception ' + e + ' while trying to save this link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s + " | " + title);
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
    }
  }
});

client.once('ready', () => {
  sequelize.sync();
	console.log(new Date().toISOString() + ' Aggrejag ready.');
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

function linksToEmbed(links) {

  let fields = [];

  for (const link of links) {
    fields.push({ name: link.description, value: link.url }) 
  }

  const embed = {
  	color: 0x0099ff,
  	title: 'Current Links',
  	description: 'Links I currently have stored from this channel.',
  	fields: fields,
  	timestamp: new Date(),
  };

  return embed;

}
