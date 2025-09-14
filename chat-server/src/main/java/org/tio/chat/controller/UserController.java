package org.tio.chat.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.tio.chat.model.ChatUser;
import org.tio.chat.service.ChatMyselfService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private ChatMyselfService chatMyselfService;

    /**
     * 更新用户头像
     */
    @PostMapping("/updateAvatar")
    public Map<String, Object> updateAvatar(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String avatar = body.get("avatar");

        Map<String, Object> resp = new HashMap<>();
        if (userId == null || avatar == null) {
            resp.put("result", "fail");
            resp.put("message", "参数缺失");
            return resp;
        }

        boolean success = chatMyselfService.updateAvatar(userId, avatar);
        if (success) {
            resp.put("result", "ok");
            resp.put("message", "头像更新成功");
        } else {
            resp.put("result", "fail");
            resp.put("message", "更新失败，用户不存在");
        }
        return resp;
    }

    /**
     * 获取用户资料
     */
    @GetMapping("/{userId}")
    public Map<String, Object> getUser(@PathVariable String userId) {
        Map<String, Object> resp = new HashMap<>();
        ChatUser user = chatMyselfService.getUserById(userId);
        if (user != null) {
            resp.put("result", "ok");
            resp.put("data", user);
        } else {
            resp.put("result", "fail");
            resp.put("message", "用户不存在");
        }
        return resp;
    }
}
