package org.service;

import org.entity.ChatUser;
import org.mapper.ChatUserMapper;
import org.springframework.stereotype.Service;
import org.util.JwtUtil;

@Service
public class AuthService {

    private final ChatUserMapper userMapper;

    public AuthService(ChatUserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public String register(String userId, String password, String nickname) {
        if (userMapper.existsByUserId(userId) > 0) {
            return null; // 用户已存在
        }
        ChatUser user = new ChatUser();
        user.setUserId(userId);
        user.setPassword(password);
        user.setNickName(nickname);
        userMapper.insert(user);
        return JwtUtil.generateToken(userId);
    }

    public String login(String userId, String password) {
        ChatUser user = userMapper.findByUserId(userId);
        if (user != null && user.getPassword().equals(password)) {
            return JwtUtil.generateToken(userId);
        }
        return null;
    }
}
