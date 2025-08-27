package org.tio.chat.service;


import org.apache.ibatis.session.SqlSession;
import org.tio.chat.mapper.ChatUserMapper;
import org.tio.chat.model.ChatUser;

import static org.tio.chat.service.ChatService.SQL_SESSION_FACTORY;

public class ChatUserService {

    public static boolean register(String userId, String password, String nickname) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatUserMapper mapper = sqlSession.getMapper(ChatUserMapper.class);
            if (mapper.findById(userId) != null) {
                return false; // 用户已存在
            }
            ChatUser user = new ChatUser();
            user.setUserId(userId);
            user.setPassword(password);
            user.setUsername(nickname);
            return mapper.insertUser(user) > 0;
        }
    }

    public static ChatUser login(String userId, String password) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatUserMapper mapper = sqlSession.getMapper(ChatUserMapper.class);
            ChatUser user = mapper.login(userId, password);
            System.out.println();
            return user;
        }
    }

    public static boolean checkLogin(String userId, String password) {
        ChatUser user = login(userId, password);
        return user != null;
    }
}