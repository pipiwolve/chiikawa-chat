package org.tio.chat.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.tio.chat.mapper.ChatMyselfMapper;
import org.tio.chat.model.ChatUser;

@Service
public class ChatMyselfService {

    @Autowired
    private ChatMyselfMapper ChatMyselfMapper;

    public ChatUser getUserById(String userId) {
        return ChatMyselfMapper.findByUserId(userId);
    }

    public boolean updateAvatar(String userId, String avatar) {
        return ChatMyselfMapper.updateAvatar(userId, avatar) > 0;
    }
}
