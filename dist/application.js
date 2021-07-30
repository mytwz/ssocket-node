"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主类，
 * @LastEditTime: 2021-07-30 10:41:47 +0800
 * @FilePath: /ssocket/src/application.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.Application = void 0;
const ws_1 = require("ws");
const events_1 = require("events");
const adapter_1 = require("./adapter");
const client_1 = require("./client");
const router_1 = require("./router");
const code_1 = __importStar(require("./code")), Code = code_1;
const debug_1 = __importDefault(require("debug"));
const logger_1 = __importDefault(require("./logger"));
const logger = logger_1.default("application");
class Application extends events_1.EventEmitter {
    constructor(opts) {
        super();
        this.opts = opts;
        this.__router = new router_1.Router();
        this.__adapter = new adapter_1.Adapter(this.opts.adapter || {});
        this.__server = new ws_1.Server(this.opts, () => this.emit("start-up"));
        if (this.opts.protos) {
            if (this.opts.protos.request)
                Code.parseRequestJson(this.opts.protos.request);
            if (this.opts.protos.response)
                Code.parseResponseJson(this.opts.protos.response);
        }
        if (this.opts.logger instanceof Function) {
            debug_1.default.prototype.logger = this.opts.logger;
        }
        else if (typeof this.opts.logger == "string") {
            debug_1.default.enable(this.opts.logger);
        }
        else if (this.opts.logger) {
            debug_1.default.enable("*");
        }
        this.__server.on("connection", (socket, req) => {
            logger("connection", { url: req.url, rawHeaders: req.rawHeaders });
            let client = new client_1.SWebSocket(socket, req);
            client.on("close", (id, code, reason) => {
                this.__adapter.delete(id);
                this.emit("close", id, code, reason);
            });
            client.on("message", (ctx) => {
                ctx.socket_id = client.getid();
                ctx.socket = client;
                ctx.app = this;
                this.__router.routes(ctx).then((res) => {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.app;
                    logger("routes", { ctx, res });
                    if (ctx.request_id) {
                        ctx.status = code_1.default[200][0];
                        ctx.msg = code_1.default[200][1];
                        ctx.data = undefined;
                        if (Array.isArray(res) && res[0] in code_1.default) {
                            //状态码
                            ctx.status = res[0];
                            ctx.msg = res[1];
                        }
                        else
                            ctx.data = typeof (res) == "object" ? res : { data: res };
                        client.response(ctx.path, ctx.status, ctx.msg, ctx.request_id, ctx.data);
                    }
                }).catch(err => {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.app;
                    client.response(ctx.path, code_1.default[4103][0], code_1.default[4103][1], 0, undefined);
                    client.emit("route-error", ctx, err);
                    this.emit("route-error", ctx, err);
                    logger("routes-error", { ctx, err });
                });
            });
            client.on("reconnection", id => {
                this.__adapter.set(client);
                this.emit("reconnection", client, id);
            });
            client.on("connection", id => {
                this.__adapter.set(client);
                this.emit("connection", client, req);
            });
        });
        logger("constructor", { opts: this.opts });
    }
    get server() { return this.__server; }
    get adapter() { return this.__adapter; }
    get router() { return this.__router; }
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.join(id, room);
        });
    }
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.leave(id, room);
        });
    }
    /**
     * 获取所有的房间号
     */
    getRoomall() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.getRoomall();
        });
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    getClientidByroom(room) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.getClientidByroom(room);
        });
    }
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    getRoomidByid(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.getRoomidByid(id);
        });
    }
    /**
     * 获取所有的房间总数
     */
    getAllRoomcount() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.getAllRoomcount();
        });
    }
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.getRoomsize(room);
        });
    }
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.adapter.hasRoom(id, room);
        });
    }
    /**
     * 发送多服同步消息
     * @param id
     * @param event
     * @param data
     */
    sendSocketMessage(id, event, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.adapter.sendSocketMessage(id, event, data);
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
            yield this.adapter.sendRoomMessage(room, event, data, status, msg);
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
            yield this.adapter.sendBroadcast(event, data, status, msg);
        });
    }
}
exports.Application = Application;
