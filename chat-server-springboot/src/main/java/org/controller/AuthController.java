package org.controller;
import org.dto.LoginRequest;
import org.dto.RegisterRequest;
import org.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
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
        String token = authService.login(req.getUserId(), req.getPassword());
        Map<String, Object> resp = new HashMap<>();
        if (token != null) {
            resp.put("result", "ok");
            resp.put("token", token);
        } else {
            resp.put("result", "fail");
            resp.put("message", "Invalid credentials");
        }
        return ResponseEntity.ok(resp);
    }
}
