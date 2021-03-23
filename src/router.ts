import { pathToRegexp, Key } from 'path-to-regexp';
import { EventEmitter } from 'events';
import debug from "./logger";
import { PackageData } from "./code"

/**中间件 */
export type Middleware = (ctx: PackageData, next: Function | Middleware) => any

/**异常中间件 */
export type MiddlewareError = (ctx: PackageData, error: Error) => any;

interface ParamNames extends Key {
    name: string | number;
    prefix: string;
    suffix: string;
    pattern: string;
    modifier: string;
}

interface Options {
    name?: string;
    end?: boolean;
    sensitive?: boolean;
    strict?: boolean;
    prefix?: string;
    ignoreCaptures?: boolean;
}

const logger = debug("router")

const emitter = new EventEmitter();

/**路由对象 */
class Layer {

    opts: Options;
    /**节点名称 */
    path: string;
    paramNames: ParamNames[];
    /**中间件调用栈 */
    stack: Middleware[];
    /**节点匹配正则 */
    regexp: RegExp;
    name?: string;
    /**
     * 节点构造器
     * @param path 节点名称
     * @param middleware 中间件列表
     * @param opts 配置
     */
    constructor(path: string, middleware: Middleware | Middleware[], opts: Options = {}) {
        this.opts = opts
        this.path = path;
        this.paramNames = [];
        this.stack = Array.isArray(middleware) ? middleware : [middleware];
        this.regexp = pathToRegexp(path, this.paramNames, this.opts);
        this.name = opts.name;
    }

    /**
     * 判断路径是否匹配此路由
     * @param path 
     */
    match(path: string): boolean {
        return this.regexp.test(path);
    }

    /**
     * 设置节点头部
     * @param prefix 
     */
    setPrefix(prefix: string) {
        if (this.path) {
            this.path = prefix + this.path;
            this.paramNames = [];
            this.regexp = pathToRegexp(this.path, this.paramNames, this.opts);
        }

        return this;
    }
}


/**
 * 生成路由栈调用函数
 * @param middleware 
 */
function compose(middleware: Middleware[]): Middleware {
    /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */
    return function (context: any, next: Middleware | Function): Promise<any> {
        // last called middleware #
        let index = -1
        function dispatch(i: number): Promise<any> {
            if (i <= index) return Promise.reject(new Error('next() called multiple times'))
            index = i
            let fn = middleware[i]
            // 最后一个
            if (i === middleware.length) fn = <Middleware>next
            if (!fn) return Promise.resolve()
            try {
                return Promise.resolve(fn(context, function next() {
                    return dispatch(i + 1)
                }))
            } catch (err) {
                return Promise.reject(err)
            }
        }

        return dispatch(0)
    }
}

/**
 * 路由节点
 */
export class Router extends EventEmitter {

    /**路由栈 */
    private stack: Layer[] = [];
    private opts: any = {};
    public get emitter(){ return emitter }

    constructor(){
        super();
        logger("constructor")
    }

    /**
     * 创建并注册一条路线
     * @param path 
     * @param middleware 
     * @param opts 
     */
    private register(path: string, middleware: Middleware | Middleware[], opts: Options = {}) {
        // create route
        var route = new Layer(path, middleware, {
            end: opts.end === false ? opts.end : true,
            name: opts.name,
            sensitive: false,
            strict: false,
            prefix: "",
            ignoreCaptures: opts.ignoreCaptures
        });
        logger("register", { path, middleware, opts, route })
        this.stack.push(route);
        return route;
    }

    /**
     * 从路径获取到匹配的路由节点
     * @param path 
     */
    private match(path: string): Layer[] {

        var layer;
        var matchedLayers = [];

        for (var len = this.stack.length, i = 0; i < len; i++) {
            layer = this.stack[i];

            if (layer.match(path)) {
                matchedLayers.push(layer);
            }
        }
        
        logger("match", { path, matchedLayers })

        return matchedLayers;
    }

    /**
     * 绑定节点函数
     * @param path 
     * @param middleware 
     */
    public ONPath(path: string, ...middleware: Middleware[]): Router {
        logger("ONPath", { path, middleware })
        this.register(path, middleware, { name: path });
        return this;
    }

    /**
     * 绑定节点树
     * @param middleware 
     */
    public USEPathMiddleware(path:string, ...middleware: Middleware[]): Router {
        var router = this;
        middleware.forEach(function (m) {
            if (m.prototype.router) {
                m.prototype.router.stack.forEach(function (nestedLayer: Layer) {
                    nestedLayer.setPrefix(<string>path);
                    if (router.opts.prefix) nestedLayer.setPrefix(router.opts.prefix);
                    router.stack.push(nestedLayer);
                });

            } else {
                router.register(<string>path, m, { end: false, ignoreCaptures: false });
            }
        });

        logger("USEPathMiddleware", { path, middleware })
        return this;
    }

    public USEMiddleware(...middleware: Middleware[]): Router {
        var router = this;
        middleware.forEach(function (m) {
            if (m.prototype && m.prototype.router) {
                m.prototype.router.stack.forEach(function (nestedLayer: Layer) {
                    if (router.opts.prefix) nestedLayer.setPrefix(router.opts.prefix);
                    router.stack.push(nestedLayer);
                });

            } else {
                router.register('(.*)', m, { end: false, ignoreCaptures: true });
            }
        });
        logger("USEPathMiddleware", { middleware })
        return this;
    }

    /**
     * 获取路由调用方法
     */
    public get routes() {
        var router = this;
        var dispatch = function dispatch(ctx: PackageData, next?: any): Promise<any> {
            var layerChain = router.match(ctx.path).reduce(function (memo: Middleware[], layer) {
                return memo.concat(layer.stack);
            }, []);

            return compose(layerChain)(ctx, next);
        };
        dispatch.prototype.router = this;
        logger("routes", { dispatch })
        return dispatch;
    }
}
