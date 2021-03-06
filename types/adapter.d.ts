import { SWebSocket } from "./client";
import { RedisOptions } from "ioredis";
/**配置 */
export interface Options extends RedisOptions {
    [key: string]: any;
}
export declare class Adapter {
    private opts?;
    /**客户端集合 */
    private clients;
    /**Redis 订阅对象 */
    private sub_redis;
    /**Redis  */
    private pub_redis;
    /**事件触发器 */
    private emitter;
    private clientkeys;
    private tmpclientkeys;
    private data_redis;
    constructor(opts?: Options | undefined);
    /**
     * @param channel
     * @param os
     * @param device
     * @param browser
     * @param roomid
     * @param uid
     * @param sid
     */
    addUserRelation(channel: string, os: string, device: string, browser: string, roomid: string, sid: string): Promise<void>;
    /**
     * 移除客户端关系
     * @param {*} sid
     */
    removeUserRelation(sid: string): Promise<void>;
    /**
     * 获取 ID
     * @param {*} keyPattern Redis Key
     * @param {*} regExp 对应资源的正则
     */
    private findIds;
    /**
     * 在 Keys 中获取 ID列表
     * @param {*} keys
     * @param {*} keyPattern
     * @param {*} regExp
     */
    private findIdsByKeys;
    /**
     * 从 Key 中获取指定的 ID
     * @param {*} key
     * @param {*} regExp
     */
    private matchId;
    /**
     * 从 Key 中获取指定的 ID
     * @param {*} keys
     * @param {*} regExp
     */
    private matchIds;
    /**
     * 根据房间ID获取所有的 Sid
     * @param {*} roomid
     */
    findSidsByRoomid(roomid: string): Promise<string[]>;
    /**
     * 根据房间ID获取所有的 Uid
     * @param {*} roomid
     */
    findUidsByRoomid(roomid: string): Promise<string[]>;
    /**
     * 根据 SID 获取房间ID
     * @param {*} uid
     */
    findRoomidsBySid(sid: string): Promise<string[]>;
    /**
     * 根据 UID 获取 SID
     * @param {*} uid
     */
    findSidsByRoomidAndUid(roomid: string, uid: string): Promise<string[]>;
    /**
     * 获取所有的 ROOMID
     */
    findAllRoomid(): Promise<string[]>;
    /**
     * 获取所有的 channel
     */
    findAllEquipment(): Promise<string[]>;
    /**获取所有的Sid */
    findAllSids(): Promise<string[]>;
    /**
     * 根据 channel 获取 ROOMID
     * @param {*} channel
     */
    findRoomidsByEquipment(equipment: string): Promise<string[]>;
    /**
     * 获取所有的 Keys
     */
    findAllKeys(): Promise<string[]>;
    /**
     * 通过 Redis 进行多服务器消息同步
     * @param message
     */
    private emit_socket_message;
    /**
     * 获取一个 Socket 客户端对象
     * @param id
     */
    get(id: string): SWebSocket;
    /**
     * 增加一个 Socket 连接
     * @param {*} id
     * @param {*} socket
     */
    set(socket: SWebSocket): Promise<SWebSocket>;
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    delete(id: string): Promise<void>;
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id: string, room: string): Promise<void>;
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id: string, room: string): Promise<void>;
    /**
     * 获取所有的房间号
     */
    getRoomall(): Promise<string[]>;
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    getClientidByroom(room: string): Promise<string[]>;
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    getRoomidByid(id: string): Promise<string[]>;
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id: string, room: string): Promise<boolean>;
    /**
     * 获取所有的房间总数
     */
    getAllRoomcount(): Promise<number>;
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room: string): Promise<number>;
    /**
     * 发送房间消息
     * @param room
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendRoomMessage(room: string, event: string, data: any, status?: number, msg?: string): Promise<void>;
    /**
     * 发送广播消息
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendBroadcast(event: string, data: any, status?: number, msg?: string): Promise<void>;
    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data
     */
    sendSocketMessage(id: string, event: string, data: any, status?: number, msg?: string): Promise<void>;
}
