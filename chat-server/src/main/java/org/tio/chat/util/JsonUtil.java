    package org.tio.chat.util;

    import com.fasterxml.jackson.core.JsonProcessingException;
    import com.fasterxml.jackson.databind.ObjectMapper;

    public class JsonUtil {
        private static final ObjectMapper objectMapper = new ObjectMapper();

        public static String toJson(Object obj) {
            try {
                return objectMapper.writeValueAsString(obj);
            } catch (JsonProcessingException e) {
                throw new RuntimeException("Json序列化失败", e);
            }
        }

        public static <T> T fromJson(String json, Class<T> clazz) {
            try {
                return objectMapper.readValue(json, clazz);
            } catch (Exception e) {
                throw new RuntimeException("Json反序列化失败", e);
            }
        }
    }
