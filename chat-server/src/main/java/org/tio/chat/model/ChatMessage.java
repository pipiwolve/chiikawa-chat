package org.tio.chat.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.tio.core.ChannelContext;

import java.io.Serializable;
import java.util.List;

/**
 * ChatMessage
 *
 * 统一的聊天消息模型（后端与前端约定的核心消息结构）。
 *
 * 设计要点：
 *  - cmd: 命令编号（1=登录, 2=私聊, 3=群聊 等）。业务逻辑用 cmd 区分行为。
 *  - type: 可选的语义说明 ("private"|"group")，用于处理路由或 UI 渲染。
 *  - from: 发送者 userId（后端发送前会确保此字段为当前连接绑定的 userId）。
 *  - to: 目标 userId（私聊）或 groupId（群聊）。
 *  - nickname: 发送者昵称（展示用途，可由前端或服务端补齐）。
 *  - message: 消息正文（实际业务字段）。使用 @JsonAlias 接受 "text" 等别名，兼容前端不同写法。
 *  - timestamp: 毫秒级时间戳（客户端或服务端写入）。
 *
 * 注意：
 *  - 序列化时只输出非 null 字段（@JsonInclude.NON_NULL）。
 *  - 反序列化时支持 "text" 或 "message" 两种字段名，减少前端/后端命名不一致导致的问题。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonIgnore
    private transient ChannelContext channelContext;


    /** 命令类型（1=登录，2=私聊，3=群聊，...） */
    private Integer cmd;

    /** 消息语义类型（"private"|"group"），便于业务层分支判断 */
    private String type;

    /** 发送者 userId（绑定后端 ChannelContext.userid） */
    private String from;

    /** 目标 userId 或 groupId */
    private String to;

    /** 发送者昵称（用于前端展示，可选） */
    private String nickname;

    /**
     * 消息正文
     * - 使用 @JsonAlias 接收 "text"、"message" 等常见名称，
     *   这样前端如果发送 { "text": "..." } 或 { "message": "..." } 都能被正确解析。
     */
    @JsonAlias({ "text", "message", "msg" ,"sysMsg"})
    private String message;

    /** 时间戳（毫秒） */
    private Long timestamp;

    /** 消息唯一标识 */
    private String msgId;

    /** 消息已读状态（true=已读，false=未读） */
    private Boolean read;

    /** 消息id对列用于返回确认 **/
    private List<String> msgIds;

    public ChatMessage() {
    }

    public ChatMessage(Integer cmd, String type, String from, String to, String nickname, String message, Long timestamp, String msgId, Boolean read, List<String> msgIds) {
        this.cmd = cmd;
        this.type = type;
        this.from = from;
        this.to = to;
        this.nickname = nickname;
        this.message = message;
        this.timestamp = timestamp;
        this.msgId = msgId;
        this.read = read;
        this.msgIds = msgIds;
    }

    /* ------------------- getters / setters ------------------- */

    public ChannelContext getChannelContext() {
        return channelContext;
    }

    public void setChannelContext(ChannelContext channelContext) {
        this.channelContext = channelContext;
    }

    public Boolean getRead() {
        return read;
    }

    public void setRead(Boolean read) {
        this.read = read;
    }

    public List<String> getMsgIds() { return msgIds; }
    public void setMsgIds(List<String> msgIds) { this.msgIds = msgIds; }

    public Integer getCmd() {
        return cmd;
    }

    public void setCmd(Integer cmd) {
        this.cmd = cmd;
    }

    public String getType() {
        return type;
    }

    /**
     * type 说明（示例）：
     *  "private" - 私聊（t-io sendToUser）
     *  "group"   - 群聊（t-io sendToGroup）
     */
    public void setType(String type) {
        this.type = type;
    }

    public String getFrom() {
        return from;
    }

    /**
     * from 一般由服务端在处理时覆盖为 channelContext.userid，
     * 防止客户端伪造发送者。
     */
    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    /**
     * to: 私聊时候为目标 userId；群聊可以为 groupId（由 ChatConst 管理）
     */
    public void setTo(String to) {
        this.to = to;
    }

    public String getNickname() {
        return nickname;
    }

    /**
     * nickname：展示用途，如缺失可由服务端根据用户信息补全
     */
    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getMessage() {
        return message;
    }

    /**
     * 注意：前端可能发送 "text" 字段；由于在字段上使用了 @JsonAlias，
     * Jackson 会在反序列化时把 "text" 映射到 message。
     */
    public void setMessage(String message) {
        this.message = message;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    /**
     * timestamp：推荐由发送方（客户端）写入发送时间；服务端在处理时也可覆盖为系统时间
     */
    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }

    public String getMsgId() {
        return msgId;
    }

    public void setMsgId(String msgId) {
        this.msgId = msgId;
    }

    @Override
    public String toString() {
        return "ChatMessage{" +
                "cmd=" + cmd +
                ", type='" + type + '\'' +
                ", from='" + from + '\'' +
                ", to='" + to + '\'' +
                ", nickname='" + nickname + '\'' +
                ", message='" + message + '\'' +
                ", timestamp=" + timestamp +
                ", msgId='" + msgId + '\'' +
                ", read=" + read +
                ", msgIds=" + msgIds +
                '}';
    }
}