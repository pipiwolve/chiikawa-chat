package org.tio.chat.mapper;

import org.apache.ibatis.annotations.Param;
import org.tio.chat.model.FriendRequest;

import java.util.List;

public interface FriendRequestMapper {

    int insertRequest(@Param("from") String from, @Param("to") String to);

    int existsPending(@Param("from") String from, @Param("to") String to);

    int isAlreadyFriend(@Param("from") String from, @Param("to") String to);

    int updateStatus(@Param("from") String from,
                     @Param("to") String to,
                     @Param("status") String status);

    List<FriendRequest> getPendingRequests(@Param("userId") String userId);

    void insertFriend(@Param("userId") String userId, @Param("friendId") String friendId);
}
