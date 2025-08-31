package org.tio.chat.mapper;

import org.apache.ibatis.annotations.Param;
import org.tio.chat.model.GroupRequest;

import java.util.List;

public interface GroupRequestMapper {

    // 是否已经是群成员
    int isMember(@Param("userId") String userId, @Param("groupId") String groupId);

    // 是否已有待处理的申请
    int existsPending(@Param("userId") String userId, @Param("groupId") String groupId);

    // 插入申请
    int insertRequest(@Param("userId") String userId, @Param("groupId") String groupId);

    // 更新申请状态
    int updateStatus(@Param("userId") String userId, @Param("groupId") String groupId, @Param("status") String status);

    // 查询群主收到的待处理申请
    List<GroupRequest> selectPendingByOwner(@Param("ownerId") String ownerId);
}