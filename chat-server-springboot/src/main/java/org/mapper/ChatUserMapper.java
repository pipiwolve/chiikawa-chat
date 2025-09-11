package org.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.entity.ChatUser;

@Mapper
public interface ChatUserMapper {

    @Select("SELECT * FROM chat_user WHERE user_id = #{userId}")
    ChatUser findByUserId(String userId);

    @Insert("INSERT INTO chat_user (user_id, password, username) VALUES (#{userId}, #{password}, #{nickname})")
    int insert(ChatUser user);

    @Select("SELECT COUNT(*) FROM chat_user WHERE user_id = #{userId}")
    int existsByUserId(String userId);
}
