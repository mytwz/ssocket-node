"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description:
 * @Date: 2021-04-26 16:51:46 +0800
 * @LastEditTime: 2021-05-10 11:45:46 +0800
 * @FilePath: /ssocket/src/adapter2.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adapter = void 0;
const amqplib_1 = require("amqplib");
const code_1 = __importDefault(require("./code"));
const ioredis_1 = __importDefault(require("ioredis"));
const events_1 = require("events");
const logger_1 = __importDefault(require("./logger"));
const os_1 = __importDefault(require("os"));
const utils_1 = require("./utils");
const msgpack = require("notepack.io");
const logger = logger_1.default("adapter");
const REDIS_SURVIVAL_KEY = `ssocket-survival:${os_1.default.hostname()}:${process.pid}`;
let __mqsub;
let __mqpub;
let redisdata;
ioredis_1.default.prototype.keys = function (pattern) {
    return __awaiter(this, void 0, void 0, function* () {
        let cursor = 0;
        let list = [];
        do {
            let res = yield this.scan(cursor, "match", pattern, "count", 2000);
            cursor = +res[0];
            list = list.concat(res[1]);
        } while (cursor != 0);
        return list;
    });
};
var RequestMethod;
(function (RequestMethod) {
    RequestMethod[RequestMethod["join"] = 0] = "join";
    RequestMethod[RequestMethod["leave"] = 1] = "leave";
    RequestMethod[RequestMethod["broadcast"] = 2] = "broadcast";
    RequestMethod[RequestMethod["getRoomall"] = 3] = "getRoomall";
    RequestMethod[RequestMethod["getClientidByroom"] = 4] = "getClientidByroom";
    RequestMethod[RequestMethod["getRoomidByid"] = 5] = "getRoomidByid";
    ////////////////////
    RequestMethod[RequestMethod["response"] = 6] = "response";
})(RequestMethod || (RequestMethod = {}));
var BroadcastType;
(function (BroadcastType) {
    BroadcastType[BroadcastType["room"] = 0] = "room";
    BroadcastType[BroadcastType["all"] = 1] = "all";
    BroadcastType[BroadcastType["socket"] = 2] = "socket";
})(BroadcastType || (BroadcastType = {}));
class Adapter extends events_1.EventEmitter {
    constructor(opt) {
        var _a;
        super();
        this.opt = opt;
        this.clients = new Map();
        this.rooms = new Map();
        this.client2rooms = new Map();
        this.requests = new Map();
        this.msgbuffers = [];
        this.survivalid = 0;
        this.ispublish = false;
        this.uid = utils_1.id24();
        this.requestsTimeout = ((_a = this.opt) === null || _a === void 0 ? void 0 : _a.requestsTimeout) || 5000;
        this.channel = "ssocket-adapter-message";
        this.cluster = Boolean(this.opt.redis && this.opt.mqurl);
        this.init();
    }
    init() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cluster) {
                clearInterval(this.survivalid);
                try {
                    if (redisdata)
                        redisdata.disconnect();
                    if (__mqsub)
                        __mqsub.close();
                    if (__mqpub)
                        __mqpub.close();
                }
                catch (error) {
                }
                redisdata = new ioredis_1.default(this.opt.redis);
                if ((_a = this.opt.redis) === null || _a === void 0 ? void 0 : _a.password)
                    redisdata.auth(this.opt.redis.password).then(_ => logger("redis", "Password verification succeeded"));
                const createChannel = () => __awaiter(this, void 0, void 0, function* () {
                    let __mqconnect = yield amqplib_1.connect(this.opt.mqurl + "");
                    return __mqconnect.createChannel();
                });
                __mqsub = yield createChannel();
                yield __mqsub.assertExchange(this.channel, "fanout", { durable: false });
                let qok = yield __mqsub.assertQueue("", { exclusive: true });
                logger("QOK", qok);
                yield __mqsub.bindQueue(qok.queue, this.channel, "");
                yield __mqsub.consume(qok.queue, this.onmessage.bind(this), { noAck: true });
                __mqpub = yield createChannel();
                yield __mqpub.assertExchange(this.channel, "fanout", { durable: false });
                this.survivalid = setInterval(this.survivalHeartbeat.bind(this), 1000);
                this.ispublish = false;
            }
        });
    }
    survivalHeartbeat() {
        if (redisdata) {
            redisdata.set(REDIS_SURVIVAL_KEY, 1, "ex", 2);
        }
    }
    /**获取所有存活主机的数量 */
    allSurvivalCount() {
        return __awaiter(this, void 0, void 0, function* () {
            let keys = yield redisdata.keys(`ssocket-survival:*`);
            return keys.length;
        });
    }
    startPublish() {
        if (this.ispublish === false && __mqpub) {
            let msg = null;
            try {
                this.ispublish = true;
                while (msg = this.msgbuffers.pop()) {
                    __mqpub.publish(this.channel, "", msg);
                }
                this.ispublish = false;
            }
            catch (error) {
                msg && this.msgbuffers.unshift(msg);
                this.init();
            }
        }
    }
    publish(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            this.msgbuffers.push(msg);
            this.startPublish();
        });
    }
    onmessage(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (msg && msg.content) {
                try {
                    const args = msgpack.decode(msg.content);
                    const type = args.shift();
                    const uid = args.shift();
                    const requestid = args.shift();
                    switch (type) {
                        case RequestMethod.response: {
                            if (this.uid === uid) {
                                (_a = this.requests.get(requestid)) === null || _a === void 0 ? void 0 : _a.call(this, args.shift());
                            }
                            break;
                        }
                        case RequestMethod.getRoomall: {
                            this.publish(msgpack.encode([RequestMethod.response, uid, requestid, [...this.rooms.keys()]]));
                            break;
                        }
                        case RequestMethod.getClientidByroom: {
                            this.publish(msgpack.encode([RequestMethod.response, uid, requestid, [...(this.rooms.get(args.shift()) || [])]]));
                            break;
                        }
                        case RequestMethod.getRoomidByid: {
                            this.publish(msgpack.encode([RequestMethod.response, uid, requestid, [...(this.client2rooms.get(args.shift()) || [])]]));
                            break;
                        }
                        case RequestMethod.broadcast: {
                            switch (args.shift()) {
                                case BroadcastType.room: {
                                    let room = args.shift();
                                    let [event, data, status, msg] = args.shift();
                                    for (let id of this.rooms.get(room) || []) {
                                        this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                    }
                                    break;
                                }
                                case BroadcastType.socket: {
                                    let id = args.shift();
                                    let [event, data, status, msg] = args.shift();
                                    this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                    break;
                                }
                                case BroadcastType.all: {
                                    let [event, data, status, msg] = args.shift();
                                    for (let id of this.clients.keys() || []) {
                                        this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                    }
                                    break;
                                }
                                default:
                                    break;
                            }
                            break;
                        }
                        default:
                    }
                }
                catch (error) {
                    this.emit("error", error);
                }
            }
        });
    }
    emitSocketMessage(id, event, data, status, msg) {
        let client = this.clients.get(id);
        if (client) {
            client.response(event, status, msg, 0, data);
        }
        else {
            this.delete(id);
        }
    }
    /**
     * 获取一个 Socket 客户端对象
     * @param id
     */
    get(id) {
        return this.clients.get(id);
    }
    /**
     * 增加一个 Socket 连接
     * @param {*} id
     * @param {*} socket
     */
    set(socket) {
        logger("set", socket.getid());
        this.clients.set(socket.getid(), socket);
        return socket;
    }
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    delete(id) {
        var _a;
        logger("delete", id);
        this.clients.delete(id);
        for (let roomid of this.client2rooms.get(id) || []) {
            (_a = this.rooms.get(roomid)) === null || _a === void 0 ? void 0 : _a.delete(id);
        }
        this.client2rooms.delete(id);
    }
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id, room) {
        var _a, _b;
        logger("join", id, room);
        room = String(room);
        id = String(id);
        if (!this.rooms.has(room))
            this.rooms.set(room, new Set());
        if (!this.client2rooms.has(id))
            this.client2rooms.set(id, new Set());
        (_a = this.client2rooms.get(id)) === null || _a === void 0 ? void 0 : _a.add(room);
        (_b = this.rooms.get(room)) === null || _b === void 0 ? void 0 : _b.add(id);
    }
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id, room) {
        var _a, _b;
        logger("leave", id, room);
        room = String(room);
        id = String(id);
        (_a = this.client2rooms.get(id)) === null || _a === void 0 ? void 0 : _a.delete(room);
        (_b = this.rooms.get(room)) === null || _b === void 0 ? void 0 : _b.delete(id);
    }
    /**
     * 获取所有的房间号
     */
    getRoomall() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!this.cluster) {
                    return resolve([...this.rooms.keys()]);
                }
                let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getRoomall] message timed out"), this.requestsTimeout);
                let requestid = utils_1.id24();
                let servercount = yield this.allSurvivalCount();
                let result = [];
                let callback = function (rooms) {
                    if (--servercount > 0) {
                        result = result.concat(rooms);
                    }
                    else {
                        this.requests.delete(requestid);
                        clearInterval(requestoutid);
                        result = result.concat(rooms);
                        resolve(result);
                    }
                };
                let msg = msgpack.encode([RequestMethod.getRoomall, this.uid, requestid]);
                this.publish(msg);
                this.requests.set(requestid, callback);
            }));
        });
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    getClientidByroom(room) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                room = String(room);
                if (!this.cluster) {
                    return resolve([...this.rooms.get(room) || []]);
                }
                let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getClientidByroom] message timed out"), this.requestsTimeout);
                let requestid = utils_1.id24();
                let servercount = yield this.allSurvivalCount();
                let result = [];
                let callback = function (sockets) {
                    if (--servercount > 0) {
                        result = result.concat(sockets);
                    }
                    else {
                        this.requests.delete(requestid);
                        clearInterval(requestoutid);
                        result = result.concat(sockets);
                        resolve(result);
                    }
                };
                let msg = msgpack.encode([RequestMethod.getClientidByroom, this.uid, requestid, room]);
                this.publish(msg);
                this.requests.set(requestid, callback);
            }));
        });
    }
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    getRoomidByid(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                id = String(id);
                if (!this.cluster) {
                    return resolve([...this.client2rooms.get(id) || []]);
                }
                let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getRoomidByid] message timed out"), this.requestsTimeout);
                let requestid = utils_1.id24();
                let servercount = yield this.allSurvivalCount();
                let result = [];
                let callback = function (rooms) {
                    if (--servercount > 0) {
                        result = result.concat(rooms);
                    }
                    else {
                        this.requests.delete(requestid);
                        clearInterval(requestoutid);
                        result = result.concat(rooms);
                        resolve(result);
                    }
                };
                let msg = msgpack.encode([RequestMethod.getRoomidByid, this.uid, requestid, id]);
                this.publish(msg);
                this.requests.set(requestid, callback);
            }));
        });
    }
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            id = String(id);
            room = String(room);
            let rooms = yield this.getRoomidByid(id);
            return rooms.includes(room);
        });
    }
    /**
     * 获取所有的房间总数
     */
    getAllRoomcount() {
        return __awaiter(this, void 0, void 0, function* () {
            let rooms = yield this.getRoomall();
            return rooms.length;
        });
    }
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room) {
        return __awaiter(this, void 0, void 0, function* () {
            let clients = yield this.getClientidByroom(room);
            return clients.length;
        });
    }
    /**
     * 发送房间消息
     * @param room
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendRoomMessage(room, event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            room = String(room);
            if (!this.cluster) {
                for (let id of this.rooms.get(room) || []) {
                    this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                }
                return;
            }
            this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.room, room, [event, data, status, msg]]));
        });
    }
    /**
     * 发送广播消息
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendBroadcast(event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.cluster) {
                for (let id of this.clients.keys() || []) {
                    this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                }
                return;
            }
            this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.all, [event, data, status, msg]]));
        });
    }
    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data
     */
    sendSocketMessage(id, event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            id = String(id);
            if (!this.cluster) {
                this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                return;
            }
            this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.socket, id, [event, data, status, msg]]));
        });
    }
}
exports.Adapter = Adapter;
