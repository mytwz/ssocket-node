"use strict";
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
exports.SWebSocket = void 0;
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description:
 * @Date: 2021-03-25 12:14:10 +0800
 * @LastEditTime: 2021-05-10 15:41:37 +0800
 * @FilePath: /ssocket/src/client.ts
 */
const ws_1 = __importDefault(require("ws"));
const utils = __importStar(require("./utils"));
const events_1 = require("events");
const code_1 = __importStar(require("./code")), Code = code_1;
const logger_1 = __importDefault(require("./logger"));
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const logger = logger_1.default("swebsocket");
console.log(".....................................................");
class SWebSocket extends events_1.EventEmitter {
    constructor(socket, req) {
        var _a;
        super();
        this.socket = socket;
        this.status = Code.SocketStatus.OPEN;
        this.browser = null;
        this.device = null;
        this.os = null;
        let { browser, os, device, ua } = new ua_parser_js_1.default(req.headers["user-agent"]).getResult();
        this.browser = browser.name || "unknown";
        this.device = device.vendor || device.model || "unknown";
        this.os = os.name || "unknown";
        if (!os.name && !device.vendor && !browser.name)
            this.browser = ((_a = String(ua).match(/\w+/)) === null || _a === void 0 ? void 0 : _a.pop()) || "unknown";
        this.opts = { ping_timeout: 1000 * 60 };
        this.ping_timeout_id = 0;
        this.id = utils.id24();
        this.socket.on("close", (code, reason) => this.onclose(code, reason));
        this.socket.on("error", err => this.emit("error", err));
        this.socket.on("upgrade", request => this.emit("upgrade", request));
        this.socket.on("unexpected-response", (request, response) => this.emit("unexpected-response", request, response));
        this.socket.on("message", this.message.bind(this));
        logger(this.id + ":constructor", this.opts);
        this.setPingtimeout();
    }
    getid() { return this.id; }
    getSocket() { return this.socket; }
    getStatus() { return this.status; }
    onclose(code, reason) {
        clearTimeout(this.ping_timeout_id);
        if (this.status == Code.SocketStatus.CLOSE)
            return;
        if (this.socket.readyState != ws_1.default.CLOSED)
            return this.socket.close(code, reason);
        this.status = Code.SocketStatus.CLOSE;
        this.socket.removeAllListeners();
        this.socket = null;
        this.emit("close", this.getid(), code, reason);
        this.removeAllListeners();
        logger(this.id + ":close", { code, reason });
    }
    message(buffer) {
        let data = Code.decode(buffer);
        logger(this.id + ":message", data);
        if (data.type == Code.PackageType.shakehands) {
            if (data.ack == Code.SocketStatus.SHAKING_HANDS) {
                this.shakehands(Code.SocketStatus.HANDSHAKE);
                this.emit("shakehands", this.status = Code.SocketStatus.HANDSHAKE);
            }
            else if (data.ack == Code.SocketStatus.CONNECTION) {
                this.shakehands(Code.SocketStatus.CONNECTION);
                this.emit("shakehands", this.status = Code.SocketStatus.CONNECTION);
                this.emit(this.id != data.id ? "reconnection" : "connection", this.id = data.id);
                this.socket.send(Code.encode(Code.PackageType.heartbeat));
            }
        }
        else if (data.type == Code.PackageType.heartbeat) {
            this.emit("ping", data.data);
            this.socket.send(Code.encode(Code.PackageType.heartbeat));
            this.setPingtimeout();
            this.emit("pong");
        }
        else if (data.type == Code.PackageType.data) {
            this.emit("message", data);
        }
    }
    setPingtimeout() {
        clearTimeout(this.ping_timeout_id);
        this.ping_timeout_id = setTimeout(() => this.onclose(code_1.default[4100][0], code_1.default[4100][1]), this.opts.ping_timeout);
    }
    shakehands(ack) {
        this.send({ id: this.getid(), ack }, Code.PackageType.shakehands);
    }
    send(data, type = Code.PackageType.data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (type == Code.PackageType.data && !data.path)
                throw new Error("Cannot have the path field");
            this.socket.send(Code.encode(type, data));
            logger(this.id + ":send", data);
        });
    }
    response(path, status, msg, request_id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.send({ path, status, msg, request_id, data });
        });
    }
}
exports.SWebSocket = SWebSocket;
