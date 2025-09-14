package org.tio.chat.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/debug")
public class DebugController {
    @Value("${chat.upload.local-path}")
    private String uploadPath;

    @GetMapping("/list")
    public List<String> listFiles() {
        File dir = new File(uploadPath);
        if (!dir.exists()) return List.of("目录不存在: " + uploadPath);
        File[] files = dir.listFiles();
        if (files == null) return List.of("目录为空");
        return Arrays.stream(files).map(File::getName).toList();
    }
}
