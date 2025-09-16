import {fetchFriends} from "../../utils/socket.js";

const state = {
    list: [],
    lastUpdate: 0
}

const mutations = {
    SET_FRIENDS(state, arr) {
        state.list = arr
        state.lastUpdate = Date.now()
    }
}

const actions = {
    async loadFriends({ commit, state }, force = false) {
        if (!force && Date.now() - state.lastUpdate < 5 * 60 * 1000) return
        const res = await new Promise(resolve => {
            fetchFriends(resolve)   // 你的原函数
        })
        commit('SET_FRIENDS', res.friends || [])
    }
}

export default { namespaced: true, state, mutations, actions }