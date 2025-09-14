package org.tio.chat.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${chat.upload.local-path}")
    private String uploadPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = "file:" + uploadPath + "/";
        System.out.println("Static resource mapping: /uploads/** -> " + location);
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location)
                .setCachePeriod(0)
                .resourceChain(true);
    }

    // 可选：允许跨域（开发时）
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("http://localhost:*",
                        "http://172.21.67.11:*") // dev 用 *，生产请改为前端域名
                .allowedMethods("*")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
