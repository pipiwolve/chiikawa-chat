package org.tio.chat.mapper;

import org.tio.chat.model.ChatUser;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ChatUserMapper {

    int insertUser(ChatUser user);

    ChatUser findById(@Param("userId") String userId);

    ChatUser login(@Param("userId") String userId, @Param("password") String password);

    List<ChatUser> getFriends(@Param("userId") String userId);

    Integer isFriendExist(@Param("userId") String userId, @Param("friendId") String friendId);

    void insertFriend(@Param("userId") String userId, @Param("friendId") String friendId);



}
