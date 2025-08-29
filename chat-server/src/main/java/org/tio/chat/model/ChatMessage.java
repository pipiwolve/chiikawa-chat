package org.tio.chat.model;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.tio.core.ChannelContext;
import java.io.Serializable;
import java.util.Calendar;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    /** 后端处理连接上下文，不序列化 */
    @JsonIgnore
    private transient ChannelContext channelContext;

    private Integer cmd;       // 消息类型：2=私聊，3=群聊
    private String type;       // 消息类型标识
    private String fromUser;
    private String toUser;
    private String nickname;

    @JsonAlias({ "text", "message", "msg", "sysMsg" })
    private String content;

    private Long timestamp;
    private String msgId;
    private Boolean isRead;
    private List<String> msgIds;

    private boolean isOffline;
    private String groupId;

    private String requester;
    private String action;

    private Integer PageNum;
    private Integer PageSize;

}