package org.tio.chat.model;

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

    private String username;

    private String userId;

    private String password;

    private Date createTime;





}
