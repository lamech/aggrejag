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

    } else if (command === "list") {

      // TODO: Going to the db twice here. 
      // Can we sort out YT links in memory instead?

      let links = await Links.findAll({
        limit: 20,
        where: {
          guild_id: message.guild.id,
          channel_id: message.channel.id
        }
      });

      let ytlinks = await Links.findAll({
        limit: 50,
        order: [['createdAt', 'DESC']],
        where: {
          guild_id: message.guild.id,
          channel_id: message.channel.id,
          url: { 
            [Op.or]: {
              [Op.startsWith]: 'https://youtube.com/', 
              [Op.startsWith]: 'https://www.youtube.com/' 
            }
          }
        }
      });
  
      // TODO: Despite current 50 row limit, keep this for archive searching, later.
      // Only grab the most recent 50 YT links, if there are more than 50,
      // due to Youtube's limit on this way of anonymously creating a playlist:
      ytlinks = ytlinks.slice(-50); 

      let ids = [];
      let ytlist;

      for (const ytlink of ytlinks) {
        let url = new URL(ytlink.url);
        let id = url.searchParams.get('v'); 
        if (id != null) {
         ids.push(id); 
        }
      }

      if (ids.length > 0) {
        ytlist = 'https://www.youtube.com/watch_videos?video_ids=' + ids.join(',');
      } 
      
      if (links.length > 0) { 
        //TODO: declutter via DM: message.author.send({ embed: linksToEmbed(ytlist, links) });
        message.channel.send({ embed: linksToEmbed(ytlist, links) });
      } else {
        message.reply('Sorry, no links to share right now; wait for someone to post something.');
      }

    } else if (command === "help") {
      // TODO: Generate help message dynamically.
      message.reply(`I grab links every time someone shares them in here. If you tell me '!list' I will return a list of the most recent links I've seen (20 or fewer). If there have been YouTube links shared, the top of the list will be a link to an auto-generated YouTube playlist you can click on. NOTE: I'm still under development, so all this might change.`);
    }
  } else {

    // Someone said something (and it wasn't a command)! Let's see if there are links to grab.

    const words = message.content.split(' ');

    let count = 0;
    for (const s of words) {
      if (isValidHttpUrl(s)) {
      // There's a link in the message! Let's try to save it.

        let date = new Date().toISOString();
   
        try {
 
          // Do we already have this link for this server/channel?
          let alreadyLink = await Links.findAll({
            where: {
              guild_id: message.guild.id,
              channel_id: message.channel.id,
              url: s
            }
          });

          if (alreadyLink.length > 0) {

            console.log(date + ': Not saving this duplicate link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s);

          } else {

            let title = await fetchTitle(s);
            // Ok to save.
            const link = Links.create({
            	url: s,
              guild: message.guild.name,
              channel: message.channel.name,
              guild_id: message.guild.id,
              channel_id: message.channel.id,
              description: title
            });
            count++;
            console.log(date + " Saved this link from " + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ": " + s);

          }
        } catch (e) {
            console.error(date + ' Got exception ' + e + ' while trying to save this link from ' + message.guild.name + ' ' + message.channel.name + ' ' + message.author.tag + ': ' + s);
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

function linksToEmbed(ytlist, links) {

  let fields = [];
  if (ytlist != null) { 
    fields.push({ 
      name: 'Playlist (YouTube links only)', value : ytlist
    });
  }

  for (const link of links) {
    fields.push({ name: link.description, value: link.url }) 
  }

  const embed = {
  	color: 0x0099ff,
  	title: 'Current Links',
  	description: 'Links I currently have stored from #' + links[0].channel,
  	fields: fields,
  	timestamp: new Date(),
  };

  return embed;

}

async function fetchTitle(url) {

  let title; 
  await got(url).then(response => {
    const $ = cheerio.load(response.body);
    const titleData = $('title')[0];
    title = $('title')[0].children[0].data;
  }).catch(err => {
    console.error(date + 'Error trying to get title of ' + s + ': ' + err);
  });

  return title;

}
