"use strict";
const utils_socket = require("../../utils/socket.js");
const state = {
  list: [],
  lastUpdate: 0
};
const mutations = {
  SET_FRIENDS(state2, arr) {
    state2.list = arr;
    state2.lastUpdate = Date.now();
  }
};
const actions = {
  async loadFriends({ commit, state: state2 }, force = false) {
    if (!force && Date.now() - state2.lastUpdate < 5 * 60 * 1e3)
      return;
    const res = await new Promise((resolve) => {
      utils_socket.fetchFriends(resolve);
    });
    commit("SET_FRIENDS", res.friends || []);
  }
};
const friends = { namespaced: true, state, mutations, actions };
exports.friends = friends;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/store/modules/friends.js.map
