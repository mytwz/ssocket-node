"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
const path_to_regexp_1 = require("path-to-regexp");
const events_1 = require("events");
const logger_1 = __importDefault(require("./logger"));
const logger = logger_1.default("router");
const emitter = new events_1.EventEmitter();
/**路由对象 */
class Layer {
    /**
     * 节点构造器
     * @param path 节点名称
     * @param middleware 中间件列表
     * @param opts 配置
     */
    constructor(path, middleware, opts = {}) {
        this.opts = opts;
        this.path = path;
        this.paramNames = [];
        this.stack = Array.isArray(middleware) ? middleware : [middleware];
        this.regexp = path_to_regexp_1.pathToRegexp(path, this.paramNames, this.opts);
        this.name = opts.name;
    }
    /**
     * 判断路径是否匹配此路由
     * @param path
     */
    match(path) {
        return this.regexp.test(path);
    }
    /**
     * 设置节点头部
     * @param prefix
     */
    setPrefix(prefix) {
        if (this.path) {
            this.path = prefix + this.path;
            this.paramNames = [];
            this.regexp = path_to_regexp_1.pathToRegexp(this.path, this.paramNames, this.opts);
        }
        return this;
    }
}
/**
 * 生成路由栈调用函数
 * @param middleware
 */
function compose(middleware) {
    /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */
    return function (context, next) {
        // last called middleware #
        let index = -1;
        function dispatch(i) {
            if (i <= index)
                return Promise.reject(new Error('next() called multiple times'));
            index = i;
            let fn = middleware[i];
            // 最后一个
            if (i === middleware.length)
                fn = next;
            if (!fn)
                return Promise.resolve();
            try {
                return Promise.resolve(fn(context, function next() {
                    return dispatch(i + 1);
                }));
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
        return dispatch(0);
    };
}
/**
 * 路由节点
 */
class Router extends events_1.EventEmitter {
    constructor() {
        super();
        /**路由栈 */
        this.stack = [];
        this.opts = {};
        logger("constructor");
    }
    get emitter() { return emitter; }
    /**
     * 创建并注册一条路线
     * @param path
     * @param middleware
     * @param opts
     */
    register(path, middleware, opts = {}) {
        // create route
        var route = new Layer(path, middleware, {
            end: opts.end === false ? opts.end : true,
            name: opts.name,
            sensitive: false,
            strict: false,
            prefix: "",
            ignoreCaptures: opts.ignoreCaptures
        });
        logger("register", { path, middleware, opts, route });
        this.stack.push(route);
        return route;
    }
    /**
     * 从路径获取到匹配的路由节点
     * @param path
     */
    match(path) {
        var layer;
        var matchedLayers = [];
        for (var len = this.stack.length, i = 0; i < len; i++) {
            layer = this.stack[i];
            if (layer.match(path)) {
                matchedLayers.push(layer);
            }
        }
        logger("match", { path, matchedLayers });
        return matchedLayers;
    }
    /**
     * 绑定节点函数
     * @param path
     * @param middleware
     */
    ONPath(path, ...middleware) {
        logger("ONPath", { path, middleware });
        this.register(path, middleware, { name: path });
        return this;
    }
    /**
     * 绑定节点树
     * @param middleware
     */
    USEPathMiddleware(path, ...middleware) {
        var router = this;
        middleware.forEach(function (m) {
            if (m.prototype.router) {
                m.prototype.router.stack.forEach(function (nestedLayer) {
                    nestedLayer.setPrefix(path);
                    if (router.opts.prefix)
                        nestedLayer.setPrefix(router.opts.prefix);
                    router.stack.push(nestedLayer);
                });
            }
            else {
                router.register(path, m, { end: false, ignoreCaptures: false });
            }
        });
        logger("USEPathMiddleware", { path, middleware });
        return this;
    }
    USEMiddleware(...middleware) {
        var router = this;
        middleware.forEach(function (m) {
            if (m.prototype && m.prototype.router) {
                m.prototype.router.stack.forEach(function (nestedLayer) {
                    if (router.opts.prefix)
                        nestedLayer.setPrefix(router.opts.prefix);
                    router.stack.push(nestedLayer);
                });
            }
            else {
                router.register('(.*)', m, { end: false, ignoreCaptures: true });
            }
        });
        logger("USEPathMiddleware", { middleware });
        return this;
    }
    /**
     * 获取路由调用方法
     */
    get routes() {
        var router = this;
        var dispatch = function dispatch(ctx, next) {
            var layerChain = router.match(ctx.path).reduce(function (memo, layer) {
                return memo.concat(layer.stack);
            }, []);
            return compose(layerChain)(ctx, next);
        };
        dispatch.prototype.router = this;
        logger("routes", { dispatch });
        return dispatch;
    }
}
exports.Router = Router;
