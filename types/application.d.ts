/// <reference types="node" />
import { Server, ServerOptions } from "ws";
import { EventEmitter } from 'events';
import { Options } from "./adapter";
import { Adapter } from "./adapter";
import { Router } from "./router";
declare type loggerFun = (name: string, message: string) => void;
export interface SOptions extends ServerOptions {
    /**服务器名称：多服务不可重复 */
    serverName: string;
    redis?: Options;
    protos?: {
        request?: {
            [key: string]: any;
        };
        response?: {
            [key: string]: any;
        };
    };
    logger: boolean | string | loggerFun;
    [key: string]: any;
}
export declare class Application extends EventEmitter {
    private opts;
    private __server;
    private __adapter;
    private __router;
    get server(): Server;
    get adapter(): Adapter;
    get router(): Router;
    constructor(opts: SOptions);
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
     * 获取所有的房间总数
     */
    getAllRoomcount(): Promise<number>;
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room: string): Promise<number>;
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id: string, room: string): Promise<boolean>;
    /**
     * 发送多服同步消息
     * @param id
     * @param event
     * @param data
     */
    sendSocketMessage(id: string, event: string, data: any): Promise<void>;
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
}
export {};
