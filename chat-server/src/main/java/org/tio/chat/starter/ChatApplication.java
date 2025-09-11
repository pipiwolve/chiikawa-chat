package org.tio.chat.starter;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.tio.chat.handler.ChatWsHandler;
import org.tio.utils.jfinal.P;


@SpringBootApplication(scanBasePackages = "org.tio.chat")
@MapperScan("org.tio.chat.mapper")
public class ChatApplication {

    public static void main(String[] args) throws Exception {
        P.use("app.properties");
        SpringApplication.run(ChatApplication.class, args);
    }

    /** ✅ 启动 t-io WebSocket Server */
    @Bean(initMethod = "start")
    public ChatServerStarter chatServerStarter() throws Exception {
        return new ChatServerStarter(
                9326,  // WebSocket 端口
                ChatWsHandler.me
        );
    }
}
