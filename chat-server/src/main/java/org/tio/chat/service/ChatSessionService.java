package org.tio.chat.service;

import lombok.var;
import org.tio.chat.mapper.ChatMessageMapper;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.model.ChatSession;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class ChatSessionService {

    /**
     * 获取用户最近会话列表，包括私聊和群聊
     */
    public static List<ChatSession> getRecentSessions(String userId) {
        List<ChatSession> sessions = new ArrayList<>();

        try (var sqlSession = ChatService.SQL_SESSION_FACTORY.openSession()) {
            ChatMessageMapper msgMapper = sqlSession.getMapper(ChatMessageMapper.class);
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);

            // 1. 私聊最近消息
            List<ChatMessage> privateMsgs = msgMapper.selectRecentPrivateMessages(userId);
            for (ChatMessage msg : privateMsgs) {
                ChatSession session = new ChatSession();
                session.setSessionId(msg.getFromUser().equals(userId) ? msg.getToUser() : msg.getFromUser());
                session.setType("private");
                session.setLastMsg(msg.getContent());
                session.setLastTime(new Date(msg.getTimestamp()));
                session.setUnread(msgMapper.countUnreadPrivateMessages(userId, session.getSessionId()));
                sessions.add(session);
            }

            // 2. 群聊最近消息
            List<String> groupIds = groupMapper.getUserGroups(userId);
            for (String gid : groupIds) {
                ChatMessage lastGroupMsg = msgMapper.selectLastGroupMessage(gid);
                if (lastGroupMsg != null) {
                    ChatSession session = new ChatSession();
                    session.setSessionId(gid);
                    session.setType("group");
                    session.setLastMsg(lastGroupMsg.getContent());
                    session.setLastTime(new Date(lastGroupMsg.getTimestamp()));
                    session.setUnread(groupMapper.countUnreadGroupMessages(userId, gid));
                    sessions.add(session);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return sessions;
    }
}