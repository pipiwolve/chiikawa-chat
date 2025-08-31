package org.tio.chat.service;

import org.apache.ibatis.session.SqlSession;
import org.tio.chat.mapper.GroupRequestMapper;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.model.ChatGroupMember;
import org.tio.chat.model.GroupRequest;

import java.util.List;

import static org.tio.chat.service.ChatService.SQL_SESSION_FACTORY;

public class GroupRequestService {

    /**
     * 创建群聊加入申请（发送者申请加入群聊）
     */
    public static boolean createRequest(String fromUser, String groupId) {
        if (fromUser == null || groupId == null) return false;

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            GroupRequestMapper mapper = sqlSession.getMapper(GroupRequestMapper.class);

            // 已经是群成员
            if (mapper.isMember(fromUser, groupId) > 0) return false;

            // 已经有待处理申请
            if (mapper.existsPending(fromUser, groupId) > 0) return false;

            // 插入申请
            return mapper.insertRequest(fromUser, groupId) > 0;
        }
    }

    /**
     * 处理群聊加入申请（群主同意入群）
     */
    public static boolean handleRequest(String fromUser, String groupId, String action) {
        if (fromUser == null || groupId == null || !"accept".equals(action)) return false;

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            GroupRequestMapper mapper = sqlSession.getMapper(GroupRequestMapper.class);
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);

            // 更新申请状态为已同意
            mapper.updateStatus(fromUser, groupId, "accepted");

            // 插入群成员表
            ChatGroupMember member = new ChatGroupMember();
            member.setUserId(fromUser);
            member.setGroupId(groupId);
            member.setRole("member");
            groupMapper.addMember(member);

            return true;
        }
    }

    /**
     * 查询群主收到的待处理申请
     */
    public static List<GroupRequest> getPendingRequests(String ownerId) {
        if (ownerId == null) return null;

        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            GroupRequestMapper mapper = sqlSession.getMapper(GroupRequestMapper.class);
            return mapper.selectPendingByOwner(ownerId);
        }
    }
}