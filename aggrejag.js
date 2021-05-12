const fs = require('fs');
const cheerio = require ('cheerio');
const got = require('got');
const Discord = require('discord.js');
const client = new Discord.Client();
let auth = require('./auth.json');
let config = require ('./config.json');

const { sequelize, Op, Links } = require('./dbObjects');

client.on("message", async message => {

  let isDM = (message.channel.type === "dm");

  // Is this a channel we should be watching? Stay restricted for now.
  if (!isDM && !config.channelsToWatch.includes(message.channel.name)) return;

  let namesOfChannelsToWatch = config.channelsToWatch.map(x => '#' + x).join(' ');
  let pleaseChannel = `Please use this command in one of these channels, so I know which one you mean: ${namesOfChannelsToWatch}`;

  // Ignore bots
  if (message.author.bot) return;

  // TODO: Commands section. To generalize.
  if (message.content.startsWith(config.prefix)) {

    const commandBody = message.content.slice(config.prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    let limit = config.limit;

    if (command === "ping") {
      const timeTaken = Date.now() - message.createdTimestamp;
      message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);

      
    } else if (command === "list") {

      if (isDM) { 
        message.author.send(pleaseChannel);
        return;
      }

      if (args.includes("json")) {
        let nonalpha = /\W/g;
        let guildname = message.guild.name.replace(nonalpha, '_');
        let channelname = message.channel.name.replace(nonalpha, '_');
        let filename = `${guildname}_${channelname}.json`;
        await generateJsonFile(message.guild.id, message.channel.id, filename);
        message.author.send(`Here's a json file containing all the links I've collected in #${message.channel.name}.`, { files: [filename] });
        return;
      }

      // TODO: Going to the db twice here. 
      // Can we sort out YT links in memory instead?

      let links = await Links.findAll({
        limit: limit,
        order: [['createdAt', 'DESC']],
        where: {
          guild_id: message.guild.id,
          channel_id: message.channel.id
        }
      });
      links.reverse();

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
        message.author.send({ embed: linksToEmbed(ytlist, links) });
      } else {
        message.reply('Sorry, no links to share right now; wait for someone to post something in this channel.');
      }

    } else if (command === "help" || command === "agg-help") {
      // TODO: Generate help message dynamically.
      message.author.send(`I store links every time someone shares them in here. If you tell me **!list** I will return a list of the most recent links I've seen (up to ${config.limit}). Discord's character limits on messages might shorten it, though. Say **!agg-help-ytlist** for info on how to use this playlist.\n\nIf instead you want a JSON file with *everything* I've seen in a given channel, say **!list json** instead.\n\nCurrently I'm configured to listen in these channels: **${namesOfChannelsToWatch}**.\n\n*NOTE: I'm still under development, so all this might change. Check back with **!agg-help** often. See also **!agg-notes** for the latest changes.*`);
    } else if (command === "agg-notes") {
      message.author.send(`**May 12, 2021**\n\nAdded full JSON list option.\n\n**May 11, 2021**\n\nMoved most bot responses to DM to reduce channel traffic. Also the bot now responds to DMs.\n\n**May 10, 2021**\n\n* Aggrejag should now notice when you upload a file (like some folks do in #wip-feedback) and store the CDN link to that file in its !list.\n* Unfortunately, detecting links that are posted from other apps like SoundCloud (especially when you post from your phone) is weird & unreliable. I may not be able to get this working easily/soon. Sorry!\n* People are very excited about the bot. This is a good problem to have! However, it means we are hitting Discord's character limits on the increasingly long lists it's trying to return to people. "We're going to need a bigger bucket." I have ideas. Might take some time to implement 'em, though.\n* Remember to check !agg-help for changes; no more weird hyphens, it's now just **!list me**.\n\n Meanwhile, thx for your enthusiasm and patience! :pray:\n\n--grrdjf`);
    } else if (command === "agg-help-ytlist") {
      message.author.send(`You can use the YouTube playlist generated by **!list** in at least two ways:\n\n1) Click the link. Watch/listen on YouTube. Enjoyment ensues.\n\n2) When you clicked the link, did you notice that YouTube immediately redirects you to a new URL? Copy it and paste it somewhere for later use; for example, go say **!p [that URL]** in the #dj-booth and Chordbot will add the list of tracks to its queue.`);
    }
  } else {

    // Someone said something (and it wasn't a command)! Let's see if there are links to grab.

    let words = message.content.split(' ');

    // Add any embed links to the list of "words" so they're processed similarly.
    if (message.embeds.length > 0) {
      words = words.concat(message.embeds.map(x => x.url));
    }

    // Grab CDN links to any uploaded files
    if (message.attachments.size > 0) {
      words = words.concat(message.attachments.map(x => x.url));
    }

    let count = 0;
    for (const s of words) {
      if (isValidHttpUrl(s)) {

        // There's a link in the message! Let's try to save it.

        // Ignore discord links.
        if (s.startsWith('https://discord.com')) return;

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

            logWithDate(': Not saving this duplicate link from ' + message.guild.name + ' ' + message.channel.name + ': ' + s);

          } else {

            let title = 'No description available'; 
            if (s.startsWith('https://cdn.discordapp.com')) { 
              title = s.split("/").pop();
            } else {
              title = await fetchTitle(s); 
            }
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
            logWithDate(" Saved this link from " + message.guild.name + ' ' + message.channel.name + ": " + s);

          }
        } catch (e) {
            errorWithDate(' Got exception ' + e + ' while trying to save this link from ' + message.guild.name + ' ' + message.channel.name + ': ' + s);
        }
      }
    }

    if (count > 0) {
      let links = ' link';
      if (count > 1) {
        links = ' links';
      }
      message.author.send('Saved ' + count + links + '. **!agg-help** for more info.');
    }

  }
});

client.once('ready', () => {
  sequelize.sync();
	logWithDate('Aggrejag ready.');
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

  let description = `Here are the ${links.length} most recent links that were seen in #` + links[0].channel;

  let fields = [];
  if (ytlist != null) { 
    let ytcount = ytlist.split(",").length;
    description += `. Click [here](${ytlist} 'YouTube playlist') for an auto-generated list of the most recent ${ytcount} YouTube links (say **!agg-help-ytlist** for info about getting Chordbot to play it).`;
  } else {
    description += '.'
  }

  for (const link of links) {
    fields.push({ name: link.description, value: link.url }) 
  }

  const embed = {
  	color: 0x0099ff,
  	title: 'Current Links',
  	description: description, 
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
    errorWithDate('Error trying to get title of ' + s + ': ' + err);
  });

  return title;

}

async function logWithDate(str) {
  console.log(new Date().toISOString() + ' ' + str);
}

async function errorWithDate(str) {
  console.error(new Date().toISOString() + ' ' + str);
}

async function generateJsonFile(guild_id, channel_id, filename) {
  let links = await Links.findAll({
    attributes: ['description', 'url'],
    order: [['createdAt', 'ASC']],
    where: {
      guild_id: guild_id,
      channel_id: channel_id
    }
  });

  fs.writeFile(filename, JSON.stringify(links, null, 2), function (err) {
    if (err) throw err;
  });
}


//TODO: not using pls data rn; I wrote this stuff and it works though, maybe later? split out to a module!
async function generatePlsFile(guild_id, channel_id, filename) {
  let links = await Links.findAll({
    order: [['createdAt', 'ASC']],
    where: {
      guild_id: guild_id,
      channel_id: channel_id
    }
  });

  fs.writeFile(filename, await generatePlsData(links), function (err) {
    if (err) throw err;
  });
}

//TODO: not using pls data rn; I wrote this stuff and it works though, maybe later? split out to a module!
async function generatePlsData(links) {
  return `[playlist]${links.map((link, i) => `
File${i+1}=${link.url}
Title${i+1}=${link.description}
Length${i+1}=-1`)}
NumberOfEntries=${links.length}
Version=2
`;
}
