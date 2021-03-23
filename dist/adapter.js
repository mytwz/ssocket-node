"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description:
 * @LastEditTime: 2021-01-22 15:13:35 +0800
 * @FilePath: \ssocket\src\adapter.ts
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
const code_1 = __importDefault(require("./code"));
const ioredis_1 = __importDefault(require("ioredis"));
const events_1 = require("events");
const logger_1 = __importDefault(require("./logger"));
const logger = logger_1.default("adapter");
const REDIS_ROOM_PREFIX = "ssocket:rooms:room";
/**系统事件 */
const SYNC_EVENTS = [
    "emit_socket_message",
];
class Adapter {
    constructor(opts) {
        this.opts = opts;
        /**客户端集合 */
        this.clients = new Map();
        /**Redis 订阅对象 */
        this.sub_redis = undefined;
        /**Redis  */
        this.pub_redis = undefined;
        this.data_redis = undefined;
        /**事件触发器 */
        this.emitter = new events_1.EventEmitter();
        this.rooms = {};
        if (this.opts) {
            this.sub_redis = new ioredis_1.default(this.opts);
            ;
            this.pub_redis = new ioredis_1.default(this.opts);
            ;
            this.data_redis = new ioredis_1.default(this.opts);
            ;
            if (this.opts.password) {
                try {
                    this.sub_redis.auth(this.opts.password);
                    this.pub_redis.auth(this.opts.password);
                    this.data_redis.auth(this.opts.password);
                }
                catch (error) {
                    logger("constructor", error);
                }
            }
            this.sub_redis.subscribe(SYNC_EVENTS);
            this.sub_redis.on("message", (event, message) => {
                logger("redis-event", message);
                this.emitter.emit(event, JSON.parse(message));
            });
            this.emitter.on("emit_socket_message", this.emit_socket_message.bind(this));
        }
        logger("constructor", { opts: this.opts });
    }
    /**
     * 通过 Redis 进行多服务器消息同步
     * @param message
     */
    emit_socket_message(message) {
        let client = this.clients.get(message.id);
        if (client) {
            logger("emit_socket_message", message);
            client.response(message.data.path, message.data.status, message.data.msg, 0, message.data.data);
        }
        else {
            this.delete(message.id);
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
        return __awaiter(this, void 0, void 0, function* () {
            logger("set", socket.getid());
            this.clients.set(socket.getid(), socket);
            return socket;
        });
    }
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("delete", id);
            this.clients.delete(id);
            for (let room of yield this.getRoomidByid(id)) {
                yield this.leave(id, room);
            }
        });
    }
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("join", id, room);
            if (this.data_redis) {
                yield this.data_redis.sadd(REDIS_ROOM_PREFIX.replace(/room/, room), id);
            }
            else {
                (this.rooms[room] = this.rooms[room] || new Set()).add(id);
            }
        });
    }
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("leave", id, room);
            if (this.data_redis) {
                yield this.data_redis.srem(REDIS_ROOM_PREFIX.replace(/room/, room), 0, id);
            }
            else {
                (this.rooms[room] = this.rooms[room] || new Set()).delete(id);
            }
        });
    }
    /**
     * 获取所有的房间号
     */
    getRoomall() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                let cursor = 0;
                let list = [];
                do {
                    let res = yield this.data_redis.scan(cursor, "match", REDIS_ROOM_PREFIX.replace(/room/, "*"), "count", 2000);
                    cursor = +res[0];
                    list = list.concat(res[1]);
                } while (cursor != 0);
                return list.map(key => key.replace(REDIS_ROOM_PREFIX.replace(/room/, ""), ""));
            }
            else {
                return Object.keys(this.rooms);
            }
        });
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    getClientidByroom(room) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                return yield this.data_redis.smembers(REDIS_ROOM_PREFIX.replace(/room/, room));
            }
            else {
                let ids = [];
                (this.rooms[room] || new Set()).forEach(id => ids.push(id));
                return ids;
            }
        });
    }
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    getRoomidByid(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                let rooms = [];
                for (let room of yield this.getRoomall()) {
                    let flog = yield this.hasRoom(room, id);
                    if (flog)
                        rooms.push(room);
                }
                return rooms;
            }
            else {
                let rooms = [];
                for (let room in this.rooms) {
                    if (this.rooms[room].has(id))
                        rooms.push(room);
                }
                return rooms;
            }
        });
    }
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                return Boolean(yield this.data_redis.sismember(REDIS_ROOM_PREFIX.replace(/room/, room), id));
            }
            else {
                return (this.rooms[room] || new Set()).has(id);
            }
        });
    }
    /**
     * 获取所有的房间总数
     */
    getAllRoomcount() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                let rooms = yield this.getRoomall();
                return rooms.length;
            }
            else {
                return Object.keys(this.rooms).length;
            }
        });
    }
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                return yield this.data_redis.scard(REDIS_ROOM_PREFIX.replace(/room/, room));
            }
            else {
                return this.rooms[room] ? this.rooms[room].size : 0;
            }
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
            for (let id of yield this.getClientidByroom(room)) {
                this.sendSocketMessage(id, event, data, status, msg);
            }
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
            for (let room of yield this.getRoomall()) {
                this.sendRoomMessage(room, event, data, status, msg);
            }
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
            logger("sendSocketMessage", { id, data });
            if (this.pub_redis) {
                this.pub_redis.publish("emit_socket_message", JSON.stringify({ id, data: { path: event, status, msg, data } }));
            }
            else {
                this.emit_socket_message({ id, data: { path: event, data, status, msg, request_id: 0 } });
            }
        });
    }
}
exports.Adapter = Adapter;
