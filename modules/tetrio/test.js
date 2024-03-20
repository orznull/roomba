/**
 * Straight up copy pasted from https://tetr.io/js/tetrio.js, lightly modified to work in node.
 * Most of the comments are by osk.
 */
import WebSocket from 'ws';
import * as msgpackr from 'msgpackr';
msgpackr.addExtension({ type: 1, read: e => null === e ? { success: !0 } : { success: !0, ...e } })
msgpackr.addExtension({ type: 2, read: e => null === e ? { success: !1 } : { success: !1, error: e } });

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

// stubbing out xdbg log functions here that new ribbon calls, cba to gut them out lol 
const window = {}
window.XDBG_PUSHLOG = () => { };
window.XDBG_CONSIDER_COMMITLOG = () => { }

// everything below is straight from tetrio
const RIBBON_CLOSE_CODES = {
  '1000': 'ribbon closed normally',
  '1001': 'client closed ribbon',
  '1002': 'protocol error',
  '1003': 'protocol violation',
  '1006': 'ribbon lost',
  '1007': 'payload data corrupted',
  '1008': 'protocol violation',
  '1009': 'too much data',
  '1010': 'negotiation error',
  '1011': 'server error',
  '1012': 'server restarting',
  '1013': 'temporary error',
  '1014': 'bad gateway',
  '1015': 'TLS error'
};
const RIBBON_BATCH_TIMEOUT = 25;
const RIBBON_CACHE_MAXSIZE = 4096;

const RIBBON_EXTRACTED_ID_TAG = new Uint8Array([174]);
const RIBBON_STANDARD_ID_TAG = new Uint8Array([69]);
const RIBBON_BATCH_TAG = new Uint8Array([88]);
const RIBBON_EXTENSION_TAG = new Uint8Array([0xB0]);

const RIBBON_EXTENSIONS = new Map();
RIBBON_EXTENSIONS.set(0x0B, (payload) => {
  if (payload.byteLength >= 6) {
    return { command: 'ping', at: new DataView(payload.buffer).getUint32(2, false) };
  } else {
    return { command: 'ping' };
  }

});
RIBBON_EXTENSIONS.set('PING', (extensionData) => {
  if (typeof extensionData === 'number') {
    const dat = new Uint8Array([0xB0, 0x0B, 0x00, 0x00, 0x00, 0x00]);
    new DataView(dat.buffer).setUint32(2, extensionData, false);
    return dat;
  } else {
    return new Uint8Array([0xB0, 0x0B]);
  }
});
RIBBON_EXTENSIONS.set(0x0C, (payload) => {
  if (payload.byteLength >= 6) {
    return { command: 'pong', at: new DataView(payload.buffer).getUint32(2, false) };
  } else {
    return { command: 'pong' };
  }
});
RIBBON_EXTENSIONS.set('PONG', (extensionData) => {
  if (typeof extensionData === 'number') {
    const dat = new Uint8Array([0xB0, 0x0C, 0x00, 0x00, 0x00, 0x00]);
    new DataView(dat.buffer).setUint32(2, extensionData, false);
    return dat;
  } else {
    return new Uint8Array([0xB0, 0x0C]);
  }
});

const globalRibbonPackr = new msgpackr.Packr({
  int64AsType: 'number',
  bundleStrings: true,
  sequential: false
});
const globalRibbonUnpackr = new msgpackr.Unpackr({
  int64AsType: 'number',
  bundleStrings: true,
  sequential: false
});

// Ribbon - blazing-fast, msgpacked resumeable WebSockets
const Ribbon = function (uri) {
  let endpoint = uri;
  let spoolToken = undefined;
  let ws = null;
  let id = null;
  let resume = null;
  let lastSentId = 0;
  let lastReceivedId = 0;
  let lastSent = [];
  let alive = true;
  let closeReason = 'ribbon lost';
  let messageListeners = {};
  let openListeners = [];
  let closeListeners = [];
  let pongListeners = [];
  let resumeListeners = [];
  let reconnectStartListeners = [];
  let saveListeners = [];
  let pingInterval = null;
  let lastPing = 0;
  let mayReconnect = true;
  let dead = false;
  let ignoreCleanness = false;
  let pingissues = false;
  let wasEverConnected = false;
  let incomingQueue = [];
  let switchingEndpoint = false;
  let socketblocked = true;
  let fasterPingRequirement = false;
  let pingID = 0;
  let reconnectTimeout = null;
  let corkQueue = null; // null if not corked

  pingInterval = setInterval(() => {
    pingID++;
    const shouldFastPing = fasterPingRequirement && !pingissues;
    if (!shouldFastPing && ((pingID % 2) !== 0)) {
      return;
    }

    if (!alive) {
      // we're pinging out, get our ass a new connection
      pingissues = true;
      alive = true;
      window.XDBG_PUSHLOG(`Ping timeout in ribbon ${id}`);
      console.warn('Ping timeout in ribbon. Abandoning current socket and obtaining a new one...');
      closeReason = 'ping timeout';
      Reconnect();
    }
    alive = false;
    if (ws && ws.readyState === 1) {
      lastPing = Date.now();
      try {
        if (ws.readyState === 1) {
          ws.send(SmartEncode('PING', null, lastReceivedId));
        }
      } catch (ex) { }
    }
  }, 2500);

  function SmartEncode(packet, packr = null, extensionData = null) {
    if (typeof packet === 'string') {
      // This might be an extension, look it up
      const found = RIBBON_EXTENSIONS.get(packet);
      if (found) {
        return found(extensionData);
      }
    }

    let prependable = RIBBON_STANDARD_ID_TAG;

    const msgpacked = (packr || globalRibbonPackr).pack(packet);
    const merged = new Uint8Array(prependable.length + msgpacked.length);
    merged.set(prependable, 0);
    merged.set(msgpacked, prependable.length);

    return merged;
  }

  function SmartDecode(packet, unpackr) {
    if (packet[0] === RIBBON_EXTENSION_TAG[0]) {
      // look up this extension
      const found = RIBBON_EXTENSIONS.get(packet[1]);
      if (!found) {
        console.error(`Unknown Ribbon extension ${packet[1]}!`);
        console.error(packet);
        window.XDBG_PUSHLOG(`Unknown Ribbon extension ${packet[1]}!`);
        throw 'Unknown extension';
      }
      return found(packet);
    } else if (packet[0] === RIBBON_STANDARD_ID_TAG[0]) {
      // simply extract
      return UnpackInner(packet.slice(1), unpackr);
    } else if (packet[0] === RIBBON_EXTRACTED_ID_TAG[0]) {
      // extract id and msgpacked, then inject id back in
      // these don't support sequential!
      const object = UnpackInner(packet.slice(5), null);
      const view = new DataView(packet.buffer);
      const id = view.getUint32(1, false);
      if (object) {
        object.id = id;
      }

      return object;
    } else if (packet[0] === RIBBON_BATCH_TAG[0]) {
      // ok these are complex, keep looking through the header until you get to the (uint32)0 delimiter
      const items = [];
      const lengths = [];
      const view = new DataView(packet.buffer);

      // Get the lengths
      for (let i = 0; true; i++) {
        const length = view.getUint32(1 + (i * 4), false);
        if (length === 0) {
          // We've hit the end of the batch
          break;
        }
        lengths.push(length);
      }

      // Get the items at those lengths
      let pointer = 0;
      for (let i = 0; i < lengths.length; i++) {
        items.push(packet.slice(1 + (lengths.length * 4) + 4 + pointer, 1 + (lengths.length * 4) + 4 + pointer + lengths[i]));
        pointer += lengths[i];
      }

      return { command: 'X-MUL', items: items.map(o => SmartDecode(o, unpackr)) };
    } else {
      // try just parsing it straight?
      return UnpackInner(packet, unpackr);
    }
  }

  function UnpackInner(packet, unpackr) {
    return (unpackr || globalRibbonUnpackr).unpack(packet);
  }

  function Open() {
    if (ws) {
      ws.close();
    }

    ws = new WebSocket(endpoint, spoolToken);
    incomingQueue = [];
    ws.packr = new msgpackr.Packr({
      int64AsType: 'number',
      bundleStrings: true,
      sequential: false
    });
    ws.unpackr = new msgpackr.Unpackr({
      int64AsType: 'number',
      bundleStrings: true,
      sequential: false
    });

    ws.onopen = function (e) {
      if (this.__destroyed) { return; }
      alive = true;
      pingissues = false;
      wasEverConnected = true;
      socketblocked = true;
      if (resume) {
        console.log(`Ribbon ${id} resuming`);
        window.XDBG_PUSHLOG(`Ribbon ${id} resuming`);
        this.send(SmartEncode({ command: 'resume', socketid: id, resumetoken: resume }, this.packr));
      } else {
        this.send(SmartEncode({ command: 'new' }, this.packr));
      }
    };
    ws.onmessage = function (e) {
      if (this.__destroyed) { return; }
      try {
        var ab = toArrayBuffer(e.data);
        const msg = SmartDecode(new Uint8Array(ab), this.unpackr);

        if (msg.command === 'kick') {
          mayReconnect = false;
          pingissues = false;
          window.XDBG_PUSHLOG(`Ribbon ${id} kicked: ${JSON.stringify(msg)}`);
          window.XDBG_CONSIDER_COMMITLOG();
        }

        if (msg.command === 'nope') {
          console.error(`Ribbon ${id} noped out (${msg.reason})`);
          mayReconnect = false;
          pingissues = false;
          closeReason = msg.reason;
          Close();
        } else if (msg.command === 'hello') {
          socketblocked = false;
          id = msg.id;
          console.log(`Ribbon ${id} ${resume ? 'resumed' : 'opened'}`);
          window.XDBG_PUSHLOG(`Ribbon ${id} ${resume ? 'resumed' : 'opened'}`);
          if (resume) {
            this.send(SmartEncode({ command: 'hello', packets: lastSent }, this.packr));
          }
          resume = msg.resume;
          msg.packets.forEach((p) => {
            HandleMessage(p);
          });
          openListeners.forEach((l) => {
            l();
          });
          saveListeners.forEach((l) => {
            l(closeReason);
          });
        } else if (msg.command === 'pong') {
          pongListeners.forEach((l) => {
            l(Date.now() - lastPing);
          });
          if (msg.at) {
            // we can evict anything lower from our to-be-sent
            while (lastSent.length && lastSent[0].id <= msg.at) {
              lastSent.shift();
            }
          }
        } else if (msg.command === 'X-MUL') {
          msg.items.forEach((m) => {
            HandleMessage(m);
          });
        } else {
          HandleMessage(msg);
        }
      } catch (ex) {
        console.error('Failed to parse message', ex);
        window.XDBG_PUSHLOG(`Ribbon ${id} failed to parse: ${ex} [${new Response(e.data).arrayBuffer().toString()}]`);
      }
    };
    ws.onerror = function (e) {
      if (this.__destroyed) { return; }
      if (!wasEverConnected) {
        if (messageListeners['connect_error']) {
          messageListeners['connect_error'].forEach((l) => {
            l();
          });
        }
      }
      console.log(e);
      window.XDBG_PUSHLOG(`Ribbon error ${e} - ${e.message} - ${e.code}`);
    };
    ws.onclose = function (e) {
      if (this.__destroyed) { return; }
      this.__destroyed = true;
      ws = null;
      ignoreCleanness = false;
      socketblocked = true;
      if (RIBBON_CLOSE_CODES[e.code]) {
        closeReason = RIBBON_CLOSE_CODES[e.code];
      }
      if (closeReason === 'ribbon lost' && pingissues) {
        closeReason = 'ping timeout';
      }
      if (closeReason === 'ribbon lost' && !wasEverConnected) {
        closeReason = 'failed to connect';
      }
      console.log(`Ribbon ${id} closed (${closeReason})`);
      window.XDBG_PUSHLOG(`Ribbon ${id} closed ${e.wasClean ? 'cleanly' : 'unexpectedly'}, code ${e.code} (${RIBBON_CLOSE_CODES[e.code]} displayed as ${closeReason}), reason string ${e.reason}`);

      Reconnect();
    };
  }

  function HandleMessage(msg) {
    if (msg.id) {
      if (msg.id <= lastReceivedId) {
        return; // already seen this
      }

      EnqueueMessage(msg);
      return;
    }

    FinalizeMessage(msg);
  }

  function EnqueueMessage(msg) {
    if (msg.id === lastReceivedId + 1) {
      // we're in order, all good!
      FinalizeMessage(msg);
    } else {
      incomingQueue.push(msg);
    }

    TryClearQueue();
  }

  function TryClearQueue() {
    if (incomingQueue.length) {
      // Try to go through these
      incomingQueue.sort((a, b) => {
        return a.id - b.id;
      });

      while (incomingQueue.length) {
        const trackbackMessage = incomingQueue[0];

        if (trackbackMessage.id !== lastReceivedId + 1) {
          // no good, wait longer
          break;
        }

        // cool, let's push it
        incomingQueue.shift();
        FinalizeMessage(trackbackMessage);
      }
    }
    if (incomingQueue.length > RIBBON_CACHE_MAXSIZE) {
      console.error(`Ribbon ${id} unrecoverable: ${incomingQueue.length} packets out of order`);
      window.XDBG_PUSHLOG(`Ribbon ${id} unrecoverable: ${incomingQueue.length} packets out of order`);
      closeReason = 'too many lost packets';
      Close();
      return;
    }
  }

  function FinalizeMessage(msg) {
    if (corkQueue === null) {
      if (messageListeners[msg.command]) {
        messageListeners[msg.command].forEach((l) => {
          l(msg.data);
        });
      }
      if (msg.id) {
        lastReceivedId = msg.id;
      }
    } else {
      corkQueue.push(msg);
    }
  }

  function Cork() {
    if (corkQueue === null) {
      corkQueue = [];
    }
  }

  function Uncork(oncomplete) {
    if (corkQueue !== null) {
      for (const msg of corkQueue) {
        if (messageListeners[msg.command]) {
          messageListeners[msg.command].forEach((l) => {
            l(msg.data);
          });
        }
        if (msg.id) {
          lastReceivedId = msg.id;
        }
      }
      corkQueue = null;
      TryClearQueue();
    }

    if (oncomplete) { oncomplete(); }
  }

  function Send(command, data) {
    const packet = { id: ++lastSentId, command, data };
    lastSent.push(packet);
    if (socketblocked) {
      return;
    }

    while (lastSent.length > RIBBON_CACHE_MAXSIZE) {
      lastSent.shift();
    }

    if (!ws || ws.readyState !== 1) { return; }

    try {
      ws.send(SmartEncode(packet, ws.packr));
    } catch (ex) { }
  }

  function Close(reason = null, silent = false) {
    mayReconnect = false;
    if (reason) {
      closeReason = reason;
    }
    if (ws) {
      ws.__destroyed = true;
      try {
        if (ws.readyState === 1) {
          ws.send(SmartEncode({ command: 'die' }, ws.packr));
        }
        ws.close();
      } catch (ex) { }
    }

    Die(silent);
  }

  function Cut(penalty = 0) {
    ignoreCleanness = true;
    extraPenalty = penalty;
    if (ws) {
      ws.close();
    }
  }

  function SwitchEndpoint() {
    console.warn(`Ribbon ${id} changing endpoint (new endpoint: ${endpoint})`);
    window.XDBG_PUSHLOG(`Ribbon ${id} changing endpoint (new endpoint: ${endpoint})`);
    ignoreCleanness = true;
    switchingEndpoint = true;
    if (ws) {
      ws.close();
    }

    setTimeout(ExpediteReconnect, 5);
  }

  let reconnectCount = 0;
  let lastReconnect = 0;
  let extraPenalty = 0;

  function Reconnect() {
    socketblocked = true;
    if (ws) {
      ws.__destroyed = true;
      ws.close();
    }

    if (!switchingEndpoint) {
      if ((Date.now() - lastReconnect) > 40000) {
        reconnectCount = 0;
      }
      lastReconnect = Date.now();

      if (reconnectCount >= 20 || !mayReconnect) {
        // Stop bothering
        console.error(`Ribbon ${id} abandoned: ${mayReconnect ? 'too many reconnects' : 'may not reconnect'}`);
        window.XDBG_PUSHLOG(`Ribbon ${id} abandoned: ${mayReconnect ? 'too many reconnects' : 'may not reconnect'}`);
        Die();
        return;
      }

      console.warn(`Ribbon ${id} reconnecting in ${extraPenalty + 5 + 100 * reconnectCount}ms (reconnects: ${reconnectCount + 1})`);
      window.XDBG_PUSHLOG(`Ribbon ${id} reconnecting in ${extraPenalty + 5 + 100 * reconnectCount}ms (reconnects: ${reconnectCount + 1})`);
      resumeListeners.forEach((l) => {
        l(extraPenalty + 5 + 100 * reconnectCount);
      });
    }

    if (reconnectTimeout) { clearTimeout(reconnectTimeout); }
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      if (!mayReconnect) {
        console.log(`Ribbon ${id} abandoned: may not reconnect`);
        window.XDBG_PUSHLOG(`Ribbon ${id} abandoned: may not reconnect`);
        Die();
        return;
      }
      if (dead) {
        console.log(`Canceling reopen of ${id}: no longer needed`);
        window.XDBG_PUSHLOG(`Canceling reopen of ${id}: no longer needed`);
        return;
      }

      reconnectStartListeners.forEach((l) => { l(); });

      Open();
    }, switchingEndpoint ? 0 : (extraPenalty + 5 + 100 * reconnectCount));

    if (switchingEndpoint) {
      switchingEndpoint = false;
    } else {
      reconnectCount++;
      extraPenalty = 0;
    }
  }

  function ExpediteReconnect() {
    if (!reconnectTimeout) { return; }
    clearTimeout(reconnectTimeout);

    reconnectTimeout = null;
    if (dead) {
      console.log(`Canceling reopen of ${id}: no longer needed`);
      window.XDBG_PUSHLOG(`Canceling reopen of ${id}: no longer needed`);
      return;
    }

    reconnectStartListeners.forEach((l) => { l(); });

    socketblocked = true;
    Open();
    switchingEndpoint = false;
  }

  function Die(silent = false) {
    if (dead) { return; }
    console.log(`Ribbon ${id} dead (${closeReason})`);
    window.XDBG_PUSHLOG(`Ribbon ${id} dead (${closeReason})`);
    dead = true;
    mayReconnect = false;

    if (!silent) {
      closeListeners.forEach((l) => {
        l(closeReason);
      });
    }

    if (ws) {
      ws.__destroyed = true;
    }

    clearInterval(pingInterval);
  }


  // Publics
  return {
    getEndpoint: () => {
      return endpoint;
    },
    setEndpoint: (uri) => {
      endpoint = uri;
    },
    getSpoolToken: () => {
      return spoolToken;
    },
    setSpoolToken: (uri) => {
      spoolToken = uri;
    },
    getId: () => { return id; },
    open: Open,
    isAlive: () => { return alive; },
    close: Close,
    send: Send,
    emit: Send,
    cork: Cork,
    uncork: Uncork,
    onclose: (l) => { closeListeners.push(l); },
    onopen: (l) => { openListeners.push(l); },
    onpong: (l) => { pongListeners.push(l); },
    onresume: (l) => { resumeListeners.push(l); },
    onreconnectstart: (l) => { reconnectStartListeners.push(l); },
    onsave: (l) => { saveListeners.push(l); },
    on: (type, l) => {
      if (messageListeners[type]) {
        messageListeners[type].push(l);
      } else {
        messageListeners[type] = [l];
      }
    },
    off: (type, l) => {
      if (messageListeners[type]) {
        if (!l) {
          messageListeners[type] = [];
          return;
        } else {
          messageListeners[type] = messageListeners[type].filter(o => o !== l);
        }
      }
    },
    cut: Cut,
    switchEndpoint: SwitchEndpoint,
    setFasterPingRequirement: (nv) => { fasterPingRequirement = nv; }
  };
}

export { Ribbon }

function SmartDecode(packet, unpackr) {
  if (packet[0] === RIBBON_EXTENSION_TAG[0]) {
    // look up this extension
    const found = RIBBON_EXTENSIONS.get(packet[1]);
    if (!found) {
      console.error(`Unknown Ribbon extension ${packet[1]}!`);
      console.error(packet);
      window.XDBG_PUSHLOG(`Unknown Ribbon extension ${packet[1]}!`);
      throw 'Unknown extension';
    }
    return found(packet);
  } else if (packet[0] === RIBBON_STANDARD_ID_TAG[0]) {
    // simply extract
    return UnpackInner(packet.slice(1), unpackr);
  } else if (packet[0] === RIBBON_EXTRACTED_ID_TAG[0]) {
    // extract id and msgpacked, then inject id back in
    // these don't support sequential!
    const object = UnpackInner(packet.slice(5), null);
    const view = new DataView(packet.buffer);
    const id = view.getUint32(1, false);
    if (object) {
      object.id = id;
    }

    return object;
  } else if (packet[0] === RIBBON_BATCH_TAG[0]) {
    // ok these are complex, keep looking through the header until you get to the (uint32)0 delimiter
    const items = [];
    const lengths = [];
    const view = new DataView(packet.buffer);

    // Get the lengths
    for (let i = 0; true; i++) {
      const length = view.getUint32(1 + (i * 4), false);
      if (length === 0) {
        // We've hit the end of the batch
        break;
      }
      lengths.push(length);
    }

    // Get the items at those lengths
    let pointer = 0;
    for (let i = 0; i < lengths.length; i++) {
      items.push(packet.slice(1 + (lengths.length * 4) + 4 + pointer, 1 + (lengths.length * 4) + 4 + pointer + lengths[i]));
      pointer += lengths[i];
    }

    return { command: 'X-MUL', items: items.map(o => SmartDecode(o, unpackr)) };
  } else {
    // try just parsing it straight?
    return UnpackInner(packet, unpackr);
  }
}

function UnpackInner(packet, unpackr) {
  return (unpackr || globalRibbonUnpackr).unpack(packet);
}


var str1 = "RdRyQJOiaWTWYgAAAAzBB8EEBMELwqC2Y29tbWFuZGRhdGFyb29tLmNyZWF0ZQ==";
var str = "RdRyQJOiaWTWYgAAABfBB8EEBcEP1HJBksEGwQbBBsEMoNk4Y29tbWFuZGRhdGFzb2NpYWwucHJlc2VuY2VzdGF0dXNkZXRhaWxvbmxpbmVsb2JieTpYLVBSSVY=";

console.log(SmartDecode(Buffer.from("RdRyQJOiaWTWYgAAAAzBB8EEC8ELw6C2Y29tbWFuZGRhdGFyb29tLmNyZWF0ZQ==", 'base64')));
