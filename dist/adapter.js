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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adapter = void 0;
var code_1 = __importDefault(require("./code"));
var ioredis_1 = __importDefault(require("ioredis"));
var events_1 = require("events");
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("adapter");
var REDIS_ROOM_PREFIX = "ssocket:rooms:room";
/**系统事件 */
var SYNC_EVENTS = [
    "emit_socket_message",
];
var Adapter = /** @class */ (function () {
    function Adapter(opts) {
        var _this = this;
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
            this.sub_redis.on("message", function (event, message) {
                logger("redis-event", message);
                _this.emitter.emit(event, JSON.parse(message));
            });
            this.emitter.on("emit_socket_message", this.emit_socket_message.bind(this));
        }
        logger("constructor", { opts: this.opts });
    }
    /**
     * 通过 Redis 进行多服务器消息同步
     * @param message
     */
    Adapter.prototype.emit_socket_message = function (message) {
        var client = this.clients.get(message.id);
        if (client) {
            logger("emit_socket_message", message);
            client.response(message.data.path, message.data.status, message.data.msg, 0, message.data.data);
        }
        else {
            this.delete(message.id);
        }
    };
    /**
     * 获取一个 Socket 客户端对象
     * @param id
     */
    Adapter.prototype.get = function (id) {
        return this.clients.get(id);
    };
    /**
     * 增加一个 Socket 连接
     * @param {*} id
     * @param {*} socket
     */
    Adapter.prototype.set = function (socket) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger("set", socket.getid());
                this.clients.set(socket.getid(), socket);
                return [2 /*return*/, socket];
            });
        });
    };
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    Adapter.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, room;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        logger("delete", id);
                        this.clients.delete(id);
                        _i = 0;
                        return [4 /*yield*/, this.getRoomidByid(id)];
                    case 1:
                        _a = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        room = _a[_i];
                        return [4 /*yield*/, this.leave(id, room)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 加入房间
     * @param id
     * @param room
     */
    Adapter.prototype.join = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger("join", id, room);
                        if (!this.data_redis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.data_redis.sadd(REDIS_ROOM_PREFIX.replace(/room/, room), id)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        (this.rooms[room] = this.rooms[room] || new Set()).add(id);
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 离开房间
     * @param id
     * @param room
     */
    Adapter.prototype.leave = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger("leave", id, room);
                        if (!this.data_redis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.data_redis.srem(REDIS_ROOM_PREFIX.replace(/room/, room), 0, id)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        (this.rooms[room] = this.rooms[room] || new Set()).delete(id);
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 获取所有的房间号
     */
    Adapter.prototype.getRoomall = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cursor, list, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 5];
                        cursor = 0;
                        list = [];
                        _a.label = 1;
                    case 1: return [4 /*yield*/, this.data_redis.scan(cursor, "match", REDIS_ROOM_PREFIX.replace(/room/, "*"), "count", 2000)];
                    case 2:
                        res = _a.sent();
                        cursor = +res[0];
                        list = list.concat(res[1]);
                        _a.label = 3;
                    case 3:
                        if (cursor != 0) return [3 /*break*/, 1];
                        _a.label = 4;
                    case 4: return [2 /*return*/, list.map(function (key) { return key.replace(REDIS_ROOM_PREFIX.replace(/room/, ""), ""); })];
                    case 5: return [2 /*return*/, Object.keys(this.rooms)];
                }
            });
        });
    };
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    Adapter.prototype.getClientidByroom = function (room) {
        return __awaiter(this, void 0, void 0, function () {
            var ids_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.data_redis.smembers(REDIS_ROOM_PREFIX.replace(/room/, room))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        ids_1 = [];
                        (this.rooms[room] || new Set()).forEach(function (id) { return ids_1.push(id); });
                        return [2 /*return*/, ids_1];
                }
            });
        });
    };
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    Adapter.prototype.getRoomidByid = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rooms, _i, _a, room, flog, rooms, room;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 6];
                        rooms = [];
                        _i = 0;
                        return [4 /*yield*/, this.getRoomall()];
                    case 1:
                        _a = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        room = _a[_i];
                        return [4 /*yield*/, this.hasRoom(room, id)];
                    case 3:
                        flog = _b.sent();
                        if (flog)
                            rooms.push(room);
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, rooms];
                    case 6:
                        rooms = [];
                        for (room in this.rooms) {
                            if (this.rooms[room].has(id))
                                rooms.push(room);
                        }
                        return [2 /*return*/, rooms];
                }
            });
        });
    };
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    Adapter.prototype.hasRoom = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 2];
                        _a = Boolean;
                        return [4 /*yield*/, this.data_redis.sismember(REDIS_ROOM_PREFIX.replace(/room/, room), id)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                    case 2: return [2 /*return*/, (this.rooms[room] || new Set()).has(id)];
                }
            });
        });
    };
    /**
     * 获取所有的房间总数
     */
    Adapter.prototype.getAllRoomcount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rooms;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getRoomall()];
                    case 1:
                        rooms = _a.sent();
                        return [2 /*return*/, rooms.length];
                    case 2: return [2 /*return*/, Object.keys(this.rooms).length];
                }
            });
        });
    };
    /**
     * 获取房间内人员数量
     * @param room
     */
    Adapter.prototype.getRoomsize = function (room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.data_redis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.data_redis.scard(REDIS_ROOM_PREFIX.replace(/room/, room))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [2 /*return*/, this.rooms[room] ? this.rooms[room].size : 0];
                }
            });
        });
    };
    /**
     * 发送房间消息
     * @param room
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    Adapter.prototype.sendRoomMessage = function (room, event, data, status, msg) {
        if (status === void 0) { status = code_1.default[200][0]; }
        if (msg === void 0) { msg = code_1.default[200][1]; }
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, id;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0;
                        return [4 /*yield*/, this.getClientidByroom(room)];
                    case 1:
                        _a = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        id = _a[_i];
                        this.sendSocketMessage(id, event, data, status, msg);
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 发送广播消息
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    Adapter.prototype.sendBroadcast = function (event, data, status, msg) {
        if (status === void 0) { status = code_1.default[200][0]; }
        if (msg === void 0) { msg = code_1.default[200][1]; }
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, room;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0;
                        return [4 /*yield*/, this.getRoomall()];
                    case 1:
                        _a = _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        room = _a[_i];
                        this.sendRoomMessage(room, event, data, status, msg);
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data
     */
    Adapter.prototype.sendSocketMessage = function (id, event, data, status, msg) {
        if (status === void 0) { status = code_1.default[200][0]; }
        if (msg === void 0) { msg = code_1.default[200][1]; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger("sendSocketMessage", { id: id, data: data });
                if (this.pub_redis) {
                    this.pub_redis.publish("emit_socket_message", JSON.stringify({ id: id, data: { path: event, status: status, msg: msg, data: data } }));
                }
                else {
                    this.emit_socket_message({ id: id, data: { path: event, data: data, status: status, msg: msg, request_id: 0 } });
                }
                return [2 /*return*/];
            });
        });
    };
    return Adapter;
}());
exports.Adapter = Adapter;
