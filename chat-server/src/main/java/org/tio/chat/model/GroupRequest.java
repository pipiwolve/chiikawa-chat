package org.tio.chat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupRequest {
    private Long id;
    private String groupId;
    private String fromUser;
    private String status; // pending / accepted
    private Date createdAt;

    // getter / setter
}