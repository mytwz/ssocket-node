/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主类，
 * @LastEditTime: 2021-03-23 17:05:19 +0800
 * @FilePath: /ssocket/src/application.ts
 */

import { IncomingMessage } from "http";
import { Server, ServerOptions } from "ws";
import { EventEmitter } from 'events';
import { Options } from "./adapter"
import { Adapter } from "./adapter"
import { SWebSocket } from "./client";
import WebSocket from "ws";
import { Router } from "./router";
import CODE, * as Code from "./code"
import DEBUG from "debug";
import debug from "./logger";

const logger = debug("application")

type loggerFun = (name: string, message: string) => void

export interface SOptions extends ServerOptions {
    redis?: Options,
    protos?: {
        request?: {[key: string]: any};
        response?: {[key: string]: any};
        
    };
    logger: boolean | string | loggerFun;
    [key: string]: any;
}

export class Application extends EventEmitter {
    
    private __server: Server;
    private __adapter: Adapter;
    private __router: Router = new Router();

    public get server(): Server { return this.__server; }
    public get adapter(): Adapter { return this.__adapter; }
    public get router(): Router { return this.__router; }

    constructor(private opts: SOptions) {
        super();
        this.__adapter = new Adapter(this.opts.redis);
        this.__server = new Server(this.opts, () => this.emit("start-up"));
        if(this.opts.protos){
            if(this.opts.protos.request) Code.parseRequestJson(this.opts.protos.request)
            if(this.opts.protos.response) Code.parseResponseJson(this.opts.protos.response)
        }
        
        if(this.opts.logger instanceof Function){
            DEBUG.prototype.logger = this.opts.logger;
        }
        else if(typeof this.opts.logger == "string"){
            DEBUG.enable(this.opts.logger)
        }
        else if(this.opts.logger){
            DEBUG.enable("*")
        }

        this.__server.on("connection", (socket: WebSocket, req: IncomingMessage) => {
            logger("connection", { url: req.url, rawHeaders: req.rawHeaders })
            let client: SWebSocket = new SWebSocket(socket)
            client.on("close", (id: string, code: number, reason: string) => {
                this.__adapter.delete(id);
                this.emit("close", id, code, reason);
            })
            client.on("message", (ctx: Code.PackageData) => {
                ctx.socket_id = client.getid();
                ctx.socket = client;
                ctx.app = ctx.application = this;
                this.__router.routes(ctx).then((res: any | Array<any>) => {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.application;
                    logger("routes", { ctx, res })
                    if(ctx.request_id){
                        ctx.status = <number>CODE[200][0];
                        ctx.msg = <string>CODE[200][1];
                        ctx.data = undefined;
                        if (Array.isArray(res) && res[0] in CODE) {
                            //状态码
                            ctx.status = res[0];
                            ctx.msg = res[1];
                        }
                        else ctx.data = typeof(res) == "object" ? res : { data: res };
                        client.response(ctx.path, ctx.status, ctx.msg, ctx.request_id, ctx.data);
                    }
                }).catch(err => {
                    delete ctx.socket_id;
                    delete ctx.socket;
                    delete ctx.application;
                    client.response(ctx.path, <number>CODE[4103][0], <string>CODE[4103][1], 0, undefined);
                    client.emit("route-error", ctx, err)
                    this.emit("route-error", ctx, err)
                    logger("routes-error", { ctx, err })
                });
            })
            client.on("reconnection", id => {
                this.__adapter.set(client)
                this.emit("reconnection", client, id);
            })
            client.on("connection", id => {
                this.__adapter.set(client)
                this.emit("connection", client, req);
            })
        })

        logger("constructor", { opts: this.opts })
    }

    /**
     * 加入房间
     * @param id 
     * @param room 
     */
    public async join(id: string, room: string){
        await this.adapter.join(id, room)
    }

    /**
     * 离开房间
     * @param id 
     * @param room 
     */
    public async leave(id:string, room: string){
        await this.adapter.leave(id, room)
    }

    /**
     * 获取所有的房间号
     */
    public async getRoomall(): Promise<string[]> {
        return await this.adapter.getRoomall();
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room 
     */
    public async getClientidByroom(room: string): Promise<string[]> {
        return await this.adapter.getClientidByroom(room)
    }
    
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id 
     */
    public async getRoomidByid(id: string): Promise<string[]>{
        return await this.adapter.getRoomidByid(id);
    }
    /**
     * 获取所有的房间总数
     */
    public async getAllRoomcount(): Promise<number> {
        return await this.adapter.getAllRoomcount()
    }
    /**
     * 获取房间内人员数量
     * @param room 
     */
    public async getRoomsize(room: string): Promise<number>{
        return await this.adapter.getRoomsize(room)
    }
    /**
     * 判断客户端是否存在啊某个房间
     * @param id 
     * @param room 
     */
    public async hasRoom(id: string, room: string): Promise<boolean> {
        return await this.adapter.hasRoom(id, room);
    }
    /**
     * 发送多服同步消息
     * @param id 
     * @param event 
     * @param data 
     */
    public async sendSocketMessage(id: string, event: string, data: any){
        await this.adapter.sendSocketMessage(id, event, data);
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
        await this.adapter.sendRoomMessage(room, event, data, status, msg)   ;
    }

    /**
     * 发送广播消息
     * @param event 
     * @param data 
     * @param status 
     * @param msg 
     */
    public async sendBroadcast(event: string, data: any, status: number = <number>CODE[200][0], msg: string = <string>CODE[200][1]) {
        await this.adapter.sendBroadcast(event, data, status, msg);
    }

}
