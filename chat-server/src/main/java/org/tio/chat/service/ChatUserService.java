package org.tio.chat.service;


import org.apache.ibatis.session.SqlSession;
import org.tio.chat.mapper.ChatUserMapper;
import org.tio.chat.model.ChatUser;

import java.util.List;

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
            user.setUserName(nickname);
            return mapper.insertUser(user) > 0;
        }
    }

    // 登录用户
    public static ChatUser login(String userId, String password) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession()) {
            ChatUserMapper mapper = sqlSession.getMapper(ChatUserMapper.class);
            return mapper.login(userId, password);  // 返回 ChatUser 对象
        }
    }

    public static boolean checkLogin(String userId, String password) {
        ChatUser user = login(userId, password);
        return user != null;
    }

    // 获取好友列表
    public static List<ChatUser> getFriends(String currentUserId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession()) {
            ChatUserMapper mapper = sqlSession.getMapper(ChatUserMapper.class);
            List<ChatUser> list = mapper.getFriends(currentUserId);

            // 调试输出
            list.forEach(u -> System.out.println("好友: " + u.getUserId() ));

            return list;
        }
    }

    // 添加好友
    public static boolean addFriend(String userId, String friendId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatUserMapper mapper = sqlSession.getMapper(ChatUserMapper.class);
            // 判断是否已存在好友关系
            Integer count = mapper.isFriendExist(userId, friendId);
            if (count != null && count > 0) return false;

            mapper.insertFriend(userId, friendId);
            return true;
        }
    }

}