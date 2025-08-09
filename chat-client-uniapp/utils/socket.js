let socketTask = null;

export function connectSocket(userId, onMessage) {
    socketTask = uni.connectSocket({
        url: 'ws://192.168.110.238:9326', // 请替换成你的局域网IP和端口
        success() {
            console.log('✅ WebSocket 连接成功');
        },
        fail(err) {
            console.error('❌ WebSocket 连接失败', err);
        }
    });

    socketTask.onOpen(() => {
        console.log('📡 WebSocket 已打开');
        // 登录绑定 userId，扁平结构
        const loginData = {
            cmd: 1,
            from: userId
        };
        socketTask.send({ data: JSON.stringify(loginData) });
    });

    socketTask.onMessage((res) => {
        const dataStr = res.data;
        if (!dataStr || dataStr === 'null' || dataStr === 'undefined') {
            console.warn('收到无效消息:', dataStr);
            return;
        }
        try {
            const data = JSON.parse(dataStr);
            onMessage && onMessage(data);
        } catch (e) {
            console.error('消息解析错误', e, dataStr);
        }
    });

    socketTask.onClose(() => {
        console.log('WebSocket 已关闭');
    });

    socketTask.onError((err) => {
        console.error('WebSocket 错误', err);
    });
}

export function sendMsg(toUserId, msg, fromUserId) {
    const data = {
        cmd: 2,
        type: "private",
        from: fromUserId,
        to: toUserId,
        message: msg,
        timestamp: Date.now()
    };
    socketTask.send({ data: JSON.stringify(data) });
}