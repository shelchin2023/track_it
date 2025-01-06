# 使用官方 Bun 镜像
FROM oven/bun:1 AS base

# 设置工作目录
WORKDIR /usr/src/app

# 复制依赖文件并安装依赖
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# 复制项目代码
COPY . .

# 暴露应用端口
EXPOSE 3000

# 设置默认启动命令
USER bun
ENTRYPOINT ["bun", "run", "index.ts"]