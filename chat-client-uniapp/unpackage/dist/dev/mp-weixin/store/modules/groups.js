"use strict";
const utils_socket = require("../../utils/socket.js");
const state = {
  list: [],
  // 群聊数组
  lastUpdate: 0
};
const mutations = {
  SET_GROUPS(state2, arr) {
    state2.list = arr;
    state2.lastUpdate = Date.now();
  },
  ADD_GROUP(state2, g) {
    const idx = state2.list.findIndex((i) => i.groupId === g.groupId);
    idx === -1 ? state2.list.push(g) : state2.list.splice(idx, 1, g);
  },
  DEL_GROUP(state2, groupId) {
    state2.list = state2.list.filter((i) => i.groupId !== groupId);
  },
  // ===== 新增：创建/被拉入群 =====
  MERGE_GROUP(state2, g) {
    const idx = state2.list.findIndex((i) => i.groupId === g.groupId);
    idx === -1 ? state2.list.unshift(g) : state2.list.splice(idx, 1, { ...state2.list[idx], ...g });
  }
};
const actions = {
  async loadGroups({ commit, state: state2 }, force = false) {
    if (!force && Date.now() - state2.lastUpdate < 5 * 60 * 1e3)
      return;
    await new Promise((resolve) => {
      utils_socket.fetchGroups((res) => {
        commit("SET_GROUPS", res.groups || []);
        resolve();
      });
    });
  },
  mergeGroup({ commit }, g) {
    commit("MERGE_GROUP", g);
  }
};
const groups = { namespaced: true, state, mutations, actions };
exports.groups = groups;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/store/modules/groups.js.map
