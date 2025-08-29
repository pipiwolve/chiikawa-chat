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
public class ChatGroup {
    private Long id;
    private String groupId;
    private String groupName;
    private String ownerId;
    private String avatar;
    private Date creatTime;
}