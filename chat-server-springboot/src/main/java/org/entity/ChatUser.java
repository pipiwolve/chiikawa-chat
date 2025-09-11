package org.entity;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatUser implements Serializable {

    private String userId;

    private String nickName;

    private String password;

    private Date createTime;

    private String avatar;
}
