/// <reference types="node" />
import { EventEmitter } from 'events';
import { PackageData } from "./code";
/**中间件 */
export declare type Middleware = (ctx: PackageData, next: Function | Middleware) => any;
/**异常中间件 */
export declare type MiddlewareError = (ctx: PackageData, error: Error) => any;
/**
 * 路由节点
 */
export declare class Router extends EventEmitter {
    /**路由栈 */
    private stack;
    private opts;
    get emitter(): EventEmitter;
    constructor();
    /**
     * 创建并注册一条路线
     * @param path
     * @param middleware
     * @param opts
     */
    private register;
    /**
     * 从路径获取到匹配的路由节点
     * @param path
     */
    private match;
    /**
     * 绑定节点函数
     * @param path
     * @param middleware
     */
    ONPath(path: string, ...middleware: Middleware[]): Router;
    /**
     * 绑定节点树
     * @param middleware
     */
    USEPathMiddleware(path: string, ...middleware: Middleware[]): Router;
    USEMiddleware(...middleware: Middleware[]): Router;
    /**
     * 获取路由调用方法
     */
    get routes(): (ctx: PackageData, next?: any) => Promise<any>;
}
