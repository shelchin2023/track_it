import { serve } from 'bun';
import { createClient } from '@clickhouse/client'

const clickhouse = createClient({
    url: Bun.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
    username: Bun.env.CLICKHOUSE_USER ?? 'default',
    password: Bun.env.CLICKHOUSE_PASSWORD ?? '',
})

// 函数：插入事件数据到 ClickHouse
async function insertEvent(eventData) {
    try {
        // 解构请求中的数据
        const { event_name, app_name, attributes, env, created_at } = eventData;

        // 将 attributes 和 env 转化用于 ClickHouse 插入的格式
        // 确保 attributes 和 env 为数组
        const safeAttributes = Array.isArray(attributes) ? attributes : [{ key: 'default', value: 'default' }];
        const safeEnv = Array.isArray(env) ? env : [{ key: 'default', value: 'default' }];

        const attributesKey = safeAttributes.map((attr) => attr.key);
        const attributesValue = safeAttributes.map((attr) => attr.value);

        const envKey = safeEnv.map((envItem) => envItem.key);
        const envValue = safeEnv.map((envItem) => envItem.value);

        // 执行插入操作
        await clickhouse.insert({
            table: 'events', // ClickHouse 中的表名
            values: [
                {
                    app_name: app_name ?? "default", // 应用名称
                    event_name: event_name,        // 事件名称
                    'attributes.key': attributesKey,    // Nested attributes.key 数组
                    'attributes.value': attributesValue,// Nested attributes.value 数组
                    'env.key': envKey,                   // Nested env.key 数组
                    'env.value': envValue,               // Nested env.value 数组
                    created_at: new Date(), // 插入时间
                },
            ],
            clickhouse_settings: {
                // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
                date_time_input_format: 'best_effort',
            },
            format: 'JSONEachRow',
        });

    } catch (error) {
        console.error('Error inserting event:', error.message);

        throw error;
    }
    await clickhouse.close()
}

export async function handleTrackEvent(req) {
    try {
        // 解析请求体
        const body = await req.json();

        // 验证请求数据的完整性
        if (
            !body.event_name
        ) {
            return new Response(
                JSON.stringify({ error: 'Invalid data structure' }),
                { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // 插入事件到 ClickHouse
        await insertEvent(body);

        // 返回成功响应
        return new Response(
            JSON.stringify({ status: 'success', message: 'Event inserted' }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    } catch (error) {
        console.error('Error handling event:', error.message);

        return new Response(
            JSON.stringify({ status: 'error', message: 'Failed to insert event' }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }
}

// 定义统一的 CORS 头
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*', // 或指定具体域名
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true', // 如果需要传递 cookies 或 authorization
    };
}

const server = serve({
    port: 3000,
    async fetch(req) {

        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204, // No Content
                headers: corsHeaders(),
            });
        }
        if (req.method === 'POST') {
            return handleTrackEvent(req);
        }
        return new Response('Not Found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE' } });
    },
});

// 启动服务器
console.log(`Server is running on http://localhost:3000`);