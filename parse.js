let linksFile = 'links.jsonl';

let lineReader = require('readline').createInterface({
  input: require('fs').createReadStream(linksFile)
});

lineReader.on('line', function (line) {
  let obj = JSON.parse(line);
  console.log(obj);
});
