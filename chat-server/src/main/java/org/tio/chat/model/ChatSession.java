package org.tio.chat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatSession {
    private String sessionId; // userId 或 groupId
    private String type;      // private / group
    private String nickname;  // 显示昵称
    private String lastMsg;
    private String avatar;
    private Date lastTime;
    private int unread;
    private String messageType;

}
