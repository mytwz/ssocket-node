"use strict";
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
exports.SWebSocket = void 0;
var ws_1 = __importDefault(require("ws"));
var utils = __importStar(require("./utils"));
var events_1 = require("events");
var code_1 = __importStar(require("./code")), Code = code_1;
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("swebsocket");
var SWebSocket = /** @class */ (function (_super) {
    __extends(SWebSocket, _super);
    function SWebSocket(socket, opts) {
        var _this = _super.call(this) || this;
        _this.socket = socket;
        _this.status = Code.SocketStatus.OPEN;
        _this.opts = Object.assign({
            ping_timeout: 1000 * 60
        }, opts);
        _this.ping_timeout_id = 0;
        _this.id = utils.id24();
        _this.socket.on("close", function (code, reason) { return _this.onclose(code, reason); });
        _this.socket.on("error", function (err) { return _this.emit("error", err); });
        _this.socket.on("upgrade", function (request) { return _this.emit("upgrade", request); });
        _this.socket.on("unexpected-response", function (request, response) { return _this.emit("unexpected-response", request, response); });
        _this.socket.on("message", _this.message.bind(_this));
        logger(_this.id + ":constructor", { opts: opts });
        _this.setPingtimeout();
        return _this;
    }
    SWebSocket.prototype.getid = function () { return this.id; };
    SWebSocket.prototype.getSocket = function () { return this.socket; };
    SWebSocket.prototype.getStatus = function () { return this.status; };
    SWebSocket.prototype.onclose = function (code, reason) {
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
        logger(this.id + ":close", { code: code, reason: reason });
    };
    SWebSocket.prototype.message = function (buffer) {
        var data = Code.decode(buffer);
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
    };
    SWebSocket.prototype.setPingtimeout = function () {
        var _this = this;
        clearTimeout(this.ping_timeout_id);
        this.ping_timeout_id = setTimeout(function () { return _this.onclose(code_1.default[4100][0], code_1.default[4100][1]); }, this.opts.ping_timeout);
    };
    SWebSocket.prototype.shakehands = function (ack) {
        this.send({ id: this.getid(), ack: ack }, Code.PackageType.shakehands);
    };
    SWebSocket.prototype.send = function (data, type) {
        if (type === void 0) { type = Code.PackageType.data; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (type == Code.PackageType.data && !data.path)
                    throw new Error("Cannot have the path field");
                this.socket.send(Code.encode(type, data));
                logger(this.id + ":send", data);
                return [2 /*return*/];
            });
        });
    };
    SWebSocket.prototype.response = function (path, status, msg, request_id, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.send({ path: path, status: status, msg: msg, request_id: request_id, data: data })];
            });
        });
    };
    return SWebSocket;
}(events_1.EventEmitter));
exports.SWebSocket = SWebSocket;
