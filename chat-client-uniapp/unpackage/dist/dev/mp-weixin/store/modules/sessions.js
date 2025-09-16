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
  }
};
const actions = {
  async loadList({ commit, state: state2 }, { userId, force = false } = {}) {
    if (!force && Date.now() - state2.lastUpdate < 5 * 60 * 1e3)
      return;
    const res = await new Promise((resolve) => utils_socket.fetchSessions(resolve));
    commit("SET_LIST", (res.sessions || []).map((s) => ({
      ...s,
      hasUnread: (s.unread || 0) > 0 || (s.pendingFriendRequest || false)
    })));
  }
};
const sessions = { namespaced: true, state, mutations, actions };
exports.sessions = sessions;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/store/modules/sessions.js.map
