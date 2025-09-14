package org.tio.chat.mapper;

import io.lettuce.core.dynamic.annotation.Param;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.tio.chat.model.ChatUser;

@Mapper
public interface ChatMyselfMapper {
    @Select("SELECT * FROM chat_user WHERE user_id = #{userId}")
    ChatUser findByUserId(String userId);

    @Update("UPDATE chat_user SET avatar = #{avatar} WHERE user_id = #{userId}")
    int updateAvatar(@Param("userId") String userId, @Param("avatar") String avatar);
}
