import {fetchGroups} from "../../utils/socket.js";

const state = {
    list: [],               // 群聊数组
    lastUpdate: 0
}

const mutations = {
    SET_GROUPS(state, arr) {
        state.list = arr
        state.lastUpdate = Date.now()
    },
    ADD_GROUP(state, g) {
        // 幂等：存在更新，不存在 push
        const idx = state.list.findIndex(i => i.groupId === g.groupId)
        idx === -1 ? state.list.push(g) : state.list.splice(idx, 1, g)
    },
    DEL_GROUP(state, groupId) {
        state.list = state.list.filter(i => i.groupId !== groupId)
    },
    // ===== 新增：创建/被拉入群 =====
    MERGE_GROUP(state, g) {
        // 幂等：存在更新，不存在 unshift 到最前面
        const idx = state.list.findIndex(i => i.groupId === g.groupId)
        idx === -1 ? state.list.unshift(g) : state.list.splice(idx, 1, { ...state.list[idx], ...g })
    }

}

const actions = {
    async loadGroups({ commit, state }, force = false) {
        if (!force && Date.now() - state.lastUpdate < 5 * 60 * 1000) return
        // 调用你原来的 fetchGroups（Promise 包装一下）
        await new Promise(resolve => {
            fetchGroups(res => {
                commit('SET_GROUPS', res.groups || [])
                resolve()
            })
        })
    },

    mergeGroup({ commit }, g) {
        commit('MERGE_GROUP', g)
    }
}

export default { namespaced: true, state, mutations, actions }