package org.tio.chat.model;

import lombok.Data;
import java.sql.Timestamp;

@Data
public class ChatGroupMember {
    private Long id;
    private String groupId;
    private String userId;
    private Timestamp joinTime;
    private String role;
    // 群聊已读游标（可选）
    private String lastReadMsgId;
}
