/// <reference types="node" />
import { SWebSocket } from "./client";
import { RedisOptions } from "ioredis";
import { EventEmitter } from 'events';
/**配置 */
export interface Options {
    redis?: RedisOptions;
    mqurl?: string;
    requestsTimeout?: number;
    [key: string]: any;
}
export declare class Adapter extends EventEmitter {
    private opt;
    readonly uid: string;
    readonly requestsTimeout: number;
    private readonly clients;
    private readonly rooms;
    private readonly client2rooms;
    private readonly channel;
    private readonly requests;
    private readonly cluster;
    constructor(opt: Options);
    init(): Promise<void>;
    private survivalHeartbeat;
    /**获取所有存活主机的数量 */
    private allSurvivalCount;
    private publish;
    private onmessage;
    private emitSocketMessage;
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
    set(socket: SWebSocket): SWebSocket;
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    delete(id: string): void;
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id: string, room: string): void;
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id: string, room: string): void;
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
