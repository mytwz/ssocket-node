"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
var path_to_regexp_1 = require("path-to-regexp");
var events_1 = require("events");
var logger_1 = __importDefault(require("./logger"));
var logger = logger_1.default("router");
var emitter = new events_1.EventEmitter();
/**路由对象 */
var Layer = /** @class */ (function () {
    /**
     * 节点构造器
     * @param path 节点名称
     * @param middleware 中间件列表
     * @param opts 配置
     */
    function Layer(path, middleware, opts) {
        if (opts === void 0) { opts = {}; }
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
    Layer.prototype.match = function (path) {
        return this.regexp.test(path);
    };
    /**
     * 设置节点头部
     * @param prefix
     */
    Layer.prototype.setPrefix = function (prefix) {
        if (this.path) {
            this.path = prefix + this.path;
            this.paramNames = [];
            this.regexp = path_to_regexp_1.pathToRegexp(this.path, this.paramNames, this.opts);
        }
        return this;
    };
    return Layer;
}());
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
        var index = -1;
        function dispatch(i) {
            if (i <= index)
                return Promise.reject(new Error('next() called multiple times'));
            index = i;
            var fn = middleware[i];
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
var Router = /** @class */ (function (_super) {
    __extends(Router, _super);
    function Router() {
        var _this = _super.call(this) || this;
        /**路由栈 */
        _this.stack = [];
        _this.opts = {};
        logger("constructor");
        return _this;
    }
    Object.defineProperty(Router.prototype, "emitter", {
        get: function () { return emitter; },
        enumerable: false,
        configurable: true
    });
    /**
     * 创建并注册一条路线
     * @param path
     * @param middleware
     * @param opts
     */
    Router.prototype.register = function (path, middleware, opts) {
        if (opts === void 0) { opts = {}; }
        // create route
        var route = new Layer(path, middleware, {
            end: opts.end === false ? opts.end : true,
            name: opts.name,
            sensitive: false,
            strict: false,
            prefix: "",
            ignoreCaptures: opts.ignoreCaptures
        });
        logger("register", { path: path, middleware: middleware, opts: opts, route: route });
        this.stack.push(route);
        return route;
    };
    /**
     * 从路径获取到匹配的路由节点
     * @param path
     */
    Router.prototype.match = function (path) {
        var layer;
        var matchedLayers = [];
        for (var len = this.stack.length, i = 0; i < len; i++) {
            layer = this.stack[i];
            if (layer.match(path)) {
                matchedLayers.push(layer);
            }
        }
        logger("match", { path: path, matchedLayers: matchedLayers });
        return matchedLayers;
    };
    /**
     * 绑定节点函数
     * @param path
     * @param middleware
     */
    Router.prototype.ONPath = function (path) {
        var middleware = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            middleware[_i - 1] = arguments[_i];
        }
        logger("ONPath", { path: path, middleware: middleware });
        this.register(path, middleware, { name: path });
        return this;
    };
    /**
     * 绑定节点树
     * @param middleware
     */
    Router.prototype.USEPathMiddleware = function (path) {
        var middleware = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            middleware[_i - 1] = arguments[_i];
        }
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
        logger("USEPathMiddleware", { path: path, middleware: middleware });
        return this;
    };
    Router.prototype.USEMiddleware = function () {
        var middleware = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            middleware[_i] = arguments[_i];
        }
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
        logger("USEPathMiddleware", { middleware: middleware });
        return this;
    };
    Object.defineProperty(Router.prototype, "routes", {
        /**
         * 获取路由调用方法
         */
        get: function () {
            var router = this;
            var dispatch = function dispatch(ctx, next) {
                var layerChain = router.match(ctx.path).reduce(function (memo, layer) {
                    return memo.concat(layer.stack);
                }, []);
                return compose(layerChain)(ctx, next);
            };
            dispatch.prototype.router = this;
            logger("routes", { dispatch: dispatch });
            return dispatch;
        },
        enumerable: false,
        configurable: true
    });
    return Router;
}(events_1.EventEmitter));
exports.Router = Router;
