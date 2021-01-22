import zlib from "zlib"
import debug from "./logger";
import { Application } from "./application"
import { SWebSocket } from "./client"

const logger = debug("code")

/**字段类型 */
enum FieldType {
    /**多层结构 */
    message = "message",
    required = "required",
    optional = "optional",
    /**数组 */
    repeated = "repeated"
}
/**数据类型 */
enum DataType {
    uint8 = "uint8",
    uint16 = "uint16",
    uint32 = "uint32",
    uint64 = "uint64",
    float = "float",
    double = "double",
    string = "string",
    message = "message",
}

type ProtosTags = { [key: number]: string }

type ProtosObj = {
    option: string,
    type: string,
    tag: number
}

type ProtosObjs = {
    [name: string]: ProtosObjs | ProtosTags | ProtosObj
    __messages: ProtosObjs;
    __tags: ProtosTags;
}

type ProtosConfig = { [name: string]: ProtosObjs }

const ProtosCode = new class Protos {
    private protos: ProtosConfig = {};
    parse(protos_config: { [name: string]: any }): void {
        for (let key in protos_config) {
            this.protos[key] = this.parseObject(protos_config[key]);
        }
        logger("ProtosCode:parse", {protos_config, proto: this.protos})
    }
    parseObject(obj: any): ProtosObjs {
        let proto: ProtosObjs = <ProtosObjs>{};
        let nestProtos: ProtosObjs = <ProtosObjs>{};
        let tags: ProtosTags = {};
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
    
    decode(protos_name: string, buffer: Buffer): Object {
        if(this.protos[protos_name]){
            let data = {};
            this.read(this.protos[protos_name], data, buffer, 0);
            logger("ProtosCode:decode", { data })
            return data;
        }
        return buffer.length ? JSON.parse(buffer.toString() || "{}") : {};
    }

    encode(protos_name: string, data: any) : Buffer {
        if(this.protos[protos_name] && data){
            let buffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(data)) * 2);
            let length = this.write(this.protos[protos_name], data, buffer);
            logger("ProtosCode:encode", { protos_name, data, length })
            return buffer.slice(0, length);
        }
        return Buffer.from(data ? JSON.stringify(data) : "");
    }

    writeTag(buffer: Buffer, tag: number, offset: number): number {
        buffer.writeUInt8(+tag, offset++);
        logger("ProtosCode:writeTag", { tag, offset })
        return offset;
    }
    readTag(buffer: Buffer, offset: number) {
        let tag = buffer.readUInt8(offset++)
        logger("ProtosCode:readTag", { offset: offset-1, tag })
        return tag;
    }
    write(protos: ProtosObjs, data: any, buffer: Buffer) {
        let offset = 0;
        if (protos) {
            logger("ProtosCode:write1", { data })
            for (let name in data) {
                if (!!protos[name]) {
                    let proto: ProtosObj = <ProtosObj>protos[name];
                    logger("ProtosCode:write2", { name, data: data[name], proto })
                    switch (proto.option) {
                        case FieldType.required:
                        case FieldType.optional:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            offset = this.writeBody(data[name], proto.type, buffer, offset, protos)
                            break;
                        case FieldType.repeated:
                            offset = this.writeTag(buffer, proto.tag, offset);
                            buffer.writeInt32BE(+data[name].length, offset);
                            offset += 4;
                            for (let i = 0, l = data[name].length; i < l; i++) {
                                offset = this.writeBody(data[name][i], proto.type, buffer, offset, protos)
                            }
                            break;
                    }
                }
            }
        }

        logger("ProtosCode:write3", { offset })

        return offset;
    }
    writeBody(value: number | string | any, type: string, buffer: Buffer, offset: number, protos: ProtosObjs) {
        logger("ProtosCode:writeBody", { type, value, offset })
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
                buffer.writeBigUInt64BE(<bigint><unknown>+value, offset);
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
                buffer.writeInt32BE(+length, offset);
                offset += 4;
                // write string
                buffer.write(value + "", offset, length);
                offset += length;
                break;
            default:
                let message = <ProtosObjs>protos.__messages[type];
                if (message) {
                    let tmpBuffer = Buffer.alloc(Buffer.byteLength(JSON.stringify(value)) * 2);
                    let length = this.write(message, value, tmpBuffer);
                    buffer.writeInt32BE(+length, offset);
                    offset += 4;
                    tmpBuffer.copy(buffer, offset, 0, length);
                    offset += length;
                }
                break;
        }

        return offset;
    }
    read(protos: ProtosObjs, data: { [key: string]: any }, buffer: Buffer, offset: number): number {
        logger("ProtosCode:decode1", { offset, data, protos })
        if (!!protos) {
            while (offset < buffer.length) {
                let tag = this.readTag(buffer, offset); offset += 1;
                let name = protos.__tags[tag];
                let proto = <ProtosObj>protos[name]
                logger("ProtosCode:decode2", { offset, tag, name, proto })
                switch (proto.option) {
                    case 'optional':
                    case 'required':
                        let body = this.readBody(buffer, proto.type, offset, protos);
                        offset = body.offset;
                        data[name] = body.value;
                        break;
                    case 'repeated':
                        if (!data[name]) { data[name] = []; }
                        let length = buffer.readUInt32BE(offset)
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
    readBody(buffer: Buffer, type: string, offset: number, protos: ProtosObjs) {
        let value: any = "";
        switch (type) {
            case DataType.uint8:
                value = buffer.readUInt8(offset)
                offset += 1;
                break;
            case DataType.uint16:
                value = buffer.readUInt16BE(offset)
                offset += 2;
                break;
            case DataType.uint32:
                value = buffer.readUInt32BE(offset)
                offset += 4;
                break;
            case DataType.uint64:
                value = buffer.readBigUInt64BE(offset)
                offset += 8;
                break;
            case DataType.float:
                value = buffer.readFloatBE(offset)
                offset += 4;
                break;
            case DataType.double:
                value = buffer.readDoubleBE(offset)
                offset += 8;
                break;
            case DataType.string:
                let length = buffer.readUInt32BE(offset)
                offset += 4;
                value = buffer.toString('utf8', offset, offset += length);
                break;
            default:

                let message = <ProtosObjs>protos.__messages[type]
                if (message) {
                    let length = buffer.readUInt32BE(offset)
                    offset += 4;
                    this.read(message, value = {}, buffer.slice(offset, offset += length), 0);
                }
                break;
        }
        logger("ProtosCode:readBody", { offset, type, value })
        return { value, offset }
    }

}

export enum PackageType {
    /**握手 */
    shakehands = 0,
    /**心跳 */
    heartbeat = 1,
    /**消息 */
    data = 2
}

/**Socket 状态 */
export enum SocketStatus {
    /**打开 */
    OPEN,
    /**正在握手 */
    SHAKING_HANDS,
    /**握手完毕 */
    HANDSHAKE,
    /**连接 */
    CONNECTION,
    /**关闭 */
    CLOSE
}


export interface ShakehandsPackageData {
    id: string;
    ack: SocketStatus;
}

export interface PackageData {
    path: string;
    request_id: number;
    status: number;
    msg: string;
    data?: { [key: string]: any; } | number;
    socket?: SWebSocket;
    app?:Application;
    [key: string]: any;
}

export interface Package {
    type: PackageType,
    path?: string;
    request_id?: number;
    status?: number;
    msg?: string;
    data?: { [key: string]: any; } | number;
    [key: string]: any;
}

let isProtos = false;

/**
 * 配置 Protos 文件
 * @param config 
 */
export function parseProtosJson(config: any){ ProtosCode.parse(config); isProtos = true; }

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
export function encode(type: PackageType, package_data?: PackageData | ShakehandsPackageData): Buffer {

    if(PackageType.data == type){
        let { path = "", request_id = 0, status = 0, msg = "", data } = <PackageData>package_data || {};
        let _data: Buffer       =  ProtosCode.encode(path, data);

        if(_data.length > 128){
            _data               = zlib.gzipSync(_data)
        }

        let _type:Buffer        = Buffer.allocUnsafe(1);   _type.writeUInt8(+type);
        let _request_id:Buffer  = Buffer.allocUnsafe(4);   _request_id.writeInt32BE(+request_id);
        let _path:Buffer        = Buffer.from(path);
        let _path_length:Buffer = Buffer.allocUnsafe(4);   _path_length.writeInt32BE(_path.length);
        let _status:Buffer      = Buffer.allocUnsafe(4);   _status.writeInt32BE(+status);
        let _msg:Buffer         = Buffer.from(msg);
        let _msg_length:Buffer  = Buffer.allocUnsafe(4);   _msg_length.writeInt32BE(_msg.length);
        let _data_length:Buffer = Buffer.allocUnsafe(4);   _data_length.writeInt32BE(_data.length);
        
        return Buffer.concat([
            _type,/*1B*/ 
            _request_id,/*4B */
            _path_length,/*4B*/ 
            _path, 
            _status,/*4B*/
            _msg_length,/*4B*/ 
            _msg, 
            _data_length,/*4B*/
            _data
        ]);
    }
    else if(type == PackageType.heartbeat){
        let _type:Buffer            = Buffer.allocUnsafe(1);   _type.writeUInt8(+type);
        let _data:Buffer            = Buffer.allocUnsafe(8);   _data.writeDoubleBE(Date.now());
        return Buffer.concat([_type, _data]);
    }
    else if(type == PackageType.shakehands){
        let {  id, ack } = <ShakehandsPackageData>package_data || {};
        let _type:Buffer            = Buffer.allocUnsafe(1);   _type.writeUInt8(+type);
        let _id:Buffer              = Buffer.from(id);
        let _id_length:Buffer       = Buffer.allocUnsafe(4);   _id_length.writeInt32BE(_id.length);
        let _ack: Buffer            = Buffer.allocUnsafe(1);   _ack.writeUInt8(+ack);

        return Buffer.concat([_type, _id_length, _id, _ack]);
    }

    return Buffer.alloc(0);
}
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
 * - +------+-------------------------------------------------------------------------------+------+
 * - | head | This data exists when type == 2                                               | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | type | request_id | path length   | path   | status | msg length | msg | body length | body |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * - | 1B   | 4B         | 4B            | --     | 4B     | 4B         | --  | 4B          | --   |
 * - +------+------------+---------------+--------+--------+------------+-----+-------------+------+
 * @param buffer 
 */
export function decode(_buffer: Buffer): Package | ShakehandsPackageData {
    try {
        
        if(Buffer.isBuffer(_buffer)) {
            let index = 0;
            let buffer          = Buffer.from(_buffer);
            let type            = buffer.slice(index, index += 1).readUInt8();

            if(type == PackageType.data){

                let request_id  = buffer.slice(index, index += 4).readUInt32BE();
                let path_length = buffer.slice(index, index += 4).readUInt32BE() 
                let path        = buffer.slice(index, index += path_length).toString() 
                let data_length = buffer.slice(index, index += 4).readUInt32BE();
                let data_buffer = data_length ? buffer.slice(index, index += data_length) : Buffer.alloc(0);
        
                // 判断是否 GZIP 压缩的数据
                if(data_buffer.length > 2 && data_buffer.slice(0, 2).readUInt16BE() == 0x8b1f){
                    data_buffer = zlib.gunzipSync(data_buffer);
                }
        
                let data        = ProtosCode.decode(path, data_buffer)
                
                return { type, request_id, path, data }
            }
            else if (type == PackageType.heartbeat){
                let data        = buffer.slice(index, index += 8).readDoubleBE();
                return { type, data }
            }
            else if(type == PackageType.shakehands){
                let id_length   = buffer.slice(index, index += 4).readUInt32BE() 
                let id          = id_length ? buffer.slice(index, index += id_length).toString() : "" 
                let ack         = buffer.slice(index, index += 1).readUInt8();

                return <ShakehandsPackageData>{ type, id, ack }
            }
        };
    } catch (error) {
        logger("decode", error)
    }
    return <Package>{};
}

/**系统状态码：这个状态码会通过事件返回给前端 */
export const StatusCode = { 
    4100:[4100, "client ping timeout"],
    4101:[4101, "connection close"],
    4102:[4102, "server ping timeout"],
    4103:[4103, "server error"],
    200:[200, "ok"],
}

class CodeError extends Error {
    constructor(message: string){
        super(message);
    }
}

/**
 * 扩展状态码
 * @param code 
 * @param msg 
 */
export function expandStatusCode(code: number, msg: string) {
    if((<any>StatusCode)[code]) throw new CodeError(" code already exists ");
    (<any>StatusCode)[code] = [ code, msg ];
}

export default StatusCode
