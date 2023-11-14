const WebSocket = require('ws');


const HOST = "ws-xd8cxueq33c2cewq5.jezevec10.com"
const SESS_HOST = "ws55-f95f480b5cea403d.jezevec10.com"


const BASE_URL = "wss://"+HOST+"/?v="
const SESS_URL="wss://"+SESS_HOST+"?v="

const rulesets = require('./rulesets');

exports.createRoom = (version, timeout, onCreate, onJoin, onTimeout, onError, ruleset) => {
  var ws = new WebSocket(BASE_URL+version+'&join=0&guest=1&nt=8023&gSess=837623290:3350456168', {
    headers: {
      
      'Origin': "https://jstris.jezevec10.com",
      'Host': HOST,
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
      'Cookie': "ga=GA1.2.2010432992.1642742871; _gid=GA1.2.712740183.1642742871; _gat=1"
      
    }
  });
  ws.on('open', function(connection) {
    //console.log("opened ws");
    var rs = rulesets[ruleset] || rulesets['default'] 
    ws.send(JSON.stringify(rs)); // send ruleset
    
    ws.send(JSON.stringify({ // Get room info request
      t: 7
    }));
  });
  
  var cancelMatchTimer = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        onTimeout();
      }
    },
  timeout);
  
  var cancelRoomTimer = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        clearTimeout(cancelMatchTimer);
        onError();
      }
    },
  3000);
  /*
  ws.on('headers', (headers, req) => {
    console.log(headers);
    console.log(req);
  });
  */
  /*
  ws.on('upgrade', (res) => {
    console.log('upgrade');
    console.log(res);
  });
  */
  /*
  ws.on('close', (code, reason) => {
    console.log('close');
    console.log(code);
    console.log(reason);
  });
  
  ws.on('unexpected-response', (req,res) => {
    console.log(req)
    console.log(res.statusMessage);
  })
  ws.on('error', function(error) {
    console.log("Connection Error when creating room: " + error.toString());
  });
  */
  ws.on('message', function(message) {
    //console.log(`main ws: ${message.toString()}`);
    var res = JSON.parse(message.toString());
    if (res.t == 12) {
      if (onCreate) {
        clearTimeout(cancelRoomTimer);
        onCreate(res);
      }
    }
    
    if (res.t == 30) {
      clearTimeout(cancelRoomTimer);
      clearTimeout(cancelMatchTimer);
      onCreate(res);
      exports.joinSess(version, res.sess, timeout, onJoin, onTimeout);
      ws.terminate();
      
    }
    
    if (res.t == 2) { // player joins
      sendMessage(ws, "Thanks for joining the room! Seeya! -Roomba");
      clearTimeout(cancelMatchTimer);
      onJoin(res);
      ws.terminate();
    }
    
  });
}

function sendMessage(ws, m) {
  ws.send(JSON.stringify({t:6, m}));
}

exports.joinSess = (version, sess, timeout, onJoin, onTimeout) => {
  var ws = new WebSocket(SESS_URL+version+"&sess="+sess, {
    perMessageDeflate: false,
    'Origin': "https://jstris.jezevec10.com",
    'Host': HOST,
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
    'Cookie': "ga=GA1.2.2010432992.1642742871; _gid=GA1.2.712740183.1642742871; _gat=1"
    
  });
  ws.on('error', function(error) {
    console.log('Error when joining session: ' + error.toString());
  });
  var i = 1;
  var cancelMatchTimer = setTimeout(
    () => {
      if (ws) {
        ws.terminate();
        onTimeout();
      }
    },
  timeout);
  
  ws.on('open', function(connection) {
    ws.send(JSON.stringify({"t":16, "mode":0}));

  });
  ws.on('message', function(message) {
    //console.log(`sub ws: ${message.toString()}`);
    var res = null;
    try {
      var res = JSON.parse(message.toString());
    } catch(e) {
      
      // probably game messages that can't be json parsed
    }
    if (!res)
      return;
    if (res.t == 2) { // player joins
      sendMessage(ws, "Thanks for joining the room! Seeya! -Roomba");
      clearTimeout(cancelMatchTimer);
      onJoin(res);
      ws.terminate();
    }
  });
}
