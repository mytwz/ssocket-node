import { Application } from "./application";
import { SWebSocket } from "./client";
declare global {
    interface Buffer {
        writeUInt64BE(value: number, offset?: number): number;
        readUInt64BE(offset?: number): number;
    }
}
export declare enum PackageType {
    /**握手 */
    shakehands = 0,
    /**心跳 */
    heartbeat = 1,
    /**消息 */
    data = 2
}
/**Socket 状态 */
export declare enum SocketStatus {
    /**打开 */
    OPEN = 0,
    /**正在握手 */
    SHAKING_HANDS = 1,
    /**握手完毕 */
    HANDSHAKE = 2,
    /**连接 */
    CONNECTION = 3,
    /**关闭 */
    CLOSE = 4
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
    data?: {
        [key: string]: any;
    } | number;
    socket?: SWebSocket;
    app?: Application;
    socket_id?: string;
    [key: string]: any;
}
export interface Package {
    type: PackageType;
    path?: string;
    request_id?: number;
    status?: number;
    msg?: string;
    data?: {
        [key: string]: any;
    } | number;
    [key: string]: any;
}
/**
 * 配置 Protos 文件
 * @param config
 */
export declare function parseRequestJson(config: any): void;
/**
 * 配置 Protos 文件
 * @param config
 */
export declare function parseResponseJson(config: any): void;
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
export declare function encode(type: PackageType, package_data?: PackageData | ShakehandsPackageData): Buffer;
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
export declare function decode(_buffer: Buffer): Package | ShakehandsPackageData;
/**系统状态码：这个状态码会通过事件返回给前端 */
export declare const StatusCode: {
    4100: (string | number)[];
    4101: (string | number)[];
    4102: (string | number)[];
    4103: (string | number)[];
    200: (string | number)[];
};
/**
 * 扩展状态码
 * @param code
 * @param msg
 */
export declare function expandStatusCode(code: number, msg: string): void;
export default StatusCode;
