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
public class FriendRequest {

    private String fromUser;

    private String toUser;

    private String status;

    private Date createTime;
}
