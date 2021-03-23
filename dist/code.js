"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandStatusCode = exports.StatusCode = exports.decode = exports.encode = exports.parseResponseJson = exports.parseRequestJson = exports.SocketStatus = exports.PackageType = void 0;
const zlib_1 = __importDefault(require("zlib"));
const logger_1 = __importDefault(require("./logger"));
const UINT32_MAX = 0xFFFFFFFF;
Buffer.prototype.writeUInt64BE = function (value, offset = 0) {
    let big = ~~(value / UINT32_MAX);
    let low = (value % UINT32_MAX) - big;
    this.writeUInt32BE(big, offset);
    this.writeUInt32BE(low, offset + 4);
    return offset + 4;
};
Buffer.prototype.readUInt64BE = function (offset = 0) {
    let hex = this.slice(offset, offset + 8).toString("hex");
    return parseInt(hex, 16);
};
const logger = logger_1.default("code");
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
class Protos {
    constructor() {
        this.protos = {};
    }
    parse(protos_config) {
        for (let key in protos_config) {
            this.protos[key] = this.parseObject(protos_config[key]);
        }
        logger("ProtosCode:parse", { protos_config, proto: this.protos });
    }
    parseObject(obj) {
        let proto = {};
        let nestProtos = {};
        let tags = {};
        for (let name in obj) {
            let tag = obj[name];
            let params = name.split(/\s+/);
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
    }
    decode(protos_name, buffer) {
        if (this.protos[protos_name]) {
            let data = {};
            this.read(this.protos[protos_name], data, buffer, 0);
            logger("ProtosCode:decode", { data });
            return data;
        }
        return buffer.length ? JSON.parse(buffer.toString() || "{}") : {};
    }
    encode(protos_name, data) {
        if (this.protos[protos_name] && data) {
            let buffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(data)) * 2);
            let length = this.write(this.protos[protos_name], data, buffer);
            logger("ProtosCode:encode", { protos_name, data, length });
            return buffer.slice(0, length);
        }
        return Buffer.from(data ? JSON.stringify(data) : "");
    }
    writeTag(buffer, tag, offset) {
        buffer.writeUInt8(+tag, offset++);
        logger("ProtosCode:writeTag", { tag, offset });
        return offset;
    }
    readTag(buffer, offset) {
        let tag = buffer.readUInt8(offset++);
        logger("ProtosCode:readTag", { offset: offset - 1, tag });
        return tag;
    }
    write(protos, data, buffer) {
        let offset = 0;
        if (protos) {
            logger("ProtosCode:write1", { data });
            for (let name in data) {
                if (!!protos[name]) {
                    let proto = protos[name];
                    logger("ProtosCode:write2", { name, data: data[name], proto });
                    switch (proto.option) {
                        case FieldType.required:
                        case FieldType.optional:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            offset = this.writeBody(data[name], proto.type, buffer, offset, protos);
                            break;
                        case FieldType.repeated:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            buffer.writeInt32BE(+data[name].length, offset);
                            offset += 4;
                            for (let i = 0, l = data[name].length; i < l; i++) {
                                offset = this.writeBody(data[name][i], proto.type, buffer, offset, protos);
                            }
                            break;
                    }
                }
            }
        }
        logger("ProtosCode:write3", { offset });
        return offset;
    }
    writeBody(value, type, buffer, offset, protos) {
        logger("ProtosCode:writeBody", { type, value, offset });
        switch (type) {
            case DataType.uint8:
                buffer.writeUInt8(+value, offset);
                offset += 1;
                break;
            case DataType.uint16:
                buffer.writeUInt16BE(+value, offset);
                offset += 2;
                break;
            case DataType.uint32:
                buffer.writeUInt32BE(+value, offset);
                offset += 4;
                break;
            case DataType.uint64:
                buffer.writeUInt64BE(+value, offset);
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
                let length = Buffer.byteLength(value + "");
                buffer.writeUInt32BE(+length, offset);
                offset += 4;
                // write string
                buffer.write(value + "", offset, length);
                offset += length;
                break;
            default:
                let message = protos.__messages[type];
                if (message) {
                    let tmpBuffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(value)) * 2);
                    let length = this.write(message, value, tmpBuffer);
                    buffer.writeUInt32BE(+length, offset);
                    offset += 4;
                    tmpBuffer.copy(buffer, offset, 0, length);
                    offset += length;
                }
                break;
        }
        return offset;
    }
    read(protos, data, buffer, offset) {
        logger("ProtosCode:decode1", { offset, data, protos });
        if (!!protos) {
            while (offset < buffer.length) {
                let tag = this.readTag(buffer, offset);
                offset += 1;
                let name = protos.__tags[tag];
                let proto = protos[name];
                logger("ProtosCode:decode2", { offset, tag, name, proto });
                switch (proto.option) {
                    case 'optional':
                    case 'required':
                        let body = this.readBody(buffer, proto.type, offset, protos);
                        offset = body.offset;
                        data[name] = body.value;
                        break;
                    case 'repeated':
                        if (!data[name]) {
                            data[name] = [];
                        }
                        let length = buffer.readUInt32BE(offset);
                        offset += 4;
                        for (let i = 0; i < length; i++) {
                            let body = this.readBody(buffer, proto.type, offset, protos);
                            offset = body.offset;
                            data[name].push(body.value);
                        }
                        break;
                }
            }
            return offset;
        }
        return 0;
    }
    readBody(buffer, type, offset, protos) {
        let value = "";
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
                value = buffer.readUInt64BE(offset);
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
                let length = buffer.readUInt32BE(offset);
                offset += 4;
                value = buffer.toString('utf8', offset, offset += length);
                break;
            default:
                let message = protos.__messages[type];
                if (message) {
                    let length = buffer.readUInt32BE(offset);
                    offset += 4;
                    this.read(message, value = {}, buffer.slice(offset, offset += length), 0);
                }
                break;
        }
        logger("ProtosCode:readBody", { offset, type, value });
        return { value, offset };
    }
}
const RequestProtos = new Protos();
const ResponseProtos = new Protos();
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
/**
 * 配置 Protos 文件
 * @param config
 */
function parseRequestJson(config) { RequestProtos.parse(config); }
exports.parseRequestJson = parseRequestJson;
/**
 * 配置 Protos 文件
 * @param config
 */
function parseResponseJson(config) { ResponseProtos.parse(config); }
exports.parseResponseJson = parseResponseJson;
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
        let { path = "", request_id = 0, status = 0, msg = "", data } = package_data || {};
        let _data = ResponseProtos.encode(path, data);
        if (_data.length > 128) {
            _data = zlib_1.default.gzipSync(_data);
        }
        let _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        let _request_id = Buffer.allocUnsafe(4);
        _request_id.writeUInt32BE(+request_id);
        let _path = Buffer.from(path);
        let _path_length = Buffer.allocUnsafe(4);
        _path_length.writeUInt32BE(_path.length);
        let _status = Buffer.allocUnsafe(4);
        _status.writeUInt32BE(+status);
        let _msg = Buffer.from(msg);
        let _msg_length = Buffer.allocUnsafe(4);
        _msg_length.writeUInt32BE(_msg.length);
        let _data_length = Buffer.allocUnsafe(4);
        _data_length.writeUInt32BE(_data.length);
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
        let _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        let _data = Buffer.allocUnsafe(8);
        _data.writeUInt64BE(Date.now());
        return Buffer.concat([_type, _data]);
    }
    else if (type == PackageType.shakehands) {
        let { id, ack } = package_data || {};
        let _type = Buffer.allocUnsafe(1);
        _type.writeUInt8(+type);
        let _id = Buffer.from(id);
        let _id_length = Buffer.allocUnsafe(4);
        _id_length.writeUInt32BE(_id.length);
        let _ack = Buffer.allocUnsafe(1);
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
            let index = 0;
            let buffer = Buffer.from(_buffer);
            let type = buffer.slice(index, index += 1).readUInt8();
            if (type == PackageType.data) {
                let request_id = buffer.slice(index, index += 4).readUInt32BE();
                let path_length = buffer.slice(index, index += 4).readUInt32BE();
                let path = buffer.slice(index, index += path_length).toString();
                let data_length = buffer.slice(index, index += 4).readUInt32BE();
                let data_buffer = data_length ? buffer.slice(index, index += data_length) : Buffer.alloc(0);
                // 判断是否 GZIP 压缩的数据
                if (data_buffer.length > 2 && data_buffer.slice(0, 2).readUInt16BE() == 0x8b1f) {
                    data_buffer = zlib_1.default.gunzipSync(data_buffer);
                }
                let data = RequestProtos.decode(path, data_buffer);
                return { type, request_id, path, data };
            }
            else if (type == PackageType.heartbeat) {
                let data = buffer.slice(index, index += 8).readUInt64BE();
                return { type, data };
            }
            else if (type == PackageType.shakehands) {
                let id_length = buffer.slice(index, index += 4).readUInt32BE();
                let id = id_length ? buffer.slice(index, index += id_length).toString() : "";
                let ack = buffer.slice(index, index += 1).readUInt8();
                return { type, id, ack };
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
class CodeError extends Error {
    constructor(message) {
        super(message);
    }
}
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
