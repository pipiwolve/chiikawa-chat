"use strict";
const utils_socket = require("../../utils/socket.js");
const state = {
  list: [],
  // 未处理申请数组
  lastUpdate: 0
};
const mutations = {
  SET_LIST(state2, arr) {
    state2.list = arr;
    state2.lastUpdate = Date.now();
  },
  // 幂等：存在更新，不存在 unshift 到最前面（时间倒序）
  ADD_ONE(state2, req) {
    const idx = state2.list.findIndex((r) => r.fromUser === req.fromUser);
    idx === -1 ? state2.list.unshift(req) : state2.list.splice(idx, 1, req);
  },
  REMOVE_ONE(state2, fromUser) {
    state2.list = state2.list.filter((r) => r.fromUser !== fromUser);
  }
};
const actions = {
  async loadList({ commit, state: state2 }, { userId, force = false } = {}) {
    if (!force && Date.now() - state2.lastUpdate < 5 * 60 * 1e3)
      return;
    const res = await new Promise((resolve) => utils_socket.fetchFriendRequests(resolve));
    commit("SET_LIST", res.requests || []);
  },
  // 被 App.vue 网关调用
  addRequest({ commit }, req) {
    commit("ADD_ONE", req);
  },
  // 页面点击「同意」后调用
  async agree({ commit }, { fromUser, userId }) {
    commit("REMOVE_ONE", fromUser);
    utils_socket.respondFriendRequest(fromUser, userId, "accept");
  }
};
const friendRequests = { namespaced: true, state, mutations, actions };
exports.friendRequests = friendRequests;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/store/modules/friendRequests.js.map
