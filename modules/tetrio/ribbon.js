const window = {}

import WebSocket from 'ws';
import { logWithTitle } from '../log.js';

const log = (...args) => logWithTitle("ribbon", ...args)

export class Ribbon {
  static _CACHE_MAXSIZE = 4096;
  static _BATCH_TIMEOUT = 25;
  static _CLOSE_CODES = {
    1e3: "ribbon closed normally",
    1001: "client closed ribbon",
    1002: "protocol error",
    1003: "protocol violation",
    1005: "no error provided",
    1006: "ribbon lost",
    1007: "payload data corrupted",
    1008: "protocol violation",
    1009: "too much data",
    1010: "negotiation error",
    1011: "server error",
    1012: "server restarting",
    1013: "temporary error",
    1014: "bad gateway",
    1015: "TLS error"
  };
  static FLAG = {
    ALIVE: 1,
    SUCCESSFUL: 2,
    CONNECTING: 4,
    FAST_PING: 8,
    TIMING_OUT: 16,
    DEAD: 32
  };
  constructor(e) {
    this._uri = e;
    this._ws = null;
    this._id = null;
    this._tokenid = null;
    this._spoolid = null;
    this._sentid = 0;
    this._recvid = 0;
    this._heartbeat = 0;
    this._flags = 0;
    this._lastReason = "ribbon lost";
    this._sentQueue = [];
    this._recvQueue = [];
    this._corkQueue = null;
    this._logs = [];
    this._lastPush = performance.now();
    this._listeners = new Map;
    this._handlers = new Map;
    this._pingItvId = setInterval(this._PingInterval.bind(this), 2500);
    this._lastPing = 0;
    this._reconnectLast = 0;
    this._reconnectCount = 0;
    this._reconnectPenalty = 0;
    this._reconnectTime = null;
  }
  get id() {
    return this._id
  }
  get endpoint() {
    return this._uri
  }
  get spool() {
    return this._spoolid
  }
  get logs() {
    return this._logs
  }
  get _prefix() { }
  _PushLogs(e) { }
  LogInfo(e, ...t) { }
  LogWarn(e, ...t) { }
  LogError(e, ...t) { }
  _OnOpen(e) {
    log("opened");
    this._flags |= Ribbon.FLAG.ALIVE | Ribbon.FLAG.SUCCESSFUL;
    this._flags &= ~Ribbon.FLAG.TIMING_OUT;
    this._tokenid ? this.send("session", {
      ribbonid: this._id,
      tokenid: this._tokenid
    }) : this.send("new")
  }

  async _OnMessage(t) {

    log("received", t.data);
    this._flags |= Ribbon.FLAG.ALIVE,
      this._flags &= ~Ribbon.FLAG.TIMING_OUT;
    let n = "ribbon:unparsed"
    try {
      const i = await new Response(t.data).arrayBuffer()
        , o = Buffer.from(i)
        , a = JSON.parse(o);
      // console.log("r", JSON.stringify(a));

      n = a.command ? `ribbon:${a.command}` : "ribbon:unknown",
        this._ProcessMessage(a),
        this._ProcessQueue()
    } catch (e) {
      console.error("error parsing message:", t.data, e);
    }
  }

  _OnError(e) {
    this.HasConnectedOnce() || this._run("connect_error")
  }
  _OnClose(e) {
    this._ws = null, this._lastReason = Ribbon._CLOSE_CODES[e.code], this._flags |= Ribbon.FLAG.CONNECTING, "ribbon lost" === this._lastReason && (this.IsTimingOut() ? this._lastReason = "ping timeout" : this.HasConnectedOnce() || (this._lastReason = "failed to connect")), this.reconnect()
    log("closed:", this._lastReason);
  }
  _PingInterval() {
    this._heartbeat++
    if (this._ShouldPing()) {
      if (!this.IsAlive()) return this._flags |= Ribbon.FLAG.TIMING_OUT | Ribbon.FLAG.ALIVE | Ribbon.FLAG.CONNECTING, this.reconnect();
      this._flags &= ~Ribbon.FLAG.ALIVE, this.IsConnected() && (this._lastPing = Date.now(), this.send("ping", {
        recvid: this._recvid
      }))
    }
  }
  _ShouldPing() {
    return !(!(this._flags & Ribbon.FLAG.FAST_PING) || this.IsTimingOut()) || this._heartbeat % 2 == 0
  }
  _ProcessMessage(e) {
    if (e.id) {
      if (e.id <= this._recvid) {
        return;
      } else if (e.id === this._recvid + 1) {
        this._RunMessage(e);
      } else {
        this._recvQueue.push(e);
        return;
      }
    } else {
      this._RunMessage(e);
    }
  }
  _ProcessQueue() {
    if (this._recvQueue.length) {
      if (this._recvQueue.length > Ribbon._CACHE_MAXSIZE) return this.close("too many lost packets");
      for (this._recvQueue.sort(((e, t) => e.id - t.id)); this._recvQueue.length;) {
        const e = this._recvQueue[0];
        if (e.id <= this._recvid) this._recvQueue.shift();
        else {
          if (e.id !== this._recvid + 1) break;
          this._RunMessage(this._recvQueue.shift())
        }
      }
    }
  }
  _RunMessage(e) {
    // log("running message", e);
    switch (e.id && (this._recvid = e.id), e.command) {
      case "session": {
        const {
          ribbonid: t,
          tokenid: n
        } = e.data;
        this._flags &= ~Ribbon.FLAG.CONNECTING, this._id = t, this._tokenid && this.send("packets", {
          packets: this._sentQueue.map((e => e.packet))
        }), this._tokenid = n, this._run("open"), this._run("save", this._lastReason);
        break
      }
      case "ping": {
        const t = e.data.recvid;
        for (this._emit("ping", {
          ms: Date.now() - this._lastPing
        }); this._sentQueue.length && this._sentQueue[0].id <= t;) this._sentQueue.shift();
        break
      }
      case "kick": {
        const {
          reason: t
        } = e.data;
        this._lastReason = "server closed ribbon", this._emit("kick", t), this.close();
        break
      }
      case "nope": {
        const {
          reason: t
        } = e.data;
        this._lastReason = t, this.close();
        break
      }
      case "packets":
        for (const t of e.data.packets) {
          this._ProcessMessage(t)
        }
        break;
      case "server.authorize":
        this._run("authorized", e.data);
      default:
        if (this._corkQueue) return this._corkQueue.push(e);
        this._emit(e.command, e.data)
    }
  }
  HasConnectedOnce() {
    return this._flags & Ribbon.FLAG.SUCCESSFUL
  }
  IsConnected() {
    return 1 === this._ws?.readyState
  }
  IsConnecting() {
    return this._flags & Ribbon.FLAG.CONNECTING
  }
  IsAlive() {
    return this._flags & Ribbon.FLAG.ALIVE
  }
  IsTimingOut() {
    return this._flags & Ribbon.FLAG.TIMING_OUT
  }
  IsDead() {
    return this._flags & Ribbon.FLAG.DEAD
  }
  SetEndpoint(e) {
    this._uri = e
  }
  SetSpoolID(e) {
    this._spoolid = e
  }
  SetFasterPing(e) {
    this._flags = this._flags & ~Ribbon.FLAG.FAST_PING | e << Math.log2(Ribbon.FLAG.FAST_PING)
  }
  async Switch(e = this._uri) {
    this._uri = e, this._flags |= Ribbon.FLAG.CONNECTING, await Ot(5), this._reconnect_internal()
  }
  connect() {
    this._ws && (this._ws.onopen = null, this._ws.onclose = null, this._ws.onerror = null, this._ws.onmessage = null, this._ws.close()), this._flags |= Ribbon.FLAG.CONNECTING, this._ws = new WebSocket(this._uri, this._spoolid), this._ws.onopen = this._OnOpen.bind(this), this._ws.onclose = this._OnClose.bind(this), this._ws.onerror = this._OnError.bind(this), this._ws.onmessage = this._OnMessage.bind(this)
  }
  reconnect() {
    if (this._reconnectTime) return;
    if (this._ws?.close(), Date.now() - this._reconnectLast > 4e4 && (this._reconnectCount = 0), this._reconnectLast = Date.now(), this._reconnectCount >= 20 || this.IsDead()) {
      const e = this.IsDead() ? "may not reconnect" : "too many reconnects";
      return this.close(e)
    }
    const e = this._reconnectPenalty + 5 + 100 * this._reconnectCount;
    this._run("resume", e), clearTimeout(this._reconnectTime), this._reconnectTime = setTimeout(this._reconnect_internal.bind(this), e), this._reconnectPenalty = 0, this._reconnectCount++
  }
  _reconnect_internal() {
    this._reconnectTime = null, this.IsDead() || (this._run("reconnect"), this.connect())
  }
  send(command, data, n) {
    log("send", { command, data });
    // const id = ++this._sentid;
    const s = {
      // id,
      command,
      data,
    };
    this._send_internal(JSON.stringify(s));
  }
  _send_internal(e) {
    try {
      this._ws.send(e), window.XDBG_LASTSEND = Date.now()
    } catch (e) { }
  }

  _run(e, t) {
    this._listeners.get(e)?.forEach((e => e(t)))
  }
  listen(e, t) {
    this._listeners.get(e) || this._listeners.set(e, []), this._listeners.get(e).push(t)
  }
  cork() {
    null == this._corkQueue && (this._corkQueue = [])
  }
  uncork() {
    if (this._corkQueue) {
      for (const {
        command: e,
        data: t
      }
        of this._corkQueue) this._emit(e, t);
      this._corkQueue = null
    }
  }
  _emit(command, data) {
    log("emitting", { command, data });
    if (!this._handlers.has(command)) return //throw new ReferenceError(`Received an unknown command: ${e} --\x3e ${t}`);
    this._handlers.get(command).forEach((e => e(data)))
  }
  on(command, data) {
    this._handlers.get(command) || this._handlers.set(command, []), this._handlers.get(command).push(data)
  }
  off(e, t) {
    if (!this._handlers.has(e)) return;
    if (!t) return this._handlers.get(e).length = 0;
    this._handlers.get(e).filter((e => e !== t))
  }
  close(e = this._lastReason) {
    this._lastReason = e, this._run("close", e);
    try {
      this.IsConnected() && this.send("die"), this._ws?.close()
    } catch (e) { }
    this._flags |= Ribbon.FLAG.DEAD, clearInterval(this._pingItvId)
  }
  cut(e = 0) {
    this._reconnectPenalty = e, this._ws?.close()
  }
}