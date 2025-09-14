package org.tio.chat.controller;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import java.util.HashMap;

@RestController
@RequestMapping("/upload")
public class UploadController {

    @Value("${chat.upload.local-path}")
    private String uploadPath;

    @Value("${chat.upload.url-prefix}")
    private String urlPrefix;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file) throws IOException {
        Map<String, Object> resp = new HashMap<>();
        if (file == null || file.isEmpty()) {
            resp.put("result", "fail");
            resp.put("message", "文件为空");
            return resp;
        }

        String original = file.getOriginalFilename();
        String ext = "";
        if (!StringUtils.isEmpty(original) && original.contains(".")) {
            ext = original.substring(original.lastIndexOf("."));
        }
        String fileName = UUID.randomUUID().toString().replace("-", "") + ext;

        File destDir = new File(uploadPath);
        if (!destDir.exists()) destDir.mkdirs();

        File dest = new File(destDir, fileName);
        file.transferTo(dest);

        String fileUrl = urlPrefix + fileName;
        resp.put("result", "ok");
        resp.put("url", fileUrl);
        return resp;
    }
}