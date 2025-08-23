package org.tio.chat.model;

import lombok.Data;
import java.sql.Timestamp;

@Data
public class ChatGroup {
    private Long id;
    private String groupId;
    private String groupName;
    private Timestamp createTime;
}