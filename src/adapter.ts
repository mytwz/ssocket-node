/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-04-26 16:51:46 +0800
 * @LastEditTime: 2021-08-03 11:16:06 +0800
 * @FilePath: /ssocket/src/adapter.ts
 */

import { connect, Channel, ConsumeMessage, Connection } from "amqplib";
import { SWebSocket } from "./client";
import CODE, * as Code from "./code";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { EventEmitter } from 'events';
import debug from "./logger";
import os from "os";
import { id24 } from "./utils"
const msgpack = require("notepack.io");

const logger = debug("adapter")

const REDIS_SURVIVAL_KEY = `ssocket-survival:${os.hostname()}:${process.pid}`

let __mqconnect: Connection;
let __mqsub: Channel;
let __mqpub: Channel;
let __redisdata: Redis;

ioredis.prototype.keys = async function (pattern: string) {
    let cursor = 0;
    let list: string[] = [];
    do {
        let res = await this.scan(cursor, "match", pattern, "count", 2000);
        cursor = +res[0];
        list = list.concat(res[1]);
    } while (cursor != 0);

    return list;
}

enum RequestMethod {
    join = 0,
    leave,
    broadcast,
    getRoomall,
    getClientidByroom,
    getRoomidByid,
    ////////////////////
    response,

    checkChannel
}

enum BroadcastType {
    room = 0, all, socket
}

type ResponseCallback<T> = (this: Adapter, result: T) => void;

/**配置 */
export interface Options {
    redis?: RedisOptions;
    mqurl?: string;
    requestsTimeout?: number;
    key?: string;
    [key: string]: any;
}

export class Adapter extends EventEmitter {

    public readonly uid: string;
    public readonly requestsTimeout: number;

    private readonly clients: Map<string/**sid */, SWebSocket> = new Map();
    private readonly rooms: Map<string/**roomid */, Set<string/**sid */>> = new Map();
    private readonly client2rooms: Map<string/**sid */, Set<string/**roomid */>> = new Map();
    private readonly channel: string;
    private readonly requests: Map<string, Function> = new Map();
    private readonly cluster: boolean;
    private readonly msgbuffers: Buffer[] = [];
    private survivalid:any = 0;
    private ispublish: boolean = false;

    constructor(private opt: Options) {
        super();
        this.uid = id24();
        this.requestsTimeout = this.opt?.requestsTimeout || 5000;
        this.channel = `${(this.opt.key || "key")}-ssocket-adapter-message`;
        this.cluster = Boolean(this.opt.redis && this.opt.mqurl)
        this.init();
    }

    async init() {
        if(this.cluster){
            console.log("开始初始化")
            this.ispublish = true;
            clearInterval(this.survivalid)
            try {
                if (__redisdata) __redisdata.disconnect()
            } catch (error) { console.log(REDIS_SURVIVAL_KEY, error) }
            
            __redisdata = new ioredis(this.opt.redis);
            if(this.opt.redis?.password) __redisdata.auth(this.opt.redis.password).then(_=> logger("redis", "Password verification succeeded"))

            this.survivalid = setInterval(this.survivalHeartbeat.bind(this), 1000);

            // 如果 MQ  连接失败了就一切都重新来一遍
            this.intiMQ().catch(this.init.bind(this));
        }
    }


    private　async intiMQ(){
        try {
            if (__mqsub) __mqsub.close();
        } catch (error) { console.log(REDIS_SURVIVAL_KEY, error) }

        try {
            if (__mqpub) __mqpub.close();
        } catch (error) { console.log(REDIS_SURVIVAL_KEY, error) }

        try {
            if (__mqconnect) {
                if((<any>__mqconnect).connection.heartbeater) (<any>__mqconnect).connection.heartbeater.clear()
                __mqconnect.close();
            }
        } catch (error) { console.log(REDIS_SURVIVAL_KEY, error) }
        __mqsub = __mqpub = __mqconnect = <any>null;
        __mqconnect = await connect(this.opt.mqurl+"");
        __mqconnect.on("error", this.checkChannel.bind(this))
        __mqsub = await __mqconnect.createChannel();
        await __mqsub.assertExchange(this.channel, "fanout", { durable: false });
        let qok = await __mqsub.assertQueue("", { exclusive: false, autoDelete:true, durable: false }); logger("QOK", qok);
        await __mqsub.bindQueue(qok.queue, this.channel, "");
        await __mqsub.consume(qok.queue, this.onmessage.bind(this), { noAck: true })

        __mqpub = await __mqconnect.createChannel();
        await __mqpub.assertExchange(this.channel, "fanout", { durable: false });
        console.log(`[${REDIS_SURVIVAL_KEY}]["建立 MQ 消息通道完成", ${JSON.stringify(qok)}]`)
        this.ispublish = false;
        this.startPublish();
    }

    private checkChannel() {
        console.log(`[${REDIS_SURVIVAL_KEY}]["MQ 消息通道超时响应，开始重新建立连接"]`);
        this.init();
    }

    private survivalHeartbeat(){
        if(__redisdata){
            __redisdata.set(REDIS_SURVIVAL_KEY, 1, "ex", 2);
        }
    }

    /**获取所有存活主机的数量 */
    private async allSurvivalCount(): Promise<number> {
        let keys = await __redisdata.keys(`ssocket-survival:*`);
        return keys.length;
    }

    
    private startPublish(){
        if(this.ispublish === false && __mqpub){
            let msg = null;
            try {
                this.ispublish = true;
                while (msg = this.msgbuffers.pop()) {
                    __mqpub.publish(this.channel, "", msg);
                }
                this.ispublish = false;
            } catch (error) {
                msg && this.msgbuffers.unshift(msg)
                this.init();
                console.log(REDIS_SURVIVAL_KEY, error)
            }
        }
    }

    private async publish(msg: Buffer): Promise<void> {
        this.msgbuffers.push(msg);
        this.startPublish();
    }

    private async onmessage(msg: ConsumeMessage | null): Promise<void> {
        if (msg && msg.content) {
            try {

                const args = msgpack.decode(msg.content);
                const type = args.shift();
                const uid = args.shift();
                const requestid = args.shift();

                switch (type) {
                    case RequestMethod.response: {
                        if (this.uid === uid) {
                            this.requests.get(requestid)?.call(this, args.shift());
                        }
                        break;
                    }
                    case RequestMethod.getRoomall: {
                        this.publish(msgpack.encode([RequestMethod.response, uid,　requestid, [...this.rooms.keys()]]))
                        break;
                    }
                    case RequestMethod.getClientidByroom: {
                        this.publish(msgpack.encode([RequestMethod.response, uid,　requestid, [...(this.rooms.get(args.shift()) || [])]]))
                        break;
                    }
                    case RequestMethod.getRoomidByid: {
                        this.publish(msgpack.encode([RequestMethod.response, uid,　requestid, [...(this.client2rooms.get(args.shift()) || [])]]))
                        break;
                    }
                    case RequestMethod.broadcast: {
                        switch (args.shift()) {
                            case BroadcastType.room:{
                                let room = args.shift();
                                let [event, data, status, msg] = args.shift();
                                for(let id of this.rooms.get(room) || []){
                                    this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                }
                                break;
                            }
                            case BroadcastType.socket:{
                                let id = args.shift();
                                let [event, data, status, msg] = args.shift();
                                this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                break;
                            }
                            case BroadcastType.all:{
                                let [event, data, status, msg] = args.shift();
                                for(let id of this.clients.keys() || []){
                                    this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
                                }
                                break;
                            }
                            default:
                                break;
                        }
                        break;
                    }
                    
                    default:
                }

            } catch (error) {
                this.emit("error", error);
            }
        }
    }

    
    private emitSocketMessage(id: string, event: string, data: any, status: number, msg: string) {
        let client = this.clients.get(id);
        if (client) {
            client.response(event, status, msg, 0, data);
        }
        else {
            this.delete(id);
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
    public set(socket: SWebSocket): SWebSocket {
        logger("set", socket.getid())
        this.clients.set(socket.getid(), socket);
        return socket;
    }

    /**
     * 删除一个 Socket 连接
     * @param {*} id 
     */
    public delete(id: string) {
        logger("delete", id)
        this.clients.delete(id);
        for (let roomid of this.client2rooms.get(id) || []) {
            this.rooms.get(roomid)?.delete(id);
        }
        this.client2rooms.delete(id);
    }

    /**
     * 加入房间
     * @param id 
     * @param room 
     */
    public join(id: string, room: string) {
        logger("join", id, room)
        room = String(room);
        id = String(id);
        if (!this.rooms.has(room)) this.rooms.set(room, new Set());
        if (!this.client2rooms.has(id)) this.client2rooms.set(id, new Set());

        this.client2rooms.get(id)?.add(room);
        this.rooms.get(room)?.add(id);
    }

    /**
     * 离开房间
     * @param id 
     * @param room 
     */
    public leave(id: string, room: string) {
        logger("leave", id, room)
        room = String(room);
        id = String(id);

        this.client2rooms.get(id)?.delete(room);
        this.rooms.get(room)?.delete(id);
    }


    /**
     * 获取所有的房间号
     */
    public async getRoomall(): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            if(!this.cluster){
                return resolve([...this.rooms.keys()]);
            }
            let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getRoomall] message timed out"), this.requestsTimeout);
            let requestid = id24();
            let servercount = await this.allSurvivalCount();
            let result:string[] = [];
            let callback:(this: this, rooms:string[]) => void = function(rooms: string[]){
                if(--servercount > 0){
                    result = result.concat(rooms)
                }
                else {
                    this.requests.delete(requestid)
                    clearInterval(requestoutid)
                    result = result.concat(rooms)
                    resolve(result)
                }
            }
            let msg = msgpack.encode([RequestMethod.getRoomall, this.uid, requestid])
            this.publish(msg)
            this.requests.set(requestid, callback);
        })
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room 
     */
    public async getClientidByroom(room: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            room = String(room);
            if(!this.cluster){
                return resolve([...this.rooms.get(room) || []]);
            }
            let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getClientidByroom] message timed out"), this.requestsTimeout);
            let requestid = id24();
            let servercount = await this.allSurvivalCount();
            let result:string[] = []
            let callback: ResponseCallback<string[]> = function(sockets: string[]){
                if(--servercount > 0){
                    result = result.concat(sockets)
                }
                else {
                    this.requests.delete(requestid)
                    clearInterval(requestoutid)
                    result = result.concat(sockets)
                    resolve(result)
                }
            }
            let msg = msgpack.encode([RequestMethod.getClientidByroom, this.uid, requestid, room])
            this.publish(msg)
            this.requests.set(requestid, callback);
        })
    }

    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id 
     */
    public async getRoomidByid(id: string): Promise<string[]> {
        return new Promise(async (resolve, reject) => {
            id = String(id);
            if(!this.cluster){
                return resolve([...this.client2rooms.get(id) || []]);
            }
            let requestoutid = setTimeout(_ => reject("Waiting for MQ to return [getRoomidByid] message timed out"), this.requestsTimeout);
            let requestid = id24();
            let servercount = await this.allSurvivalCount();
            let result:string[] = []
            let callback: ResponseCallback<string[]> = function(rooms: string[]){
                if(--servercount > 0){
                    result = result.concat(rooms)
                }
                else {
                    this.requests.delete(requestid)
                    clearInterval(requestoutid)
                    result = result.concat(rooms)
                    resolve(result)
                }
            }
            let msg = msgpack.encode([RequestMethod.getRoomidByid, this.uid, requestid, id])
            this.publish(msg)
            this.requests.set(requestid, callback);
        })
    }

    /**
     * 判断客户端是否存在啊某个房间
     * @param id 
     * @param room 
     */
    public async hasRoom(id: string, room: string): Promise<boolean> {
        id = String(id);
        room = String(room);
        let rooms = await this.getRoomidByid(id);
        return rooms.includes(room);
    }

    /**
     * 获取所有的房间总数
     */
    public async getAllRoomcount(): Promise<number> {
        let rooms = await this.getRoomall();
        return rooms.length;
    }

    /**
     * 获取房间内人员数量
     * @param room 
     */
    public async getRoomsize(room: string): Promise<number> {
        let clients = await this.getClientidByroom(room);
        return clients.length;
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
        room = String(room)
        if(!this.cluster){
            for(let id of this.rooms.get(room) || []){
                this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
            }
            return ;
        }
        this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.room, room,　[ event, data, status, msg ]]));
    }

    /**
     * 发送广播消息
     * @param event 
     * @param data 
     * @param status 
     * @param msg 
     */
    public async sendBroadcast(event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        if(!this.cluster){
            for(let id of this.clients.keys() || []){
                this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
            }
            return ;
        }
        this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.all, [ event, data, status, msg ]]));
    }

    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data 
     */
    public async sendSocketMessage(id: string, event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        id = String(id)
        if(!this.cluster){
            this.emitSocketMessage.apply(this, [id, event, data, status, msg]);
            return ;
        }
        this.publish(msgpack.encode([RequestMethod.broadcast, this.uid, 0, BroadcastType.socket, id,　[ event, data, status, msg ]]));
    }
}

