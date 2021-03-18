/**
 * 获取一个 24 位的ID
 * - 进程ID + 时间戳后 6 位 + 6 位序列号 + 随机数后 6 位
 * - 经测试 100W 次运行中，没有发现重复ID
 */
export declare function id24(): string;
