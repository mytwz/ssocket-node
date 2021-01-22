"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主类，
 * @LastEditTime: 2021-01-22 16:55:25 +0800
 * @FilePath: \ssocket\src\application.ts
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.Application = void 0;
var ws_1 = require("ws");
var events_1 = require("events");
var adapter_1 = require("./adapter");
var client_1 = require("./client");
var router_1 = require("./router");
var code_1 = __importStar(require("./code")), Code = code_1;
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("application");
var Application = /** @class */ (function (_super) {
    __extends(Application, _super);
    function Application(opts) {
        var _a;
        var _this = _super.call(this) || this;
        _this.opts = opts;
        _this.__router = new router_1.Router();
        _this.__adapter = new adapter_1.Adapter((_a = _this.opts) === null || _a === void 0 ? void 0 : _a.redis);
        _this.__server = new ws_1.Server(_this.opts, function () { return _this.emit("start-up"); });
        _this.opts.protos && Code.parseProtosJson(_this.opts.protos);
        _this.__server.on("connection", function (socket, req) {
            logger("connection", { url: req.url, rawHeaders: req.rawHeaders });
            var client = new client_1.SWebSocket(socket);
            client.on("close", function (id, code, reason) {
                _this.__adapter.delete(id);
                _this.emit("close", id, code, reason);
            });
            client.on("message", function (ctx) {
                ctx.socket_id = client.getid();
                ctx.socket = client;
                ctx.application = _this;
                _this.__router.routes(ctx).then(function (res) {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.application;
                    logger("routes", { ctx: ctx, res: res });
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
                }).catch(function (err) {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.application;
                    client.response(ctx.path, code_1.default[4103][0], code_1.default[4103][1], 0, undefined);
                    client.emit("route-error", ctx, err);
                    _this.emit("route-error", ctx, err);
                    logger("routes-error", { ctx: ctx, err: err });
                });
            });
            client.on("reconnection", function (id) {
                _this.__adapter.set(client);
                _this.emit("reconnection", client, id);
            });
            client.on("connection", function (id) {
                _this.__adapter.set(client);
                _this.emit("connection", client, req);
            });
        });
        logger("constructor", { opts: _this.opts });
        return _this;
    }
    Object.defineProperty(Application.prototype, "server", {
        get: function () { return this.__server; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Application.prototype, "adapter", {
        get: function () { return this.__adapter; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Application.prototype, "router", {
        get: function () { return this.__router; },
        enumerable: false,
        configurable: true
    });
    /**
     * 加入房间
     * @param id
     * @param room
     */
    Application.prototype.join = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.join(id, room)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 离开房间
     * @param id
     * @param room
     */
    Application.prototype.leave = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.leave(id, room)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 获取所有的房间号
     */
    Application.prototype.getRoomall = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.getRoomall()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    Application.prototype.getClientidByroom = function (room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.getClientidByroom(room)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    Application.prototype.getRoomidByid = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.getRoomidByid(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 获取所有的房间总数
     */
    Application.prototype.getAllRoomcount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.getAllRoomcount()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 获取房间内人员数量
     * @param room
     */
    Application.prototype.getRoomsize = function (room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.getRoomsize(room)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    Application.prototype.hasRoom = function (id, room) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.hasRoom(id, room)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 发送多服同步消息
     * @param id
     * @param event
     * @param data
     */
    Application.prototype.sendSocketMessage = function (id, event, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.sendSocketMessage(id, event, data)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
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
    Application.prototype.sendRoomMessage = function (room, event, data, status, msg) {
        if (status === void 0) { status = code_1.default[200][0]; }
        if (msg === void 0) { msg = code_1.default[200][1]; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.sendRoomMessage(room, event, data, status, msg)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
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
    Application.prototype.sendBroadcast = function (event, data, status, msg) {
        if (status === void 0) { status = code_1.default[200][0]; }
        if (msg === void 0) { msg = code_1.default[200][1]; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adapter.sendBroadcast(event, data, status, msg)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return Application;
}(events_1.EventEmitter));
exports.Application = Application;
