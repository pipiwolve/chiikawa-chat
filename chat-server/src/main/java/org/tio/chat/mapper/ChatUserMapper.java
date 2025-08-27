package org.tio.chat.mapper;

import org.tio.chat.model.ChatUser;
import org.apache.ibatis.annotations.Param;

public interface ChatUserMapper {

    int insertUser(@Param("user") ChatUser user);

    ChatUser findById(@Param("userId") String userId);

    ChatUser login(@Param("userId") String userId, @Param("password") String password);

}
