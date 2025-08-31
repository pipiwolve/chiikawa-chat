package org.tio.chat.service;

import org.apache.ibatis.session.SqlSession;
import org.tio.chat.mapper.FriendRequestMapper;
import org.tio.chat.model.FriendRequest;


import java.util.List;

import static org.tio.chat.service.ChatService.SQL_SESSION_FACTORY;

public class FriendRequestService {

    // 创建好友申请
    public static boolean createRequest(String from, String to) {
        if (from.equals(to)) return false;

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            FriendRequestMapper mapper = sqlSession.getMapper(FriendRequestMapper.class);

            if (mapper.isAlreadyFriend(from, to) > 0) {
                return false;
            }
            if (mapper.existsPending(from, to) > 0) {
                return false;
            }
            return mapper.insertRequest(from, to) > 0;
        }
    }

    // 处理好友请求
    public static boolean handleRequest(String fromUser, String toUser, String action) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            FriendRequestMapper mapper = sqlSession.getMapper(FriendRequestMapper.class);

            if ("accept".equals(action)) {
                mapper.updateStatus(fromUser, toUser, "accepted");

//                 mapper.insertFriend(fromUser, toUser);
//                 mapper.insertFriend(toUser, fromUser);

                return true;
            } else if ("reject".equals(action)) {
                mapper.updateStatus(fromUser, toUser, "rejected");
                return true;
            }
            return false;
        }
    }

    // 查询未处理好友申请
    public static List<FriendRequest> getPendingRequests(String userId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            FriendRequestMapper mapper = sqlSession.getMapper(FriendRequestMapper.class);
            return mapper.getPendingRequests(userId);
        }
    }
}