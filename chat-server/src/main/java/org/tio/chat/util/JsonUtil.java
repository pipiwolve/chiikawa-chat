package org.tio.chat.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.text.SimpleDateFormat;

/**
 * JsonUtil
 *
 * 全局公用的 JSON（反）序列化工具。封装了一个线程安全的单例 ObjectMapper。
 *
 * 设计与配置要点：
 *  - 忽略未知属性：避免前端多传字段导致反序列化失败（DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES=false）
 *  - 统一时间格式（可选）
 *  - 提供泛型解析方法（TypeReference）以支持 List/Map 等复杂类型
 *
 * 使用示例：
 *  ChatMessage msg = JsonUtil.fromJson(jsonString, ChatMessage.class);
 *  String json = JsonUtil.toJson(obj);
 *  List<ChatMessage> list = JsonUtil.fromJson(jsonArray, new TypeReference<List<ChatMessage>>() {});
 */
public class JsonUtil {
    private static final ObjectMapper objectMapper = createDefaultMapper();

    private static ObjectMapper createDefaultMapper() {
        ObjectMapper mapper = new ObjectMapper();
        // 忽略未知字段，兼容前端发来的附加字段
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        // 可选：设置统一时间格式（如果你使用 Date 类型）
        mapper.setDateFormat(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"));

        return mapper;
    }

    /**
     * 对象转 JSON 字符串。
     * 注意：序列化失败时抛出 RuntimeException（可根据情况改为自定义异常）。
     */
    public static String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Json序列化失败", e);
        }
    }

    /**
     * JSON 字符串转对象（支持普通类型）
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            throw new RuntimeException("Json反序列化失败: " + json, e);
        }
    }

    /**
     * JSON 字符串转复杂泛型对象（例如 List<ChatMessage>）
     * 使用示例：
     *   List<ChatMessage> list = JsonUtil.fromJson(json, new TypeReference<List<ChatMessage>>() {});
     */
    public static <T> T fromJson(String json, TypeReference<T> typeRef) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (Exception e) {
            throw new RuntimeException("Json反序列化失败: " + json, e);
        }
    }
}