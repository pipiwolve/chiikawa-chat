package org.tio.chat.model;

public class ChatMessage {
    private String type;       // "private" or "group"
    private String from;       // sender userId
    private String to;         // target userId or groupId
    private String nickname;   // sender nickname
    private String message;    // text message content
    private long timestamp;    // client-side time
    private Integer cmd;   // 1=登录，2=私聊，3=群聊

    public ChatMessage() {}

    public ChatMessage(Integer cmd, String type, String from, String to, String nickname, String message, long timestamp) {
        this.cmd = cmd;
        this.type = type;
        this.from = from;
        this.to = to;
        this.nickname = nickname;
        this.message = message;
        this.timestamp = timestamp;
    }

    public Integer getCmd() {
        return cmd;
    }

    public void setCmd(Integer cmd) {
        this.cmd = cmd;
    }
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
