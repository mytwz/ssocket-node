/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @LastEditTime: 2021-03-23 18:12:39 +0800
 * @FilePath: /ssocket/src/adapter.ts
 */

import { SWebSocket } from "./client";
import CODE, * as Code from "./code";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { EventEmitter } from 'events';
import debug from "./logger";

/**配置 */
export interface Options extends RedisOptions {
    
    [key: string]: any;
}

const logger = debug("adapter")

const REDIS_ROOM_PREFIX = "ssocket:rooms:room"

/**系统事件 */
const SYNC_EVENTS: string[] = [
    "emit_socket_message",
]

export class Adapter {

    /**客户端集合 */
    private clients: Map<string, SWebSocket> = new Map();
    /**Redis 订阅对象 */
    private sub_redis: Redis = <Redis><unknown>undefined;
    /**Redis  */
    private pub_redis: Redis = <Redis><unknown>undefined;
    private data_redis: Redis = <Redis><unknown>undefined;
    /**事件触发器 */
    private emitter: EventEmitter = new EventEmitter();
    private rooms: { [room: string]: Set<string> } = {};

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
        return socket;
    }

    /**
     * 删除一个 Socket 连接
     * @param {*} id 
     */
    public async delete(id: string) {
        logger("delete", id)
        this.clients.delete(id);
        for(let room of await this.getRoomidByid(id)){
            await this.leave(id, room);
        }
    }

    /**
     * 加入房间
     * @param id 
     * @param room 
     */
    public async join(id: string, room: string){
        logger("join", id, room)
        if(this.data_redis) {
            await this.data_redis.sadd(REDIS_ROOM_PREFIX.replace(/room/, room), id)
        }
        else {
            (this.rooms[room] = this.rooms[room] || new Set()).add(id)
        }
    }

    /**
     * 离开房间
     * @param id 
     * @param room 
     */
    public async leave(id:string, room: string){
        logger("leave", id, room)
        if(this.data_redis) {
            await this.data_redis.srem(REDIS_ROOM_PREFIX.replace(/room/, room), 0, id)
        }
        else {
            (this.rooms[room] = this.rooms[room] || new Set()).delete(id)
        }
    }

    /**
     * 获取所有的房间号
     */
    public async getRoomall(): Promise<string[]>{
        if(this.data_redis) {
            let cursor = 0;
            let list:string[] = [];
            do {
              let res = await this.data_redis.scan(cursor, "match", REDIS_ROOM_PREFIX.replace(/room/, "*"), "count", 2000);
              cursor = +res[0];
              list = list.concat(res[1]);
            } while (cursor != 0);

            return list.map(key => key.replace(REDIS_ROOM_PREFIX.replace(/room/, ""), ""));
        }
        else {
            return Object.keys(this.rooms)
        }
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room 
     */
    public async getClientidByroom(room: string): Promise<string[]>{
        if(this.data_redis) {
            return await this.data_redis.smembers(REDIS_ROOM_PREFIX.replace(/room/, room))
        }
        else {
            let ids: string[] = [];
            (this.rooms[room] || new Set()).forEach(id => ids.push(id))
            return ids;
        }
    }

    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id 
     */
    public async getRoomidByid(id: string): Promise<string[]>{
        if(this.data_redis) {
            let rooms: string[] = [];
            for(let room of await this.getRoomall()){
                let flog = await this.hasRoom(room, id);
                if(flog) rooms.push(room);
            }
            return rooms;
        }
        else {
            let rooms: string[] = [];
            for(let room in this.rooms){
                if(this.rooms[room].has(id)) rooms.push(room);
            }
            return rooms;
        }
    }

    /**
     * 判断客户端是否存在啊某个房间
     * @param id 
     * @param room 
     */
    public async hasRoom(id: string, room: string): Promise<boolean> {
        if(this.data_redis){
            return Boolean(await this.data_redis.sismember(REDIS_ROOM_PREFIX.replace(/room/, room), id));
        }
        else {
            return (this.rooms[room] || new Set()).has(id)
        }
    }

    /**
     * 获取所有的房间总数
     */
    public async getAllRoomcount(): Promise<number> {
        if(this.data_redis) {
            let rooms = await this.getRoomall();
            return rooms.length;
        }
        else {
            return Object.keys(this.rooms).length;
        }
    }

    /**
     * 获取房间内人员数量
     * @param room 
     */
    public async getRoomsize(room: string): Promise<number>{
        if(this.data_redis) {
            return await this.data_redis.scard(REDIS_ROOM_PREFIX.replace(/room/, room))
        }
        else {
            return this.rooms[room] ? this.rooms[room].size : 0;
        }
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
        for(let room of await this.getRoomall()) {
            this.sendRoomMessage(room, event, data, status, msg);
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