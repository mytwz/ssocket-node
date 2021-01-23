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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandStatusCode = exports.StatusCode = exports.decode = exports.encode = exports.parseProtosJson = exports.SocketStatus = exports.PackageType = void 0;
var zlib_1 = __importDefault(require("zlib"));
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("code");
/**字段类型 */
var FieldType;
(function (FieldType) {
    /**多层结构 */
    FieldType["message"] = "message";
    FieldType["required"] = "required";
    FieldType["optional"] = "optional";
    /**数组 */
    FieldType["repeated"] = "repeated";
})(FieldType || (FieldType = {}));
/**数据类型 */
var DataType;
(function (DataType) {
    DataType["uint8"] = "uint8";
    DataType["uint16"] = "uint16";
    DataType["uint32"] = "uint32";
    DataType["uint64"] = "uint64";
    DataType["float"] = "float";
    DataType["double"] = "double";
    DataType["string"] = "string";
    DataType["message"] = "message";
})(DataType || (DataType = {}));
var ProtosCode = new /** @class */ (function () {
    function Protos() {
        this.protos = {};
    }
    Protos.prototype.parse = function (protos_config) {
        for (var key in protos_config) {
            this.protos[key] = this.parseObject(protos_config[key]);
        }
        logger("ProtosCode:parse", { protos_config: protos_config, proto: this.protos });
    };
    Protos.prototype.parseObject = function (obj) {
        var proto = {};
        var nestProtos = {};
        var tags = {};
        for (var name_1 in obj) {
            var tag = obj[name_1];
            var params = name_1.split(/\s+/);
            switch (params[0]) {
                case FieldType.message:
                    if (params.length !== 2) {
                        continue;
                    }
                    nestProtos[params[1]] = this.parseObject(tag);
                    continue;
                case FieldType.required:
                case FieldType.optional:
                case FieldType.repeated: {
                    // params length should be 3 and tag can't be duplicated
                    if (params.length !== 3 || !!tags[tag]) {
                        continue;
                    }
                    proto[params[2]] = {
                        option: params[0],
                        type: params[1],
                        tag: tag
                    };
                    tags[tag] = params[2];
                }
            }
        }
        proto.__messages = nestProtos;
        proto.__tags = tags;
        return proto;
    };
    Protos.prototype.decode = function (protos_name, buffer) {
        if (this.protos[protos_name]) {
            var data = {};
            this.read(this.protos[protos_name], data, buffer, 0);
            logger("ProtosCode:decode", { data: data });
            return data;
        }
        return buffer.length ? JSON.parse(buffer.toString() || "{}") : {};
    };
    Protos.prototype.encode = function (protos_name, data) {
        if (this.protos[protos_name] && data) {
            var buffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(data)) * 2);
            var length_1 = this.write(this.protos[protos_name], data, buffer);
            logger("ProtosCode:encode", { protos_name: protos_name, data: data, length: length_1 });
            return buffer.slice(0, length_1);
        }
        return Buffer.from(data ? JSON.stringify(data) : "");
    };
    Protos.prototype.writeTag = function (buffer, tag, offset) {
        buffer.writeUInt8(+tag, offset++);
        logger("ProtosCode:writeTag", { tag: tag, offset: offset });
        return offset;
    };
    Protos.prototype.readTag = function (buffer, offset) {
        var tag = buffer.readUInt8(offset++);
        logger("ProtosCode:readTag", { offset: offset - 1, tag: tag });
        return tag;
    };
    Protos.prototype.write = function (protos, data, buffer) {
        var offset = 0;
        if (protos) {
            logger("ProtosCode:write1", { data: data });
            for (var name_2 in data) {
                if (!!protos[name_2]) {
                    var proto = protos[name_2];
                    logger("ProtosCode:write2", { name: name_2, data: data[name_2], proto: proto });
                    switch (proto.option) {
                        case FieldType.required:
                        case FieldType.optional:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            offset = this.writeBody(data[name_2], proto.type, buffer, offset, protos);
                            break;
                        case FieldType.repeated:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            buffer.writeInt32BE(+data[name_2].length, offset);
                            offset += 4;
                            for (var i = 0, l = data[name_2].length; i < l; i++) {
                                offset = this.writeBody(data[name_2][i], proto.type, buffer, offset, protos);
                            }
                            break;
                    }
                }
            }
        }
        logger("ProtosCode:write3", { offset: offset });
        return offset;
    };
    Protos.prototype.writeBody = function (value, type, buffer, offset, protos) {
        logger("ProtosCode:writeBody", { type: type, value: value, offset: offset });
        switch (type) {
            case DataType.uint8:
                buffer.writeUInt8(+value, offset);
                offset += 1;
                break;
            case DataType.uint16:
                buffer.writeInt16BE(+value, offset);
                offset += 2;
                break;
            case DataType.uint32:
                buffer.writeInt32BE(+value, offset);
                offset += 4;
                break;
            case DataType.uint64:
                buffer.writeBigUInt64BE(+value, offset);
                offset += 8;
                break;
            case DataType.float:
                buffer.writeFloatBE(+value, offset);
                offset += 4;
                break;
            case DataType.double:
                buffer.writeDoubleBE(+value, offset);
                offset += 8;
                break;
            case DataType.string:
                // Encode length
                var length_2 = Buffer.byteLength(value + "");
                buffer.writeInt32BE(+length_2, offset);
                offset += 4;
                // write string
                buffer.write(value + "", offset, length_2);
                offset += length_2;
                break;
            default:
                var message = protos.__messages[type];
                if (message) {
                    var tmpBuffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(value)) * 2);
                    var length_3 = this.write(message, value, tmpBuffer);
                    buffer.writeInt32BE(+length_3, offset);
                    offset += 4;
                    tmpBuffer.copy(buffer, offset, 0, length_3);
                    offset += length_3;
                }
                break;
        }
        return offset;
    };
    Protos.prototype.read = function (protos, data, buffer, offset) {
        logger("ProtosCode:decode1", { offset: offset, data: data, protos: protos });
        if (!!protos) {
            while (offset < buffer.length) {
                var tag = this.readTag(buffer, offset);
                offset += 1;
                var name_3 = protos.__tags[tag];
                var proto = protos[name_3];
                logger("ProtosCode:decode2", { offset: offset, tag: tag, name: name_3, proto: proto });
                switch (proto.option) {
                    case 'optional':
                    case 'required':
                        var body = this.readBody(buffer, proto.type, offset, protos);
                        offset = body.offset;
                        data[name_3] = body.value;
                        break;
                    case 'repeated':
                        if (!data[name_3]) {
                            data[name_3] = [];
                        }
                        var length_4 = buffer.readUInt32BE(offset);
                        offset += 4;
                        for (var i = 0; i < length_4; i++) {
                            var body_1 = this.readBody(buffer, proto.type, offset, protos);
                            offset = body_1.offset;
                            data[name_3].push(body_1.value);
                        }
                        break;
                }
            }
            return offset;
        }
        return 0;
    };
    Protos.prototype.readBody = function (buffer, type, offset, protos) {
        var value = "";
        switch (type) {
            case DataType.uint8:
                value = buffer.readUInt8(offset);
                offset += 1;
                break;
            case DataType.uint16:
                value = buffer.readUInt16BE(offset);
                offset += 2;
                break;
            case DataType.uint32:
                value = buffer.readUInt32BE(offset);
                offset += 4;
                break;
            case DataType.uint64:
                value = buffer.readBigUInt64BE(offset);
                offset += 8;
                break;
            case DataType.float:
                value = buffer.readFloatBE(offset);
                offset += 4;
                break;
            case DataType.double:
                value = buffer.readDoubleBE(offset);
                offset += 8;
                break;
            case DataType.string:
                var length_5 = buffer.readUInt32BE(offset);
                offset += 4;
                value = buffer.toString('utf8', offset, offset += length_5);
                break;
            default:
                var message = protos.__messages[type];
                if (message) {
                    var length_6 = buffer.readUInt32BE(offset);
                    offset += 4;
                    this.read(message, value = {}, buffer.slice(offset, offset += length_6), 0);
                }
                break;
        }
        logger("ProtosCode:readBody", { offset: offset, type: type, value: value });
        return { value: value, offset: offset };
    };
    return Protos;
}());
var PackageType;
(function (PackageType) {
    /**握手 */
    PackageType[PackageType["shakehands"] = 0] = "shakehands";
    /**心跳 */
    PackageType[PackageType["heartbeat"] = 1] = "heartbeat";
    /**消息 */
    PackageType[PackageType["data"] = 2] = "data";
})(PackageType = exports.PackageType || (exports.PackageType = {}));
/**Socket 状态 */
var SocketStatus;
(function (SocketStatus) {
    /**打开 */
    SocketStatus[SocketStatus["OPEN"] = 0] = "OPEN";
    /**正在握手 */
    SocketStatus[SocketStatus["SHAKING_HANDS"] = 1] = "SHAKING_HANDS";
    /**握手完毕 */
    SocketStatus[SocketStatus["HANDSHAKE"] = 2] = "HANDSHAKE";
    /**连接 */
    SocketStatus[SocketStatus["CONNECTION"] = 3] = "CONNECTION";
    /**关闭 */
    SocketStatus[SocketStatus["CLOSE"] = 4] = "CLOSE";
})(SocketStatus = exports.SocketStatus || (exports.SocketStatus = {}));
var isProtos = false;
/**
 * 配置 Protos 文件
 * @param config
 */
function parseProtosJson(config) { ProtosCode.parse(config); isProtos = true; }
exports.parseProtosJson = parseProtosJson;
/**
 * 消息封包
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 0  | body |
 * - +------+------------+---------------------+------+
 * - | type | id length  | id                  | ack  |
 * - +------+------------+---------------------+------+
 * - | 1B   | 4B         | --                  | 1B   |
 * - +------+------------+---------------------+------+
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 1  | body |
 * - +------+----------------------------------+------+
 * - | type | body length                      | time |
 * - +------+----------------------------------+------+
 * - | 1B   | 0B                               | 8B   |
 * - +------+----------------------------------+------+
 * - +------+-------------------------------------------------------------------------------+------+
 * - | head | This data exists when type == 2                                               | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | type | request_id | path length   | path   | status | msg length | msg | body length | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | 1B   | 4B         | 4B            | --     | 4B     | 4B         | --  | 4B          | --   |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * -
 * @param type 类型：0握手|1心跳|2数据
 * @param package_data
 */
function encode(type, package_data) {
    if (PackageType.data == type) {
        var _a = package_data || {}, _b = _a.path, path = _b === void 0 ? "" : _b, _c = _a.request_id, request_id = _c === void 0 ? 0 : _c, _d = _a.status, status_1 = _d === void 0 ? 0 : _d, _e = _a.msg, msg = _e === void 0 ? "" : _e, data = _a.data;
        var _data = ProtosCode.encode(path, data);
        if (_data.length > 128) {
            _data = zlib_1.default.gzipSync(_data);
        }
        var _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        var _request_id = Buffer.allocUnsafe(4);
        _request_id.writeInt32BE(+request_id);
        var _path = Buffer.from(path);
        var _path_length = Buffer.allocUnsafe(4);
        _path_length.writeInt32BE(_path.length);
        var _status = Buffer.allocUnsafe(4);
        _status.writeInt32BE(+status_1);
        var _msg = Buffer.from(msg);
        var _msg_length = Buffer.allocUnsafe(4);
        _msg_length.writeInt32BE(_msg.length);
        var _data_length = Buffer.allocUnsafe(4);
        _data_length.writeInt32BE(_data.length);
        return Buffer.concat([
            _type,
            _request_id,
            _path_length,
            _path,
            _status,
            _msg_length,
            _msg,
            _data_length,
            _data
        ]);
    }
    else if (type == PackageType.heartbeat) {
        var _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        var _data = Buffer.allocUnsafe(8);
        _data.writeDoubleBE(Date.now());
        return Buffer.concat([_type, _data]);
    }
    else if (type == PackageType.shakehands) {
        var _f = package_data || {}, id = _f.id, ack = _f.ack;
        var _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        var _id = Buffer.from(id);
        var _id_length = Buffer.allocUnsafe(4);
        _id_length.writeInt32BE(_id.length);
        var _ack = Buffer.allocUnsafe(1);
        _ack.writeUInt8(+ack);
        return Buffer.concat([_type, _id_length, _id, _ack]);
    }
    return Buffer.alloc(0);
}
exports.encode = encode;
/**
 * 消息拆包
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 0  | body |
 * - +------+------------+---------------------+------+
 * - | type | id length  | id                  | ack  |
 * - +------+------------+---------------------+------+
 * - | 1B   | 4B         | --                  | 1B   |
 * - +------+------------+---------------------+------+
 * - +------+----------------------------------+------+
 * - | head | This data exists when type == 1  | time |
 * - +------+----------------------------------+------+
 * - | type | body length                      | body |
 * - +------+----------------------------------+------+
 * - | 1B   | 0B                               | 8B   |
 * - +------+----------------------------------+------+
 * - +------+---------------------------------------------------+------+
 * - | head | This data exists when type == 2                   | body |
 * - +------+------------+---------------+--------+-------------+------+
 * - | type | request_id | path length   | path   | body length | body |
 * - +------+------------+---------------+--------+-------------+------+
 * - | 1B   | 4B         | 4B            | 4B     | --          | 4B   |
 * - +------+------------+---------------+--------+-------------+------+
 * @param buffer
 */
function decode(_buffer) {
    try {
        if (Buffer.isBuffer(_buffer)) {
            var index = 0;
            var buffer = Buffer.from(_buffer);
            var type = buffer.slice(index, index += 1).readUInt8();
            if (type == PackageType.data) {
                var request_id = buffer.slice(index, index += 4).readUInt32BE();
                var path_length = buffer.slice(index, index += 4).readUInt32BE();
                var path = buffer.slice(index, index += path_length).toString();
                var data_length = buffer.slice(index, index += 4).readUInt32BE();
                var data_buffer = data_length ? buffer.slice(index, index += data_length) : Buffer.alloc(0);
                // 判断是否 GZIP 压缩的数据
                if (data_buffer.length > 2 && data_buffer.slice(0, 2).readUInt16BE() == 0x8b1f) {
                    data_buffer = zlib_1.default.gunzipSync(data_buffer);
                }
                var data = ProtosCode.decode(path, data_buffer);
                return { type: type, request_id: request_id, path: path, data: data };
            }
            else if (type == PackageType.heartbeat) {
                var data = buffer.slice(index, index += 8).readDoubleBE();
                return { type: type, data: data };
            }
            else if (type == PackageType.shakehands) {
                var id_length = buffer.slice(index, index += 4).readUInt32BE();
                var id = id_length ? buffer.slice(index, index += id_length).toString() : "";
                var ack = buffer.slice(index, index += 1).readUInt8();
                return { type: type, id: id, ack: ack };
            }
        }
        ;
    }
    catch (error) {
        logger("decode", error);
    }
    return {};
}
exports.decode = decode;
/**系统状态码：这个状态码会通过事件返回给前端 */
exports.StatusCode = {
    4100: [4100, "client ping timeout"],
    4101: [4101, "connection close"],
    4102: [4102, "server ping timeout"],
    4103: [4103, "server error"],
    200: [200, "ok"],
};
var CodeError = /** @class */ (function (_super) {
    __extends(CodeError, _super);
    function CodeError(message) {
        return _super.call(this, message) || this;
    }
    return CodeError;
}(Error));
/**
 * 扩展状态码
 * @param code
 * @param msg
 */
function expandStatusCode(code, msg) {
    if (exports.StatusCode[code])
        throw new CodeError(" code already exists ");
    exports.StatusCode[code] = [code, msg];
}
exports.expandStatusCode = expandStatusCode;
exports.default = exports.StatusCode;
