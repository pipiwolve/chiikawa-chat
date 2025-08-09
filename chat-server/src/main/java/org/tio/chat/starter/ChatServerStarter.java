package org.tio.chat.starter;

import org.tio.chat.listener.ChatServerIpStatListener;
import org.tio.server.TioServerConfig;
import org.tio.utils.jfinal.P;
import org.tio.websocket.server.WsServerStarter;
import org.tio.chat.handler.ChatWsHandler;
import org.tio.chat.config.ChatServerConfig;
import org.tio.chat.listener.ChatServerListener;



public class ChatServerStarter {
    private WsServerStarter wsServerStarter;
    private TioServerConfig serverTioConfig;

    public ChatServerStarter(int port, ChatWsHandler wsMsgHandler) throws Exception {
        wsServerStarter = new WsServerStarter(port, wsMsgHandler);
        serverTioConfig = wsServerStarter.getTioServerConfig();
        serverTioConfig.setName(ChatServerConfig.PROTOCOL_NAME);
        serverTioConfig.setTioServerListener(ChatServerListener.me);
        serverTioConfig.setIpStatListener(ChatServerIpStatListener.me);
        serverTioConfig.ipStats.addDurations(ChatServerConfig.IpStatDuration.IPSTAT_DURATIONS);
        serverTioConfig.setHeartbeatTimeout(ChatServerConfig.HEARTBEAT_TIMEOUT);

        if (P.getInt("ws.use.ssl", 1) == 1) {
            String keyStoreFile = P.get("ssl.keystore", null);
            String trustStoreFile = P.get("ssl.truststore", null);
            String keyStorePwd = P.get("ssl.pwd", null);
            serverTioConfig.useSsl(keyStoreFile, trustStoreFile, keyStorePwd);
        }
    }

    public static void start() throws Exception {
        ChatServerStarter appStarter = new ChatServerStarter(ChatServerConfig.SERVER_PORT, ChatWsHandler.me);
        appStarter.wsServerStarter.start();
    }

    public TioServerConfig getTioServerConfig() {
        return serverTioConfig;
    }

    public WsServerStarter getWsServerStarter() {
        return wsServerStarter;
    }

    public static void main(String[] args) throws Exception {
        P.use("app.properties");
        start();
    }
}