package org.tio.chat.service;

import org.springframework.stereotype.Service;
import org.tio.chat.mapper.ChatJwtUserMapper;
import org.tio.chat.model.ChatUser;
import org.tio.chat.model.LoginResponse;
import org.tio.chat.util.JwtUtil;

@Service
public class AuthService {

    private final ChatJwtUserMapper userMapper;

    public AuthService(ChatJwtUserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public String register(String userId, String password, String userName) {
        if (userMapper.existsByUserId(userId) > 0) {
            return null; // 用户已存在
        }
        ChatUser user = new ChatUser();
        user.setUserId(userId);
        user.setPassword(password);
        user.setUserName(userName);
        userMapper.insert(user);
        return JwtUtil.generateToken(userId);
    }

    public LoginResponse login(String userId, String password) {
        ChatUser user = userMapper.findByUserId(userId);
        if (user != null && user.getPassword().equals(password)) {
            LoginResponse resp = new LoginResponse();
            resp.setToken(JwtUtil.generateToken(userId));
            resp.setUserId(user.getUserId());
            resp.setUsername(user.getUserName());
            resp.setAvatar(user.getAvatar());
            return resp;
        }
        return null;
    }
}