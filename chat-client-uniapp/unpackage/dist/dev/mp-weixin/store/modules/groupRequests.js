"use strict";
const utils_socket = require("../../utils/socket.js");
const state = {
  list: [],
  lastUpdate: 0
};
const mutations = {
  SET_LIST(state2, arr) {
    state2.list = arr;
    state2.lastUpdate = Date.now();
  },
  // 幂等：存在更新，不存在 push
  ADD_ONE(state2, req) {
    const idx = state2.list.findIndex((r) => r.fromUser === req.fromUser && r.groupId === req.groupId);
    idx === -1 ? state2.list.push(req) : state2.list.splice(idx, 1, req);
  }
};
const actions = {
  async loadList({ commit, state: state2 }, { userId, force = false } = {}) {
    if (!force && Date.now() - state2.lastUpdate < 5 * 60 * 1e3)
      return;
    const res = await new Promise((resolve) => utils_socket.fetchGroupRequests());
    commit("SET_LIST", res.requests || []);
  },
  // 被 App.vue 网关调用
  addRequest({ commit }, req) {
    commit("ADD_ONE", req);
  }
};
const groupRequests = { namespaced: true, state, mutations, actions };
exports.groupRequests = groupRequests;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/store/modules/groupRequests.js.map
