package org.tio.chat.service;

import lombok.var;
import org.apache.ibatis.session.SqlSession;
import org.tio.chat.mapper.ChatMessageMapper;
import org.tio.chat.mapper.ChatGroupMapper;
import org.tio.chat.model.ChatGroup;
import org.tio.chat.model.ChatMessage;
import org.tio.chat.model.ChatSession;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.tio.chat.service.ChatService.SQL_SESSION_FACTORY;

public class ChatSessionService {

    /**
     * 获取用户最近会话列表，包括私聊和群聊
     */
    public static List<ChatSession> getRecentSessions(String userId) {
        try (SqlSession sqlSession = SQL_SESSION_FACTORY.openSession(true)) {
            ChatMessageMapper msgMapper = sqlSession.getMapper(ChatMessageMapper.class);
            ChatGroupMapper groupMapper = sqlSession.getMapper(ChatGroupMapper.class);

            List<ChatSession> sessions = new ArrayList<>();

            // ========== 群聊会话 ==========
            List<ChatGroup> groups = groupMapper.getUserGroupObjects(userId);
            for (ChatGroup g : groups) {
                ChatMessage lastMsg = msgMapper.selectLastGroupMessage(g.getGroupId());
                ChatSession s = new ChatSession();
                s.setSessionId(g.getGroupId());
                s.setNickname(g.getGroupName());
                s.setUnread(groupMapper.countUnreadGroupMessages(userId, g.getGroupId()));
                if (lastMsg != null) {
                    s.setLastMsg(lastMsg.getContent());
                    s.setLastTime(new Date(lastMsg.getTimestamp()));
                } else {
                    // 没消息，用群创建时间
                    s.setLastMsg(null);
                    s.setLastTime(g.getCreatTime());
                }
                sessions.add(s);
            }

            // ========== 私聊会话 ==========
            List<ChatMessage> lastPrivates = msgMapper.selectRecentPrivateMessages(userId);
            for (ChatMessage m : lastPrivates) {
                ChatSession s = new ChatSession();
                String peerId = m.getFromUser().equals(userId) ? m.getToUser() : m.getFromUser();
                s.setSessionId(peerId);
                s.setNickname(peerId);
                s.setLastMsg(m.getContent());
                s.setLastTime(new Date(m.getTimestamp()));
                s.setUnread(msgMapper.countUnreadPrivateMessages(userId, s.getSessionId()));
                sessions.add(s);
            }

            // ========== 排序 ==========
            sessions.sort((a, b) -> {
                long t1 = a.getLastTime() == null ? 0 : a.getLastTime().getTime();
                long t2 = b.getLastTime() == null ? 0 : b.getLastTime().getTime();
                return Long.compare(t2, t1);
            });

            return sessions;
        }
    }
}

