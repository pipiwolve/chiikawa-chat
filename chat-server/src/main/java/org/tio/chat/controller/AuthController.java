package org.tio.chat.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.tio.chat.model.LoginRequest;
import org.tio.chat.model.LoginResponse;
import org.tio.chat.model.RegisterRequest;
import org.tio.chat.service.AuthService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        String token = authService.register(req.getUserId(), req.getPassword(), req.getNickname());
        Map<String, Object> resp = new HashMap<>();
        if (token != null) {
            resp.put("result", "ok");
            resp.put("token", token);
        } else {
            resp.put("result", "fail");
            resp.put("message", "User already exists");
        }
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        LoginResponse loginResp = authService.login(req.getUserId(), req.getPassword());
        if (loginResp != null) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("result", "ok");
            resp.put("token", loginResp.getToken());
            resp.put("userId", loginResp.getUserId());
            resp.put("username", loginResp.getUsername()); // 即使 null 也能存
            resp.put("avatar", loginResp.getAvatar());
            return ResponseEntity.ok(resp);
        } else {
            Map<String, Object> resp = new HashMap<>();
                    resp.put("result", "fail");
                    resp.put("message", "用户名或密码错误");
                    return ResponseEntity.ok(resp);
        }
    }
}