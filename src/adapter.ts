/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @LastEditTime: 2021-04-26 16:48:39 +0800
 * @FilePath: /ssocket/src/adapter.ts
 */

import { SWebSocket } from "./client";
import CODE, * as Code from "./code";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { EventEmitter } from 'events';
import debug from "./logger";
import os from "os";
const HOST_NAME = os.hostname()

/**配置 */
export interface Options extends RedisOptions {
    
    [key: string]: any;
}

const logger = debug("adapter")

/**系统事件 */
const SYNC_EVENTS: string[] = [
    "emit_socket_message",
]


ioredis.prototype.keys = async function(pattern: string){
    let cursor = 0;
    let list:string[] = [];
    do {
        let res = await this.scan(cursor, "match", pattern, "count", 2000);
        cursor = +res[0];
        list = list.concat(res[1]);
    } while (cursor != 0);

    return list;
}


/**Redis Key */
const REDIS_SOCKET_SERVICE_KEY = "ssocket_service"
/**获取主机名的正则 */
const HOSTNAME_REGEXP = /(?<=:H)[^:]+/g
/**获取进程号的正则 */
const PROCESS_REGEXP = /(?<=:P)[^:]+/g
/**获取渠道号的正则 */
const CHANNEL_REGEXP = /(?<=:C)[^:]+/g
/**获取设备号的正则 */
const EQUIPMENT_REGEXP = /(?<=:D)[^:]+/g
/**获取房间号的正则 */
const ROOM_ID_REGEXP = /(?<=:R)[^:]+/g
/**获取用户 ID 的正则 */
const UID_REGEXP = /(?<=:U)[^:]+/g
/**获取 Socket 连接 ID 的正则 */
const SID_REGEXP = /(?<=:S)[^:]+/g

const X = "XXX";
const U = /(?<=U)\*/;
const R = /(?<=R)\*/;
const D = /(?<=D)\*/;
const C = /(?<=C)\*/;
const S = /(?<=S)\*/;
const P = /(?<=P)\*/;
const H = /(?<=H)\*/;

const HOST_PROCESS = `H${HOST_NAME}:P${process.pid}`;

const ALL_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R*:S*`
const HOST_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H${X}:P*:C*:O*:D*:B*:R*:S*`
const PROCESS_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P${X}:C*:O*:D*:B*:R*:S*`
const SID_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R*:S${X}`;
const ROOM_ID_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R${X}:S*`;
const EQUIPMENT_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D${X}:B*:R*:S*`;
const CHANNEL_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C${X}:O*:D*:B*:R*:S*`;

const SYSTEM_ROOMID = "unknown";
const SYSTEM_USERID = "unknown";

export class Adapter {

    /**客户端集合 */
    private clients: Map<string, SWebSocket> = new Map();
    /**Redis 订阅对象 */
    private sub_redis: Redis = <Redis><unknown>undefined;
    /**Redis  */
    private pub_redis: Redis = <Redis><unknown>undefined;
    /**事件触发器 */
    private emitter: EventEmitter = new EventEmitter();
    private clientkeys: { [key: string]: string } = {};
    private tmpclientkeys: { [key: string]: string } = {};
    private data_redis: Redis = <Redis><unknown>undefined;

    constructor(private opts?: Options) {
        if(this.opts){
            this.sub_redis = new ioredis(this.opts);;
            this.pub_redis = new ioredis(this.opts);;
            this.data_redis = new ioredis(this.opts);;
    
            if (this.opts.password) {
                try {
                    this.sub_redis.auth(this.opts.password)
                    this.pub_redis.auth(this.opts.password)
                    this.data_redis.auth(this.opts.password)
                } catch (error) {
                    logger("constructor", error)
                }
            }
    
            this.sub_redis.subscribe(SYNC_EVENTS)
            this.sub_redis.on("message", (event: string, message: string) => {
                logger("redis-event", message)
                this.emitter.emit(event, JSON.parse(message))
            })
    
            this.emitter.on("emit_socket_message", this.emit_socket_message.bind(this))
        }
        
        logger("constructor", { opts: this.opts })
    }


    /**
     * @param channel 
     * @param os 
     * @param device 
     * @param browser 
     * @param roomid 
     * @param uid 
     * @param sid 
     */
    public async addUserRelation(channel:string, os:string, device:string, browser:string, roomid:string,  sid:string): Promise<void> {
        let key = `${REDIS_SOCKET_SERVICE_KEY}:${HOST_PROCESS}:C${channel}:O${os}:D${device}:B${browser}:R${roomid}:S${sid}`;
        if(this.data_redis){
            await this.data_redis.set(key, sid, "px", 1000 * 60 * 60 * 24);
        }
        else this.tmpclientkeys[this.clientkeys[key] = sid] = key;
    }

    /**
     * 移除客户端关系
     * @param {*} sid 
     */
    public async removeUserRelation(sid: string): Promise<void>{
        if(this.data_redis){
            let keys = await this.data_redis.keys(SID_KEY.replace(X, sid))
            for(let key of keys){
                await this.data_redis.del(key);
            }
        }
        else {
            delete this.clientkeys[this.tmpclientkeys[sid]];
            delete this.tmpclientkeys[sid];
        }
    }

    /**
     * 获取 ID 
     * @param {*} keyPattern Redis Key
     * @param {*} regExp 对应资源的正则
     */
    private async findIds(keyPattern: string, regExp: RegExp): Promise<string[]>{
        const keys = this.data_redis ? await this.data_redis.keys(keyPattern) :  Object.keys(this.clientkeys).filter(key => new RegExp(keyPattern.replace(/\*/g, ".*")).test(key))
        return this.matchIds(keys, regExp);
    }

    /**
     * 在 Keys 中获取 ID列表
     * @param {*} keys 
     * @param {*} keyPattern 
     * @param {*} regExp 
     */
    private findIdsByKeys(keys: string[], keyPattern: string, id: string, regExp: RegExp): string[] {
        const keyList = keys.filter(key => new RegExp(keyPattern.replace(X, id).replace(/\*/g, ".*")).test(key))
        return this.matchIds(keyList, regExp);
    }

    /**
     * 从 Key 中获取指定的 ID
     * @param {*} key 
     * @param {*} regExp 
     */
    private matchId(key: string, regExp: RegExp):string{
        return String(key).match(regExp)?.pop() + "";
    }
    /**
     * 从 Key 中获取指定的 ID
     * @param {*} keys 
     * @param {*} regExp 
     */
    private matchIds(keys:string[], regExp: RegExp): string[] {
        return [... new Set(keys.map(key => this.matchId(key, regExp)))];
    }

    /**
     * 根据房间ID获取所有的 Sid
     * @param {*} roomid 
     */
    public async findSidsByRoomid(roomid:string): Promise<string[]>{
        const results = await this.findIds(ROOM_ID_KEY.replace(X, roomid), SID_REGEXP);
        return results || [];
    }

    /**
     * 根据房间ID获取所有的 Uid
     * @param {*} roomid 
     */
    public async findUidsByRoomid(roomid:string): Promise<string[]>{
        const results = await this.findIds(ROOM_ID_KEY.replace(X, roomid), UID_REGEXP);
        return results || [];
    }

    /**
     * 根据 SID 获取房间ID
     * @param {*} uid 
     */
    public async findRoomidsBySid(sid:string): Promise<string[]>{
        const results = await this.findIds(SID_KEY.replace(X, sid), ROOM_ID_REGEXP);
        return (results || []).filter(id => id != SYSTEM_ROOMID);
    }

    /**
     * 根据 UID 获取 SID
     * @param {*} uid 
     */
    public async findSidsByRoomidAndUid(roomid:string, uid:string): Promise<string[]>{
        const results = await this.findIds(ALL_KEY.replace(/R\*/, roomid).replace(/U\*/, uid), SID_REGEXP);
        return results || [];
    }
    
    /**
     * 获取所有的 ROOMID
     */
    public async findAllRoomid(): Promise<string[]>{
        const results = await this.findIds(ALL_KEY, ROOM_ID_REGEXP);
        return (results || []).filter(id => id != SYSTEM_ROOMID);
    }
    
    /**
     * 获取所有的 channel
     */
    public async findAllEquipment(): Promise<string[]>{
        const results = await this.findIds(ALL_KEY, EQUIPMENT_REGEXP);
        return results || [];
    }

    /**获取所有的Sid */
    public async findAllSids(): Promise<string[]>{
        const results = await this.findIds(ALL_KEY, SID_REGEXP);
        return results || [];
    }

    /**
     * 根据 channel 获取 ROOMID
     * @param {*} channel 
     */
    public async findRoomidsByEquipment(equipment:string): Promise<string[]>{
        const results = await this.findIds(EQUIPMENT_KEY.replace(X, equipment), ROOM_ID_REGEXP);
        return results || [];
    }

    /**
     * 获取所有的 Keys
     */
    public async findAllKeys(): Promise<string[]>{
        const results = this.data_redis ? await this.data_redis.keys(ALL_KEY) : Object.keys(this.clientkeys);
        return results || [];
    }


    /**
     * 通过 Redis 进行多服务器消息同步
     * @param message 
     */
    private emit_socket_message(message: { id: string, data: Code.PackageData }) {
        let client = this.clients.get(message.id);
        if (client) {
            logger("emit_socket_message", message)
            client.response(
                message.data.path, 
                message.data.status, 
                message.data.msg, 
                0, 
                message.data.data
            );
        }
        else {
            this.delete(message.id);
        }
    }

    /**
     * 获取一个 Socket 客户端对象
     * @param id 
     */
    public get(id: string): SWebSocket {
        return <SWebSocket>this.clients.get(id);
    }

    /**
     * 增加一个 Socket 连接
     * @param {*} id 
     * @param {*} socket 
     */
    public async set(socket: SWebSocket): Promise<SWebSocket> {
        logger("set", socket.getid())
        this.clients.set(socket.getid(), socket);
        this.addUserRelation("summer01", socket.os, socket.device, socket.browser, SYSTEM_ROOMID, socket.getid());
        return socket;
    }

    /**
     * 删除一个 Socket 连接
     * @param {*} id 
     */
    public async delete(id: string) {
        logger("delete", id)
        this.clients.delete(id);
        this.removeUserRelation(id);
    }

    /**
     * 加入房间
     * @param id 
     * @param room 
     */
    public async join(id: string, room: string){
        logger("join", id, room)
        let socket = this.get(id);
        this.addUserRelation("summer01", socket.os, socket.device, socket.browser, room, socket.getid());
    }

    /**
     * 离开房间
     * @param id 
     * @param room 
     */
    public async leave(id:string, room: string){
        logger("leave", id, room)
        if(this.data_redis){
            let keys = await this.data_redis.keys(ALL_KEY.replace(/R\*/, room).replace(/S\*/, id))
            for(let key of keys){
                await this.data_redis.del(key);
            }
        }
        else {
            delete this.clientkeys[this.tmpclientkeys[id]];
            delete this.tmpclientkeys[id];
        }
    }

    /**
     * 获取所有的房间号
     */
    public async getRoomall(): Promise<string[]>{
        return await this.findAllRoomid();
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room 
     */
    public async getClientidByroom(room: string): Promise<string[]>{
        return await this.findSidsByRoomid(room);
    }

    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id 
     */
    public async getRoomidByid(id: string): Promise<string[]>{
        return await this.findRoomidsBySid(id);
    }

    /**
     * 判断客户端是否存在啊某个房间
     * @param id 
     * @param room 
     */
    public async hasRoom(id: string, room: string): Promise<boolean> {
        let sids = await this.findSidsByRoomid(room);
        return sids.includes(id);
    }

    /**
     * 获取所有的房间总数
     */
    public async getAllRoomcount(): Promise<number> {
        let rooms = await this.findAllRoomid();
        return rooms.length - 1;
    }

    /**
     * 获取房间内人员数量
     * @param room 
     */
    public async getRoomsize(room: string): Promise<number>{
        let sids = await this.findSidsByRoomid(room);
        return sids.length;
    }

    /**
     * 发送房间消息
     * @param room 
     * @param event 
     * @param data 
     * @param status 
     * @param msg 
     */
    public async sendRoomMessage(room: string, event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        for(let id of await this.getClientidByroom(room)){
            this.sendSocketMessage(id, event, data, status, msg)
        }
    }

    /**
     * 发送广播消息
     * @param event 
     * @param data 
     * @param status 
     * @param msg 
     */
    public async sendBroadcast(event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        for(let sid of await this.getClientidByroom(SYSTEM_ROOMID)) {
            this.sendSocketMessage(sid, event, data, status, msg);
        }
    }

    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data 
     */
    public async sendSocketMessage(id: string, event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        logger("sendSocketMessage", { id, data })
        if(this.pub_redis){
            this.pub_redis.publish("emit_socket_message", JSON.stringify({ id, data:{ path: event, status, msg, data } }))
        }
        else {
            this.emit_socket_message({ id, data:{ path: event, data, status, msg, request_id: 0 }} )
        }
    }
}