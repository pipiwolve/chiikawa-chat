package org.tio.chat.handler;


import org.tio.http.common.HttpConfig;
import org.tio.http.common.HttpRequest;
import org.tio.http.common.HttpResponse;
import org.tio.http.common.RequestLine;
import org.tio.http.common.handler.HttpRequestHandler;
import org.tio.utils.json.Json;

import org.tio.chat.service.ChatUserService;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.tio.http.common.Method;

public class ChatHttpHandler implements HttpRequestHandler {


    @Override
    public HttpResponse handler(HttpRequest request) throws Exception {
        String path = request.getRequestLine().getPath();
        HttpResponse response = new HttpResponse(request);

        Method method = request.getRequestLine().getMethod();

        if ("/register".equals(path) && method == Method.POST) {
            Map<String, String> params = Json.toBean(new String(request.getBody(), StandardCharsets.UTF_8), Map.class);
            String userId = params.get("userId");
            String password = params.get("password");
            String username = params.getOrDefault("username", userId);

            boolean success = ChatUserService.register(userId, password, username);

            Map<String, Object> resp = new HashMap<>();
            resp.put("success", success);
            if (!success) resp.put("msg", "用户已存在");

            response.setBody(Json.toJson(resp).getBytes(StandardCharsets.UTF_8));
            return response;
        }

        if ("/login".equals(path) && method == Method.POST) {
            Map<String, String> params = Json.toBean(new String(request.getBody(), StandardCharsets.UTF_8), Map.class);
            String userId = params.get("userId");
            String password = params.get("password");

            boolean success = ChatUserService.checkLogin(userId, password);

            Map<String, Object> resp = new HashMap<>();
            resp.put("success", success);
            if (!success) resp.put("msg", "账号或密码错误");

            response.setBody(Json.toJson(resp).getBytes(StandardCharsets.UTF_8));
            return response;
        }

        response.setBody("{\"msg\":\"Not Found\"}".getBytes(StandardCharsets.UTF_8));
        return response;
    }

    @Override
    public HttpResponse resp404(HttpRequest httpRequest, RequestLine requestLine) throws Exception {
        return null;
    }

    @Override
    public HttpResponse resp500(HttpRequest httpRequest, RequestLine requestLine, Throwable throwable) throws Exception {
        return null;
    }

    @Override
    public HttpConfig getHttpConfig(HttpRequest httpRequest) {
        return null;
    }

    @Override
    public void clearStaticResCache() {

    }


}
